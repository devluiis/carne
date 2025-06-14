# backend/app/routers/carnes_router.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, date, timedelta
from typing import List, Optional

from app import schemas, crud, models
from app.dependencies import get_db, get_current_active_user, get_current_admin_user # Adicionado get_current_admin_user
# Removido 'get_password_hash', 'verify_password' se não forem usados neste arquivo

router = APIRouter(
    prefix="/carnes",
    tags=["Carnes"],
)

# Rota para criar um novo carnê
@router.post("/", response_model=schemas.CarneResponse, status_code=status.HTTP_201_CREATED)
def create_carne_route(
    carne: schemas.CarneCreate,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_active_user)
):
    if not crud.get_client(db, client_id=carne.id_cliente):
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    return crud.create_carne(db=db, carne=carne, user_id=current_user.id_usuario)

# Rota para buscar todos os carnês
@router.get("/", response_model=List[schemas.CarneResponse])
def get_all_carnes_route( # Renomeado para get_all_carnes_route para clareza
    skip: int = 0,
    limit: int = 100,
    status_carne: Optional[str] = None, # Parâmetro de busca
    client_id: Optional[int] = None,
    data_vencimento_inicio: Optional[date] = None,
    data_vencimento_fim: Optional[date] = None,
    search_query: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_active_user)
):
    # A função crud.get_carnes já foi ajustada para lidar com esses parâmetros
    carnes = crud.get_carnes(db, skip=skip, limit=limit, status_carne=status_carne, id_cliente=client_id, data_vencimento_inicio=data_vencimento_inicio, data_vencimento_fim=data_vencimento_fim, search_query=search_query)
    return carnes

# Rota para buscar um carnê específico pelo ID
@router.get("/{carne_id}", response_model=schemas.CarneResponse)
def get_carne_by_id_route( # Renomeado para get_carne_by_id_route
    carne_id: int,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_active_user)
):
    db_carne = crud.get_carne(db, carne_id=carne_id) # Usando crud.get_carne
    if db_carne is None:
        raise HTTPException(status_code=404, detail="Carnê não encontrado")
    return db_carne

# Rota para atualizar um carnê
@router.put("/{carne_id}", response_model=schemas.CarneResponse)
def update_carne_route(
    carne_id: int,
    carne: schemas.CarneUpdate, # Alterado para CarneUpdate
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_active_user)
):
    db_carne = crud.update_carne(db, carne_id=carne_id, carne_update=carne)
    if db_carne is None:
        raise HTTPException(status_code=404, detail="Carnê não encontrado")
    return db_carne

# Rota para deletar um carnê
@router.delete("/{carne_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_carne_route(
    carne_id: int,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_active_user)
):
    success = crud.delete_carne(db, carne_id=carne_id)
    if not success:
        raise HTTPException(status_code=404, detail="Carnê não encontrado")
    return {"message": "Carnê deletado com sucesso."}

# Rota para registrar pagamento de uma parcela
@router.post("/{carne_id}/parcelas/{parcela_id}/pagar", response_model=schemas.PagamentoResponse)
def create_pagamento_route(
    carne_id: int,
    parcela_id: int,
    pagamento: schemas.PagamentoCreate,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_active_user)
):
    # Verifica se o id_parcela no corpo da requisição corresponde ao da URL
    if pagamento.id_parcela != parcela_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="ID da parcela no corpo da requisição não corresponde ao ID da URL.")

    db_pagamento = crud.create_pagamento(
        db=db,
        pagamento=pagamento,
        usuario_id=current_user.id_usuario
    )
    if db_pagamento is None:
        raise HTTPException(status_code=404, detail="Parcela não encontrada ou pagamento inválido.")
    return db_pagamento

# Rota para estornar um pagamento
@router.post("/{carne_id}/parcelas/{parcela_id}/reverse-payment", status_code=status.HTTP_200_OK)
def reverse_payment_route(
    carne_id: int,
    parcela_id: int,
    pagamento_info: schemas.PagamentoReverse, # AQUI ESTÁ A MUDANÇA: Recebe o corpo da requisição
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_admin_user) # Sugestão: tornar esta rota exclusiva para admin
):
    # crud.delete_pagamento agora recebe o pagamento_id diretamente
    result = crud.delete_pagamento(db, pagamento_id=pagamento_info.pagamento_id)
    
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pagamento não encontrado para estorno ou já estornado.")
    
    return {"message": "Pagamento estornado com sucesso!"}

# Rota para renegociar uma parcela
@router.post("/{carne_id}/parcelas/{parcela_id}/renegotiate", response_model=schemas.ParcelaResponse)
def renegotiate_parcela_route(
    carne_id: int,
    parcela_id: int,
    renegotiation_data: schemas.ParcelaRenegotiate, # Recebe um objeto Renegotiate
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_active_user)
):
    db_parcela = crud.renegotiate_parcela(
        db=db,
        parcela_id=parcela_id,
        renegotiation_data=renegotiation_data # Passa o objeto completo
    )
    if db_parcela is None:
        raise HTTPException(status_code=404, detail="Parcela não encontrada ou renegociação inválida.")
    return db_parcela