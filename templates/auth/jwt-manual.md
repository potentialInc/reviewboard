# Manual JWT Authentication Template

## When to Use

- Custom backends (FastAPI, Express, Go, Rust)
- Full control over auth flow needed
- No third-party auth dependency desired

## Stack Variants

| Backend | Library | Hash Library |
|---------|---------|-------------|
| FastAPI | `python-jose`, `passlib` | bcrypt |
| Express | `jsonwebtoken` | bcryptjs |
| Go | `golang-jwt/jwt` | `golang.org/x/crypto/bcrypt` |
| Rust | `jsonwebtoken` | `argon2` |

## File Structure (FastAPI Example)

```
src/
├── types/
│   └── auth.py              # Token/User schemas (Pydantic)
├── config/
│   └── auth.py              # JWT settings, secret key
├── repo/
│   └── user_repo.py         # User CRUD
├── service/
│   └── auth_service.py      # Login, register, token logic
└── runtime/
    ├── deps.py              # get_current_user dependency
    └── routes/
        └── auth.py          # /auth/login, /auth/register
```

## FastAPI Implementation

### Types (`src/types/auth.py`)

```python
from pydantic import BaseModel, EmailStr

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class TokenPayload(BaseModel):
    sub: str
    exp: int
    role: str = "user"
```

### Config (`src/config/auth.py`)

```python
from pydantic_settings import BaseSettings

class AuthSettings(BaseSettings):
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7

    class Config:
        env_prefix = "AUTH_"

auth_settings = AuthSettings()
```

### Service (`src/service/auth_service.py`)

```python
from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError
from passlib.context import CryptContext
from src.config.auth import auth_settings
from src.types.auth import TokenPayload

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def create_access_token(user_id: str, role: str = "user") -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=auth_settings.access_token_expire_minutes
    )
    payload = {"sub": user_id, "exp": expire, "role": role}
    return jwt.encode(payload, auth_settings.secret_key, auth_settings.algorithm)

def create_refresh_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        days=auth_settings.refresh_token_expire_days
    )
    payload = {"sub": user_id, "exp": expire, "type": "refresh"}
    return jwt.encode(payload, auth_settings.secret_key, auth_settings.algorithm)

def decode_token(token: str) -> TokenPayload:
    try:
        payload = jwt.decode(
            token, auth_settings.secret_key, algorithms=[auth_settings.algorithm]
        )
        return TokenPayload(**payload)
    except JWTError as e:
        raise ValueError(f"Invalid token: {e}")
```

### Dependency (`src/runtime/deps.py`)

```python
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from src.service.auth_service import decode_token
from src.repo.user_repo import get_user_by_id

security = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    try:
        payload = decode_token(credentials.credentials)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    user = await get_user_by_id(payload.sub)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user
```

### Routes (`src/runtime/routes/auth.py`)

```python
from fastapi import APIRouter, HTTPException, status
from src.types.auth import UserCreate, UserLogin, TokenResponse
from src.service.auth_service import (
    hash_password, verify_password,
    create_access_token, create_refresh_token,
)
from src.repo.user_repo import create_user, get_user_by_email

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/register", response_model=TokenResponse)
async def register(data: UserCreate):
    existing = await get_user_by_email(data.email)
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    hashed = hash_password(data.password)
    user = await create_user(email=data.email, name=data.name, hashed_password=hashed)

    return TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    )

@router.post("/login", response_model=TokenResponse)
async def login(data: UserLogin):
    user = await get_user_by_email(data.email)
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    return TokenResponse(
        access_token=create_access_token(user.id, user.role),
        refresh_token=create_refresh_token(user.id),
    )
```

### Environment Variables

```env
AUTH_SECRET_KEY=<generate-with-openssl-rand-hex-32>
AUTH_ACCESS_TOKEN_EXPIRE_MINUTES=30
AUTH_REFRESH_TOKEN_EXPIRE_DAYS=7
```

## Security Checklist

- [ ] Secret key is unique per environment, never committed
- [ ] Passwords hashed with bcrypt/argon2 (cost >= 10)
- [ ] Access tokens short-lived (15-30 min)
- [ ] Refresh tokens stored securely (httpOnly cookie)
- [ ] Rate limiting on login/register endpoints
- [ ] Token blacklist for logout (Redis or DB)
- [ ] HTTPS enforced in production
