from fastapi import Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.auth import get_current_active_user
from app.models import Usuario

# Exemplo de dependência para obter o usuário logado
def get_current_user_dependency(db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_active_user)):
    return current_user