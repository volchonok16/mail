from pydantic import BaseModel, EmailStr, validator
from typing import Optional
from datetime import datetime

class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    phone: Optional[str] = None

class UserCreate(BaseModel):
    full_name: str
    username: str
    phone: Optional[str] = None
    password: str

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    password: Optional[str] = None

class UserAdminUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    password: Optional[str] = None
    is_admin: Optional[bool] = None
    is_active: Optional[bool] = None

class UserResponse(BaseModel):
    id: int
    email: str
    username: str
    full_name: str
    phone: Optional[str]
    avatar_url: Optional[str]
    is_admin: bool
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

class LoginRequest(BaseModel):
    email: str
    password: str

class EmailCreate(BaseModel):
    to_address: str
    subject: str
    body: str
    html_body: Optional[str] = None

class EmailResponse(BaseModel):
    id: int
    from_address: str
    to_address: str
    subject: Optional[str]
    body: Optional[str]
    html_body: Optional[str]
    is_read: bool
    is_sent: bool
    received_at: datetime
    
    class Config:
        from_attributes = True

