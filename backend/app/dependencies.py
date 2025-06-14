# backend/app/dependencies.py
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.database import get_db
from app import crud, models, auth

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/token")

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    user = auth.get_current_user_from_token(db, token)
    if user is None:
        raise credentials_exception
    return user

async def get_current_active_user(current_user: models.Usuario = Depends(get_current_user)):
    if not current_user.ativo:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user

# NOVA FUNÇÃO: get_current_admin_user
async def get_current_admin_user(current_user: models.Usuario = Depends(get_current_active_user)):
    if current_user.perfil != 'admin':
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Operation requires admin privileges")
    return current_user