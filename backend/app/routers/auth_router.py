from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta
from app import schemas, crud, models
from app.database import get_db
from app.auth import verify_password, create_access_token, get_current_active_user, get_current_admin_user # Importar get_current_admin_user
from app.config import ACCESS_TOKEN_EXPIRE_MINUTES

router = APIRouter()

@router.post("/token", response_model=schemas.Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = crud.get_user_by_email(db, email=form_data.username)
    if not user or not verify_password(form_data.password, user.senha_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciais inválidas",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # ATENÇÃO: É importante que o perfil do usuário seja incluído no token
    # ou que seja acessível após a autenticação para que o frontend
    # possa tomar decisões sobre a interface (Ex: exibir botão de admin)
    # Por simplicidade, assumimos que 'get_current_active_user' ou uma rota '/me'
    # retornará o perfil completo do usuário.
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    
    # Retorna o token e os dados básicos do usuário para o frontend
    return {"access_token": access_token, "token_type": "bearer", "user_data": schemas.UserResponse.model_validate(user).model_dump()}


@router.post("/register", response_model=schemas.UserResponse)
# Permite que qualquer usuário logado (atendente ou admin) registre novos atendentes
# Se a intenção é que APENAS ADMINS possam registrar, adicione Depends(get_current_admin_user)
# Ex: def register_user(user: schemas.UserCreate, db: Session = Depends(get_db), current_user: models.Usuario = Depends(get_current_admin_user)):
def register_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = crud.get_user_by_email(db, email=user.email)
    if db_user:
        raise HTTPException(status_code=400, detail="Email já registrado")
    # Garante que este endpoint só crie usuários com perfil "atendente"
    if user.perfil and user.perfil != "atendente":
        raise HTTPException(status_code=400, detail="Este endpoint é apenas para registro de atendentes.")
    
    # Se o perfil não for especificado, ele será "atendente" por padrão no schema
    return crud.create_user(db=db, user=user)


@router.post("/register-admin", response_model=schemas.UserResponse)
# Rota agora protegida: Apenas administradores logados podem criar novos administradores.
def register_admin_user(user_data: schemas.UserRegisterAdmin, db: Session = Depends(get_db), current_admin_user: models.Usuario = Depends(get_current_admin_user)):
    db_user = crud.get_user_by_email(db, email=user_data.email)
    if db_user:
        raise HTTPException(status_code=400, detail="Email já registrado")
    
    # Garante que o perfil seja 'admin' para este endpoint
    user_data.perfil = "admin" 
    return crud.create_user(db=db, user=user_data)


@router.get("/me", response_model=schemas.UserResponse)
async def read_users_me(current_user: schemas.UserResponse = Depends(get_current_active_user)):
    return current_user

@router.put("/me", response_model=schemas.UserResponse)
async def update_users_me(user_update: schemas.UserUpdate, db: Session = Depends(get_db), current_user: models.Usuario = Depends(get_current_active_user)):
    db_user = crud.update_user(db, current_user.id_usuario, user_update)
    if not db_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado.")
    return db_user