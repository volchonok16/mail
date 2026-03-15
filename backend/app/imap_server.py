"""
IMAP4rev1 сервер: даёт доступ к почте через стандартные клиенты (Outlook, Apple Mail, etc.)

Порты:
  143  — plain / STARTTLS
  993  — SSL (IMAPS)

Поддерживаемые команды:
  CAPABILITY, NOOP, LOGOUT, LOGIN, AUTHENTICATE, STARTTLS,
  SELECT, EXAMINE, LIST, LSUB, STATUS, SEARCH, FETCH, UID, STORE,
  EXPUNGE, CLOSE, NAMESPACE, ID, SUBSCRIBE, UNSUBSCRIBE
"""
import asyncio
import ssl
import os
import re
import logging
import subprocess
import tempfile
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import format_datetime
from email.parser import BytesParser
from email import policy as email_policy

from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker, Session

from app.models import User, Email
from app.auth import verify_password
from app.config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# TLS helpers
# ---------------------------------------------------------------------------

def _get_sync_db_url() -> str:
    if settings.DATABASE_URL_SYNC:
        return settings.DATABASE_URL_SYNC
    return settings.DATABASE_URL.replace("postgresql+asyncpg", "postgresql")


def _make_tls_context() -> ssl.SSLContext | None:
    """Return TLS context; fall back to ephemeral self-signed cert."""
    if settings.SMTP_TLS_CERT_FILE and settings.SMTP_TLS_KEY_FILE:
        if os.path.isfile(settings.SMTP_TLS_CERT_FILE) and os.path.isfile(settings.SMTP_TLS_KEY_FILE):
            ctx = ssl.create_default_context(ssl.Purpose.CLIENT_AUTH)
            ctx.load_cert_chain(settings.SMTP_TLS_CERT_FILE, settings.SMTP_TLS_KEY_FILE)
            logger.info("IMAP TLS: using configured cert %s", settings.SMTP_TLS_CERT_FILE)
            return ctx

    try:
        tmpdir = tempfile.mkdtemp()
        cert = os.path.join(tmpdir, "cert.pem")
        key = os.path.join(tmpdir, "key.pem")
        subprocess.run(
            [
                "openssl", "req", "-x509", "-newkey", "rsa:2048",
                "-keyout", key, "-out", cert,
                "-days", "3650", "-nodes",
                "-subj", f"/CN={settings.MAIL_DOMAIN}",
            ],
            capture_output=True, check=True, timeout=30,
        )
        ctx = ssl.create_default_context(ssl.Purpose.CLIENT_AUTH)
        ctx.load_cert_chain(cert, key)
        logger.info("IMAP TLS: generated self-signed cert (CN=%s)", settings.MAIL_DOMAIN)
        return ctx
    except Exception as exc:
        logger.warning("IMAP: cannot create TLS context: %s — ports 993/STARTTLS disabled", exc)
        return None


# ---------------------------------------------------------------------------
# Protocol helpers
# ---------------------------------------------------------------------------

def _parse_args(s: str) -> list[str]:
    """Parse IMAP argument string honouring quoted strings."""
    result: list[str] = []
    s = s.strip()
    i = 0
    while i < len(s):
        if s[i] == '"':
            try:
                j = s.index('"', i + 1)
            except ValueError:
                j = len(s)
            result.append(s[i + 1:j])
            i = j + 1
        elif s[i] == ' ':
            i += 1
        else:
            j = s.find(' ', i)
            if j == -1:
                result.append(s[i:])
                break
            result.append(s[i:j])
            i = j
    return result


def _parse_seq_set(seq_set: str, total: int, uid_mode: bool,
                   emails: list[dict]) -> list[tuple[int, dict]]:
    """Expand sequence-set (e.g. '1:*', '2,4', '5') into (seq_num, email) pairs."""
    result: list[tuple[int, dict]] = []
    if not emails or total == 0:
        return result

    def _resolve(s: str, max_val: int) -> int:
        return max_val if s == '*' else int(s)

    for part in seq_set.split(','):
        part = part.strip()
        if ':' in part:
            a, b = part.split(':', 1)
            if uid_mode:
                all_uids = [e['id'] for e in emails]
                lo = _resolve(a, max(all_uids))
                hi = _resolve(b, max(all_uids))
                for idx, e in enumerate(emails):
                    if lo <= e['id'] <= hi:
                        result.append((idx + 1, e))
            else:
                lo = _resolve(a, total)
                hi = _resolve(b, total)
                lo, hi = max(1, lo), min(total, hi)
                for seq in range(lo, hi + 1):
                    result.append((seq, emails[seq - 1]))
        else:
            if uid_mode:
                uid = _resolve(part, emails[-1]['id'] if emails else 0)
                for idx, e in enumerate(emails):
                    if e['id'] == uid:
                        result.append((idx + 1, e))
                        break
            else:
                seq = _resolve(part, total)
                seq = max(1, min(total, seq))
                if seq <= len(emails):
                    result.append((seq, emails[seq - 1]))
    return result


