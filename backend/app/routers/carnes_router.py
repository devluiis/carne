from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session
from app import crud, schemas, models
from app.database import get_db
from app.auth import get_current_active_user, get_current_admin_user
from datetime import datetime, timedelta
from typing import List, Optional

router = APIRouter(
    prefix="/carnes",
    tags=["Carnes"],
)

@router.post("/", response_model=schemas.CarneResponse)
def create_carne_route(
    carne: schemas.CarneCreate,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_active_user)
):
    db_carne = crud.create_carne(db=db, carne=carne)
    return db_carne

@router.get("/", response_model=List[schemas.CarneResponse])
def read_carnes_route(
    skip: int = 0,
    limit: int = 100,
    status_carne: Optional[str] = None,
    client_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_active_user)
):
    carnes = crud.get_carnes(db, skip=skip, limit=limit, status_carne=status_carne, id_cliente=client_id)
    return carnes

@router.get("/{carne_id}", response_model=schemas.CarneResponse)
def read_carne_route(
    carne_id: int,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_active_user)
):
    # CORRIGIDO: Chamando crud.get_carne em vez de crud.get_carne_with_details
    db_carne = crud.get_carne(db, carne_id=carne_id)
    if db_carne is None:
        raise HTTPException(status_code=404, detail="Carnê não encontrado")
    return db_carne

@router.put("/{carne_id}", response_model=schemas.CarneResponse)
def update_carne_route(
    carne_id: int,
    carne: schemas.CarneUpdate,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_admin_user)
):
    db_carne = crud.update_carne(db, carne_id=carne_id, carne=carne)
    if db_carne is None:
        raise HTTPException(status_code=404, detail="Carnê não encontrado")
    return db_carne

@router.delete("/{carne_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_carne_route(
    carne_id: int,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_admin_user)
):
    success = crud.delete_carne(db, carne_id=carne_id)
    if not success:
        raise HTTPException(status_code=404, detail="Carnê não encontrado ou não pode ser deletado (possui pagamentos).")
    return Response(status_code=status.HTTP_204_NO_CONTENT)

@router.post("/{carne_id}/parcelas/{parcela_id}/pagar", response_model=schemas.PagamentoResponse)
def create_pagamento_route(
    carne_id: int,
    parcela_id: int,
    pagamento: schemas.PagamentoCreate,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_active_user)
):
    db_pagamento = crud.create_pagamento(
        db=db,
        parcela_id=parcela_id,
        pagamento=pagamento,
        user_id=current_user.id_usuario
    )
    if db_pagamento is None:
        raise HTTPException(status_code=404, detail="Parcela não encontrada ou pagamento inválido.")
    return db_pagamento

@router.post("/{carne_id}/parcelas/{parcela_id}/renegotiate", response_model=schemas.ParcelaResponse)
def renegotiate_parcela_route(
    carne_id: int,
    parcela_id: int,
    new_due_date: datetime,
    new_value: Optional[float] = None,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_admin_user)
):
    db_parcela = crud.renegotiate_parcela(db, parcela_id, new_due_date, new_value)
    if db_parcela is None:
        raise HTTPException(status_code=404, detail="Parcela não encontrada ou não pode ser renegociada.")
    return db_parcela

@router.post("/{carne_id}/parcelas/{parcela_id}/reverse-payment", response_model=schemas.PagamentoResponse)
def reverse_payment_route(
    carne_id: int,
    parcela_id: int,
    pagamento_id: int,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_admin_user)
):
    db_pagamento = crud.reverse_payment(db, parcela_id, pagamento_id)
    if db_pagamento is None:
        raise HTTPException(status_code=404, detail="Pagamento não encontrado ou não pode ser estornado.")
    return db_pagamento