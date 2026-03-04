"""
Собственный SMTP-сервер: приём почты (порт 25) и Submission с аутентификацией (порт 587).
Без зависимостей от внешних сервисов — всё в одном процессе, БД и логика в приложении.
"""
import asyncio
import ssl
import tempfile
import os
from email import policy
from email.parser import BytesParser
from aiosmtpd.smtp import SMTP, AuthResult, LoginPassword
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from app.models import User, Email
from app.config import settings
from app.auth import verify_password
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def _get_sync_database_url() -> str:
    """URL для синхронного движка (SMTP auth вызывается из sync-контекста)."""
    if settings.DATABASE_URL_SYNC:
        return settings.DATABASE_URL_SYNC
    return settings.DATABASE_URL.replace("postgresql+asyncpg", "postgresql")


def _make_tls_context():
    """TLS-контекст для порта 587. Если сертификаты не заданы — self-signed для разработки."""
    if settings.SMTP_TLS_CERT_FILE and settings.SMTP_TLS_KEY_FILE:
        if os.path.isfile(settings.SMTP_TLS_CERT_FILE) and os.path.isfile(settings.SMTP_TLS_KEY_FILE):
            ctx = ssl.create_default_context(ssl.Purpose.CLIENT_AUTH)
            ctx.load_cert_chain(settings.SMTP_TLS_CERT_FILE, settings.SMTP_TLS_KEY_FILE)
            return ctx
    # Self-signed для разработки (клиенты могут ругаться, но подключение работает)
    try:
        import subprocess
        with tempfile.TemporaryDirectory() as d:
            cert = os.path.join(d, "cert.pem")
            key = os.path.join(d, "key.pem")
            subprocess.run(
                [
                    "openssl", "req", "-x509", "-newkey", "rsa:2048",
                    "-keyout", key, "-out", cert, "-days", "1",
                    "-nodes", "-subj", "/CN=localhost"
                ],
                capture_output=True,
                check=True,
                timeout=10,
            )
            ctx = ssl.create_default_context(ssl.Purpose.CLIENT_AUTH)
            ctx.load_cert_chain(cert, key)
            return ctx
    except Exception as e:
        logger.warning("Could not create self-signed TLS cert for 587: %s. Submission port will start without TLS.", e)
        return None


class CustomSMTPHandler:
    """Обработчик приёма писем (общий для портов 25 и 587)."""

    def __init__(self):
        self._async_engine = create_async_engine(
            settings.DATABASE_URL,
            echo=False,
            pool_pre_ping=True,
        )
        self._async_session_factory = async_sessionmaker(
            self._async_engine,
            class_=AsyncSession,
            expire_on_commit=False,
        )
        sync_url = _get_sync_database_url()
        self._sync_engine = create_engine(sync_url, pool_pre_ping=True)
        self._SyncSession = sessionmaker(self._sync_engine, class_=Session, expire_on_commit=False)

    def _authenticator(self, server, session, envelope, mechanism: str, auth_data):
        """Проверка логина/пароля для порта 587 (sync, т.к. вызывается из aiosmtpd)."""
        if not isinstance(auth_data, LoginPassword):
            return AuthResult(success=False)
        login = (auth_data.login or "").strip()
        password = auth_data.password or ""
        if not login or not password:
            return AuthResult(success=False)
        try:
            with self._SyncSession() as db:
                row = db.execute(select(User).where(User.email == login)).scalar_one_or_none()
                if not row or not row.is_active:
                    return AuthResult(success=False)
                if verify_password(password, row.hashed_password):
                    return AuthResult(success=True, auth_data=auth_data)
                return AuthResult(success=False)
        except Exception as e:
            logger.exception("Auth error for %s: %s", login, e)
            return AuthResult(success=False)

    async def handle_DATA(self, server, session, envelope):
        """Приём письма и сохранение в БД."""
        logger.info("Receiving email from %s to %s", envelope.mail_from, envelope.rcpt_tos)
        try:
            msg = BytesParser(policy=policy.default).parsebytes(envelope.content)
            subject = msg.get("subject", "No Subject")
            from_address = envelope.mail_from or ""
            body = ""
            html_body = ""
            if msg.is_multipart():
                for part in msg.walk():
                    ct = part.get_content_type()
                    if ct == "text/plain":
                        body = part.get_content() or ""
                    elif ct == "text/html":
                        html_body = part.get_content() or ""
            else:
                body = msg.get_content() or ""
            async with self._async_session_factory() as db:
                for to_address in envelope.rcpt_tos:
                    result = await db.execute(select(User).where(User.email == to_address))
                    user = result.scalar_one_or_none()
                    if user:
                        email_obj = Email(
                            user_id=user.id,
                            from_address=from_address,
                            to_address=to_address,
                            subject=subject,
                            body=body,
                            html_body=html_body,
                            is_sent=False,
                        )
                        db.add(email_obj)
                        await db.commit()
                        logger.info("Email saved for user %s", to_address)
                    else:
                        logger.warning("User not found: %s", to_address)
            return "250 OK"
        except Exception as e:
            logger.error("Error handling email: %s", e, exc_info=True)
            return "500 Error processing email"

    @property
    def engine(self):
        return self._async_engine


def _run_smtp_servers(handler, tls_ctx, loop):
    """В одном потоке поднимает два слушателя: 25 и 587."""
    host = settings.SMTP_HOST
    port_25 = settings.SMTP_PORT
    port_587 = settings.SMTP_SUBMISSION_PORT

    def factory_25():
        return SMTP(handler, hostname=host)

    def factory_587():
        return SMTP(
            handler,
            hostname=host,
            authenticator=handler._authenticator,
            require_starttls=(tls_ctx is not None),
            tls_context=tls_ctx,
        )

    async def run():
        server_25 = await loop.create_server(factory_25, host, port_25)
        server_587 = await loop.create_server(factory_587, host, port_587)
        logger.info("SMTP (receive) started on %s:%s", host, port_25)
        logger.info(
            "SMTP (submission) started on %s:%s (auth + %s)",
            host, port_587, "STARTTLS" if tls_ctx else "no TLS",
        )
        return server_25, server_587

    return loop.run_until_complete(run())


class SMTPServer:
    """Единый SMTP: порт 25 (приём) и порт 587 (Submission с auth + STARTTLS). Один поток, один loop."""

    def __init__(self):
        self._loop = None
        self._thread = None
        self._servers = ()  # (server_25, server_587)
        self.handler = None

    def start(self):
        import threading
        self._loop = asyncio.new_event_loop()
        self.handler = CustomSMTPHandler()
        tls_ctx = _make_tls_context()

        def thread_target():
            asyncio.set_event_loop(self._loop)
            self._servers = _run_smtp_servers(self.handler, tls_ctx, self._loop)
            self._loop.run_forever()

        self._thread = threading.Thread(target=thread_target, daemon=True)
        self._thread.start()

    async def cleanup(self):
        if self.handler and hasattr(self.handler, "_async_engine"):
            await self.handler._async_engine.dispose()
        if self.handler and hasattr(self.handler, "_sync_engine"):
            self.handler._sync_engine.dispose()

    def stop(self):
        if self._loop and self._servers:
            for s in self._servers:
                s.close()
            self._loop.call_soon_threadsafe(self._loop.stop)
            if self._thread:
                self._thread.join(timeout=5)
            logger.info("SMTP (25 and 587) stopped")


smtp_server = SMTPServer()
