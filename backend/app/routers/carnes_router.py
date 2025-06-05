# backend/app/routers/carnes_router.py
# (Conteúdo original do seu arquivo, que já estava correto na definição do APIRouter)
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date
from app import schemas, crud, models # models importado para current_user type hint
from app.database import get_db
from app.auth import get_current_active_user, get_current_admin_user 
from fastapi.responses import Response
from app.pdf_utils import generate_carne_pdf_bytes, LOGO_PATH # Importado LOGO_PATH para o tratamento de erro

router = APIRouter(prefix="/carnes", tags=["Carnês"])

# --- Rotas de Carnê ---
@router.post("/", response_model=schemas.CarneResponse, status_code=status.HTTP_201_CREATED)
def create_carne(carne: schemas.CarneCreate, db: Session = Depends(get_db), current_user: models.Usuario = Depends(get_current_active_user)):
    db_cliente = crud.get_client(db, client_id=carne.id_cliente)
    if not db_cliente:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cliente não encontrado para associar o carnê.")
    return crud.create_carne(db=db, carne=carne)

@router.get("/", response_model=List[schemas.CarneResponse])
def read_carnes(
    skip: int = 0,
    limit: int = 100,
    id_cliente: Optional[int] = Query(None, description="Filtrar por ID do cliente"),
    status_carne: Optional[str] = Query(None, description="Filtrar por status do carnê (Ativo, Quitado, Em Atraso, Cancelado)"),
    data_vencimento_inicio: Optional[date] = Query(None, description="Filtrar carnês com parcelas vencendo a partir desta data (YYYY-MM-DD)"),
    data_vencimento_fim: Optional[date] = Query(None, description="Filtrar carnês com parcelas vencendo até esta data (YYYY-MM-DD)"),
    search_query: Optional[str] = Query(None, description="Buscar carnês por descrição, nome ou CPF/CNPJ do cliente"), # Descrição da busca atualizada
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_active_user)
):
    carnes = crud.get_carnes(
        db,
        skip=skip,
        limit=limit,
        id_cliente=id_cliente,
        status_carne=status_carne,
        data_vencimento_inicio=data_vencimento_inicio,
        data_vencimento_fim=data_vencimento_fim,
        search_query=search_query
    )
    return carnes

@router.get("/{carne_id}", response_model=schemas.CarneResponse)
def read_carne(carne_id: int, db: Session = Depends(get_db), current_user: models.Usuario = Depends(get_current_active_user)):
    db_carne = crud.get_carne(db, carne_id=carne_id)
    if db_carne is None:
        raise HTTPException(status_code=404, detail="Carnê não encontrado")
    return db_carne

@router.put("/{carne_id}", response_model=schemas.CarneResponse)
def update_carne(carne_id: int, carne_update: schemas.CarneCreate, db: Session = Depends(get_db), current_user: models.Usuario = Depends(get_current_active_user)):
    db_carne = crud.update_carne(db, carne_id, carne_update)
    if db_carne is None:
        raise HTTPException(status_code=404, detail="Carnê não encontrado")
    return db_carne

