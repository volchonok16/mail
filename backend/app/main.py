from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import timedelta
from typing import List, Optional
import io
import uuid

from app.database import get_db, engine, Base, AsyncSessionLocal
from app.models import User, Email, EmailTemplate
from app.schemas import (
    UserCreate,
    UserResponse,
    UserUpdate,
    UserAdminUpdate,
    LoginRequest,
    Token,
    EmailCreate,
    EmailResponse,
    EmailTemplateCreate,
    EmailTemplateUpdate,
    EmailTemplateResponse,
)
from app.auth import (
    verify_password, get_password_hash, create_access_token,
    get_current_user, get_current_admin_user
)
from app.config import settings
from app.smtp_server import smtp_server
from app.minio_client import minio_client
import smtplib
import httpx
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

app = FastAPI(title="Mail Server API")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    """Initialize database and create default admin"""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    # Create default admin
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.email == settings.DEFAULT_ADMIN_EMAIL))
        admin = result.scalar_one_or_none()
        
        if not admin:
            admin = User(
                email=settings.DEFAULT_ADMIN_EMAIL,
                username="admin",
                full_name="Administrator",
                hashed_password=get_password_hash(settings.DEFAULT_ADMIN_PASSWORD),
                is_admin=True,
                is_active=True
            )
            db.add(admin)
            await db.commit()
            print(f"Default admin created: {settings.DEFAULT_ADMIN_EMAIL}")
    
    # Start SMTP server
    smtp_server.start()

@app.on_event("shutdown")
async def shutdown_event():
    """Stop SMTP server"""
    smtp_server.stop()
    await smtp_server.cleanup()

