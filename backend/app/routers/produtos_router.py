from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app import schemas, crud, models
from app.database import get_db
from app.auth import get_current_active_user, get_current_admin_user # Para proteger rotas

router = APIRouter(
    prefix="/produtos",
    tags=["Produtos"]
)

@router.post("/", response_model=schemas.ProdutoResponse, status_code=status.HTTP_201_CREATED)
def create_new_produto(
    produto: schemas.ProdutoCreate, 
    db: Session = Depends(get_db), 
    current_user: models.Usuario = Depends(get_current_admin_user) # Apenas admins podem criar produtos
):
    return crud.create_produto(db=db, produto=produto)

@router.get("/", response_model=List[schemas.ProdutoResponse])
def read_all_produtos(
    skip: int = 0, 
    limit: int = 100, 
    search_query: Optional[str] = Query(None, description="Buscar produtos por nome"),
    categoria: Optional[str] = Query(None, description="Filtrar por categoria"),
    marca: Optional[str] = Query(None, description="Filtrar por marca"),
    db: Session = Depends(get_db), 
    current_user: models.Usuario = Depends(get_current_active_user) # Qualquer usuário logado pode ver
):
    produtos = crud.get_produtos(db, skip=skip, limit=limit, search_query=search_query, categoria=categoria, marca=marca)
    return produtos

@router.get("/{produto_id}", response_model=schemas.ProdutoResponse)
def read_single_produto(
    produto_id: int, 
    db: Session = Depends(get_db), 
    current_user: models.Usuario = Depends(get_current_active_user)
):
    db_produto = crud.get_produto(db, produto_id=produto_id)
    if db_produto is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Produto não encontrado")
    return db_produto

@router.put("/{produto_id}", response_model=schemas.ProdutoResponse)
def update_existing_produto(
    produto_id: int, 
    produto_update: schemas.ProdutoUpdate, 
    db: Session = Depends(get_db), 
    current_user: models.Usuario = Depends(get_current_admin_user) # Apenas admins podem atualizar
):
    db_produto = crud.update_produto(db=db, produto_id=produto_id, produto_update=produto_update)
    if db_produto is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Produto não encontrado para atualizar")
    return db_produto

@router.delete("/{produto_id}", response_model=schemas.ProdutoResponse) # Pode retornar o objeto deletado ou apenas status 204
def delete_existing_produto(
    produto_id: int, 
    db: Session = Depends(get_db), 
    current_user: models.Usuario = Depends(get_current_admin_user) # Apenas admins podem deletar
):
    db_produto = crud.delete_produto(db=db, produto_id=produto_id)
    if db_produto is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Produto não encontrado para deletar")
    return db_produto # Retorna o produto deletado para confirmação