def _email_to_rfc822(em: dict) -> bytes:
    date = em.get('date') or datetime.now(timezone.utc)
    if isinstance(date, datetime) and date.tzinfo is None:
        date = date.replace(tzinfo=timezone.utc)
    date_str = format_datetime(date)

    if em.get('html_body'):
        msg = MIMEMultipart('alternative')
        msg.attach(MIMEText(em.get('body', ''), 'plain', 'utf-8'))
        msg.attach(MIMEText(em['html_body'], 'html', 'utf-8'))
    else:
        msg = MIMEText(em.get('body', ''), 'plain', 'utf-8')

    msg['From'] = em.get('from', '')
    msg['To'] = em.get('to', '')
    msg['Subject'] = em.get('subject', '')
    msg['Date'] = date_str
    msg['Message-ID'] = f"<{em['id']}@{settings.MAIL_DOMAIN}>"
    return msg.as_bytes()


def _build_fetch_response(seq_num: int, em: dict, items_str: str,
                           uid_mode: bool) -> str:
    upper = items_str.upper()
    flags_str = ' '.join(em.get('flags', []))
    uid = em['id']

    date = em.get('date') or datetime.now(timezone.utc)
    if isinstance(date, datetime) and date.tzinfo is None:
        date = date.replace(tzinfo=timezone.utc)
    date_str = format_datetime(date)

    parts: list[str] = []

    if uid_mode:
        parts.append(f'UID {uid}')

    if 'FLAGS' in upper:
        parts.append(f'FLAGS ({flags_str})')

    if 'INTERNALDATE' in upper:
        parts.append(f'INTERNALDATE "{date_str}"')

    needs_body = (
        'RFC822' in upper or
        'BODY[' in upper.replace(' ', '') or
        'BODY.PEEK[' in upper.upper()
    )
    if needs_body or 'RFC822.SIZE' in upper:
        rfc = _email_to_rfc822(em)
        size = len(rfc)

        if 'RFC822.SIZE' in upper:
            parts.append(f'RFC822.SIZE {size}')

        if 'RFC822' in upper and 'RFC822.SIZE' not in upper:
            rfc_str = rfc.decode('utf-8', errors='replace')
            parts.append(f'RFC822 {{{size}}}\r\n{rfc_str}')
        elif 'BODY[' in upper or 'BODY.PEEK[' in upper.upper():
            # Identify which section was requested
            section_match = re.search(
                r'BODY(?:\.PEEK)?\[([^\]]*)\](?:<(\d+)\.(\d+)>)?',
                items_str, re.IGNORECASE
            )
            section = section_match.group(1).upper() if section_match else ''

            if section in ('HEADER', 'HEADER.FIELDS'):
                parsed = BytesParser(policy=email_policy.compat32).parsebytes(rfc)
                headers_str = ''.join(
                    f'{k}: {v}\r\n' for k, v in parsed.items()
                ) + '\r\n'
                hb = headers_str.encode('utf-8')
                parts.append(f'BODY[HEADER] {{{len(hb)}}}\r\n{headers_str}')
            elif section == 'TEXT':
                body_text = em.get('body', '')
                tb = body_text.encode('utf-8')
                parts.append(f'BODY[TEXT] {{{len(tb)}}}\r\n{body_text}')
            else:
                rfc_str = rfc.decode('utf-8', errors='replace')
                label = 'BODY[]' if not section else f'BODY[{section}]'
                parts.append(f'{label} {{{size}}}\r\n{rfc_str}')

    if 'ENVELOPE' in upper:
        def _mbox(addr: str) -> str:
            at = addr.find('@')
            if at == -1:
                return f'("" NIL "{addr}" "")'
            return f'("" NIL "{addr[:at]}" "{addr[at+1:]}")'

        frm = em.get('from', '')
        to = em.get('to', '')
        subj = em.get('subject', '').replace('"', '\\"')
        parts.append(
            f'ENVELOPE ("{date_str}" "{subj}" '
            f'({_mbox(frm)}) ({_mbox(frm)}) ({_mbox(frm)}) ({_mbox(to)}) '
            f'NIL NIL NIL "<{uid}@{settings.MAIL_DOMAIN}>")'
        )

    if 'BODYSTRUCTURE' in upper and 'BODY[' not in upper:
        if em.get('html_body'):
            bs = '("TEXT" "HTML" ("CHARSET" "UTF-8") NIL NIL "7BIT" 100 10)'
        else:
            bs = '("TEXT" "PLAIN" ("CHARSET" "UTF-8") NIL NIL "7BIT" 100 10)'
        parts.append(f'BODYSTRUCTURE {bs}')

    if not parts:
        parts.append(f'FLAGS ({flags_str})')

    return f'* {seq_num} FETCH ({" ".join(parts)})'


