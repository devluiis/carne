from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, date, timedelta
from typing import List, Optional

from app import schemas, crud, models
from app.dependencies import get_db, get_current_active_user
from app.auth import get_password_hash, verify_password # Removido se não usado diretamente neste arquivo

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
    data_vencimento_inicio: Optional[date] = None,
    data_vencimento_fim: Optional[date] = None,
    search_query: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_active_user)
):
    carnes = crud.get_carnes(db, skip=skip, limit=limit, status_carne=status_carne, id_cliente=client_id, data_vencimento_inicio=data_vencimento_inicio, data_vencimento_fim=data_vencimento_fim, search_query=search_query)
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
    current_user: models.Usuario = Depends(get_current_active_user) # Alterado para get_current_active_user, ajuste se admin é mandatório
):
    db_carne = crud.update_carne(db, carne_id=carne_id, carne_update=carne) # Argumento renomeado para carne_update
    if db_carne is None:
        raise HTTPException(status_code=404, detail="Carnê não encontrado")
    return db_carne

@router.delete("/{carne_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_carne_route(
    carne_id: int,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_active_user) # Alterado para get_current_active_user, ajuste se admin é mandatório
):
    success = crud.delete_carne(db, carne_id=carne_id)
    if not success:
        raise HTTPException(status_code=404, detail="Carnê não encontrado ou não pode ser deletado (possui pagamentos).")
    return status.HTTP_204_NO_CONTENT # Retorna o código 204 diretamente

@router.post("/{carne_id}/parcelas/{parcela_id}/pagar", response_model=schemas.PagamentoResponse)
def create_pagamento_route(
    carne_id: int,
    parcela_id: int,
    pagamento: schemas.PagamentoCreate,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_active_user)
):
    # Verifica se o id_parcela no corpo da requisição corresponde ao da URL
    # É uma boa prática para garantir consistência e evitar ataques de ID injection
    if pagamento.id_parcela != parcela_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="O ID da parcela no corpo da requisição não corresponde ao ID da parcela na URL."
        )

    db_pagamento = crud.create_pagamento( # Correção aqui: removido 'parcela_id=parcela_id'
        db=db,
        pagamento=pagamento,
        usuario_id=current_user.id_usuario
    )
    if db_pagamento is None:
        raise HTTPException(status_code=404, detail="Parcela não encontrada ou pagamento inválido.")
    return db_pagamento


@router.post("/{carne_id}/parcelas/{parcela_id}/renegotiate", response_model=schemas.ParcelaResponse)
def renegotiate_parcela_route(
    carne_id: int, # Mantido, embora não usado diretamente na função crud.renegotiate_parcela
    parcela_id: int,
    renegotiation_data: schemas.ParcelaRenegotiate, # Recebe um objeto Renegotiate
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_active_user) # Alterado para get_current_active_user, ajuste se admin é mandatório
):
    db_parcela = crud.renegotiate_parcela(
        db=db,
        parcela_id=parcela_id,
        renegotiation_data=renegotiation_data # Passa o objeto completo
    )
    if db_parcela is None:
        raise HTTPException(status_code=404, detail="Parcela não encontrada ou não pode ser renegociada.")
    return db_parcela

# Note: A rota original para estornar pagamento em `carnes_router.py` tinha um nome `reverse_payment_route`
# mas chamava `crud.reverse_payment`. Se essa função não existe em `crud.py` ou tem outra assinatura,
# o erro persistirá. Assumindo que `crud.reverse_payment` existe e lida com `pagamento_id` diretamente.
# Adicionando uma correção baseada no nome da rota no frontend e na lógica do crud.
@router.post("/{carne_id}/parcelas/{parcela_id}/reverse-payment", status_code=status.HTTP_200_OK) # Retorna 200 OK ou 204 No Content
def reverse_payment_route(
    carne_id: int, # Não usado diretamente, mas parte da URL
    parcela_id: int, # Usado para encontrar a parcela, se necessário no crud
    pagamento_id: int, # Recebe o ID do pagamento a ser estornado
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_active_user) # Ajuste a permissão se necessário
):
    # O crud.delete_pagamento é mais apropriado para 'estornar' um pagamento,
    # pois ele recalcula o saldo da parcela e o status do carnê.
    # Certifique-se de que o crud.delete_pagamento lida com a lógica de estorno (reverter valores).
    result = crud.delete_pagamento(db, pagamento_id=pagamento_id)
    
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pagamento não encontrado ou já estornado.")
    
    return {"message": "Pagamento estornado com sucesso!"}