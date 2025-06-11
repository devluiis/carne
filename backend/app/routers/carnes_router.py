from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session
from app import crud, schemas, models
from app.database import get_db
from app.dependencies import get_current_active_user, get_current_admin_user
from datetime import datetime, timedelta
from typing import List, Optional

# Importação corrigida para a função de geração de PDF
from app.pdf_utils import generate_carne_pdf_weasyprint

router = APIRouter(
    prefix="/carnes",
    tags=["Carnes"],
)

@router.post("/", response_model=schemas.Carne)
def create_carne_route(
    carne: schemas.CarneCreate,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_active_user)
):
    db_carne = crud.create_carne(db=db, carne=carne)
    return db_carne

@router.get("/", response_model=List[schemas.Carne])
def read_carnes_route(
    skip: int = 0,
    limit: int = 100,
    status_carne: Optional[str] = None,
    client_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_active_user)
):
    carnes = crud.get_carnes(db, skip=skip, limit=limit, status_carne=status_carne, client_id=client_id)
    return carnes

@router.get("/{carne_id}", response_model=schemas.CarneWithDetails)
def read_carne_route(
    carne_id: int,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_active_user)
):
    db_carne = crud.get_carne_with_details(db, carne_id=carne_id)
    if db_carne is None:
        raise HTTPException(status_code=404, detail="Carnê não encontrado")
    return db_carne

@router.put("/{carne_id}", response_model=schemas.Carne)
def update_carne_route(
    carne_id: int,
    carne: schemas.CarneUpdate,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_admin_user) # Apenas admin pode atualizar
):
    db_carne = crud.update_carne(db, carne_id=carne_id, carne=carne)
    if db_carne is None:
        raise HTTPException(status_code=404, detail="Carnê não encontrado")
    return db_carne

@router.delete("/{carne_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_carne_route(
    carne_id: int,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_admin_user) # Apenas admin pode deletar
):
    success = crud.delete_carne(db, carne_id=carne_id)
    if not success:
        raise HTTPException(status_code=404, detail="Carnê não encontrado ou não pode ser deletado (possui pagamentos).")
    return Response(status_code=status.HTTP_204_NO_CONTENT)

@router.post("/{carne_id}/parcelas/{parcela_id}/pagar", response_model=schemas.Pagamento)
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
        user_id=current_user.id_usuario # Associa o pagamento ao usuário logado
    )
    if db_pagamento is None:
        raise HTTPException(status_code=404, detail="Parcela não encontrada ou pagamento inválido.")
    return db_pagamento

@router.post("/{carne_id}/parcelas/{parcela_id}/renegotiate", response_model=schemas.Parcela)
def renegotiate_parcela_route(
    carne_id: int,
    parcela_id: int,
    new_due_date: datetime,
    new_value: Optional[float] = None,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_admin_user) # Apenas admin pode renegociar
):
    db_parcela = crud.renegotiate_parcela(db, parcela_id, new_due_date, new_value)
    if db_parcela is None:
        raise HTTPException(status_code=404, detail="Parcela não encontrada ou não pode ser renegociada.")
    return db_parcela

@router.post("/{carne_id}/parcelas/{parcela_id}/reverse-payment", response_model=schemas.Pagamento)
def reverse_payment_route(
    carne_id: int,
    parcela_id: int,
    pagamento_id: int,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_admin_user) # Apenas admin pode estornar
):
    db_pagamento = crud.reverse_payment(db, parcela_id, pagamento_id)
    if db_pagamento is None:
        raise HTTPException(status_code=404, detail="Pagamento não encontrado ou não pode ser estornado.")
    return db_pagamento

@router.get("/carnes/{carne_id}/pdf", response_class=Response)
async def get_carne_pdf_route(
    carne_id: int,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_active_user)
):
    carne = crud.get_carne(db, carne_id)
    if not carne:
        raise HTTPException(status_code=404, detail="Carnê não encontrado")

    cliente = crud.get_client(db, carne.id_cliente)
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente do carnê não encontrado")

    parcelas = crud.get_parcelas_by_carne_id(db, carne_id)
    
    # Preparar os dados do carnê no formato esperado pela função de PDF
    carne_data = {
        "id_carne": carne.id_carne,
        "descricao": carne.descricao,
        "valor_total_original": carne.valor_total_original,
        "numero_parcelas": carne.numero_parcelas,
        "nome_cliente": cliente.nome,
        "cpf_cnpj_cliente": cliente.cpf_cnpj,
        "endereco_cliente": cliente.endereco,
        "data_venda": carne.data_venda.isoformat() if carne.data_venda else None, # Adicionado data_venda
        "valor_entrada": carne.valor_entrada, # Adicionado valor_entrada
        "forma_pagamento_entrada": carne.forma_pagamento_entrada, # Adicionado forma_pagamento_entrada
        "parcela_fixa": carne.parcela_fixa, # Adicionado parcela_fixa
    }

    parcelas_data = []
    for parcela in parcelas:
        parcelas_data.append({
            "id_parcela": parcela.id_parcela,
            "numero_parcela": parcela.numero_parcela,
            "valor_devido": parcela.valor_devido,
            "data_vencimento": parcela.data_vencimento.isoformat(), # Converter para string ISO
            "status_parcela": parcela.status_parcela,
            "observacoes": parcela.observacoes,
            "valor_pago": parcela.valor_pago,
            "saldo_devedor": parcela.saldo_devedor,
            "data_pagamento_completo": parcela.data_pagamento_completo.isoformat() if parcela.data_pagamento_completo else None,
            "juros_multa": parcela.juros_multa,
        })

    # Chame a função de geração de PDF e receba o buffer de retorno
    pdf_buffer = generate_carne_pdf_weasyprint(carne_data, parcelas_data)

    return Response(content=pdf_buffer.getvalue(), media_type="application/pdf")