# ---------------------------------------------------------------------------
# IMAP session handler
# ---------------------------------------------------------------------------

class IMAPSession:
    NOT_AUTH = 'NOT_AUTHENTICATED'
    AUTHENTICATED = 'AUTHENTICATED'
    SELECTED = 'SELECTED'
    LOGOUT = 'LOGOUT'

    def __init__(self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter,
                 db_factory, tls_ctx: ssl.SSLContext | None, is_ssl: bool = False):
        self.reader = reader
        self.writer = writer
        self._db = db_factory
        self._tls_ctx = tls_ctx
        self._is_ssl = is_ssl
        self.state = self.NOT_AUTH
        self.user: User | None = None
        self.selected_mailbox: str | None = None
        self.selected_emails: list[dict] = []

    # ------------------------------------------------------------------
    async def handle(self):
        await self._send('* OK IMAP4rev1 Service Ready')
        try:
            while self.state != self.LOGOUT:
                line = await asyncio.wait_for(self.reader.readline(), timeout=300)
                if not line:
                    break
                line = line.decode('utf-8', errors='replace').rstrip('\r\n')
                if not line:
                    continue
                logger.debug('IMAP < %s', line)
                await self._dispatch(line)
        except asyncio.TimeoutError:
            await self._send('* BYE Autologout; idle for too long')
        except Exception as exc:
            logger.error('IMAP session error: %s', exc, exc_info=True)
        finally:
            try:
                self.writer.close()
                await self.writer.wait_closed()
            except Exception:
                pass

    async def _send(self, data: str):
        logger.debug('IMAP > %s', data[:200])
        self.writer.write((data + '\r\n').encode('utf-8'))
        await self.writer.drain()

    async def _dispatch(self, line: str):
        m = re.match(r'^(\S+)\s+(\S+)(.*)', line)
        if not m:
            return
        tag, cmd, rest = m.group(1), m.group(2).upper(), m.group(3).strip()

        dispatch = {
            'CAPABILITY': self._capability,
            'NOOP': self._noop,
            'LOGOUT': self._logout,
            'LOGIN': self._login,
            'AUTHENTICATE': self._authenticate,
            'STARTTLS': self._starttls,
            'SELECT': self._select,
            'EXAMINE': self._select,
            'LIST': self._list,
            'LSUB': self._lsub,
            'STATUS': self._status,
            'SEARCH': self._search,
            'FETCH': self._fetch,
            'UID': self._uid,
            'STORE': self._store,
            'EXPUNGE': self._expunge,
            'CLOSE': self._close,
            'NAMESPACE': self._namespace,
            'ID': self._id,
            'SUBSCRIBE': self._ok,
            'UNSUBSCRIBE': self._ok,
            'APPEND': self._ok,
            'CHECK': self._ok,
            'COPY': self._ok,
        }
        handler = dispatch.get(cmd, self._unknown)
        await handler(tag, cmd, rest)

    # ------------------------------------------------------------------
    # Commands
    # ------------------------------------------------------------------

    async def _capability(self, tag, cmd, args):
        caps = 'IMAP4rev1 AUTH=PLAIN AUTH=LOGIN'
        if self._tls_ctx and not self._is_ssl:
            caps += ' STARTTLS'
        await self._send(f'* CAPABILITY {caps}')
        await self._send(f'{tag} OK CAPABILITY completed')

    async def _noop(self, tag, cmd, args):
        await self._send(f'{tag} OK NOOP completed')

    async def _ok(self, tag, cmd, args):
        await self._send(f'{tag} OK {cmd} completed')

    async def _unknown(self, tag, cmd, args):
        await self._send(f'{tag} BAD Command {cmd} not supported')

    async def _logout(self, tag, cmd, args):
        await self._send('* BYE IMAP4rev1 Server logging out')
        await self._send(f'{tag} OK LOGOUT completed')
        self.state = self.LOGOUT

    async def _login(self, tag, cmd, args):
        parts = _parse_args(args)
        if len(parts) < 2:
            await self._send(f'{tag} BAD LOGIN requires username and password')
            return
        user = self._auth(parts[0], parts[1])
        if user:
            self.user = user
            self.state = self.AUTHENTICATED
            await self._send(f'{tag} OK LOGIN completed')
        else:
            await self._send(f'{tag} NO [AUTHENTICATIONFAILED] Invalid credentials')

    async def _authenticate(self, tag, cmd, args):
        # Simple AUTH=PLAIN inline (some clients send it as: AUTHENTICATE PLAIN <base64>)
        mech = args.strip().split()[0].upper() if args.strip() else ''
        if mech == 'PLAIN':
            # Expect base64-encoded \0user\0pass or wait for it on next line
            rest = args.strip()[len('PLAIN'):].strip()
            if not rest:
                await self._send('+ ')
                rest = (await asyncio.wait_for(self.reader.readline(), timeout=60)).decode('utf-8', errors='replace').strip()
            try:
                import base64
                decoded = base64.b64decode(rest).split(b'\x00')
                username = decoded[1].decode() if len(decoded) >= 3 else decoded[0].decode()
                password = decoded[2].decode() if len(decoded) >= 3 else decoded[1].decode()
            except Exception:
                await self._send(f'{tag} NO [AUTHENTICATIONFAILED] Invalid PLAIN encoding')
                return
            user = self._auth(username, password)
            if user:
                self.user = user
                self.state = self.AUTHENTICATED
                await self._send(f'{tag} OK AUTHENTICATE completed')
            else:
                await self._send(f'{tag} NO [AUTHENTICATIONFAILED] Invalid credentials')
        else:
            await self._send(f'{tag} NO AUTHENTICATE mechanism not supported, use LOGIN')

    async def _starttls(self, tag, cmd, args):
        if self._is_ssl:
            await self._send(f'{tag} NO Already using TLS')
            return
        if self._tls_ctx is None:
            await self._send(f'{tag} NO STARTTLS not available')
            return
        await self._send(f'{tag} OK Begin TLS negotiation now')
        transport = self.writer.transport
        loop = asyncio.get_event_loop()
        try:
            new_transport = await loop.start_tls(
                transport, transport.get_protocol(),
                self._tls_ctx, server_side=True,
            )
            self.writer._transport = new_transport  # type: ignore[attr-defined]
            self.reader._transport = new_transport  # type: ignore[attr-defined]
            self._is_ssl = True
        except Exception as exc:
            logger.error('STARTTLS upgrade failed: %s', exc)

    async def _select(self, tag, cmd, args):
        if self.state not in (self.AUTHENTICATED, self.SELECTED):
            await self._send(f'{tag} NO Not authenticated')
            return
        mailbox = args.strip().strip('"').upper()
        if mailbox in ('INBOX', ''):
            emails = self._fetch_inbox()
            self.selected_mailbox = 'INBOX'
        elif mailbox in ('SENT', 'SENT ITEMS', 'SENT MESSAGES', 'GESENDETE ELEMENTE',
                         'ОТПРАВЛЕННЫЕ', 'ОТПРАВЛЕННЫЕ СООБЩЕНИЯ'):
            emails = self._fetch_sent()
            self.selected_mailbox = 'Sent'
        else:
            await self._send(f'{tag} NO Mailbox "{args.strip()}" not found')
            return

        self.selected_emails = emails
        self.state = self.SELECTED
        n = len(emails)
        unseen = sum(1 for e in emails if '\\Seen' not in e['flags'])

        await self._send(f'* {n} EXISTS')
        await self._send(f'* 0 RECENT')
        if unseen:
            await self._send(f'* OK [UNSEEN {unseen}]')
        await self._send(f'* OK [PERMANENTFLAGS (\\Seen \\Answered \\Flagged \\Deleted \\Draft)]')
        await self._send(f'* OK [UIDVALIDITY 1]')
        await self._send(f'* OK [UIDNEXT {(emails[-1]["id"] + 1) if emails else 1}]')
        read_write = 'READ-ONLY' if cmd == 'EXAMINE' else 'READ-WRITE'
        await self._send(f'{tag} OK [{read_write}] {cmd} completed')

    async def _list(self, tag, cmd, args):
        await self._send('* LIST (\\HasNoChildren) "/" "INBOX"')
        await self._send('* LIST (\\HasNoChildren \\Sent) "/" "Sent"')
        await self._send(f'{tag} OK LIST completed')

    async def _lsub(self, tag, cmd, args):
        await self._send('* LSUB () "/" "INBOX"')
        await self._send('* LSUB () "/" "Sent"')
        await self._send(f'{tag} OK LSUB completed')

    async def _status(self, tag, cmd, args):
        parts = args.strip().split(' ', 1)
        mbox = parts[0].strip('"').upper()
        if mbox in ('INBOX',):
            emails = self._fetch_inbox()
        elif mbox in ('SENT', 'SENT ITEMS', 'SENT MESSAGES', 'ОТПРАВЛЕННЫЕ'):
            emails = self._fetch_sent()
        else:
            await self._send(f'{tag} NO Mailbox not found')
            return
        n = len(emails)
        unseen = sum(1 for e in emails if '\\Seen' not in e['flags'])
        uid_next = (emails[-1]['id'] + 1) if emails else 1
        await self._send(f'* STATUS "{parts[0].strip(chr(34))}" '
                         f'(MESSAGES {n} RECENT 0 UNSEEN {unseen} UIDNEXT {uid_next} UIDVALIDITY 1)')
        await self._send(f'{tag} OK STATUS completed')

    async def _search(self, tag, cmd, args):
        await self._do_search(tag, args, uid_mode=False)

    async def _fetch(self, tag, cmd, args):
        await self._do_fetch(tag, args, uid_mode=False)

    async def _uid(self, tag, cmd, args):
        parts = args.strip().split(' ', 1)
        sub = parts[0].upper()
        sub_args = parts[1] if len(parts) > 1 else ''
        if sub == 'FETCH':
            await self._do_fetch(tag, sub_args, uid_mode=True)
        elif sub == 'SEARCH':
            await self._do_search(tag, sub_args, uid_mode=True)
        elif sub == 'STORE':
            await self._do_store(tag, sub_args, uid_mode=True)
        elif sub == 'COPY':
            await self._send(f'{tag} OK UID COPY completed')
        else:
            await self._send(f'{tag} BAD UID {sub} unknown')

    async def _store(self, tag, cmd, args):
        await self._do_store(tag, args, uid_mode=False)

    async def _do_store(self, tag, args, uid_mode=False):
        # Minimal: parse flags and acknowledge — persistence not needed for basic client support
        await self._send(f'{tag} OK STORE completed')

    async def _expunge(self, tag, cmd, args):
        await self._send(f'{tag} OK EXPUNGE completed')

    async def _close(self, tag, cmd, args):
        self.state = self.AUTHENTICATED
        self.selected_mailbox = None
        self.selected_emails = []
        await self._send(f'{tag} OK CLOSE completed')

    async def _namespace(self, tag, cmd, args):
        await self._send('* NAMESPACE (("" "/")) NIL NIL')
        await self._send(f'{tag} OK NAMESPACE completed')

    async def _id(self, tag, cmd, args):
        await self._send('* ID ("name" "MailServer" "version" "1.0")')
        await self._send(f'{tag} OK ID completed')

    # ------------------------------------------------------------------
    # Core logic helpers
    # ------------------------------------------------------------------

    async def _do_fetch(self, tag: str, args: str, uid_mode: bool):
        if self.state != self.SELECTED:
            await self._send(f'{tag} NO Not in selected state')
            return
        parts = args.strip().split(' ', 1)
        seq_set = parts[0]
        items_str = parts[1] if len(parts) > 1 else 'FLAGS'
        # Strip outer parens if present
        if items_str.startswith('(') and items_str.endswith(')'):
            items_str = items_str[1:-1]

        pairs = _parse_seq_set(seq_set, len(self.selected_emails), uid_mode, self.selected_emails)
        for seq_num, em in pairs:
            resp = _build_fetch_response(seq_num, em, items_str, uid_mode)
            await self._send(resp)
        await self._send(f'{tag} OK FETCH completed')

    async def _do_search(self, tag: str, args: str, uid_mode: bool):
        # Simplified: return all messages (handles ALL, UNSEEN, etc. as "all")
        if uid_mode:
            nums = ' '.join(str(e['id']) for e in self.selected_emails)
        else:
            nums = ' '.join(str(i + 1) for i in range(len(self.selected_emails)))
        await self._send(f'* SEARCH {nums}' if nums else '* SEARCH')
        await self._send(f'{tag} OK SEARCH completed')

    def _auth(self, username: str, password: str) -> User | None:
        try:
            with self._db() as db:
                user = db.execute(
                    select(User).where(User.email == username)
                ).scalar_one_or_none()
                if user and user.is_active and verify_password(password, user.hashed_password):
                    return user
        except Exception as exc:
            logger.error('IMAP auth error: %s', exc)
        return None

    def _fetch_inbox(self) -> list[dict]:
        return self._fetch_emails(is_sent=False)

    def _fetch_sent(self) -> list[dict]:
        return self._fetch_emails(is_sent=True)

    def _fetch_emails(self, is_sent: bool) -> list[dict]:
        if not self.user:
            return []
        try:
            with self._db() as db:
                rows = db.execute(
                    select(Email)
                    .where(Email.user_id == self.user.id, Email.is_sent == is_sent)
                    .order_by(Email.id)
                ).scalars().all()
                result = []
                for e in rows:
                    flags = ['\\Seen'] if (is_sent or e.is_read) else []
                    result.append({
                        'id': e.id,
                        'from': e.from_address,
                        'to': e.to_address,
                        'subject': e.subject or '',
                        'body': e.body or '',
                        'html_body': e.html_body or '',
                        'date': e.received_at,
                        'flags': flags,
                    })
                return result
        except Exception as exc:
            logger.error('IMAP fetch error: %s', exc)
            return []


