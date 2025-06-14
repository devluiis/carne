# backend/app/dependencies.py
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

# Importações necessárias para decodificar o token diretamente
from jose import JWTError, jwt
from app.config import SECRET_KEY, ALGORITHM
from app.database import get_db
from app import models # Importa models para ter acesso a models.Usuario

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/token")

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Não foi possível validar credenciais",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        # Lógica de decodificação do token replicada de auth.py
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    # Busca o usuário no banco de dados
    user = db.query(models.Usuario).filter(models.Usuario.email == username).first()
    if user is None:
        raise credentials_exception
    return user

async def get_current_active_user(current_user: models.Usuario = Depends(get_current_user)):
    if not current_user.ativo:
        raise HTTPException(status_code=400, detail="Usuário inativo")
    return current_user

# FUNÇÃO: get_current_admin_user
async def get_current_admin_user(current_user: models.Usuario = Depends(get_current_active_user)):
    if current_user.perfil != 'admin':
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Operação requer privilégios de administrador")
    return current_user