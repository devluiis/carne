# backend/app/routers/clients_router.py
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional # Optional já estava importado
from app import schemas, crud, models # models importado para current_user type hint
from app.database import get_db
from app.auth import get_current_active_user, get_current_admin_user

router = APIRouter(
    prefix="/clients",  # Prefixo definido aqui
    tags=["Clientes"]   # Tags definidas aqui
)

@router.post("/", response_model=schemas.ClientResponse, status_code=status.HTTP_201_CREATED) # Path ajustado de "/clients/" para "/"
def create_client(client: schemas.ClientCreate, db: Session = Depends(get_db), current_user: models.Usuario = Depends(get_current_active_user)):
    return crud.create_client(db=db, client=client)

@router.get("/", response_model=List[schemas.ClientResponse]) # Path ajustado de "/clients/" para "/"
def read_clients(
    skip: int = 0,
    limit: int = 100,
    search_query: Optional[str] = Query(None, description="Buscar clientes por nome ou CPF/CNPJ"),
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_active_user)
):
    clients = crud.get_clients(db, skip=skip, limit=limit, search_query=search_query)
    return clients

@router.get("/{client_id}", response_model=schemas.ClientResponse) # Path ajustado de "/clients/{client_id}" para "/{client_id}"
def read_client(client_id: int, db: Session = Depends(get_db), current_user: models.Usuario = Depends(get_current_active_user)):
    db_client = crud.get_client(db, client_id=client_id)
    if db_client is None:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    return db_client

@router.put("/{client_id}", response_model=schemas.ClientResponse) # Path ajustado de "/clients/{client_id}" para "/{client_id}"
def update_client(client_id: int, client_update: schemas.ClientUpdate, db: Session = Depends(get_db), current_user: models.Usuario = Depends(get_current_active_user)):
    db_client = crud.update_client(db, client_id, client_update)
    if db_client is None:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    return db_client

@router.delete("/{client_id}", status_code=status.HTTP_204_NO_CONTENT) # Path ajustado de "/clients/{client_id}" para "/{client_id}"
def delete_client(client_id: int, db: Session = Depends(get_db), current_user: models.Usuario = Depends(get_current_admin_user)):
    db_client = crud.delete_client(db, client_id=client_id)
    if db_client is None:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    return {}

@router.get("/{client_id}/summary", response_model=schemas.ClientSummaryResponse) # Path ajustado de "/clients/{client_id}/summary" para "/{client_id}/summary"
def get_client_summary_route(client_id: int, db: Session = Depends(get_db), current_user: models.Usuario = Depends(get_current_active_user)):
    client_summary = crud.get_client_summary(db, client_id=client_id)
    if client_summary is None:
        raise HTTPException(status_code=404, detail="Cliente não encontrado ou sem resumo disponível.")
    return client_summary