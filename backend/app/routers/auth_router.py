# backend/app/routers/auth_router.py
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta # Certifique-se que timedelta está importado
from app import schemas, crud, models # models importado para current_user type hint
from app.database import get_db
from app.auth import verify_password, create_access_token, get_current_active_user, get_current_admin_user
from app.config import ACCESS_TOKEN_EXPIRE_MINUTES

router = APIRouter(
    tags=["Autenticação"]  # Tags definidas aqui
)

@router.post("/token", response_model=schemas.Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = crud.get_user_by_email(db, email=form_data.username)
    if not user or not verify_password(form_data.password, user.senha_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciais inválidas",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    
    # Corrigido para usar model_validate e model_dump se UserResponse for Pydantic v2+
    # Se UserResponse for Pydantic v1, .from_orm(user) ou apenas passar o user pode funcionar dependendo da config
    user_response_data = schemas.UserResponse.model_validate(user).model_dump()

    return {"access_token": access_token, "token_type": "bearer", "user_data": user_response_data}


@router.post("/register", response_model=schemas.UserResponse)
def register_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = crud.get_user_by_email(db, email=user.email)
    if db_user:
        raise HTTPException(status_code=400, detail="Email já registrado")
    
    user.perfil = "atendente"
    return crud.create_user(db=db, user=user)

@router.post("/register-atendente", response_model=schemas.UserResponse)
def register_atendente_by_admin(
    user_data: schemas.UserCreate, 
    db: Session = Depends(get_db),
    current_admin_user: models.Usuario = Depends(get_current_admin_user)
):
    db_user = crud.get_user_by_email(db, email=user_data.email)
    if db_user:
        raise HTTPException(status_code=400, detail="Email já registrado")
    
    user_data.perfil = "atendente"
    return crud.create_user(db=db, user=user_data)


@router.post("/register-admin", response_model=schemas.UserResponse)
def register_admin_user(user_data: schemas.UserRegisterAdmin, db: Session = Depends(get_db), current_admin_user: models.Usuario = Depends(get_current_admin_user)):
    db_user = crud.get_user_by_email(db, email=user_data.email)
    if db_user:
        raise HTTPException(status_code=400, detail="Email já registrado")
    
    # O schema UserRegisterAdmin já define o perfil como 'admin' por padrão ou validação
    # user_data.perfil = "admin" # Pode ser redundante se o schema já garante
    return crud.create_user(db=db, user=user_data) # user_data já deve ter o perfil correto


@router.get("/me", response_model=schemas.UserResponse)
async def read_users_me(current_user: models.Usuario = Depends(get_current_active_user)): # current_user é models.Usuario
    return current_user

@router.put("/me", response_model=schemas.UserResponse)
async def update_users_me(user_update: schemas.UserUpdate, db: Session = Depends(get_db), current_user: models.Usuario = Depends(get_current_active_user)):
    db_user = crud.update_user(db, current_user.id_usuario, user_update)
    if not db_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado.")
    return db_user