# Auth endpoints
@app.post("/api/auth/login", response_model=Token)
async def login(login_data: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Login user"""
    result = await db.execute(select(User).where(User.email == login_data.email))
    user = result.scalar_one_or_none()
    
    if not user or not verify_password(login_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is inactive"
        )
    
    access_token = create_access_token(data={"sub": user.email})
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/api/auth/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """Get current user info"""
    return current_user

# Admin endpoints
@app.post("/api/admin/users", response_model=UserResponse)
async def create_user(
    user_data: UserCreate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin_user)
):
    """Create new user (admin only)"""
    # Check if user already exists
    result = await db.execute(
        select(User).where(
            (User.email == f"{user_data.username}@{settings.MAIL_DOMAIN}") |
            (User.username == user_data.username)
        )
    )
    existing_user = result.scalar_one_or_none()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User already exists"
        )
    
    email = f"{user_data.username}@{settings.MAIL_DOMAIN}"
    user = User(
        email=email,
        username=user_data.username,
        full_name=user_data.full_name,
        phone=user_data.phone,
        hashed_password=get_password_hash(user_data.password),
        is_admin=False,
        is_active=True
    )
    
    db.add(user)
    await db.commit()
    await db.refresh(user)
    
    return user

@app.get("/api/admin/users", response_model=List[UserResponse])
async def list_users(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin_user)
):
    """List all users (admin only)"""
    result = await db.execute(select(User))
    users = result.scalars().all()
    return users

@app.delete("/api/admin/users/{user_id}")
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin_user)
):
    """Delete user (admin only)"""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.is_admin:
        raise HTTPException(status_code=400, detail="Cannot delete admin user")
    
    await db.delete(user)
    await db.commit()
    
    return {"message": "User deleted successfully"}

@app.put("/api/admin/users/{user_id}", response_model=UserResponse)
async def update_user_by_admin(
    user_id: int,
    user_data: UserAdminUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin_user)
):
    """Update user (admin only) - can edit all fields including admin status"""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Update fields if provided
    if user_data.full_name is not None:
        user.full_name = user_data.full_name
    if user_data.phone is not None:
        user.phone = user_data.phone
    if user_data.password is not None:
        user.hashed_password = get_password_hash(user_data.password)
    if user_data.is_admin is not None:
        # Prevent removing admin from yourself
        if user.id == admin.id and user_data.is_admin == False:
            raise HTTPException(
                status_code=400, 
                detail="Cannot remove admin privileges from yourself"
            )
        user.is_admin = user_data.is_admin
    if user_data.is_active is not None:
        user.is_active = user_data.is_active
    
    await db.commit()
    await db.refresh(user)
    
    return user

@app.post("/api/admin/users/{user_id}/make-admin")
async def make_user_admin(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin_user)
):
    """Make user an admin (admin only)"""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.is_admin:
        raise HTTPException(status_code=400, detail="User is already an admin")
    
    user.is_admin = True
    await db.commit()
    await db.refresh(user)
    
    return {"message": f"User {user.email} is now an admin", "user": user}

@app.post("/api/admin/users/{user_id}/remove-admin")
async def remove_user_admin(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin_user)
):
    """Remove admin privileges from user (admin only)"""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if not user.is_admin:
        raise HTTPException(status_code=400, detail="User is not an admin")
    
    # Prevent removing admin from yourself
    if user.id == admin.id:
        raise HTTPException(
            status_code=400, 
            detail="Cannot remove admin privileges from yourself"
        )
    
    user.is_admin = False
    await db.commit()
    await db.refresh(user)
    
    return {"message": f"Admin privileges removed from {user.email}", "user": user}

# User profile endpoints
@app.put("/api/profile", response_model=UserResponse)
async def update_profile(
    user_data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update user profile"""
    if user_data.full_name:
        current_user.full_name = user_data.full_name
    if user_data.phone:
        current_user.phone = user_data.phone
    if user_data.password:
        current_user.hashed_password = get_password_hash(user_data.password)
    
    await db.commit()
    await db.refresh(current_user)
    
    return current_user

@app.post("/api/profile/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Upload user avatar"""
    # Validate file type
    if not file.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    # Generate unique filename
    file_extension = file.filename.split('.')[-1]
    file_name = f"{current_user.username}_{uuid.uuid4()}.{file_extension}"
    
    # Upload to MinIO
    file_data = await file.read()
    file_stream = io.BytesIO(file_data)
    
    avatar_url = minio_client.upload_file(file_stream, file_name, file.content_type)
    
    # Update user
    current_user.avatar_url = avatar_url
    await db.commit()
    
    return {"avatar_url": avatar_url}

# Email endpoints
@app.post("/api/emails/send")
async def send_email(
    email_data: EmailCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Send email"""
    # Create email message
    msg = MIMEMultipart('alternative')
    msg['From'] = current_user.email
    msg['To'] = email_data.to_address
    msg['Subject'] = email_data.subject
    
    # Add text body
    text_part = MIMEText(email_data.body, 'plain')
    msg.attach(text_part)
    
    # Add HTML body if provided
    if email_data.html_body:
        html_part = MIMEText(email_data.html_body, 'html')
        msg.attach(html_part)
    
    # Save to database as sent
    email_obj = Email(
        user_id=current_user.id,
        from_address=current_user.email,
        to_address=email_data.to_address,
        subject=email_data.subject,
        body=email_data.body,
        html_body=email_data.html_body,
        is_sent=True
    )
    db.add(email_obj)
    await db.commit()
    
    # Send email
    print(f"[EMAIL] Starting send process: from={current_user.email}, to={email_data.to_address}")
    try:
        # Определяем домен получателя
        recipient_domain = email_data.to_address.split('@')[1] if '@' in email_data.to_address else None
        
        if not recipient_domain:
            raise HTTPException(status_code=400, detail="Invalid recipient email address")
        
        print(f"[EMAIL] Recipient domain: {recipient_domain}, Mail domain: {settings.MAIL_DOMAIN}")
        print(f"[EMAIL] SMTP_RELAY_ENABLED: {settings.SMTP_RELAY_ENABLED}, SMTP_RELAY_HOST: {settings.SMTP_RELAY_HOST}")
        
        # Если настроен SMTP Relay - используем его для всех внешних доменов
        if recipient_domain != settings.MAIL_DOMAIN.replace('@', '') and settings.SMTP_RELAY_ENABLED and settings.SMTP_RELAY_HOST:
            # SendGrid: предпочитаем HTTP API (порт 443), т.к. на сервере часто блокируют исходящий 587
            use_sendgrid_api = (
                settings.SENDGRID_USE_API
                and settings.SMTP_RELAY_HOST and "sendgrid" in settings.SMTP_RELAY_HOST.lower()
                and settings.SMTP_RELAY_PASSWORD
            )
            if use_sendgrid_api:
                print(f"[EMAIL] Sending via SendGrid API (HTTPS) to {email_data.to_address}")
                try:
                    payload = {
                        "personalizations": [{"to": [{"email": email_data.to_address}]}],
                        "from": {"email": current_user.email, "name": current_user.full_name or current_user.email},
                        "subject": email_data.subject,
                        "content": [{"type": "text/plain", "value": email_data.body or ""}],
                    }
                    if email_data.html_body:
                        payload["content"].append({"type": "text/html", "value": email_data.html_body})
                    async with httpx.AsyncClient(timeout=30.0) as client:
                        r = await client.post(
                            "https://api.sendgrid.com/v3/mail/send",
                            json=payload,
                            headers={
                                "Authorization": f"Bearer {settings.SMTP_RELAY_PASSWORD}",
                                "Content-Type": "application/json",
                            },
                        )
                    if r.status_code >= 400:
                        raise Exception(f"SendGrid API {r.status_code}: {r.text}")
                    print(f"[EMAIL] Successfully sent via SendGrid API to {email_data.to_address}")
                except Exception as api_err:
                    print(f"[EMAIL] SendGrid API error: {api_err}")
                    raise
            else:
                # Отправка через SMTP Relay
                print(f"[EMAIL] Sending via SMTP Relay to {email_data.to_address}")
                print(f"[EMAIL] Relay config: {settings.SMTP_RELAY_HOST}:{settings.SMTP_RELAY_PORT}, user: {settings.SMTP_RELAY_USER}")
                try:
                    with smtplib.SMTP(settings.SMTP_RELAY_HOST, settings.SMTP_RELAY_PORT) as smtp:
                        if settings.SMTP_RELAY_USE_TLS:
                            smtp.starttls()
                        if settings.SMTP_RELAY_USER and settings.SMTP_RELAY_PASSWORD:
                            smtp.login(settings.SMTP_RELAY_USER, settings.SMTP_RELAY_PASSWORD)
                        smtp.send_message(msg)
                        print(f"[EMAIL] Successfully sent via SMTP Relay to {email_data.to_address}")
                except Exception as relay_error:
                    print(f"[EMAIL] SMTP Relay error: {relay_error}")
                    raise
        else:
            print(f"[EMAIL] Using direct SMTP (not using relay). Reason: domain={recipient_domain}, mail_domain={settings.MAIL_DOMAIN}, relay_enabled={settings.SMTP_RELAY_ENABLED}, relay_host={settings.SMTP_RELAY_HOST}")
            # Прямая отправка через DNS MX lookup
            # Работает для внутренних доменов и всех внешних (если настроены DNS)
            import dns.resolver
            
            try:
                # Получаем MX записи для домена получателя
                mx_records = dns.resolver.resolve(recipient_domain, 'MX')
                mx_records = sorted(mx_records, key=lambda r: r.preference)
                
                # Пробуем отправить через первый доступный MX сервер
                sent = False
                for mx in mx_records:
                    mx_host = str(mx.exchange).rstrip('.')
                    try:
                        with smtplib.SMTP(mx_host, 25, timeout=30) as smtp:
                            smtp.send_message(msg)
                        sent = True
                        break
                    except Exception as mx_error:
                        print(f"Failed to send via {mx_host}: {mx_error}")
                        continue
                
                if not sent:
                    raise Exception("All MX servers failed")
                    
            except dns.resolver.NXDOMAIN:
                raise HTTPException(status_code=400, detail=f"Domain {recipient_domain} does not exist")
            except dns.resolver.NoAnswer:
                raise HTTPException(status_code=400, detail=f"No MX records found for {recipient_domain}")
            except Exception as dns_error:
                # Fallback для локальных доменов
                if recipient_domain == settings.MAIL_DOMAIN.replace('@', ''):
                    with smtplib.SMTP('localhost', settings.SMTP_PORT) as smtp:
                        smtp.send_message(msg)
                else:
                    raise HTTPException(
                        status_code=500,
                        detail=f"Failed to send email: {str(dns_error)}"
                    )
    except HTTPException:
        raise
    except Exception as e:
        print(f"Could not send email: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to send email: {str(e)}"
        )
    
    return {"message": "Email sent successfully", "email_id": email_obj.id}


@app.get("/api/templates", response_model=List[EmailTemplateResponse])
async def list_templates(
    template_type: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List email templates for current user (optionally filtered by type)"""
    query = select(EmailTemplate).where(EmailTemplate.user_id == current_user.id)
    if template_type:
        query = query.where(EmailTemplate.type == template_type)

    result = await db.execute(query.order_by(EmailTemplate.created_at.desc()))
    templates = result.scalars().all()
    return templates


@app.post("/api/templates", response_model=EmailTemplateResponse)
async def create_template(
    template_data: EmailTemplateCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new email template for current user"""
    template = EmailTemplate(
        user_id=current_user.id,
        name=template_data.name,
        type=template_data.type,
        description=template_data.description,
        html_content=template_data.html_content,
    )
    db.add(template)
    await db.commit()
    await db.refresh(template)
    return template


@app.put("/api/templates/{template_id}", response_model=EmailTemplateResponse)
async def update_template(
    template_id: int,
    template_data: EmailTemplateUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update existing email template (only owner can edit)"""
    result = await db.execute(
        select(EmailTemplate).where(
            EmailTemplate.id == template_id,
            EmailTemplate.user_id == current_user.id,
        )
    )
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    if template_data.name is not None:
        template.name = template_data.name
    if template_data.type is not None:
        template.type = template_data.type
    if template_data.description is not None:
        template.description = template_data.description
    if template_data.html_content is not None:
        template.html_content = template_data.html_content

    await db.commit()
    await db.refresh(template)
    return template


@app.delete("/api/templates/{template_id}")
async def delete_template(
    template_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete email template (only owner can delete)"""
    result = await db.execute(
        select(EmailTemplate).where(
            EmailTemplate.id == template_id,
            EmailTemplate.user_id == current_user.id,
        )
    )
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    await db.delete(template)
    await db.commit()
    return {"message": "Template deleted successfully"}

@app.get("/api/emails/inbox", response_model=List[EmailResponse])
async def get_inbox(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get user inbox"""
    result = await db.execute(
        select(Email)
        .where(Email.user_id == current_user.id, Email.is_sent == False)
        .order_by(Email.received_at.desc())
    )
    emails = result.scalars().all()
    return emails

@app.get("/api/emails/sent", response_model=List[EmailResponse])
async def get_sent(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get sent emails"""
    result = await db.execute(
        select(Email)
        .where(Email.user_id == current_user.id, Email.is_sent == True)
        .order_by(Email.received_at.desc())
    )
    emails = result.scalars().all()
    return emails

@app.get("/api/emails/{email_id}", response_model=EmailResponse)
async def get_email(
    email_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get email by ID"""
    result = await db.execute(
        select(Email).where(Email.id == email_id, Email.user_id == current_user.id)
    )
    email = result.scalar_one_or_none()
    
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
    
    # Mark as read
    if not email.is_read and not email.is_sent:
        email.is_read = True
        await db.commit()
    
    return email

@app.delete("/api/emails/{email_id}")
async def delete_email(
    email_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete email"""
    result = await db.execute(
        select(Email).where(Email.id == email_id, Email.user_id == current_user.id)
    )
    email = result.scalar_one_or_none()
    
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
    
    await db.delete(email)
    await db.commit()
    
    return {"message": "Email deleted successfully"}

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