@router.delete("/{carne_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_carne(carne_id: int, db: Session = Depends(get_db), current_user: models.Usuario = Depends(get_current_admin_user)):
    db_carne = crud.delete_carne(db, carne_id=carne_id)
    if db_carne is None:
        raise HTTPException(status_code=404, detail="Carnê não encontrado")
    return Response(status_code=status.HTTP_204_NO_CONTENT) # Retorna uma resposta vazia


# --- Rotas de Parcela (associadas a um Carnê) ---
@router.get("/{carne_id}/parcelas", response_model=List[schemas.ParcelaResponse])
def read_parcelas_by_carne(carne_id: int, skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: models.Usuario = Depends(get_current_active_user)):
    db_carne = crud.get_carne(db, carne_id=carne_id, apply_interest=False) # apply_interest=False para não recalcular aqui, já que será feito em get_parcelas_by_carne
    if not db_carne:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Carnê não encontrado.")
    parcelas = crud.get_parcelas_by_carne(db, carne_id=carne_id, skip=skip, limit=limit)
    return parcelas

@router.get("/parcelas/{parcela_id}", response_model=schemas.ParcelaResponse)
def read_parcela(parcela_id: int, db: Session = Depends(get_db), current_user: models.Usuario = Depends(get_current_active_user)):
    db_parcela = crud.get_parcela(db, parcela_id=parcela_id)
    if db_parcela is None:
        raise HTTPException(status_code=404, detail="Parcela não encontrada")
    return db_parcela

@router.put("/parcelas/{parcela_id}", response_model=schemas.ParcelaResponse)
def update_parcela(parcela_id: int, parcela_update: schemas.ParcelaBase, db: Session = Depends(get_db), current_user: models.Usuario = Depends(get_current_active_user)):
    db_parcela = crud.update_parcela(db, parcela_id, parcela_update)
    if db_parcela is None:
        raise HTTPException(status_code=404, detail="Parcela não encontrada")
    return db_parcela

@router.delete("/parcelas/{parcela_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_parcela(parcela_id: int, db: Session = Depends(get_db), current_user: models.Usuario = Depends(get_current_admin_user)):
    result = crud.delete_parcela(db, parcela_id=parcela_id) # crud.delete_parcela agora retorna um dict
    if not result or not result.get("ok"): # Ajuste para checar o retorno
        raise HTTPException(status_code=404, detail="Parcela não encontrada ou falha ao deletar")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- Rotas de Pagamento ---
@router.post("/pagamentos/", response_model=schemas.PagamentoResponse, status_code=status.HTTP_201_CREATED)
def create_pagamento(pagamento: schemas.PagamentoCreate, db: Session = Depends(get_db), current_user: models.Usuario = Depends(get_current_active_user)):
    return crud.create_pagamento(db=db, pagamento=pagamento, usuario_id=current_user.id_usuario)

@router.get("/pagamentos/{pagamento_id}", response_model=schemas.PagamentoResponse)
def read_pagamento(pagamento_id: int, db: Session = Depends(get_db), current_user: models.Usuario = Depends(get_current_active_user)):
    db_pagamento = crud.get_pagamento(db, pagamento_id=pagamento_id)
    if db_pagamento is None:
        raise HTTPException(status_code=404, detail="Pagamento não encontrado")
    return db_pagamento

@router.get("/parcelas/{parcela_id}/pagamentos", response_model=List[schemas.PagamentoResponse])
def read_pagamentos_by_parcela(parcela_id: int, skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: models.Usuario = Depends(get_current_active_user)):
    db_parcela = crud.get_parcela(db, parcela_id=parcela_id, apply_interest=False) # apply_interest=False para performance
    if not db_parcela:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parcela não encontrada.")
    pagamentos = crud.get_pagamentos_by_parcela(db, parcela_id=parcela_id, skip=skip, limit=limit)
    return pagamentos

@router.put("/pagamentos/{pagamento_id}", response_model=schemas.PagamentoResponse)
def update_pagamento(pagamento_id: int, pagamento_update: schemas.PagamentoCreate, db: Session = Depends(get_db), current_user: models.Usuario = Depends(get_current_admin_user)):
    db_pagamento = crud.update_pagamento(db, pagamento_id, pagamento_update)
    # crud.update_pagamento já levanta exceção se não encontrar
    return db_pagamento

@router.delete("/pagamentos/{pagamento_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_pagamento(pagamento_id: int, db: Session = Depends(get_db), current_user: models.Usuario = Depends(get_current_admin_user)):
    result = crud.delete_pagamento(db, pagamento_id=pagamento_id) # crud.delete_pagamento agora retorna um dict
    if not result or not result.get("ok"): # Ajuste para checar o retorno
        raise HTTPException(status_code=404, detail="Pagamento não encontrado ou falha ao estornar")
    return Response(status_code=status.HTTP_204_NO_CONTENT)

@router.get("/{carne_id}/pdf", tags=["Carnês PDF"]) # Tags podem ser adicionadas por rota também
async def get_carne_pdf_route(
    carne_id: int, 
    db: Session = Depends(get_db), 
    current_user: models.Usuario = Depends(get_current_active_user)
):
    db_carne = crud.get_carne(db, carne_id=carne_id) # get_carne já aplica juros por padrão
    if db_carne is None:
        raise HTTPException(status_code=404, detail="Carnê não encontrado")

    try:
        pdf_bytes = generate_carne_pdf_bytes(db_carne)
        filename = f"carne_{db_carne.id_cliente}_{carne_id}.pdf"
        
        return Response(
            content=pdf_bytes,
            media_type='application/pdf',
            headers={'Content-Disposition': f'inline; filename="{filename}"'}
        )
    except FileNotFoundError:
         raise HTTPException(status_code=500, detail=f"Erro ao gerar PDF: Arquivo de logo não encontrado em {LOGO_PATH}. Verifique o caminho.")
    except Exception as e:
        print(f"Erro detalhado ao gerar PDF: {e}") 
        raise HTTPException(status_code=500, detail=f"Ocorreu um erro interno ao gerar o PDF: {str(e)}")