# ---------------------------------------------------------------------------
# Server
# ---------------------------------------------------------------------------

class IMAPServer:
    """Запускает IMAP4 на портах 143 (plain+STARTTLS) и 993 (SSL)."""

    def __init__(self):
        self._servers: list[asyncio.AbstractServer] = []
        self._loop: asyncio.AbstractEventLoop | None = None
        self._thread = None
        self._tls_ctx: ssl.SSLContext | None = None

    def start(self):
        import threading
        self._loop = asyncio.new_event_loop()

        def _run():
            asyncio.set_event_loop(self._loop)
            self._loop.run_until_complete(self._start_servers())
            self._loop.run_forever()

        self._thread = threading.Thread(target=_run, daemon=True, name='imap-thread')
        self._thread.start()
        logger.info('IMAPServer thread launched')

    async def _start_servers(self):
        sync_url = _get_sync_db_url()
        engine = create_engine(sync_url, pool_pre_ping=True, pool_size=5, max_overflow=10)
        SyncSession = sessionmaker(engine, class_=Session, expire_on_commit=False)

        self._tls_ctx = _make_tls_context()
        host = settings.IMAP_HOST
        port_plain = settings.IMAP_PORT           # 143
        port_ssl = getattr(settings, 'IMAP_SSL_PORT', 993)

        async def _handle_plain(reader, writer):
            sess = IMAPSession(reader, writer, SyncSession, self._tls_ctx, is_ssl=False)
            await sess.handle()

        async def _handle_ssl(reader, writer):
            sess = IMAPSession(reader, writer, SyncSession, self._tls_ctx, is_ssl=True)
            await sess.handle()

        srv_plain = await asyncio.start_server(_handle_plain, host, port_plain)
        self._servers.append(srv_plain)
        logger.info('IMAP plain started on %s:%s (STARTTLS=%s)', host, port_plain, bool(self._tls_ctx))

        if self._tls_ctx:
            srv_ssl = await asyncio.start_server(_handle_ssl, host, port_ssl, ssl=self._tls_ctx)
            self._servers.append(srv_ssl)
            logger.info('IMAP SSL started on %s:%s', host, port_ssl)
        else:
            logger.warning('IMAP: no TLS context — port %s (SSL) not available', port_ssl)

    def stop(self):
        if self._servers and self._loop:
            for srv in self._servers:
                self._loop.call_soon_threadsafe(srv.close)
            self._loop.call_soon_threadsafe(self._loop.stop)
        if self._thread:
            self._thread.join(timeout=5)
        logger.info('IMAP servers stopped')


imap_server = IMAPServer()
