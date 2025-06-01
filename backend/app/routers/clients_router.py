from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app import schemas, crud, models
from app.database import get_db
from app.auth import get_current_active_user, get_current_admin_user

router = APIRouter()

@router.post("/clients/", response_model=schemas.ClientResponse, status_code=status.HTTP_201_CREATED)
def create_client(client: schemas.ClientCreate, db: Session = Depends(get_db), current_user: models.Usuario = Depends(get_current_active_user)):
    return crud.create_client(db=db, client=client)

@router.get("/clients/", response_model=List[schemas.ClientResponse])
def read_clients(
    skip: int = 0,
    limit: int = 100,
    search_query: Optional[str] = Query(None, description="Buscar clientes por nome ou CPF/CNPJ"),
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_active_user)
):
    clients = crud.get_clients(db, skip=skip, limit=limit, search_query=search_query)
    return clients

@router.get("/clients/{client_id}", response_model=schemas.ClientResponse)
def read_client(client_id: int, db: Session = Depends(get_db), current_user: models.Usuario = Depends(get_current_active_user)):
    db_client = crud.get_client(db, client_id=client_id)
    if db_client is None:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    return db_client

@router.put("/clients/{client_id}", response_model=schemas.ClientResponse)
def update_client(client_id: int, client_update: schemas.ClientUpdate, db: Session = Depends(get_db), current_user: models.Usuario = Depends(get_current_active_user)):
    db_client = crud.update_client(db, client_id, client_update)
    if db_client is None:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    return db_client

@router.delete("/clients/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_client(client_id: int, db: Session = Depends(get_db), current_user: models.Usuario = Depends(get_current_admin_user)):
    db_client = crud.delete_client(db, client_id=client_id)
    if db_client is None:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    return {}

# NOVO ENDPOINT: Resumo Detalhado do Cliente (RF008)
@router.get("/clients/{client_id}/summary", response_model=schemas.ClientSummaryResponse)
def get_client_summary_route(client_id: int, db: Session = Depends(get_db), current_user: models.Usuario = Depends(get_current_active_user)):
    client_summary = crud.get_client_summary(db, client_id=client_id)
    if client_summary is None:
        raise HTTPException(status_code=404, detail="Cliente não encontrado ou sem resumo disponível.")
    return client_summary