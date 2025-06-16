# backend/app/crud.py
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import IntegrityError
from app import models, schemas
from fastapi import HTTPException, status
from datetime import date, timedelta, datetime
from decimal import Decimal
from typing import Optional, List
from app.config import MULTA_ATRASO_PERCENTUAL, JUROS_MORA_PERCENTUAL_AO_MES
from sqlalchemy import func

# >>> ADICIONAR ESTA IMPORTAÇÃO <<<
from dateutil.relativedelta import relativedelta
# >>> FIM DA ADIÇÃO <<<

# --- Funções Auxiliares (RF017/RF018) ---
def _apply_interest_and_fine_if_due(db: Session, parcela: models.Parcela):
    today = date.today()
    
    # NÃO recalcular juros/multas se a parcela já está paga ou cancelada.
    if parcela.status_parcela in ['Paga', 'Paga com Atraso', 'Cancelada']:
        # Garante que, se já está paga, saldo e juros/multa sejam zero.
        # Isso evita que juros/multa apareçam em parcelas já quitadas
        if parcela.juros_multa > Decimal('0.00') and parcela.saldo_devedor <= Decimal('0.00'):
            parcela.juros_multa = Decimal('0.00')
            parcela.juros_multa_anterior_aplicada = Decimal('0.00')
            db.add(parcela)
            # Não faz commit aqui, deixa para o caller
        return 

    # Se a parcela está vencida e não paga, recalcula juros/multas
    if parcela.data_vencimento < today:
        dias_atraso = (today - parcela.data_vencimento).days
        
        # O valor base para cálculo de juros/multa deve ser o saldo original que falta
        # Não sobre o valor já aplicado de juros/multas, para evitar juros sobre juros sem controle.
        valor_base_para_calculo = parcela.valor_devido - parcela.valor_pago
        if valor_base_para_calculo < Decimal('0.00'):
            valor_base_para_calculo = Decimal('0.00') # Não calcular juros sobre valor negativo

        # MULTAS_ATRASO_PERCENTUAL já é Decimal
        multa = (valor_base_para_calculo * MULTA_ATRASO_PERCENTUAL) / Decimal('100')
        
        # JUROS_MORA_PERCENTUAL_AO_MES já é Decimal
        juros_diario_percentual = JUROS_MORA_PERCENTUAL_AO_MES / Decimal('30') / Decimal('100')
        juros_mora = (valor_base_para_calculo * juros_diario_percentual * Decimal(str(dias_atraso)))
        
        total_novos_juros_multa = multa + juros_mora

        # Atualiza o campo juros_multa APENAS se o valor mudou
        # Isso é importante para não "sujar" o histórico se não houve alteração.
        if total_novos_juros_multa != parcela.juros_multa_anterior_aplicada:
            parcela.juros_multa = total_novos_juros_multa
            parcela.juros_multa_anterior_aplicada = total_novos_juros_multa # Guarda o último valor aplicado

        # Recalcula saldo devedor incluindo os juros/multas calculados.
        # Saldo devedor é o que falta do principal (valor_devido - valor_pago) + juros/multa atual
        parcela.saldo_devedor = (parcela.valor_devido - parcela.valor_pago) + parcela.juros_multa

        # Ajuste para evitar valores negativos residuais muito pequenos
        if parcela.saldo_devedor < Decimal('0.01') and parcela.saldo_devedor > Decimal('-0.01'):
            parcela.saldo_devedor = Decimal('0.00')

        # Atualiza status da parcela com base no saldo e vencimento
        if parcela.saldo_devedor <= Decimal('0.00'):
            # Se quitada, mesmo que atrasada, o status prioritário é 'Paga'
            if parcela.data_pagamento_completo and parcela.data_pagamento_completo > parcela.data_vencimento:
                parcela.status_parcela = 'Paga com Atraso'
            else:
                parcela.status_parcela = 'Paga'
            # Garante que juros/multa sejam zerados se a parcela está efetivamente paga
            parcela.juros_multa = Decimal('0.00')
            parcela.juros_multa_anterior_aplicada = Decimal('0.00')
        elif parcela.data_vencimento < today:
            parcela.status_parcela = 'Atrasada'
        elif parcela.valor_pago > Decimal('0.00'):
            parcela.status_parcela = 'Parcialmente Paga'
        else:
            parcela.status_parcela = 'Pendente'
        
        db.add(parcela) # Adiciona ao session, mas não faz commit aqui.

# >>> FUNÇÃO calculate_next_due_date MODIFICADA <<<
def calculate_next_due_date(current_date: date, frequency: str) -> date:
    if frequency == "mensal":
        return current_date + relativedelta(months=1)
    elif frequency == "quinzenal":
        return current_date + timedelta(days=15)
    elif frequency == "trimestral":
        return current_date + relativedelta(months=3)
    else:
        raise ValueError(f"Frequência de pagamento inválida: {frequency}")
# >>> FIM DA MODIFICAÇÃO <<<

def calculate_parcela_saldo_devedor(parcela_valor_devido: Decimal, pagos: Decimal, juros: Decimal) -> Decimal:
    return (parcela_valor_devido + juros) - pagos

# --- Operações de Produto ---
def create_produto(db: Session, produto: schemas.ProdutoCreate) -> models.Produto:
    db_produto = models.Produto(
        nome=produto.nome,
        descricao=produto.descricao,
        categoria=produto.categoria,
        marca=produto.marca,
        imei=produto.imei,
        codigo_sku=produto.codigo_sku,
        preco_venda=produto.preco_venda,
        preco_custo=produto.preco_custo,
        estoque_atual=produto.estoque_atual if produto.estoque_atual is not None else 0,
        unidade_medida=produto.unidade_medida if produto.unidade_medida else "unidade"
    )
    try:
        db.add(db_produto)
        db.commit()
        db.refresh(db_produto)
        return db_produto
    except IntegrityError as e:
        db.rollback()
        error_info = str(e.orig).lower()
        if "duplicate key value violates unique constraint" in error_info:
            if "produto_imei_key" in error_info or (db_produto.imei and f"({db_produto.imei})" in error_info):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"IMEI '{db_produto.imei}' já cadastrado.")
            if "produto_codigo_sku_key" in error_info or (db_produto.codigo_sku and f"({db_produto.codigo_sku})" in error_info):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Código SKU '{db_produto.codigo_sku}' já cadastrado.")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Erro ao criar produto. Verifique os dados.")

def get_produto(db: Session, produto_id: int) -> Optional[models.Produto]:
    return db.query(models.Produto).filter(models.Produto.id_produto == produto_id).first()

def get_produtos(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    search_query: Optional[str] = None,
    categoria: Optional[str] = None,
    marca: Optional[str] = None
) -> List[models.Produto]:
    query = db.query(models.Produto)
    if search_query:
        query = query.filter(models.Produto.nome.ilike(f"%{search_query}%"))
    if categoria:
        query = query.filter(models.Produto.categoria.ilike(f"%{categoria}%"))
    if marca:
        query = query.filter(models.Produto.marca.ilike(f"%{marca}%"))
    return query.order_by(models.Produto.nome).offset(skip).limit(limit).all()

def update_produto(db: Session, produto_id: int, produto_update: schemas.ProdutoUpdate) -> Optional[models.Produto]:
    db_produto = get_produto(db, produto_id)
    if not db_produto:
        return None

    update_data = produto_update.model_dump(exclude_unset=True)

    for key, value in update_data.items():
        if key in ['preco_venda', 'preco_custo'] and value is not None:
            setattr(db_produto, key, value) # Removido Decimal(str())
        else:
            setattr(db_produto, key, value)

    try:
        db.add(db_produto)
        db.commit()
        db.refresh(db_produto)
        return db_produto
    except IntegrityError as e:
        db.rollback()
        error_info = str(e.orig).lower()
        if "duplicate key value violates unique constraint" in error_info:
            if "produto_imei_key" in error_info or (db_produto.imei and f"({db_produto.imei})" in error_info):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"IMEI '{db_produto.imei}' já cadastrado para outro produto.")
            if "produto_codigo_sku_key" in error_info or (db_produto.codigo_sku and f"({db_produto.codigo_sku})" in error_info):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Código SKU '{db_produto.codigo_sku}' já cadastrado para outro produto.")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Erro ao atualizar produto. Verifique os dados.")

def delete_produto(db: Session, produto_id: int) -> Optional[models.Produto]:
    db_produto = get_produto(db, produto_id)
    if not db_produto:
        return None
    db.delete(db_produto)
    db.commit()
    return db_produto

# --- Operações de Usuário ---
def get_user_by_email(db: Session, email: str):
    return db.query(models.Usuario).filter(models.Usuario.email == email).first()

def create_user(db: Session, user: schemas.UserCreate):
    from app.auth import get_password_hash
    hashed_password = get_password_hash(user.senha)
    db_user = models.Usuario(
        nome=user.nome,
        email=user.email,
        senha_hash=hashed_password,
        perfil=user.perfil
    )
    try:
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
        return db_user
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email já registrado")

def update_user(db: Session, user_id: int, user_update: schemas.UserUpdate):
    db_user = db.query(models.Usuario).filter(models.Usuario.id_usuario == user_id).first()
    if not db_user:
        return None
    update_data = user_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        if key in ["id_usuario", "senha_hash", "perfil"]:
            continue
        setattr(db_user, key, value)
    try:
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
        return db_user
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email já registrado por outro usuário")

# --- Operações de Cliente ---
def get_client(db: Session, client_id: int):
    return db.query(models.Cliente).filter(models.Cliente.id_cliente == client_id).first()

def get_clients(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    search_query: Optional[str] = None
):
    query = db.query(models.Cliente)
    if search_query:
        query = query.filter(
            (models.Cliente.nome.ilike(f"%{search_query}%")) |
            (models.Cliente.cpf_cnpj.ilike(f"%{search_query}%"))
        )
    return query.order_by(models.Cliente.nome).offset(skip).limit(limit).all()

def create_client(db: Session, client: schemas.ClientCreate):
    db_client = models.Cliente(**client.model_dump())
    try:
        db.add(db_client)
        db.commit()
        db.refresh(db_client)
        return db_client
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="CPF/CNPJ já registrado")

def update_client(db: Session, client_id: int, client_update: schemas.ClientUpdate):
    db_client = get_client(db, client_id)
    if not db_client:
        return None
    update_data = client_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_client, key, value)
    try:
        db.add(db_client)
        db.commit()
        db.refresh(db_client)
        return db_client
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="CPF/CNPJ já registrado por outro cliente")

def delete_client(db: Session, client_id: int):
    db_client = get_client(db, client_id)
    if not db_client:
        return None
    db.delete(db_client)
    db.commit()
    return db_client

def get_client_summary(db: Session, client_id: int):
    db_client = db.query(models.Cliente).options(
        joinedload(models.Cliente.carnes).joinedload(models.Carne.parcelas).joinedload(models.Parcela.pagamentos)
    ).filter(models.Cliente.id_cliente == client_id).first()

    if not db_client:
        return None

    total_divida_aberta = Decimal('0.00')
    total_pago_historico = Decimal('0.00')
    numero_carnes_ativos = 0
    numero_carnes_quitados = 0
    numero_carnes_cancelados = 0

    for carne_obj in db_client.carnes:
        # Aplica juros/multas e atualiza status das parcelas.
        # Não faz commit aqui, pois a lógica de update do carnê fará.
        for parcela in carne_obj.parcelas:
            _apply_interest_and_fine_if_due(db, parcela)

        # Recalcula o status do carnê com base no status das parcelas após aplicação de juros
        if carne_obj.status_carne != 'Cancelado':
            all_parcels_paid = all(p.status_parcela in ['Paga', 'Paga com Atraso'] for p in carne_obj.parcelas)
            has_overdue_parcel = any(p.status_parcela == 'Atrasada' for p in carne_obj.parcelas)
            has_partially_paid_parcel = any(p.status_parcela == 'Parcialmente Paga' for p in carne_obj.parcelas)
            
            if all_parcels_paid and carne_obj.parcelas:
                carne_obj.status_carne = 'Quitado'
            elif has_overdue_parcel:
                carne_obj.status_carne = 'Em Atraso'
            elif has_partially_paid_parcel:
                carne_obj.status_carne = 'Ativo' # Pode ser 'Parcialmente Ativo' se quiser distinguir
            else:
                carne_obj.status_carne = 'Ativo' # Se não tem atrasadas e não pagas, mas também não totalmente pagas
        db.add(carne_obj) # Adiciona ao session, mas não faz commit aqui

    db.commit() # Commit uma vez após o loop de carnês para salvar as mudanças de status e juros/multas

    # Após o commit, re-refresh para garantir que os dados de status e saldos estão atualizados para o resumo
    db.refresh(db_client)
    for carne_obj in db_client.carnes:
        db.refresh(carne_obj)
        for parcela in carne_obj.parcelas:
            db.refresh(parcela)

        if carne_obj.status_carne == 'Quitado':
            numero_carnes_quitados += 1
        elif carne_obj.status_carne == 'Cancelado':
            numero_carnes_cancelados += 1
        else: # Inclui Ativo, Em Atraso
            numero_carnes_ativos += 1
            for parcela in carne_obj.parcelas:
                # Soma a dívida aberta apenas se o status da parcela indica que há saldo a ser pago
                if parcela.status_parcela not in ['Paga', 'Paga com Atraso', 'Cancelada']:
                    total_divida_aberta += parcela.saldo_devedor

        for parcela in carne_obj.parcelas:
            total_pago_historico += parcela.valor_pago


    client_data_for_summary = schemas.ClientResponse.model_validate(db_client).model_dump()
    client_summary = schemas.ClientSummaryResponse(
        **client_data_for_summary,
        total_divida_aberta=float(total_divida_aberta), # Convert Decimal to float for response schema
        total_pago_historico=float(total_pago_historico), # Convert Decimal to float for response schema
        numero_carnes_ativos=numero_carnes_ativos,
        numero_carnes_quitados=numero_carnes_quitados,
        numero_carnes_cancelados=numero_carnes_cancelados
    )
    return client_summary

# --- Operações de Carne ---
def get_carne(db: Session, carne_id: int, apply_interest: bool = True):
    # Alterado para carregar pagamentos aninhados ao carnê, incluindo usuário e número da parcela
    db_carne = db.query(models.Carne).options(
        joinedload(models.Carne.cliente),
        joinedload(models.Carne.parcelas).joinedload(models.Parcela.pagamentos).joinedload(models.Pagamento.usuario_registro),
        joinedload(models.Carne.parcelas) # Carrega as parcelas diretamente
    ).filter(models.Carne.id_carne == carne_id).first()

    if db_carne and apply_interest:
        needs_commit = False
        for parcela in db_carne.parcelas:
            original_juros_multa = parcela.juros_multa
            original_saldo_devedor = parcela.saldo_devedor
            original_status_parcela = parcela.status_parcela
            _apply_interest_and_fine_if_due(db, parcela)
            if (parcela.juros_multa != original_juros_multa or 
                parcela.saldo_devedor != original_saldo_devedor or 
                parcela.status_parcela != original_status_parcela):
                needs_commit = True
                db.add(parcela) # Marca para salvamento

        # Recalcula o status do carnê após aplicar juros às parcelas
        if db_carne.status_carne != 'Cancelado':
            all_parcels_paid = all(p.status_parcela in ['Paga', 'Paga com Atraso'] for p in db_carne.parcelas)
            has_overdue_parcel = any(p.status_parcela == 'Atrasada' for p in db_carne.parcelas)
            has_partially_paid_parcel = any(p.status_parcela == 'Parcialmente Paga' for p in db_carne.parcelas)
            
            new_status_carne = db_carne.status_carne # Manter o status atual se não houver mudança

            if all_parcels_paid and db_carne.parcelas:
                new_status_carne = 'Quitado'
            elif has_overdue_parcel:
                new_status_carne = 'Em Atraso'
            elif has_partially_paid_parcel:
                new_status_carne = 'Ativo' # Pode ser 'Parcialmente Ativo' se quiser distinguir
            else:
                new_status_carne = 'Ativo'
            
            if db_carne.status_carne != new_status_carne:
                db_carne.status_carne = new_status_carne
                needs_commit = True
                db.add(db_carne) # Marca o carnê para salvamento

        if needs_commit:
            db.commit() # Commit uma vez para todas as parcelas e o carnê
            db.refresh(db_carne) # Refresha o carnê para ter os dados mais recentes

    # Consolidar pagamentos de todas as parcelas em uma lista plana para o Carnê
    all_payments = []
    if db_carne:
        for parcela in db_carne.parcelas:
            db.refresh(parcela) # Ensure parcela is fresh to get its payments
            for pagamento in parcela.pagamentos:
                db.refresh(pagamento) # Ensure payment is fresh
                # Construct payment data as a dictionary that matches PagamentoResponseMin
                payment_data = {
                    "id_pagamento": pagamento.id_pagamento,
                    "data_pagamento": pagamento.data_pagamento,
                    "valor_pago": float(pagamento.valor_pago), # Converter Decimal para float para o schema de resposta
                    "forma_pagamento": pagamento.forma_pagamento,
                    "observacoes": pagamento.observacoes,
                    "id_usuario_registro": pagamento.id_usuario_registro,
                    "parcela_numero": parcela.numero_parcela,
                    "parcela_data_vencimento": parcela.data_vencimento,
                    "usuario_registro_nome": pagamento.usuario_registro.nome if pagamento.usuario_registro else 'N/A'
                }
                all_payments.append(payment_data)
    
    # Ordenar pagamentos por data (mais recente primeiro)
    all_payments.sort(key=lambda p: p['data_pagamento'], reverse=True)

    # Construir um dicionário completo para CarneResponse
    carne_response_data = {
        "id_carne": db_carne.id_carne,
        "id_cliente": db_carne.id_cliente,
        "data_venda": db_carne.data_venda,
        "descricao": db_carne.descricao,
        "valor_total_original": float(db_carne.valor_total_original), # Converter Decimal para float para o schema de resposta
        "numero_parcelas": db_carne.numero_parcelas,
        # Use valor_parcela_original para o campo sugerido se for carnê fixo
        "valor_parcela_sugerido": float(db_carne.valor_parcela_original) if db_carne.parcela_fixa else None,
        "data_primeiro_vencimento": db_carne.data_primeiro_vencimento,
        "frequencia_pagamento": db_carne.frequencia_pagamento,
        "status_carne": db_carne.status_carne,
        "observacoes": db_carne.observacoes,
        "valor_entrada": float(db_carne.valor_entrada), # Converter Decimal para float para o schema de resposta
        "forma_pagamento_entrada": db_carne.forma_pagamento_entrada,
        "parcela_fixa": db_carne.parcela_fixa,
        "data_criacao": db_carne.data_criacao,
        "valor_parcela_original": float(db_carne.valor_parcela_original), # Converter Decimal para float para o schema de resposta
        "cliente": schemas.ClientResponseMin.model_validate(db_carne.cliente).model_dump(),
        "pagamentos": all_payments, # A lista consolidada de pagamentos
        "parcelas": [schemas.ParcelaResponse.model_validate(p).model_dump() for p in db_carne.parcelas]
    }

    # Finalmente, valide o dicionário inteiro com o esquema CarneResponse
    return schemas.CarneResponse.model_validate(carne_response_data)

def get_carnes(
    db: Session, skip: int = 0, limit: int = 100, id_cliente: Optional[int] = None,
    status_carne: Optional[str] = None, data_vencimento_inicio: Optional[date] = None,
    data_vencimento_fim: Optional[date] = None, search_query: Optional[str] = None
):
    query = db.query(models.Carne).options(
        joinedload(models.Carne.cliente),
        joinedload(models.Carne.parcelas).joinedload(models.Parcela.pagamentos).joinedload(models.Pagamento.usuario_registro) # Carrega pagamentos e usuários de registro
    )

    if id_cliente:
        query = query.filter(models.Carne.id_cliente == id_cliente)
    if status_carne:
        query = query.filter(models.Carne.status_carne == status_carne)

    # Filtragem por data de vencimento precisa juntar com Parcelas
    if data_vencimento_inicio or data_vencimento_fim:
        query = query.join(models.Carne.parcelas) # Garante que estamos filtrando por parcelas do carnê
        if data_vencimento_inicio:
            query = query.filter(models.Parcela.data_vencimento >= data_vencimento_inicio)
        if data_vencimento_fim:
            query = query.filter(models.Parcela.data_vencimento <= data_vencimento_fim)
        query = query.distinct(models.Carne.id_carne) # Para evitar carnês duplicados se tiverem várias parcelas no range
        
    if search_query:
        query = query.filter(
            (models.Carne.descricao.ilike(f"%{search_query}%")) |
            (models.Carne.cliente.has(models.Cliente.nome.ilike(f"%{search_query}%"))) |
            (models.Carne.cliente.has(models.Cliente.cpf_cnpj.ilike(f"%{search_query}%")))
        )

    # Ordenação mais robusta: primeiro por data de venda (mais recente) e depois por data de criação.
    query = query.order_by(models.Carne.data_venda.desc().nullslast(), models.Carne.data_criacao.desc())

    db_carnes = query.offset(skip).limit(limit).all()

    needs_overall_commit = False
    for carne_obj in db_carnes:
        # Aplicar juros/multas e atualizar status das parcelas individualmente
        for parcela in carne_obj.parcelas:
            original_status = parcela.status_parcela
            original_juros = parcela.juros_multa
            _apply_interest_and_fine_if_due(db, parcela)
            if parcela.status_parcela != original_status or parcela.juros_multa != original_juros:
                needs_overall_commit = True
                db.add(parcela) # Marca parcela para commit

        # Recalcular o status do carnê
        if carne_obj.status_carne != 'Cancelado':
            all_parcels_paid = all(p.status_parcela in ['Paga', 'Paga com Atraso'] for p in carne_obj.parcelas)
            has_overdue_parcel = any(p.status_parcela == 'Atrasada' for p in carne_obj.parcelas)
            has_partially_paid_parcel = any(p.status_parcela == 'Parcialmente Paga' for p in carne_obj.parcelas)

            new_status_carne = carne_obj.status_carne
            if all_parcels_paid and carne_obj.parcelas:
                new_status_carne = 'Quitado'
            elif has_overdue_parcel:
                new_status_carne = 'Em Atraso'
            elif has_partially_paid_parcel:
                new_status_carne = 'Ativo' # Ou 'Parcialmente Ativo'
            else:
                new_status_carne = 'Ativo' # Se não tem atrasadas e não pagas, mas também não totalmente pagas
            
            if carne_obj.status_carne != new_status_carne:
                carne_obj.status_carne = new_status_carne
                needs_overall_commit = True
                db.add(carne_obj) # Marca carnê para commit

    if needs_overall_commit:
        db.commit() # Commit uma vez para todas as mudanças coletadas

    # Refresha todos os objetos para garantir que os dados retornados estão atualizados
    final_carnes_list = []
    for carne_obj in db_carnes:
        db.refresh(carne_obj)
        # Consolidar pagamentos para cada carnê na lista
        all_payments_for_carne = []
        if carne_obj:
            for parcela in carne_obj.parcelas:
                db.refresh(parcela) # Refresha a parcela também para ter pagamentos atualizados
                for pagamento in parcela.pagamentos:
                    db.refresh(pagamento) # Refresha o pagamento
                    # Constrói o dicionário de pagamento
                    payment_data = {
                        "id_pagamento": pagamento.id_pagamento,
                        "data_pagamento": pagamento.data_pagamento,
                        "valor_pago": float(pagamento.valor_pago), # Converter Decimal para float para o schema de resposta
                        "forma_pagamento": pagamento.forma_pagamento,
                        "observacoes": pagamento.observacoes,
                        "id_usuario_registro": pagamento.id_usuario_registro,
                        "parcela_numero": parcela.numero_parcela,
                        "parcela_data_vencimento": parcela.data_vencimento,
                        "usuario_registro_nome": pagamento.usuario_registro.nome if pagamento.usuario_registro else 'N/A'
                    }
                    all_payments_for_carne.append(payment_data)
        all_payments_for_carne.sort(key=lambda p: p['data_pagamento'], reverse=True)
        
        # Constrói o dicionário completo para CarneResponse para este carnê
        carne_response_dict = {
            "id_carne": carne_obj.id_carne,
            "id_cliente": carne_obj.id_cliente,
            "data_venda": carne_obj.data_venda,
            "descricao": carne_obj.descricao,
            "valor_total_original": float(carne_obj.valor_total_original), # Converter Decimal para float para o schema de resposta
            "numero_parcelas": carne_obj.numero_parcelas,
            # Use valor_parcela_original para o campo sugerido se for carnê fixo
            "valor_parcela_sugerido": float(carne_obj.valor_parcela_original) if carne_obj.parcela_fixa else None,
            "data_primeiro_vencimento": carne_obj.data_primeiro_vencimento,
            "frequencia_pagamento": carne_obj.frequencia_pagamento,
            "status_carne": carne_obj.status_carne,
            "observacoes": carne_obj.observacoes,
            "valor_entrada": float(carne_obj.valor_entrada), # Converter Decimal para float para o schema de resposta
            "forma_pagamento_entrada": carne_obj.forma_pagamento_entrada,
            "parcela_fixa": carne_obj.parcela_fixa,
            "data_criacao": carne_obj.data_criacao,
            "valor_parcela_original": float(carne_obj.valor_parcela_original), # Converter Decimal para float para o schema de resposta
            "cliente": schemas.ClientResponseMin.model_validate(carne_obj.cliente).model_dump(),
            "pagamentos": all_payments_for_carne, # Adiciona pagamentos consolidados
            "parcelas": [schemas.ParcelaResponse.model_validate(p).model_dump() for p in carne_obj.parcelas]
        }

        final_carnes_list.append(schemas.CarneResponse.model_validate(carne_response_dict))

    return final_carnes_list


def create_carne(db: Session, carne: schemas.CarneCreate):
    valor_total_original_decimal = carne.valor_total_original # Alterado: Pydantic já validou para Decimal
    valor_entrada_decimal = carne.valor_entrada # Alterado: Pydantic já validou para Decimal
    valor_a_parcelar = valor_total_original_decimal - valor_entrada_decimal

    if valor_entrada_decimal > valor_total_original_decimal:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="O valor de entrada não pode ser maior que o valor total original da dívida.")

    if carne.data_venda and carne.data_primeiro_vencimento < carne.data_venda:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A data do primeiro vencimento não pode ser anterior à data da venda.")

    # --- Lógica para parcela_fixa ---
    if not carne.parcela_fixa: # Carnê sem parcela fixa (flexível)
        db_carne = models.Carne(
            id_cliente=carne.id_cliente,
            data_venda=carne.data_venda,
            descricao=carne.descricao,
            valor_total_original=valor_total_original_decimal,
            numero_parcelas=1, # Para carnês flexíveis, sempre 1 parcela (total da dívida)
            valor_parcela_original=valor_a_parcelar, # A "parcela original" é o total a ser pago após a entrada
            data_primeiro_vencimento=carne.data_primeiro_vencimento,
            frequencia_pagamento="única", # Ou "variável", um valor que indique flexibilidade
            status_carne=carne.status_carne if carne.status_carne else "Ativo",
            observacoes=carne.observacoes,
            valor_entrada=valor_entrada_decimal,
            forma_pagamento_entrada=carne.forma_pagamento_entrada,
            parcela_fixa=False # Define como não fixa
        )
        db.add(db_carne)
        db.commit()
        db.refresh(db_carne)

        # Cria a única parcela para o carnê flexível
        db_parcela = models.Parcela(
            id_carne=db_carne.id_carne,
            numero_parcela=1,
            valor_devido=valor_a_parcelar,
            data_vencimento=carne.data_primeiro_vencimento,
            valor_pago=Decimal('0.00'),
            saldo_devedor=valor_a_parcelar,
            status_parcela='Pendente',
            juros_multa=Decimal('0.00'),
            juros_multa_anterior_aplicada=Decimal('0.00'),
            observacoes=None
        )
        db.add(db_parcela)
        db.commit()
        db.refresh(db_carne) # Refresh novamente para carregar as parcelas
        return db_carne
    else: # Carnê com parcela fixa (comportamento anterior)
        if carne.numero_parcelas <= 0:
            if valor_a_parcelar != Decimal('0.00'):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Se o número de parcelas é zero, o valor total deve ser igual ao valor de entrada.")
        # NOVO CÁLCULO DO VALOR DA PARCELA ORIGINAL COM BASE NO VALOR SUGERIDO OU DISTRIBUIÇÃO UNIFORME
        valor_parcela_original_calculado = Decimal('0.00')
        if carne.numero_parcelas > 0:
            if carne.valor_parcela_sugerido:
                valor_parcela_original_calculado = carne.valor_parcela_sugerido.quantize(Decimal('0.01')) # Alterado: Pydantic já validou para Decimal
                if valor_parcela_original_calculado <= 0:
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Valor sugerido da parcela deve ser maior que zero.")
            else:
                if valor_a_parcelar > Decimal('0.00'):
                     valor_parcela_original_calculado = (valor_a_parcelar / carne.numero_parcelas).quantize(Decimal('0.01'))
                else:
                     valor_parcela_original_calculado = Decimal('0.00')

        db_carne = models.Carne(
            id_cliente=carne.id_cliente,
            data_venda=carne.data_venda,
            descricao=carne.descricao,
            valor_total_original=valor_total_original_decimal,
            numero_parcelas=carne.numero_parcelas,
            valor_parcela_original=valor_parcela_original_calculado,
            data_primeiro_vencimento=carne.data_primeiro_vencimento,
            frequencia_pagamento=carne.frequencia_pagamento,
            status_carne=carne.status_carne if carne.status_carne else "Ativo",
            observacoes=carne.observacoes,
            valor_entrada=valor_entrada_decimal,
            forma_pagamento_entrada=carne.forma_pagamento_entrada,
            parcela_fixa=True # Define como fixa
        )
        db.add(db_carne)
        db.commit()
        db.refresh(db_carne)

        current_due_date = carne.data_primeiro_vencimento
        if carne.numero_parcelas > 0:
            valor_a_parcelar_recalc = valor_total_original_decimal - valor_entrada_decimal
            for i in range(carne.numero_parcelas):
                parcela_valor_devido = valor_parcela_original_calculado
                if i == carne.numero_parcelas - 1:
                    soma_parcelas_anteriores = valor_parcela_original_calculado * i
                    parcela_valor_devido = valor_a_parcelar_recalc - soma_parcelas_anteriores
                    parcela_valor_devido = parcela_valor_devido.quantize(Decimal('0.01'))

                if parcela_valor_devido < Decimal('0.00'):
                    parcela_valor_devido = Decimal('0.00')

                db_parcela = models.Parcela(
                    id_carne=db_carne.id_carne,
                    numero_parcela=i + 1,
                    valor_devido=parcela_valor_devido,
                    data_vencimento=current_due_date,
                    valor_pago=Decimal('0.00'),
                    saldo_devedor=parcela_valor_devido,
                    status_parcela='Pendente',
                    juros_multa=Decimal('0.00'),
                    juros_multa_anterior_aplicada=Decimal('0.00'),
                    observacoes=None
                )
                db.add(db_parcela)
                current_due_date = calculate_next_due_date(current_due_date, db_carne.frequencia_pagamento)

            db.commit()
            db.refresh(db_carne) # Refresh novamente para carregar as parcelas
        return db_carne


def update_carne(db: Session, carne_id: int, carne_update: schemas.CarneCreate):
    db_carne = db.query(models.Carne).filter(models.Carne.id_carne == carne_id).first()
    if not db_carne:
        return None

    has_payments = db.query(models.Pagamento).join(models.Parcela).filter(models.Parcela.id_carne == carne_id).first()

    update_data = carne_update.model_dump(exclude_unset=False)

    new_data_venda = update_data.get('data_venda', db_carne.data_venda)
    new_data_primeiro_vencimento = update_data.get('data_primeiro_vencimento', db_carne.data_primeiro_vencimento)
    if new_data_venda and new_data_primeiro_vencimento < new_data_venda:
         raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A data do primeiro vencimento não pode ser anterior à data da venda.")

    # Detectar mudança no tipo de carnê (fixo/flexível) ou em campos financeiros que exigem regeneração
    regenerate_parcels_flag = False
    financial_keys_for_parcel_regeneration = [
        'valor_total_original', 'numero_parcelas',
        'valor_parcela_sugerido', # Campo relevante para carnê fixo
        'data_primeiro_vencimento',
        'frequencia_pagamento', 'valor_entrada',
        'parcela_fixa' # NOVO: Mudança no tipo de carnê exige regeneração
    ]

    if has_payments:
        # Se tem pagamentos, só permite alterar descricao, status_carne, observacoes, data_venda
        allowed_keys_with_payments = ['descricao', 'status_carne', 'observacoes', 'data_venda']
        for key_to_update in list(update_data.keys()):
            if key_to_update not in allowed_keys_with_payments:
                if getattr(db_carne, key_to_update) != update_data[key_to_update]:
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                        detail=f"Não é possível alterar o campo '{key_to_update}' de um carnê que já possui pagamentos.")
    else: # Não tem pagamentos, pode regenerar parcelas
        for key in financial_keys_for_parcel_regeneration:
            if key in update_data:
                current_val = getattr(db_carne, key)
                new_val = update_data.get(key)

                # Tratamento para comparação de Decimals
                if key in ['valor_total_original', 'valor_parcela_sugerido', 'valor_entrada']:
                    current_val = Decimal(str(current_val)) if current_val is not None else None # manter str para Decimal para compatibilidade
                    new_val = Decimal(str(new_val)) if new_val is not None else None # manter str para Decimal para compatibilidade
                # Para booleanos, comparar diretamente
                elif key == 'parcela_fixa':
                    if current_val != new_val: # A mudança no tipo de parcela sempre dispara regeneração
                        regenerate_parcels_flag = True
                        break
                # Para outros tipos, comparação padrão
                if current_val != new_val:
                    regenerate_parcels_flag = True
                    break

    # Aplicar as atualizações aos campos do objeto db_carne
    for key, value in update_data.items():
        if key == 'valor_parcela_original': # Este campo é calculado, não setado diretamente
            continue
        if key in ['valor_total_original', 'valor_entrada'] and value is not None:
            setattr(db_carne, key, value) # Alterado: Pydantic já validou para Decimal
        elif key == 'valor_parcela_sugerido' and value is not None:
            pass # Não armazena diretamente no db_carne, é usado para cálculo
        else:
            setattr(db_carne, key, value)

    # Lógica de regeneração de parcelas
    if regenerate_parcels_flag and not has_payments:
        # Excluir parcelas existentes
        db.query(models.Parcela).filter(models.Parcela.id_carne == carne_id).delete(synchronize_session='fetch')
        db.flush() # Garante que as deleções sejam processadas antes de adicionar novas

        valor_total_original_decimal = db_carne.valor_total_original # Alterado: Pydantic já validou para Decimal
        valor_entrada_decimal = db_carne.valor_entrada # Alterado: Pydantic já validou para Decimal
        valor_a_parcelar = valor_total_original_decimal - valor_entrada_decimal

        # Se o carnê se torna não fixo
        if not db_carne.parcela_fixa:
            db_carne.numero_parcelas = 1
            db_carne.valor_parcela_original = valor_a_parcelar.quantize(Decimal('0.01'))
            db_carne.frequencia_pagamento = "única" # Ou "variável"

            db_parcela_nova = models.Parcela(
                id_carne=db_carne.id_carne,
                numero_parcela=1,
                valor_devido=valor_a_parcelar,
                data_vencimento=db_carne.data_primeiro_vencimento,
                valor_pago=Decimal('0.00'),
                saldo_devedor=valor_a_parcelar,
                status_parcela='Pendente',
                juros_multa=Decimal('0.00'),
                juros_multa_anterior_aplicada=Decimal('0.00'),
                observacoes=None
            )
            db.add(db_parcela_nova)
        else: # Se o carnê é fixo (ou mudou para fixo)
            if db_carne.numero_parcelas <= 0:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Para carnês com parcela fixa, o número de parcelas deve ser maior que zero.")
            if valor_a_parcelar <= Decimal('0.00') and db_carne.numero_parcelas > 0:
                 pass # A validação já é feita no frontend ou no esquema

            valor_parcela_sugerido_decimal = carne_update.valor_parcela_sugerido if carne_update.valor_parcela_sugerido is not None else Decimal('0.00') # Alterado para usar o Decimal do update_data
            if valor_parcela_sugerido_decimal == Decimal('0.00'): # Default se não sugerido
                if valor_a_parcelar > Decimal('0.00'):
                    valor_parcela_original_calculado = (valor_a_parcelar / db_carne.numero_parcelas).quantize(Decimal('0.01'))
                else:
                    valor_parcela_original_calculado = Decimal('0.00')
            else:
                valor_parcela_original_calculado = valor_parcela_sugerido_decimal


            db_carne.valor_parcela_original = valor_parcela_original_calculado # ATUALIZA O VALOR NO OBJETO DO CARNÊ

            current_due_date = db_carne.data_primeiro_vencimento
            for i in range(db_carne.numero_parcelas):
                parcela_valor_devido = valor_parcela_original_calculado
                if i == db_carne.numero_parcelas - 1:
                    soma_parcelas_anteriores = valor_parcela_original_calculado * i
                    parcela_valor_devido = valor_a_parcelar - soma_parcelas_anteriores
                    parcela_valor_devido = parcela_valor_devido.quantize(Decimal('0.01'))

                if parcela_valor_devido < Decimal('0.00'):
                    parcela_valor_devido = Decimal('0.00')

                db_parcela = models.Parcela(
                    id_carne=db_carne.id_carne,
                    numero_parcela=i + 1,
                    valor_devido=parcela_valor_devido,
                    data_vencimento=current_due_date,
                    valor_pago=Decimal('0.00'),
                    saldo_devedor=parcela_valor_devido,
                    status_parcela='Pendente',
                    juros_multa=Decimal('0.00'),
                    juros_multa_anterior_aplicada=Decimal('0.00'),
                    observacoes=None
                )
                db.add(db_parcela)
                current_due_date = calculate_next_due_date(current_due_date, db_carne.frequencia_pagamento)

            db.commit()
            db.refresh(db_carne) # Refresh novamente para carregar as parcelas
        return db_carne


def update_carne(db: Session, carne_id: int, carne_update: schemas.CarneCreate):
    db_carne = db.query(models.Carne).filter(models.Carne.id_carne == carne_id).first()
    if not db_carne:
        return None

    has_payments = db.query(models.Pagamento).join(models.Parcela).filter(models.Parcela.id_carne == carne_id).first()

    update_data = carne_update.model_dump(exclude_unset=False)

    new_data_venda = update_data.get('data_venda', db_carne.data_venda)
    new_data_primeiro_vencimento = update_data.get('data_primeiro_vencimento', db_carne.data_primeiro_vencimento)
    if new_data_venda and new_data_primeiro_vencimento < new_data_venda:
         raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A data do primeiro vencimento não pode ser anterior à data da venda.")

    # Detectar mudança no tipo de carnê (fixo/flexível) ou em campos financeiros que exigem regeneração
    regenerate_parcels_flag = False
    financial_keys_for_parcel_regeneration = [
        'valor_total_original', 'numero_parcelas',
        'valor_parcela_sugerido', # Campo relevante para carnê fixo
        'data_primeiro_vencimento',
        'frequencia_pagamento', 'valor_entrada',
        'parcela_fixa' # NOVO: Mudança no tipo de carnê exige regeneração
    ]

    if has_payments:
        # Se tem pagamentos, só permite alterar descricao, status_carne, observacoes, data_venda
        allowed_keys_with_payments = ['descricao', 'status_carne', 'observacoes', 'data_venda']
        for key_to_update in list(update_data.keys()):
            if key_to_update not in allowed_keys_with_payments:
                if getattr(db_carne, key_to_update) != update_data[key_to_update]:
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                        detail=f"Não é possível alterar o campo '{key_to_update}' de um carnê que já possui pagamentos.")
    else: # Não tem pagamentos, pode regenerar parcelas
        for key in financial_keys_for_parcel_regeneration:
            if key in update_data:
                current_val = getattr(db_carne, key)
                new_val = update_data.get(key)

                # Tratamento para comparação de Decimals
                if key in ['valor_total_original', 'valor_parcela_sugerido', 'valor_entrada']:
                    current_val = Decimal(str(current_val)) if current_val is not None else None # manter str para Decimal para compatibilidade
                    new_val = Decimal(str(new_val)) if new_val is not None else None # manter str para Decimal para compatibilidade
                # Para booleanos, comparar diretamente
                elif key == 'parcela_fixa':
                    if current_val != new_val: # A mudança no tipo de parcela sempre dispara regeneração
                        regenerate_parcels_flag = True
                        break
                # Para outros tipos, comparação padrão
                if current_val != new_val:
                    regenerate_parcels_flag = True
                    break

    # Aplicar as atualizações aos campos do objeto db_carne
    for key, value in update_data.items():
        if key == 'valor_parcela_original': # Este campo é calculado, não setado diretamente
            continue
        if key in ['valor_total_original', 'valor_entrada'] and value is not None:
            setattr(db_carne, key, value) # Alterado: Pydantic já validou para Decimal
        elif key == 'valor_parcela_sugerido' and value is not None:
            pass # Não armazena diretamente no db_carne, é usado para cálculo
        else:
            setattr(db_carne, key, value)

    # Lógica de regeneração de parcelas
    if regenerate_parcels_flag and not has_payments:
        # Excluir parcelas existentes
        db.query(models.Parcela).filter(models.Parcela.id_carne == carne_id).delete(synchronize_session='fetch')
        db.flush() # Garante que as deleções sejam processadas antes de adicionar novas

        valor_total_original_decimal = db_carne.valor_total_original # Alterado: Pydantic já validou para Decimal
        valor_entrada_decimal = db_carne.valor_entrada # Alterado: Pydantic já validou para Decimal
        valor_a_parcelar = valor_total_original_decimal - valor_entrada_decimal

        # Se o carnê se torna não fixo
        if not db_carne.parcela_fixa:
            db_carne.numero_parcelas = 1
            db_carne.valor_parcela_original = valor_a_parcelar.quantize(Decimal('0.01'))
            db_carne.frequencia_pagamento = "única" # Ou "variável"

            db_parcela_nova = models.Parcela(
                id_carne=db_carne.id_carne,
                numero_parcela=1,
                valor_devido=valor_a_parcelar,
                data_vencimento=db_carne.data_primeiro_vencimento,
                valor_pago=Decimal('0.00'),
                saldo_devedor=valor_a_parcelar,
                status_parcela='Pendente',
                juros_multa=Decimal('0.00'),
                juros_multa_anterior_aplicada=Decimal('0.00'),
                observacoes=None
            )
            db.add(db_parcela_nova)
        else: # Se o carnê é fixo (ou mudou para fixo)
            if db_carne.numero_parcelas <= 0:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Para carnês com parcela fixa, o número de parcelas deve ser maior que zero.")
            if valor_a_parcelar <= Decimal('0.00') and db_carne.numero_parcelas > 0:
                 pass # A validação já é feita no frontend ou no esquema

            valor_parcela_sugerido_decimal = carne_update.valor_parcela_sugerido if carne_update.valor_parcela_sugerido is not None else Decimal('0.00') # Alterado para usar o Decimal do update_data
            if valor_parcela_sugerido_decimal == Decimal('0.00'): # Default se não sugerido
                if valor_a_parcelar > Decimal('0.00'):
                    valor_parcela_original_calculado = (valor_a_parcelar / db_carne.numero_parcelas).quantize(Decimal('0.01'))
                else:
                    valor_parcela_original_calculado = Decimal('0.00')
            else:
                valor_parcela_original_calculado = valor_parcela_sugerido_decimal


            db_carne.valor_parcela_original = valor_parcela_original_calculado # ATUALIZA O VALOR NO OBJETO DO CARNÊ

            current_due_date = db_carne.data_primeiro_vencimento
            for i in range(db_carne.numero_parcelas):
                parcela_valor_devido = valor_parcela_original_calculado
                if i == db_carne.numero_parcelas - 1:
                    soma_parcelas_anteriores = valor_parcela_original_calculado * i
                    parcela_valor_devido = valor_a_parcelar - soma_parcelas_anteriores
                    parcela_valor_devido = parcela_valor_devido.quantize(Decimal('0.01'))

                if parcela_valor_devido < Decimal('0.00'):
                    parcela_valor_devido = Decimal('0.00')

                db_parcela = models.Parcela(
                    id_carne=db_carne.id_carne,
                    numero_parcela=i + 1,
                    valor_devido=parcela_valor_devido,
                    data_vencimento=current_due_date,
                    valor_pago=Decimal('0.00'),
                    saldo_devedor=parcela_valor_devido,
                    status_parcela='Pendente',
                    juros_multa=Decimal('0.00'),
                    juros_multa_anterior_aplicada=Decimal('0.00'),
                    observacoes=None
                )
                db.add(db_parcela)
                current_due_date = calculate_next_due_date(current_due_date, db_carne.frequencia_pagamento)

            db.commit()
            db.refresh(db_carne) # Refresh novamente para carregar as parcelas
        return db_carne


def update_carne(db: Session, carne_id: int, carne_update: schemas.CarneCreate):
    db_carne = db.query(models.Carne).filter(models.Carne.id_carne == carne_id).first()
    if not db_carne:
        return None

    has_payments = db.query(models.Pagamento).join(models.Parcela).filter(models.Parcela.id_carne == carne_id).first()

    update_data = carne_update.model_dump(exclude_unset=False)

    new_data_venda = update_data.get('data_venda', db_carne.data_venda)
    new_data_primeiro_vencimento = update_data.get('data_primeiro_vencimento', db_carne.data_primeiro_vencimento)
    if new_data_venda and new_data_primeiro_vencimento < new_data_venda:
         raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A data do primeiro vencimento não pode ser anterior à data da venda.")

    # Detectar mudança no tipo de carnê (fixo/flexível) ou em campos financeiros que exigem regeneração
    regenerate_parcels_flag = False
    financial_keys_for_parcel_regeneration = [
        'valor_total_original', 'numero_parcelas',
        'valor_parcela_sugerido', # Campo relevante para carnê fixo
        'data_primeiro_vencimento',
        'frequencia_pagamento', 'valor_entrada',
        'parcela_fixa' # NOVO: Mudança no tipo de carnê exige regeneração
    ]

    if has_payments:
        # Se tem pagamentos, só permite alterar descricao, status_carne, observacoes, data_venda
        allowed_keys_with_payments = ['descricao', 'status_carne', 'observacoes', 'data_venda']
        for key_to_update in list(update_data.keys()):
            if key_to_update not in allowed_keys_with_payments:
                if getattr(db_carne, key_to_update) != update_data[key_to_update]:
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                        detail=f"Não é possível alterar o campo '{key_to_update}' de um carnê que já possui pagamentos.")
    else: # Não tem pagamentos, pode regenerar parcelas
        for key in financial_keys_for_parcel_regeneration:
            if key in update_data:
                current_val = getattr(db_carne, key)
                new_val = update_data.get(key)

                # Tratamento para comparação de Decimals
                if key in ['valor_total_original', 'valor_parcela_sugerido', 'valor_entrada']:
                    current_val = Decimal(str(current_val)) if current_val is not None else None # manter str para Decimal para compatibilidade
                    new_val = Decimal(str(new_val)) if new_val is not None else None # manter str para Decimal para compatibilidade
                # Para booleanos, comparar diretamente
                elif key == 'parcela_fixa':
                    if current_val != new_val: # A mudança no tipo de parcela sempre dispara regeneração
                        regenerate_parcels_flag = True
                        break
                # Para outros tipos, comparação padrão
                if current_val != new_val:
                    regenerate_parcels_flag = True
                    break

    # Aplicar as atualizações aos campos do objeto db_carne
    for key, value in update_data.items():
        if key == 'valor_parcela_original': # Este campo é calculado, não setado diretamente
            continue
        if key in ['valor_total_original', 'valor_entrada'] and value is not None:
            setattr(db_carne, key, value) # Alterado: Pydantic já validou para Decimal
        elif key == 'valor_parcela_sugerido' and value is not None:
            pass # Não armazena diretamente no db_carne, é usado para cálculo
        else:
            setattr(db_carne, key, value)

    # Lógica de regeneração de parcelas
    if regenerate_parcels_flag and not has_payments:
        # Excluir parcelas existentes
        db.query(models.Parcela).filter(models.Parcela.id_carne == carne_id).delete(synchronize_session='fetch')
        db.flush() # Garante que as deleções sejam processadas antes de adicionar novas

        valor_total_original_decimal = db_carne.valor_total_original # Alterado: Pydantic já validou para Decimal
        valor_entrada_decimal = db_carne.valor_entrada # Alterado: Pydantic já validou para Decimal
        valor_a_parcelar = valor_total_original_decimal - valor_entrada_decimal

        # Se o carnê se torna não fixo
        if not db_carne.parcela_fixa:
            db_carne.numero_parcelas = 1
            db_carne.valor_parcela_original = valor_a_parcelar.quantize(Decimal('0.01'))
            db_carne.frequencia_pagamento = "única" # Ou "variável"

            db_parcela_nova = models.Parcela(
                id_carne=db_carne.id_carne,
                numero_parcela=1,
                valor_devido=valor_a_parcelar,
                data_vencimento=db_carne.data_primeiro_vencimento,
                valor_pago=Decimal('0.00'),
                saldo_devedor=valor_a_parcelar,
                status_parcela='Pendente',
                juros_multa=Decimal('0.00'),
                juros_multa_anterior_aplicada=Decimal('0.00'),
                observacoes=None
            )
            db.add(db_parcela_nova)
        else: # Se o carnê é fixo (ou mudou para fixo)
            if db_carne.numero_parcelas <= 0:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Para carnês com parcela fixa, o número de parcelas deve ser maior que zero.")
            if valor_a_parcelar <= Decimal('0.00') and db_carne.numero_parcelas > 0:
                 pass # A validação já é feita no frontend ou no esquema

            valor_parcela_sugerido_decimal = carne_update.valor_parcela_sugerido if carne_update.valor_parcela_sugerido is not None else Decimal('0.00') # Alterado para usar o Decimal do update_data
            if valor_parcela_sugerido_decimal == Decimal('0.00'): # Default se não sugerido
                if valor_a_parcelar > Decimal('0.00'):
                    valor_parcela_original_calculado = (valor_a_parcelar / db_carne.numero_parcelas).quantize(Decimal('0.01'))
                else:
                    valor_parcela_original_calculado = Decimal('0.00')
            else:
                valor_parcela_original_calculado = valor_parcela_sugerido_decimal


            db_carne.valor_parcela_original = valor_parcela_original_calculado # ATUALIZA O VALOR NO OBJETO DO CARNÊ

            current_due_date = db_carne.data_primeiro_vencimento
            for i in range(db_carne.numero_parcelas):
                parcela_valor_devido = valor_parcela_original_calculado
                if i == db_carne.numero_parcelas - 1:
                    soma_parcelas_anteriores = valor_parcela_original_calculado * i
                    parcela_valor_devido = valor_a_parcelar - soma_parcelas_anteriores
                    parcela_valor_devido = parcela_valor_devido.quantize(Decimal('0.01'))

                if parcela_valor_devido < Decimal('0.00'):
                    parcela_valor_devido = Decimal('0.00')

                db_parcela = models.Parcela(
                    id_carne=db_carne.id_carne,
                    numero_parcela=i + 1,
                    valor_devido=parcela_valor_devido,
                    data_vencimento=current_due_date,
                    valor_pago=Decimal('0.00'),
                    saldo_devedor=parcela_valor_devido,
                    status_parcela='Pendente',
                    juros_multa=Decimal('0.00'),
                    juros_multa_anterior_aplicada=Decimal('0.00'),
                    observacoes=None
                )
                db.add(db_parcela)
                current_due_date = calculate_next_due_date(current_due_date, db_carne.frequencia_pagamento)

            db.commit()
            db.refresh(db_carne) # Refresh novamente para carregar as parcelas
        return db_carne


def update_carne(db: Session, carne_id: int, carne_update: schemas.CarneCreate):
    db_carne = db.query(models.Carne).filter(models.Carne.id_carne == carne_id).first()
    if not db_carne:
        return None

    has_payments = db.query(models.Pagamento).join(models.Parcela).filter(models.Parcela.id_carne == carne_id).first()

    update_data = carne_update.model_dump(exclude_unset=False)

    new_data_venda = update_data.get('data_venda', db_carne.data_venda)
    new_data_primeiro_vencimento = update_data.get('data_primeiro_vencimento', db_carne.data_primeiro_vencimento)
    if new_data_venda and new_data_primeiro_vencimento < new_data_venda:
         raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A data do primeiro vencimento não pode ser anterior à data da venda.")

    # Detectar mudança no tipo de carnê (fixo/flexível) ou em campos financeiros que exigem regeneração
    regenerate_parcels_flag = False
    financial_keys_for_parcel_regeneration = [
        'valor_total_original', 'numero_parcelas',
        'valor_parcela_sugerido', # Campo relevante para carnê fixo
        'data_primeiro_vencimento',
        'frequencia_pagamento', 'valor_entrada',
        'parcela_fixa' # NOVO: Mudança no tipo de carnê exige regeneração
    ]

    if has_payments:
        # Se tem pagamentos, só permite alterar descricao, status_carne, observacoes, data_venda
        allowed_keys_with_payments = ['descricao', 'status_carne', 'observacoes', 'data_venda']
        for key_to_update in list(update_data.keys()):
            if key_to_update not in allowed_keys_with_payments:
                if getattr(db_carne, key_to_update) != update_data[key_to_update]:
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                        detail=f"Não é possível alterar o campo '{key_to_update}' de um carnê que já possui pagamentos.")
    else: # Não tem pagamentos, pode regenerar parcelas
        for key in financial_keys_for_parcel_regeneration:
            if key in update_data:
                current_val = getattr(db_carne, key)
                new_val = update_data.get(key)

                # Tratamento para comparação de Decimals
                if key in ['valor_total_original', 'valor_parcela_sugerido', 'valor_entrada']:
                    current_val = Decimal(str(current_val)) if current_val is not None else None # manter str para Decimal para compatibilidade
                    new_val = Decimal(str(new_val)) if new_val is not None else None # manter str para Decimal para compatibilidade
                # Para booleanos, comparar diretamente
                elif key == 'parcela_fixa':
                    if current_val != new_val: # A mudança no tipo de parcela sempre dispara regeneração
                        regenerate_parcels_flag = True
                        break
                # Para outros tipos, comparação padrão
                if current_val != new_val:
                    regenerate_parcels_flag = True
                    break

    # Aplicar as atualizações aos campos do objeto db_carne
    for key, value in update_data.items():
        if key == 'valor_parcela_original': # Este campo é calculado, não setado diretamente
            continue
        if key in ['valor_total_original', 'valor_entrada'] and value is not None:
            setattr(db_carne, key, value) # Alterado: Pydantic já validou para Decimal
        elif key == 'valor_parcela_sugerido' and value is not None:
            pass # Não armazena diretamente no db_carne, é usado para cálculo
        else:
            setattr(db_carne, key, value)

    # Lógica de regeneração de parcelas
    if regenerate_parcels_flag and not has_payments:
        # Excluir parcelas existentes
        db.query(models.Parcela).filter(models.Parcela.id_carne == carne_id).delete(synchronize_session='fetch')
        db.flush() # Garante que as deleções sejam processadas antes de adicionar novas

        valor_total_original_decimal = db_carne.valor_total_original # Alterado: Pydantic já validou para Decimal
        valor_entrada_decimal = db_carne.valor_entrada # Alterado: Pydantic já validou para Decimal
        valor_a_parcelar = valor_total_original_decimal - valor_entrada_decimal

        # Se o carnê se torna não fixo
        if not db_carne.parcela_fixa:
            db_carne.numero_parcelas = 1
            db_carne.valor_parcela_original = valor_a_parcelar.quantize(Decimal('0.01'))
            db_carne.frequencia_pagamento = "única" # Ou "variável"

            db_parcela_nova = models.Parcela(
                id_carne=db_carne.id_carne,
                numero_parcela=1,
                valor_devido=valor_a_parcelar,
                data_vencimento=db_carne.data_primeiro_vencimento,
                valor_pago=Decimal('0.00'),
                saldo_devedor=valor_a_parcelar,
                status_parcela='Pendente',
                juros_multa=Decimal('0.00'),
                juros_multa_anterior_aplicada=Decimal('0.00'),
                observacoes=None
            )
            db.add(db_parcela_nova)
        else: # Se o carnê é fixo (ou mudou para fixo)
            if db_carne.numero_parcelas <= 0:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Para carnês com parcela fixa, o número de parcelas deve ser maior que zero.")
            if valor_a_parcelar <= Decimal('0.00') and db_carne.numero_parcelas > 0:
                 pass # A validação já é feita no frontend ou no esquema

            valor_parcela_sugerido_decimal = carne_update.valor_parcela_sugerido if carne_update.valor_parcela_sugerido is not None else Decimal('0.00') # Alterado para usar o Decimal do update_data
            if valor_parcela_sugerido_decimal == Decimal('0.00'): # Default se não sugerido
                if valor_a_parcelar > Decimal('0.00'):
                    valor_parcela_original_calculado = (valor_a_parcelar / db_carne.numero_parcelas).quantize(Decimal('0.01'))
                else:
                    valor_parcela_original_calculado = Decimal('0.00')
            else:
                valor_parcela_original_calculado = valor_parcela_sugerido_decimal


            db_carne.valor_parcela_original = valor_parcela_original_calculado # ATUALIZA O VALOR NO OBJETO DO CARNÊ

            current_due_date = db_carne.data_primeiro_vencimento
            for i in range(db_carne.numero_parcelas):
                parcela_valor_devido = valor_parcela_original_calculado
                if i == db_carne.numero_parcelas - 1:
                    soma_parcelas_anteriores = valor_parcela_original_calculado * i
                    parcela_valor_devido = valor_a_parcelar - soma_parcelas_anteriores
                    parcela_valor_devido = parcela_valor_devido.quantize(Decimal('0.01'))

                if parcela_valor_devido < Decimal('0.00'):
                    parcela_valor_devido = Decimal('0.00')

                db_parcela = models.Parcela(
                    id_carne=db_carne.id_carne,
                    numero_parcela=i + 1,
                    valor_devido=parcela_valor_devido,
                    data_vencimento=current_due_date,
                    valor_pago=Decimal('0.00'),
                    saldo_devedor=parcela_valor_devido,
                    status_parcela='Pendente',
                    juros_multa=Decimal('0.00'),
                    juros_multa_anterior_aplicada=Decimal('0.00'),
                    observacoes=None
                )
                db.add(db_parcela)
                current_due_date = calculate_next_due_date(current_due_date, db_carne.frequencia_pagamento)

            db.commit()
            db.refresh(db_carne) # Refresh novamente para carregar as parcelas
        return db_carne


def update_carne(db: Session, carne_id: int, carne_update: schemas.CarneCreate):
    db_carne = db.query(models.Carne).filter(models.Carne.id_carne == carne_id).first()
    if not db_carne:
        return None

    has_payments = db.query(models.Pagamento).join(models.Parcela).filter(models.Parcela.id_carne == carne_id).first()

    update_data = carne_update.model_dump(exclude_unset=False)

    new_data_venda = update_data.get('data_venda', db_carne.data_venda)
    new_data_primeiro_vencimento = update_data.get('data_primeiro_vencimento', db_carne.data_primeiro_vencimento)
    if new_data_venda and new_data_primeiro_vencimento < new_data_venda:
         raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A data do primeiro vencimento não pode ser anterior à data da venda.")

    # Detectar mudança no tipo de carnê (fixo/flexível) ou em campos financeiros que exigem regeneração
    regenerate_parcels_flag = False
    financial_keys_for_parcel_regeneration = [
        'valor_total_original', 'numero_parcelas',
        'valor_parcela_sugerido', # Campo relevante para carnê fixo
        'data_primeiro_vencimento',
        'frequencia_pagamento', 'valor_entrada',
        'parcela_fixa' # NOVO: Mudança no tipo de carnê exige regeneração
    ]

    if has_payments:
        # Se tem pagamentos, só permite alterar descricao, status_carne, observacoes, data_venda
        allowed_keys_with_payments = ['descricao', 'status_carne', 'observacoes', 'data_venda']
        for key_to_update in list(update_data.keys()):
            if key_to_update not in allowed_keys_with_payments:
                if getattr(db_carne, key_to_update) != update_data[key_to_update]:
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                        detail=f"Não é possível alterar o campo '{key_to_update}' de um carnê que já possui pagamentos.")
    else: # Não tem pagamentos, pode regenerar parcelas
        for key in financial_keys_for_parcel_regeneration:
            if key in update_data:
                current_val = getattr(db_carne, key)
                new_val = update_data.get(key)

                # Tratamento para comparação de Decimals
                if key in ['valor_total_original', 'valor_parcela_sugerido', 'valor_entrada']:
                    current_val = Decimal(str(current_val)) if current_val is not None else None # manter str para Decimal para compatibilidade
                    new_val = Decimal(str(new_val)) if new_val is not None else None # manter str para Decimal para compatibilidade
                # Para booleanos, comparar diretamente
                elif key == 'parcela_fixa':
                    if current_val != new_val: # A mudança no tipo de parcela sempre dispara regeneração
                        regenerate_parcels_flag = True
                        break
                # Para outros tipos, comparação padrão
                if current_val != new_val:
                    regenerate_parcels_flag = True
                    break

    # Aplicar as atualizações aos campos do objeto db_carne
    for key, value in update_data.items():
        if key == 'valor_parcela_original': # Este campo é calculado, não setado diretamente
            continue
        if key in ['valor_total_original', 'valor_entrada'] and value is not None:
            setattr(db_carne, key, value) # Alterado: Pydantic já validou para Decimal
        elif key == 'valor_parcela_sugerido' and value is not None:
            pass # Não armazena diretamente no db_carne, é usado para cálculo
        else:
            setattr(db_carne, key, value)

    # Lógica de regeneração de parcelas
    if regenerate_parcels_flag and not has_payments:
        # Excluir parcelas existentes
        db.query(models.Parcela).filter(models.Parcela.id_carne == carne_id).delete(synchronize_session='fetch')
        db.flush() # Garante que as deleções sejam processadas antes de adicionar novas

        valor_total_original_decimal = db_carne.valor_total_original # Alterado: Pydantic já validou para Decimal
        valor_entrada_decimal = db_carne.valor_entrada # Alterado: Pydantic já validou para Decimal
        valor_a_parcelar = valor_total_original_decimal - valor_entrada_decimal

        # Se o carnê se torna não fixo
        if not db_carne.parcela_fixa:
            db_carne.numero_parcelas = 1
            db_carne.valor_parcela_original = valor_a_parcelar.quantize(Decimal('0.01'))
            db_carne.frequencia_pagamento = "única" # Ou "variável"

            db_parcela_nova = models.Parcela(
                id_carne=db_carne.id_carne,
                numero_parcela=1,
                valor_devido=valor_a_parcelar,
                data_vencimento=db_carne.data_primeiro_vencimento,
                valor_pago=Decimal('0.00'),
                saldo_devedor=valor_a_parcelar,
                status_parcela='Pendente',
                juros_multa=Decimal('0.00'),
                juros_multa_anterior_aplicada=Decimal('0.00'),
                observacoes=None
            )
            db.add(db_parcela_nova)
        else: # Se o carnê é fixo (ou mudou para fixo)
            if db_carne.numero_parcelas <= 0:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Para carnês com parcela fixa, o número de parcelas deve ser maior que zero.")
            if valor_a_parcelar <= Decimal('0.00') and db_carne.numero_parcelas > 0:
                 pass # A validação já é feita no frontend ou no esquema

            valor_parcela_sugerido_decimal = carne_update.valor_parcela_sugerido if carne_update.valor_parcela_sugerido is not None else Decimal('0.00') # Alterado para usar o Decimal do update_data
            if valor_parcela_sugerido_decimal == Decimal('0.00'): # Default se não sugerido
                if valor_a_parcelar > Decimal('0.00'):
                    valor_parcela_original_calculado = (valor_a_parcelar / db_carne.numero_parcelas).quantize(Decimal('0.01'))
                else:
                    valor_parcela_original_calculado = Decimal('0.00')
            else:
                valor_parcela_original_calculado = valor_parcela_sugerido_decimal


            db_carne.valor_parcela_original = valor_parcela_original_calculado # ATUALIZA O VALOR NO OBJETO DO CARNÊ

            current_due_date = db_carne.data_primeiro_vencimento
            for i in range(db_carne.numero_parcelas):
                parcela_valor_devido = valor_parcela_original_calculado
                if i == db_carne.numero_parcelas - 1:
                    soma_parcelas_anteriores = valor_parcela_original_calculado * i
                    parcela_valor_devido = valor_a_parcelar - soma_parcelas_anteriores
                    parcela_valor_devido = parcela_valor_devido.quantize(Decimal('0.01'))

                if parcela_valor_devido < Decimal('0.00'):
                    parcela_valor_devido = Decimal('0.00')

                db_parcela = models.Parcela(
                    id_carne=db_carne.id_carne,
                    numero_parcela=i + 1,
                    valor_devido=parcela_valor_devido,
                    data_vencimento=current_due_date,
                    valor_pago=Decimal('0.00'),
                    saldo_devedor=parcela_valor_devido,
                    status_parcela='Pendente',
                    juros_multa=Decimal('0.00'),
                    juros_multa_anterior_aplicada=Decimal('0.00'),
                    observacoes=None
                )
                db.add(db_parcela)
                current_due_date = calculate_next_due_date(current_due_date, db_carne.frequencia_pagamento)

            db.commit()
            db.refresh(db_carne) # Refresh novamente para carregar as parcelas
        return db_carne


def update_carne(db: Session, carne_id: int, carne_update: schemas.CarneCreate):
    db_carne = db.query(models.Carne).filter(models.Carne.id_carne == carne_id).first()
    if not db_carne:
        return None

    has_payments = db.query(models.Pagamento).join(models.Parcela).filter(models.Parcela.id_carne == carne_id).first()

    update_data = carne_update.model_dump(exclude_unset=False)

    new_data_venda = update_data.get('data_venda', db_carne.data_venda)
    new_data_primeiro_vencimento = update_data.get('data_primeiro_vencimento', db_carne.data_primeiro_vencimento)
    if new_data_venda and new_data_primeiro_vencimento < new_data_venda:
         raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A data do primeiro vencimento não pode ser anterior à data da venda.")

    # Detectar mudança no tipo de carnê (fixo/flexível) ou em campos financeiros que exigem regeneração
    regenerate_parcels_flag = False
    financial_keys_for_parcel_regeneration = [
        'valor_total_original', 'numero_parcelas',
        'valor_parcela_sugerido', # Campo relevante para carnê fixo
        'data_primeiro_vencimento',
        'frequencia_pagamento', 'valor_entrada',
        'parcela_fixa' # NOVO: Mudança no tipo de carnê exige regeneração
    ]

    if has_payments:
        # Se tem pagamentos, só permite alterar descricao, status_carne, observacoes, data_venda
        allowed_keys_with_payments = ['descricao', 'status_carne', 'observacoes', 'data_venda']
        for key_to_update in list(update_data.keys()):
            if key_to_update not in allowed_keys_with_payments:
                if getattr(db_carne, key_to_update) != update_data[key_to_update]:
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                        detail=f"Não é possível alterar o campo '{key_to_update}' de um carnê que já possui pagamentos.")
    else: # Não tem pagamentos, pode regenerar parcelas
        for key in financial_keys_for_parcel_regeneration:
            if key in update_data:
                current_val = getattr(db_carne, key)
                new_val = update_data.get(key)

                # Tratamento para comparação de Decimals
                if key in ['valor_total_original', 'valor_parcela_sugerido', 'valor_entrada']:
                    current_val = Decimal(str(current_val)) if current_val is not None else None # manter str para Decimal para compatibilidade
                    new_val = Decimal(str(new_val)) if new_val is not None else None # manter str para Decimal para compatibilidade
                # Para booleanos, comparar diretamente
                elif key == 'parcela_fixa':
                    if current_val != new_val: # A mudança no tipo de parcela sempre dispara regeneração
                        regenerate_parcels_flag = True
                        break
                # Para outros tipos, comparação padrão
                if current_val != new_val:
                    regenerate_parcels_flag = True
                    break

    # Aplicar as atualizações aos campos do objeto db_carne
    for key, value in update_data.items():
        if key == 'valor_parcela_original': # Este campo é calculado, não setado diretamente
            continue
        if key in ['valor_total_original', 'valor_entrada'] and value is not None:
            setattr(db_carne, key, value) # Alterado: Pydantic já validou para Decimal
        elif key == 'valor_parcela_sugerido' and value is not None:
            pass # Não armazena diretamente no db_carne, é usado para cálculo
        else:
            setattr(db_carne, key, value)

    # Lógica de regeneração de parcelas
    if regenerate_parcels_flag and not has_payments:
        # Excluir parcelas existentes
        db.query(models.Parcela).filter(models.Parcela.id_carne == carne_id).delete(synchronize_session='fetch')
        db.flush() # Garante que as deleções sejam processadas antes de adicionar novas

        valor_total_original_decimal = db_carne.valor_total_original # Alterado: Pydantic já validou para Decimal
        valor_entrada_decimal = db_carne.valor_entrada # Alterado: Pydantic já validou para Decimal
        valor_a_parcelar = valor_total_original_decimal - valor_entrada_decimal

        # Se o carnê se torna não fixo
        if not db_carne.parcela_fixa:
            db_carne.numero_parcelas = 1
            db_carne.valor_parcela_original = valor_a_parcelar.quantize(Decimal('0.01'))
            db_carne.frequencia_pagamento = "única" # Ou "variável"

            db_parcela_nova = models.Parcela(
                id_carne=db_carne.id_carne,
                numero_parcela=1,
                valor_devido=valor_a_parcelar,
                data_vencimento=db_carne.data_primeiro_vencimento,
                valor_pago=Decimal('0.00'),
                saldo_devedor=valor_a_parcelar,
                status_parcela='Pendente',
                juros_multa=Decimal('0.00'),
                juros_multa_anterior_aplicada=Decimal('0.00'),
                observacoes=None
            )
            db.add(db_parcela_nova)
        else: # Se o carnê é fixo (ou mudou para fixo)
            if db_carne.numero_parcelas <= 0:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Para carnês com parcela fixa, o número de parcelas deve ser maior que zero.")
            if valor_a_parcelar <= Decimal('0.00') and db_carne.numero_parcelas > 0:
                 pass # A validação já é feita no frontend ou no esquema

            valor_parcela_sugerido_decimal = carne_update.valor_parcela_sugerido if carne_update.valor_parcela_sugerido is not None else Decimal('0.00') # Alterado para usar o Decimal do update_data
            if valor_parcela_sugerido_decimal == Decimal('0.00'): # Default se não sugerido
                if valor_a_parcelar > Decimal('0.00'):
                    valor_parcela_original_calculado = (valor_a_parcelar / db_carne.numero_parcelas).quantize(Decimal('0.01'))
                else:
                    valor_parcela_original_calculado = Decimal('0.00')
            else:
                valor_parcela_original_calculado = valor_parcela_sugerido_decimal


            db_carne.valor_parcela_original = valor_parcela_original_calculado # ATUALIZA O VALOR NO OBJETO DO CARNÊ

            current_due_date = db_carne.data_primeiro_vencimento
            for i in range(db_carne.numero_parcelas):
                parcela_valor_devido = valor_parcela_original_calculado
                if i == db_carne.numero_parcelas - 1:
                    soma_parcelas_anteriores = valor_parcela_original_calculado * i
                    parcela_valor_devido = valor_a_parcelar - soma_parcelas_anteriores
                    parcela_valor_devido = parcela_valor_devido.quantize(Decimal('0.01'))

                if parcela_valor_devido < Decimal('0.00'):
                    parcela_valor_devido = Decimal('0.00')

                db_parcela = models.Parcela(
                    id_carne=db_carne.id_carne,
                    numero_parcela=i + 1,
                    valor_devido=parcela_valor_devido,
                    data_vencimento=current_due_date,
                    valor_pago=Decimal('0.00'),
                    saldo_devedor=parcela_valor_devido,
                    status_parcela='Pendente',
                    juros_multa=Decimal('0.00'),
                    juros_multa_anterior_aplicada=Decimal('0.00'),
                    observacoes=None
                )
                db.add(db_parcela)
                current_due_date = calculate_next_due_date(current_due_date, db_carne.frequencia_pagamento)

            db.commit()
            db.refresh(db_carne) # Refresh novamente para carregar as parcelas
        return db_carne


def update_carne(db: Session, carne_id: int, carne_update: schemas.CarneCreate):
    db_carne = db.query(models.Carne).filter(models.Carne.id_carne == carne_id).first()
    if not db_carne:
        return None

    has_payments = db.query(models.Pagamento).join(models.Parcela).filter(models.Parcela.id_carne == carne_id).first()

    update_data = carne_update.model_dump(exclude_unset=False)

    new_data_venda = update_data.get('data_venda', db_carne.data_venda)
    new_data_primeiro_vencimento = update_data.get('data_primeiro_vencimento', db_carne.data_primeiro_vencimento)
    if new_data_venda and new_data_primeiro_vencimento < new_data_venda:
         raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A data do primeiro vencimento não pode ser anterior à data da venda.")

    # Detectar mudança no tipo de carnê (fixo/flexível) ou em campos financeiros que exigem regeneração
    regenerate_parcels_flag = False
    financial_keys_for_parcel_regeneration = [
        'valor_total_original', 'numero_parcelas',
        'valor_parcela_sugerido', # Campo relevante para carnê fixo
        'data_primeiro_vencimento',
        'frequencia_pagamento', 'valor_entrada',
        'parcela_fixa' # NOVO: Mudança no tipo de carnê exige regeneração
    ]

    if has_payments:
        # Se tem pagamentos, só permite alterar descricao, status_carne, observacoes, data_venda
        allowed_keys_with_payments = ['descricao', 'status_carne', 'observacoes', 'data_venda']
        for key_to_update in list(update_data.keys()):
            if key_to_update not in allowed_keys_with_payments:
                if getattr(db_carne, key_to_update) != update_data[key_to_update]:
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                        detail=f"Não é possível alterar o campo '{key_to_update}' de um carnê que já possui pagamentos.")
    else: # Não tem pagamentos, pode regenerar parcelas
        for key in financial_keys_for_parcel_regeneration:
            if key in update_data:
                current_val = getattr(db_carne, key)
                new_val = update_data.get(key)

                # Tratamento para comparação de Decimals
                if key in ['valor_total_original', 'valor_parcela_sugerido', 'valor_entrada']:
                    current_val = Decimal(str(current_val)) if current_val is not None else None # manter str para Decimal para compatibilidade
                    new_val = Decimal(str(new_val)) if new_val is not None else None # manter str para Decimal para compatibilidade
                # Para booleanos, comparar diretamente
                elif key == 'parcela_fixa':
                    if current_val != new_val: # A mudança no tipo de parcela sempre dispara regeneração
                        regenerate_parcels_flag = True
                        break
                # Para outros tipos, comparação padrão
                if current_val != new_val:
                    regenerate_parcels_flag = True
                    break

    # Aplicar as atualizações aos campos do objeto db_carne
    for key, value in update_data.items():
        if key == 'valor_parcela_original': # Este campo é calculado, não setado diretamente
            continue
        if key in ['valor_total_original', 'valor_entrada'] and value is not None:
            setattr(db_carne, key, value) # Alterado: Pydantic já validou para Decimal
        elif key == 'valor_parcela_sugerido' and value is not None:
            pass # Não armazena diretamente no db_carne, é usado para cálculo
        else:
            setattr(db_carne, key, value)

    # Lógica de regeneração de parcelas
    if regenerate_parcels_flag and not has_payments:
        # Excluir parcelas existentes
        db.query(models.Parcela).filter(models.Parcela.id_carne == carne_id).delete(synchronize_session='fetch')
        db.flush() # Garante que as deleções sejam processadas antes de adicionar novas

        valor_total_original_decimal = db_carne.valor_total_original # Alterado: Pydantic já validou para Decimal
        valor_entrada_decimal = db_carne.valor_entrada # Alterado: Pydantic já validou para Decimal
        valor_a_parcelar = valor_total_original_decimal - valor_entrada_decimal

        # Se o carnê se torna não fixo
        if not db_carne.parcela_fixa:
            db_carne.numero_parcelas = 1
            db_carne.valor_parcela_original = valor_a_parcelar.quantize(Decimal('0.01'))
            db_carne.frequencia_pagamento = "única" # Ou "variável"

            db_parcela_nova = models.Parcela(
                id_carne=db_carne.id_carne,
                numero_parcela=1,
                valor_devido=valor_a_parcelar,
                data_vencimento=db_carne.data_primeiro_vencimento,
                valor_pago=Decimal('0.00'),
                saldo_devedor=valor_a_parcelar,
                status_parcela='Pendente',
                juros_multa=Decimal('0.00'),
                juros_multa_anterior_aplicada=Decimal('0.00'),
                observacoes=None
            )
            db.add(db_parcela_nova)
        else: # Se o carnê é fixo (ou mudou para fixo)
            if db_carne.numero_parcelas <= 0:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Para carnês com parcela fixa, o número de parcelas deve ser maior que zero.")
            if valor_a_parcelar <= Decimal('0.00') and db_carne.numero_parcelas > 0:
                 pass # A validação já é feita no frontend ou no esquema

            valor_parcela_sugerido_decimal = carne_update.valor_parcela_sugerido if carne_update.valor_parcela_sugerido is not None else Decimal('0.00') # Alterado para usar o Decimal do update_data
            if valor_parcela_sugerido_decimal == Decimal('0.00'): # Default se não sugerido
                if valor_a_parcelar > Decimal('0.00'):
                    valor_parcela_original_calculado = (valor_a_parcelar / db_carne.numero_parcelas).quantize(Decimal('0.01'))
                else:
                    valor_parcela_original_calculado = Decimal('0.00')
            else:
                valor_parcela_original_calculado = valor_parcela_sugerido_decimal


            db_carne.valor_parcela_original = valor_parcela_original_calculado # ATUALIZA O VALOR NO OBJETO DO CARNÊ

            current_due_date = db_carne.data_primeiro_vencimento
            for i in range(db_carne.numero_parcelas):
                parcela_valor_devido = valor_parcela_original_calculado
                if i == db_carne.numero_parcelas - 1:
                    soma_parcelas_anteriores = valor_parcela_original_calculado * i
                    parcela_valor_devido = valor_a_parcelar - soma_parcelas_anteriores
                    parcela_valor_devido = parcela_valor_devido.quantize(Decimal('0.01'))

                if parcela_valor_devido < Decimal('0.00'):
                    parcela_valor_devido = Decimal('0.00')

                db_parcela = models.Parcela(
                    id_carne=db_carne.id_carne,
                    numero_parcela=i + 1,
                    valor_devido=parcela_valor_devido,
                    data_vencimento=current_due_date,
                    valor_pago=Decimal('0.00'),
                    saldo_devedor=parcela_valor_devido,
                    status_parcela='Pendente',
                    juros_multa=Decimal('0.00'),
                    juros_multa_anterior_aplicada=Decimal('0.00'),
                    observacoes=None
                )
                db.add(db_parcela)
                current_due_date = calculate_next_due_date(current_due_date, db_carne.frequencia_pagamento)

            db.commit()
            db.refresh(db_carne) # Refresh novamente para carregar as parcelas
        return db_carne


def update_carne(db: Session, carne_id: int, carne_update: schemas.CarneCreate):
    db_carne = db.query(models.Carne).filter(models.Carne.id_carne == carne_id).first()
    if not db_carne:
        return None

    has_payments = db.query(models.Pagamento).join(models.Parcela).filter(models.Parcela.id_carne == carne_id).first()

    update_data = carne_update.model_dump(exclude_unset=False)

    new_data_venda = update_data.get('data_venda', db_carne.data_venda)
    new_data_primeiro_vencimento = update_data.get('data_primeiro_vencimento', db_carne.data_primeiro_vencimento)
    if new_data_venda and new_data_primeiro_vencimento < new_data_venda:
         raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A data do primeiro vencimento não pode ser anterior à data da venda.")

    # Detectar mudança no tipo de carnê (fixo/flexível) ou em campos financeiros que exigem regeneração
    regenerate_parcels_flag = False
    financial_keys_for_parcel_regeneration = [
        'valor_total_original', 'numero_parcelas',
        'valor_parcela_sugerido', # Campo relevante para carnê fixo
        'data_primeiro_vencimento',
        'frequencia_pagamento', 'valor_entrada',
        'parcela_fixa' # NOVO: Mudança no tipo de carnê exige regeneração
    ]

    if has_payments:
        # Se tem pagamentos, só permite alterar descricao, status_carne, observacoes, data_venda
        allowed_keys_with_payments = ['descricao', 'status_carne', 'observacoes', 'data_venda']
        for key_to_update in list(update_data.keys()):
            if key_to_update not in allowed_keys_with_payments:
                if getattr(db_carne, key_to_update) != update_data[key_to_update]:
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                        detail=f"Não é possível alterar o campo '{key_to_update}' de um carnê que já possui pagamentos.")
    else: # Não tem pagamentos, pode regenerar parcelas
        for key in financial_keys_for_parcel_regeneration:
            if key in update_data:
                current_val = getattr(db_carne, key)
                new_val = update_data.get(key)

                # Tratamento para comparação de Decimals
                if key in ['valor_total_original', 'valor_parcela_sugerido', 'valor_entrada']:
                    current_val = Decimal(str(current_val)) if current_val is not None else None # manter str para Decimal para compatibilidade
                    new_val = Decimal(str(new_val)) if new_val is not None else None # manter str para Decimal para compatibilidade
                # Para booleanos, comparar diretamente
                elif key == 'parcela_fixa':
                    if current_val != new_val: # A mudança no tipo de parcela sempre dispara regeneração
                        regenerate_parcels_flag = True
                        break
                # Para outros tipos, comparação padrão
                if current_val != new_val:
                    regenerate_parcels_flag = True
                    break

    # Aplicar as atualizações aos campos do objeto db_carne
    for key, value in update_data.items():
        if key == 'valor_parcela_original': # Este campo é calculado, não setado diretamente
            continue
        if key in ['valor_total_original', 'valor_entrada'] and value is not None:
            setattr(db_carne, key, value) # Alterado: Pydantic já validou para Decimal
        elif key == 'valor_parcela_sugerido' and value is not None:
            pass # Não armazena diretamente no db_carne, é usado para cálculo
        else:
            setattr(db_carne, key, value)

    # Lógica de regeneração de parcelas
    if regenerate_parcels_flag and not has_payments:
        # Excluir parcelas existentes
        db.query(models.Parcela).filter(models.Parcela.id_carne == carne_id).delete(synchronize_session='fetch')
        db.flush() # Garante que as deleções sejam processadas antes de adicionar novas

        valor_total_original_decimal = db_carne.valor_total_original # Alterado: Pydantic já validou para Decimal
        valor_entrada_decimal = db_carne.valor_entrada # Alterado: Pydantic já validou para Decimal
        valor_a_parcelar = valor_total_original_decimal - valor_entrada_decimal

        # Se o carnê se torna não fixo
        if not db_carne.parcela_fixa:
            db_carne.numero_parcelas = 1
            db_carne.valor_parcela_original = valor_a_parcelar.quantize(Decimal('0.01'))
            db_carne.frequencia_pagamento = "única" # Ou "variável"

            db_parcela_nova = models.Parcela(
                id_carne=db_carne.id_carne,
                numero_parcela=1,
                valor_devido=valor_a_parcelar,
                data_vencimento=db_carne.data_primeiro_vencimento,
                valor_pago=Decimal('0.00'),
                saldo_devedor=valor_a_parcelar,
                status_parcela='Pendente',
                juros_multa=Decimal('0.00'),
                juros_multa_anterior_aplicada=Decimal('0.00'),
                observacoes=None
            )
            db.add(db_parcela_nova)
        else: # Se o carnê é fixo (ou mudou para fixo)
            if db_carne.numero_parcelas <= 0:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Para carnês com parcela fixa, o número de parcelas deve ser maior que zero.")
            if valor_a_parcelar <= Decimal('0.00') and db_carne.numero_parcelas > 0:
                 pass # A validação já é feita no frontend ou no esquema

            valor_parcela_sugerido_decimal = carne_update.valor_parcela_sugerido if carne_update.valor_parcela_sugerido is not None else Decimal('0.00') # Alterado para usar o Decimal do update_data
            if valor_parcela_sugerido_decimal == Decimal('0.00'): # Default se não sugerido
                if valor_a_parcelar > Decimal('0.00'):
                    valor_parcela_original_calculado = (valor_a_parcelar / db_carne.numero_parcelas).quantize(Decimal('0.01'))
                else:
                    valor_parcela_original_calculado = Decimal('0.00')
            else:
                valor_parcela_original_calculado = valor_parcela_sugerido_decimal


            db_carne.valor_parcela_original = valor_parcela_original_calculado # ATUALIZA O VALOR NO OBJETO DO CARNÊ

            current_due_date = db_carne.data_primeiro_vencimento
            for i in range(db_carne.numero_parcelas):
                parcela_valor_devido = valor_parcela_original_calculado
                if i == db_carne.numero_parcelas - 1:
                    soma_parcelas_anteriores = valor_parcela_original_calculado * i
                    parcela_valor_devido = valor_a_parcelar - soma_parcelas_anteriores
                    parcela_valor_devido = parcela_valor_devido.quantize(Decimal('0.01'))

                if parcela_valor_devido < Decimal('0.00'):
                    parcela_valor_devido = Decimal('0.00')

                db_parcela = models.Parcela(
                    id_carne=db_carne.id_carne,
                    numero_parcela=i + 1,
                    valor_devido=parcela_valor_devido,
                    data_vencimento=current_due_date,
                    valor_pago=Decimal('0.00'),
                    saldo_devedor=parcela_valor_devido,
                    status_parcela='Pendente',
                    juros_multa=Decimal('0.00'),
                    juros_multa_anterior_aplicada=Decimal('0.00'),
                    observacoes=None
                )
                db.add(db_parcela)
                current_due_date = calculate_next_due_date(current_due_date, db_carne.frequencia_pagamento)

            db.commit()
            db.refresh(db_carne) # Refresh novamente para carregar as parcelas
        return db_carne


def update_carne(db: Session, carne_id: int, carne_update: schemas.CarneCreate):
    db_carne = db.query(models.Carne).filter(models.Carne.id_carne == carne_id).first()
    if not db_carne:
        return None

    has_payments = db.query(models.Pagamento).join(models.Parcela).filter(models.Parcela.id_carne == carne_id).first()

    update_data = carne_update.model_dump(exclude_unset=False)

    new_data_venda = update_data.get('data_venda', db_carne.data_venda)
    new_data_primeiro_vencimento = update_data.get('data_primeiro_vencimento', db_carne.data_primeiro_vencimento)
    if new_data_venda and new_data_primeiro_vencimento < new_data_venda:
         raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A data do primeiro vencimento não pode ser anterior à data da venda.")

    # Detectar mudança no tipo de carnê (fixo/flexível) ou em campos financeiros que exigem regeneração
    regenerate_parcels_flag = False
    financial_keys_for_parcel_regeneration = [
        'valor_total_original', 'numero_parcelas',
        'valor_parcela_sugerido', # Campo relevante para carnê fixo
        'data_primeiro_vencimento',
        'frequencia_pagamento', 'valor_entrada',
        'parcela_fixa' # NOVO: Mudança no tipo de carnê exige regeneração
    ]

    if has_payments:
        # Se tem pagamentos, só permite alterar descricao, status_carne, observacoes, data_venda
        allowed_keys_with_payments = ['descricao', 'status_carne', 'observacoes', 'data_venda']
        for key_to_update in list(update_data.keys()):
            if key_to_update not in allowed_keys_with_payments:
                if getattr(db_carne, key_to_update) != update_data[key_to_update]:
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                        detail=f"Não é possível alterar o campo '{key_to_update}' de um carnê que já possui pagamentos.")
    else: # Não tem pagamentos, pode regenerar parcelas
        for key in financial_keys_for_parcel_regeneration:
            if key in update_data:
                current_val = getattr(db_carne, key)
                new_val = update_data.get(key)

                # Tratamento para comparação de Decimals
                if key in ['valor_total_original', 'valor_parcela_sugerido', 'valor_entrada']:
                    current_val = Decimal(str(current_val)) if current_val is not None else None # manter str para Decimal para compatibilidade
                    new_val = Decimal(str(new_val)) if new_val is not None else None # manter str para Decimal para compatibilidade
                # Para booleanos, comparar diretamente
                elif key == 'parcela_fixa':
                    if current_val != new_val: # A mudança no tipo de parcela sempre dispara regeneração
                        regenerate_parcels_flag = True
                        break
                # Para outros tipos, comparação padrão
                if current_val != new_val:
                    regenerate_parcels_flag = True
                    break

    # Aplicar as atualizações aos campos do objeto db_carne
    for key, value in update_data.items():
        if key == 'valor_parcela_original': # Este campo é calculado, não setado diretamente
            continue
        if key in ['valor_total_original', 'valor_entrada'] and value is not None:
            setattr(db_carne, key, value) # Alterado: Pydantic já validou para Decimal
        elif key == 'valor_parcela_sugerido' and value is not None:
            pass # Não armazena diretamente no db_carne, é usado para cálculo
        else:
            setattr(db_carne, key, value)

    # Lógica de regeneração de parcelas
    if regenerate_parcels_flag and not has_payments:
        # Excluir parcelas existentes
        db.query(models.Parcela).filter(models.Parcela.id_carne == carne_id).delete(synchronize_session='fetch')
        db.flush() # Garante que as deleções sejam processadas antes de adicionar novas

        valor_total_original_decimal = db_carne.valor_total_original # Alterado: Pydantic já validou para Decimal
        valor_entrada_decimal = db_carne.valor_entrada # Alterado: Pydantic já validou para Decimal
        valor_a_parcelar = valor_total_original_decimal - valor_entrada_decimal

        # Se o carnê se torna não fixo
        if not db_carne.parcela_fixa:
            db_carne.numero_parcelas = 1
            db_carne.valor_parcela_original = valor_a_parcelar.quantize(Decimal('0.01'))
            db_carne.frequencia_pagamento = "única" # Ou "variável"

            db_parcela_nova = models.Parcela(
                id_carne=db_carne.id_carne,
                numero_parcela=1,
                valor_devido=valor_a_parcelar,
                data_vencimento=db_carne.data_primeiro_vencimento,
                valor_pago=Decimal('0.00'),
                saldo_devedor=valor_a_parcelar,
                status_parcela='Pendente',
                juros_multa=Decimal('0.00'),
                juros_multa_anterior_aplicada=Decimal('0.00'),
                observacoes=None
            )
            db.add(db_parcela_nova)
        else: # Se o carnê é fixo (ou mudou para fixo)
            if db_carne.numero_parcelas <= 0:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Para carnês com parcela fixa, o número de parcelas deve ser maior que zero.")
            if valor_a_parcelar <= Decimal('0.00') and db_carne.numero_parcelas > 0:
                 pass # A validação já é feita no frontend ou no esquema

            valor_parcela_sugerido_decimal = carne_update.valor_parcela_sugerido if carne_update.valor_parcela_sugerido is not None else Decimal('0.00') # Alterado para usar o Decimal do update_data
            if valor_parcela_sugerido_decimal == Decimal('0.00'): # Default se não sugerido
                if valor_a_parcelar > Decimal('0.00'):
                    valor_parcela_original_calculado = (valor_a_parcelar / db_carne.numero_parcelas).quantize(Decimal('0.01'))
                else:
                    valor_parcela_original_calculado = Decimal('0.00')
            else:
                valor_parcela_original_calculado = valor_parcela_sugerido_decimal


            db_carne.valor_parcela_original = valor_parcela_original_calculado # ATUALIZA O VALOR NO OBJETO DO CARNÊ

            current_due_date = db_carne.data_primeiro_vencimento
            for i in range(db_carne.numero_parcelas):
                parcela_valor_devido = valor_parcela_original_calculado
                if i == db_carne.numero_parcelas - 1:
                    soma_parcelas_anteriores = valor_parcela_original_calculado * i
                    parcela_valor_devido = valor_a_parcelar - soma_parcelas_anteriores
                    parcela_valor_devido = parcela_valor_devido.quantize(Decimal('0.01'))

                if parcela_valor_devido < Decimal('0.00'):
                    parcela_valor_devido = Decimal('0.00')

                db_parcela = models.Parcela(
                    id_carne=db_carne.id_carne,
                    numero_parcela=i + 1,
                    valor_devido=parcela_valor_devido,
                    data_vencimento=current_due_date,
                    valor_pago=Decimal('0.00'),
                    saldo_devedor=parcela_valor_devido,
                    status_parcela='Pendente',
                    juros_multa=Decimal('0.00'),
                    juros_multa_anterior_aplicada=Decimal('0.00'),
                    observacoes=None
                )
                db.add(db_parcela)
                current_due_date = calculate_next_due_date(current_due_date, db_carne.frequencia_pagamento)

            db.commit()
            db.refresh(db_carne) # Refresh novamente para carregar as parcelas
        return db_carne


def update_carne(db: Session, carne_id: int, carne_update: schemas.CarneCreate):
    db_carne = db.query(models.Carne).filter(models.Carne.id_carne == carne_id).first()
    if not db_carne:
        return None

    has_payments = db.query(models.Pagamento).join(models.Parcela).filter(models.Parcela.id_carne == carne_id).first()

    update_data = carne_update.model_dump(exclude_unset=False)

    new_data_venda = update_data.get('data_venda', db_carne.data_venda)
    new_data_primeiro_vencimento = update_data.get('data_primeiro_vencimento', db_carne.data_primeiro_vencimento)
    if new_data_venda and new_data_primeiro_vencimento < new_data_venda:
         raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A data do primeiro vencimento não pode ser anterior à data da venda.")

    # Detectar mudança no tipo de carnê (fixo/flexível) ou em campos financeiros que exigem regeneração
    regenerate_parcels_flag = False
    financial_keys_for_parcel_regeneration = [
        'valor_total_original', 'numero_parcelas',
        'valor_parcela_sugerido', # Campo relevante para carnê fixo
        'data_primeiro_vencimento',
        'frequencia_pagamento', 'valor_entrada',
        'parcela_fixa' # NOVO: Mudança no tipo de carnê exige regeneração
    ]

    if has_payments:
        # Se tem pagamentos, só permite alterar descricao, status_carne, observacoes, data_venda
        allowed_keys_with_payments = ['descricao', 'status_carne', 'observacoes', 'data_venda']
        for key_to_update in list(update_data.keys()):
            if key_to_update not in allowed_keys_with_payments:
                if getattr(db_carne, key_to_update) != update_data[key_to_update]:
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                        detail=f"Não é possível alterar o campo '{key_to_update}' de um carnê que já possui pagamentos.")
    else: # Não tem pagamentos, pode regenerar parcelas
        for key in financial_keys_for_parcel_regeneration:
            if key in update_data:
                current_val = getattr(db_carne, key)
                new_val = update_data.get(key)

                # Tratamento para comparação de Decimals
                if key in ['valor_total_original', 'valor_parcela_sugerido', 'valor_entrada']:
                    current_val = Decimal(str(current_val)) if current_val is not None else None # manter str para Decimal para compatibilidade
                    new_val = Decimal(str(new_val)) if new_val is not None else None # manter str para Decimal para compatibilidade
                # Para booleanos, comparar diretamente
                elif key == 'parcela_fixa':
                    if current_val != new_val: # A mudança no tipo de parcela sempre dispara regeneração
                        regenerate_parcels_flag = True
                        break
                # Para outros tipos, comparação padrão
                if current_val != new_val:
                    regenerate_parcels_flag = True
                    break

    # Aplicar as atualizações aos campos do objeto db_carne
    for key, value in update_data.items():
        if key == 'valor_parcela_original': # Este campo é calculado, não setado diretamente
            continue
        if key in ['valor_total_original', 'valor_entrada'] and value is not None:
            setattr(db_carne, key, value) # Alterado: Pydantic já validou para Decimal
        elif key == 'valor_parcela_sugerido' and value is not None:
            pass # Não armazena diretamente no db_carne, é usado para cálculo
        else:
            setattr(db_carne, key, value)

    # Lógica de regeneração de parcelas
    if regenerate_parcels_flag and not has_payments:
        # Excluir parcelas existentes
        db.query(models.Parcela).filter(models.Parcela.id_carne == carne_id).delete(synchronize_session='fetch')
        db.flush() # Garante que as deleções sejam processadas antes de adicionar novas

        valor_total_original_decimal = db_carne.valor_total_original # Alterado: Pydantic já validou para Decimal
        valor_entrada_decimal = db_carne.valor_entrada # Alterado: Pydantic já validou para Decimal
        valor_a_parcelar = valor_total_original_decimal - valor_entrada_decimal

        # Se o carnê se torna não fixo
        if not db_carne.parcela_fixa:
            db_carne.numero_parcelas = 1
            db_carne.valor_parcela_original = valor_a_parcelar.quantize(Decimal('0.01'))
            db_carne.frequencia_pagamento = "única" # Ou "variável"

            db_parcela_nova = models.Parcela(
                id_carne=db_carne.id_carne,
                numero_parcela=1,
                valor_devido=valor_a_parcelar,
                data_vencimento=db_carne.data_primeiro_vencimento,
                valor_pago=Decimal('0.00'),
                saldo_devedor=valor_a_parcelar,
                status_parcela='Pendente',
                juros_multa=Decimal('0.00'),
                juros_multa_anterior_aplicada=Decimal('0.00'),
                observacoes=None
            )
            db.add(db_parcela_nova)
        else: # Se o carnê é fixo (ou mudou para fixo)
            if db_carne.numero_parcelas <= 0:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Para carnês com parcela fixa, o número de parcelas deve ser maior que zero.")
            if valor_a_parcelar <= Decimal('0.00') and db_carne.numero_parcelas > 0:
                 pass # A validação já é feita no frontend ou no esquema

            valor_parcela_sugerido_decimal = carne_update.valor_parcela_sugerido if carne_update.valor_parcela_sugerido is not None else Decimal('0.00') # Alterado para usar o Decimal do update_data
            if valor_parcela_sugerido_decimal == Decimal('0.00'): # Default se não sugerido
                if valor_a_parcelar > Decimal('0.00'):
                    valor_parcela_original_calculado = (valor_a_parcelar / db_carne.numero_parcelas).quantize(Decimal('0.01'))
                else:
                    valor_parcela_original_calculado = Decimal('0.00')
            else:
                valor_parcela_original_calculado = valor_parcela_sugerido_decimal


            db_carne.valor_parcela_original = valor_parcela_original_calculado # ATUALIZA O VALOR NO OBJETO DO CARNÊ

            current_due_date = db_carne.data_primeiro_vencimento
            for i in range(db_carne.numero_parcelas):
                parcela_valor_devido = valor_parcela_original_calculado
                if i == db_carne.numero_parcelas - 1:
                    soma_parcelas_anteriores = valor_parcela_original_calculado * i
                    parcela_valor_devido = valor_a_parcelar - soma_parcelas_anteriores
                    parcela_valor_devido = parcela_valor_devido.quantize(Decimal('0.01'))

                if parcela_valor_devido < Decimal('0.00'):
                    parcela_valor_devido = Decimal('0.00')

                db_parcela = models.Parcela(
                    id_carne=db_carne.id_carne,
                    numero_parcela=i + 1,
                    valor_devido=parcela_valor_devido,
                    data_vencimento=current_due_date,
                    valor_pago=Decimal('0.00'),
                    saldo_devedor=parcela_valor_devido,
                    status_parcela='Pendente',
                    juros_multa=Decimal('0.00'),
                    juros_multa_anterior_aplicada=Decimal('0.00'),
                    observacoes=None
                )
                db.add(db_parcela)
                current_due_date = calculate_next_due_date(current_due_date, db_carne.frequencia_pagamento)

            db.commit()
            db.refresh(db_carne) # Refresh novamente para carregar as parcelas
        return db_carne


def update_carne(db: Session, carne_id: int, carne_update: schemas.CarneCreate):
    db_carne = db.query(models.Carne).filter(models.Carne.id_carne == carne_id).first()
    if not db_carne:
        return None

    has_payments = db.query(models.Pagamento).join(models.Parcela).filter(models.Parcela.id_carne == carne_id).first()

    update_data = carne_update.model_dump(exclude_unset=False)

    new_data_venda = update_data.get('data_venda', db_carne.data_venda)
    new_data_primeiro_vencimento = update_data.get('data_primeiro_vencimento', db_carne.data_primeiro_vencimento)
    if new_data_venda and new_data_primeiro_vencimento < new_data_venda:
         raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A data do primeiro vencimento não pode ser anterior à data da venda.")

    # Detectar mudança no tipo de carnê (fixo/flexível) ou em campos financeiros que exigem regeneração
    regenerate_parcels_flag = False
    financial_keys_for_parcel_regeneration = [
        'valor_total_original', 'numero_parcelas',
        'valor_parcela_sugerido', # Campo relevante para carnê fixo
        'data_primeiro_vencimento',
        'frequencia_pagamento', 'valor_entrada',
        'parcela_fixa' # NOVO: Mudança no tipo de carnê exige regeneração
    ]

    if has_payments:
        # Se tem pagamentos, só permite alterar descricao, status_carne, observacoes, data_venda
        allowed_keys_with_payments = ['descricao', 'status_carne', 'observacoes', 'data_venda']
        for key_to_update in list(update_data.keys()):
            if key_to_update not in allowed_keys_with_payments:
                if getattr(db_carne, key_to_update) != update_data[key_to_update]:
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                        detail=f"Não é possível alterar o campo '{key_to_update}' de um carnê que já possui pagamentos.")
    else: # Não tem pagamentos, pode regenerar parcelas
        for key in financial_keys_for_parcel_regeneration:
            if key in update_data:
                current_val = getattr(db_carne, key)
                new_val = update_data.get(key)

                # Tratamento para comparação de Decimals
                if key in ['valor_total_original', 'valor_parcela_sugerido', 'valor_entrada']:
                    current_val = Decimal(str(current_val)) if current_val is not None else None # manter str para Decimal para compatibilidade
                    new_val = Decimal(str(new_val)) if new_val is not None else None # manter str para Decimal para compatibilidade
                # Para booleanos, comparar diretamente
                elif key == 'parcela_fixa':
                    if current_val != new_val: # A mudança no tipo de parcela sempre dispara regeneração
                        regenerate_parcels_flag = True
                        break
                # Para outros tipos, comparação padrão
                if current_val != new_val:
                    regenerate_parcels_flag = True
                    break

    # Aplicar as atualizações aos campos do objeto db_carne
    for key, value in update_data.items():
        if key == 'valor_parcela_original': # Este campo é calculado, não setado diretamente
            continue
        if key in ['valor_total_original', 'valor_entrada'] and value is not None:
            setattr(db_carne, key, value) # Alterado: Pydantic já validou para Decimal
        elif key == 'valor_parcela_sugerido' and value is not None:
            pass # Não armazena diretamente no db_carne, é usado para cálculo
        else:
            setattr(db_carne, key, value)

    # Lógica de regeneração de parcelas
    if regenerate_parcels_flag and not has_payments:
        # Excluir parcelas existentes
        db.query(models.Parcela).filter(models.Parcela.id_carne == carne_id).delete(synchronize_session='fetch')
        db.flush() # Garante que as deleções sejam processadas antes de adicionar novas

        valor_total_original_decimal = db_carne.valor_total_original # Alterado: Pydantic já validou para Decimal
        valor_entrada_decimal = db_carne.valor_entrada # Alterado: Pydantic já validou para Decimal
        valor_a_parcelar = valor_total_original_decimal - valor_entrada_decimal

        # Se o carnê se torna não fixo
        if not db_carne.parcela_fixa:
            db_carne.numero_parcelas = 1
            db_carne.valor_parcela_original = valor_a_parcelar.quantize(Decimal('0.01'))
            db_carne.frequencia_pagamento = "única" # Ou "variável"

            db_parcela_nova = models.Parcela(
                id_carne=db_carne.id_carne,
                numero_parcela=1,
                valor_devido=valor_a_parcelar,
                data_vencimento=db_carne.data_primeiro_vencimento,
                valor_pago=Decimal('0.00'),
                saldo_devedor=valor_a_parcelar,
                status_parcela='Pendente',
                juros_multa=Decimal('0.00'),
                juros_multa_anterior_aplicada=Decimal('0.00'),
                observacoes=None
            )
            db.add(db_parcela_nova)
        else: # Se o carnê é fixo (ou mudou para fixo)
            if db_carne.numero_parcelas <= 0:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Para carnês com parcela fixa, o número de parcelas deve ser maior que zero.")
            if valor_a_parcelar <= Decimal('0.00') and db_carne.numero_parcelas > 0:
                 pass # A validação já é feita no frontend ou no esquema

            valor_parcela_sugerido_decimal = carne_update.valor_parcela_sugerido if carne_update.valor_parcela_sugerido is not None else Decimal('0.00') # Alterado para usar o Decimal do update_data
            if valor_parcela_sugerido_decimal == Decimal('0.00'): # Default se não sugerido
                if valor_a_parcelar > Decimal('0.00'):
                    valor_parcela_original_calculado = (valor_a_parcelar / db_carne.numero_parcelas).quantize(Decimal('0.01'))
                else:
                    valor_parcela_original_calculado = Decimal('0.00')
            else:
                valor_parcela_original_calculado = valor_parcela_sugerido_decimal


            db_carne.valor_parcela_original = valor_parcela_original_calculado # ATUALIZA O VALOR NO OBJETO DO CARNÊ

            current_due_date = db_carne.data_primeiro_vencimento
            for i in range(db_carne.numero_parcelas):
                parcela_valor_devido = valor_parcela_original_calculado
                if i == db_carne.numero_parcelas - 1:
                    soma_parcelas_anteriores = valor_parcela_original_calculado * i
                    parcela_valor_devido = valor_a_parcelar - soma_parcelas_anteriores
                    parcela_valor_devido = parcela_valor_devido.quantize(Decimal('0.01'))

                if parcela_valor_devido < Decimal('0.00'):
                    parcela_valor_devido = Decimal('0.00')

                db_parcela = models.Parcela(
                    id_carne=db_carne.id_carne,
                    numero_parcela=i + 1,
                    valor_devido=parcela_valor_devido,
                    data_vencimento=current_due_date,
                    valor_pago=Decimal('0.00'),
                    saldo_devedor=parcela_valor_devido,
                    status_parcela='Pendente',
                    juros_multa=Decimal('0.00'),
                    juros_multa_anterior_aplicada=Decimal('0.00'),
                    observacoes=None
                )
                db.add(db_parcela)
                current_due_date = calculate_next_due_date(current_due_date, db_carne.frequencia_pagamento)

            db.commit()
            db.refresh(db_carne) # Refresh novamente para carregar as parcelas
        return db_carne


def update_carne(db: Session, carne_id: int, carne_update: schemas.CarneCreate):
    db_carne = db.query(models.Carne).filter(models.Carne.id_carne == carne_id).first()
    if not db_carne:
        return None

    has_payments = db.query(models.Pagamento).join(models.Parcela).filter(models.Parcela.id_carne == carne_id).first()

    update_data = carne_update.model_dump(exclude_unset=False)

    new_data_venda = update_data.get('data_venda', db_carne.data_venda)
    new_data_primeiro_vencimento = update_data.get('data_primeiro_vencimento', db_carne.data_primeiro_vencimento)
    if new_data_venda and new_data_primeiro_vencimento < new_data_venda:
         raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A data do primeiro vencimento não pode ser anterior à data da venda.")

    # Detectar mudança no tipo de carnê (fixo/flexível) ou em campos financeiros que exigem regeneração
    regenerate_parcels_flag = False
    financial_keys_for_parcel_regeneration = [
        'valor_total_original', 'numero_parcelas',
        'valor_parcela_sugerido', # Campo relevante para carnê fixo
        'data_primeiro_vencimento',
        'frequencia_pagamento', 'valor_entrada',
        'parcela_fixa' # NOVO: Mudança no tipo de carnê exige regeneração
    ]

    if has_payments:
        # Se tem pagamentos, só permite alterar descricao, status_carne, observacoes, data_venda
        allowed_keys_with_payments = ['descricao', 'status_carne', 'observacoes', 'data_venda']
        for key_to_update in list(update_data.keys()):
            if key_to_update not in allowed_keys_with_payments:
                if getattr(db_carne, key_to_update) != update_data[key_to_update]:
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                        detail=f"Não é possível alterar o campo '{key_to_update}' de um carnê que já possui pagamentos.")
    else: # Não tem pagamentos, pode regenerar parcelas
        for key in financial_keys_for_parcel_regeneration:
            if key in update_data:
                current_val = getattr(db_carne, key)
                new_val = update_data.get(key)

                # Tratamento para comparação de Decimals
                if key in ['valor_total_original', 'valor_parcela_sugerido', 'valor_entrada']:
                    current_val = Decimal(str(current_val)) if current_val is not None else None # manter str para Decimal para compatibilidade
                    new_val = Decimal(str(new_val)) if new_val is not None else None # manter str para Decimal para compatibilidade
                # Para booleanos, comparar diretamente
                elif key == 'parcela_fixa':
                    if current_val != new_val: # A mudança no tipo de parcela sempre dispara regeneração
                        regenerate_parcels_flag = True
                        break
                # Para outros tipos, comparação padrão
                if current_val != new_val:
                    regenerate_parcels_flag = True
                    break

    # Aplicar as atualizações aos campos do objeto db_carne
    for key, value in update_data.items():
        if key == 'valor_parcela_original': # Este campo é calculado, não setado diretamente
            continue
        if key in ['valor_total_original', 'valor_entrada'] and value is not None:
            setattr(db_carne, key, value) # Alterado: Pydantic já validou para Decimal
        elif key == 'valor_parcela_sugerido' and value is not None:
            pass # Não armazena diretamente no db_carne, é usado para cálculo
        else:
            setattr(db_carne, key, value)

    # Lógica de regeneração de parcelas
    if regenerate_parcels_flag and not has_payments:
        # Excluir parcelas existentes
        db.query(models.Parcela).filter(models.Parcela.id_carne == carne_id).delete(synchronize_session='fetch')
        db.flush() # Garante que as deleções sejam processadas antes de adicionar novas

        valor_total_original_decimal = db_carne.valor_total_original # Alterado: Pydantic já validou para Decimal
        valor_entrada_decimal = db_carne.valor_entrada # Alterado: Pydantic já validou para Decimal
        valor_a_parcelar = valor_total_original_decimal - valor_entrada_decimal

        # Se o carnê se torna não fixo
        if not db_carne.parcela_fixa:
            db_carne.numero_parcelas = 1
            db_carne.valor_parcela_original = valor_a_parcelar.quantize(Decimal('0.01'))
            db_carne.frequencia_pagamento = "única" # Ou "variável"

            db_parcela_nova = models.Parcela(
                id_carne=db_carne.id_carne,
                numero_parcela=1,
                valor_devido=valor_a_parcelar,
                data_vencimento=db_carne.data_primeiro_vencimento,
                valor_pago=Decimal('0.00'),
                saldo_devedor=valor_a_parcelar,
                status_parcela='Pendente',
                juros_multa=Decimal('0.00'),
                juros_multa_anterior_aplicada=Decimal('0.00'),
                observacoes=None
            )
            db.add(db_parcela_nova)
        else: # Se o carnê é fixo (ou mudou para fixo)
            if db_carne.numero_parcelas <= 0:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Para carnês com parcela fixa, o número de parcelas deve ser maior que zero.")
            if valor_a_parcelar <= Decimal('0.00') and db_carne.numero_parcelas > 0:
                 pass # A validação já é feita no frontend ou no esquema

            valor_parcela_sugerido_decimal = carne_update.valor_parcela_sugerido if carne_update.valor_parcela_sugerido is not None else Decimal('0.00') # Alterado para usar o Decimal do update_data
            if valor_parcela_sugerido_decimal == Decimal('0.00'): # Default se não sugerido
                if valor_a_parcelar > Decimal('0.00'):
                    valor_parcela_original_calculado = (valor_a_parcelar / db_carne.numero_parcelas).quantize(Decimal('0.01'))
                else:
                    valor_parcela_original_calculado = Decimal('0.00')
            else:
                valor_parcela_original_calculado = valor_parcela_sugerido_decimal


            db_carne.valor_parcela_original = valor_parcela_original_calculado # ATUALIZA O VALOR NO OBJETO DO CARNÊ

            current_due_date = db_carne.data_primeiro_vencimento
            for i in range(db_carne.numero_parcelas):
                parcela_valor_devido = valor_parcela_original_calculado
                if i == db_carne.numero_parcelas - 1:
                    soma_parcelas_anteriores = valor_parcela_original_calculado * i
                    parcela_valor_devido = valor_a_parcelar - soma_parcelas_anteriores
                    parcela_valor_devido = parcela_valor_devido.quantize(Decimal('0.01'))

                if parcela_valor_devido < Decimal('0.00'):
                    parcela_valor_devido = Decimal('0.00')

                db_parcela = models.Parcela(
                    id_carne=db_carne.id_carne,
                    numero_parcela=i + 1,
                    valor_devido=parcela_valor_devido,
                    data_vencimento=current_due_date,
                    valor_pago=Decimal('0.00'),
                    saldo_devedor=parcela_valor_devido,
                    status_parcela='Pendente',
                    juros_multa=Decimal('0.00'),
                    juros_multa_anterior_aplicada=Decimal('0.00'),
                    observacoes=None
                )
                db.add(db_parcela)
                current_due_date = calculate_next_due_date(current_due_date, db_carne.frequencia_pagamento)

            db.commit()
            db.refresh(db_carne) # Refresh novamente para carregar as parcelas
        return db_carne


def update_carne(db: Session, carne_id: int, carne_update: schemas.CarneCreate):
    db_carne = db.query(models.Carne).filter(models.Carne.id_carne == carne_id).first()
    if not db_carne:
        return None

    has_payments = db.query(models.Pagamento).join(models.Parcela).filter(models.Parcela.id_carne == carne_id).first()

    update_data = carne_update.model_dump(exclude_unset=False)

    new_data_venda = update_data.get('data_venda', db_carne.data_venda)
    new_data_primeiro_vencimento = update_data.get('data_primeiro_vencimento', db_carne.data_primeiro_vencimento)
    if new_data_venda and new_data_primeiro_vencimento < new_data_venda:
         raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A data do primeiro vencimento não pode ser anterior à data da venda.")

    # Detectar mudança no tipo de carnê (fixo/flexível) ou em campos financeiros que exigem regeneração
    regenerate_parcels_flag = False
    financial_keys_for_parcel_regeneration = [
        'valor_total_original', 'numero_parcelas',
        'valor_parcela_sugerido', # Campo relevante para carnê fixo
        'data_primeiro_vencimento',
        'frequencia_pagamento', 'valor_entrada',
        'parcela_fixa' # NOVO: Mudança no tipo de carnê exige regeneração
    ]

    if has_payments:
        # Se tem pagamentos, só permite alterar descricao, status_carne, observacoes, data_venda
        allowed_keys_with_payments = ['descricao', 'status_carne', 'observacoes', 'data_venda']
        for key_to_update in list(update_data.keys()):
            if key_to_update not in allowed_keys_with_payments:
                if getattr(db_carne, key_to_update) != update_data[key_to_update]:
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                        detail=f"Não é possível alterar o campo '{key_to_update}' de um carnê que já possui pagamentos.")
    else: # Não tem pagamentos, pode regenerar parcelas
        for key in financial_keys_for_parcel_regeneration:
            if key in update_data:
                current_val = getattr(db_carne, key)
                new_val = update_data.get(key)

                # Tratamento para comparação de Decimals
                if key in ['valor_total_original', 'valor_parcela_sugerido', 'valor_entrada']:
                    current_val = Decimal(str(current_val)) if current_val is not None else None # manter str para Decimal para compatibilidade
                    new_val = Decimal(str(new_val)) if new_val is not None else None # manter str para Decimal para compatibilidade
                # Para booleanos, comparar diretamente
                elif key == 'parcela_fixa':
                    if current_val != new_val: # A mudança no tipo de parcela sempre dispara regeneração
                        regenerate_parcels_flag = True
                        break
                # Para outros tipos, comparação padrão
                if current_val != new_val:
                    regenerate_parcels_flag = True
                    break

    # Aplicar as atualizações aos campos do objeto db_carne
    for key, value in update_data.items():
        if key == 'valor_parcela_original': # Este campo é calculado, não setado diretamente
            continue
        if key in ['valor_total_original', 'valor_entrada'] and value is not None:
            setattr(db_carne, key, value) # Alterado: Pydantic já validou para Decimal
        elif key == 'valor_parcela_sugerido' and value is not None:
            pass # Não armazena diretamente no db_carne, é usado para cálculo
        else:
            setattr(db_carne, key, value)

    # Lógica de regeneração de parcelas
    if regenerate_parcels_flag and not has_payments:
        # Excluir parcelas existentes
        db.query(models.Parcela).filter(models.Parcela.id_carne == carne_id).delete(synchronize_session='fetch')
        db.flush() # Garante que as deleções sejam processadas antes de adicionar novas

        valor_total_original_decimal = db_carne.valor_total_original # Alterado: Pydantic já validou para Decimal
        valor_entrada_decimal = db_carne.valor_entrada # Alterado: Pydantic já validou para Decimal
        valor_a_parcelar = valor_total_original_decimal - valor_entrada_decimal

        # Se o carnê se torna não fixo
        if not db_carne.parcela_fixa:
            db_carne.numero_parcelas = 1
            db_carne.valor_parcela_original = valor_a_parcelar.quantize(Decimal('0.01'))
            db_carne.frequencia_pagamento = "única" # Ou "variável"

            db_parcela_nova = models.Parcela(
                id_carne=db_carne.id_carne,
                numero_parcela=1,
                valor_devido=valor_a_parcelar,
                data_vencimento=db_carne.data_primeiro_vencimento,
                valor_pago=Decimal('0.00'),
                saldo_devedor=valor_a_parcelar,
                status_parcela='Pendente',
                juros_multa=Decimal('0.00'),
                juros_multa_anterior_aplicada=Decimal('0.00'),
                observacoes=None
            )
            db.add(db_parcela_nova)
        else: # Se o carnê é fixo (ou mudou para fixo)
            if db_carne.numero_parcelas <= 0:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Para carnês com parcela fixa, o número de parcelas deve ser maior que zero.")
            if valor_a_parcelar <= Decimal('0.00') and db_carne.numero_parcelas > 0:
                 pass # A validação já é feita no frontend ou no esquema

            valor_parcela_sugerido_decimal = carne_update.valor_parcela_sugerido if carne_update.valor_parcela_sugerido is not None else Decimal('0.00') # Alterado para usar o Decimal do update_data
            if valor_parcela_sugerido_decimal == Decimal('0.00'): # Default se não sugerido
                if valor_a_parcelar > Decimal('0.00'):
                    valor_parcela_original_calculado = (valor_a_parcelar / db_carne.numero_parcelas).quantize(Decimal('0.01'))
                else:
                    valor_parcela_original_calculado = Decimal('0.00')
            else:
                valor_parcela_original_calculado = valor_parcela_sugerido_decimal


            db_carne.valor_parcela_original = valor_parcela_original_calculado # ATUALIZA O VALOR NO OBJETO DO CARNÊ

            current_due_date = db_carne.data_primeiro_vencimento
            for i in range(db_carne.numero_parcelas):
                parcela_valor_devido = valor_parcela_original_calculado
                if i == db_carne.numero_parcelas - 1:
                    soma_parcelas_anteriores = valor_parcela_original_calculado * i
                    parcela_valor_devido = valor_a_parcelar - soma_parcelas_anteriores
                    parcela_valor_devido = parcela_valor_devido.quantize(Decimal('0.01'))

                if parcela_valor_devido < Decimal('0.00'):
                    parcela_valor_devido = Decimal('0.00')

                db_parcela = models.Parcela(
                    id_carne=db_carne.id_carne,
                    numero_parcela=i + 1,
                    valor_devido=parcela_valor_devido,
                    data_vencimento=current_due_date,
                    valor_pago=Decimal('0.00'),
                    saldo_devedor=parcela_valor_devido,
                    status_parcela='Pendente',
                    juros_multa=Decimal('0.00'),
                    juros_multa_anterior_aplicada=Decimal('0.00'),
                    observacoes=None
                )
                db.add(db_parcela)
                current_due_date = calculate_next_due_date(current_due_date, db_carne.frequencia_pagamento)

            db.commit()
            db.refresh(db_carne) # Refresh novamente para carregar as parcelas
        return db_carne


def update_carne(db: Session, carne_id: int, carne_update: schemas.CarneCreate):
    db_carne = db.query(models.Carne).filter(models.Carne.id_carne == carne_id).first()
    if not db_carne:
        return None

    has_payments = db.query(models.Pagamento).join(models.Parcela).filter(models.Parcela.id_carne == carne_id).first()

    update_data = carne_update.model_dump(exclude_unset=False)

    new_data_venda = update_data.get('data_venda', db_carne.data_venda)
    new_data_primeiro_vencimento = update_data.get('data_primeiro_vencimento', db_carne.data_primeiro_vencimento)
    if new_data_venda and new_data_primeiro_vencimento < new_data_venda:
         raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A data do primeiro vencimento não pode ser anterior à data da venda.")

    # Detectar mudança no tipo de carnê (fixo/flexível) ou em campos financeiros que exigem regeneração
    regenerate_parcels_flag = False
    financial_keys_for_parcel_regeneration = [
        'valor_total_original', 'numero_parcelas',
        'valor_parcela_sugerido', # Campo relevante para carnê fixo
        'data_primeiro_vencimento',
        'frequencia_pagamento', 'valor_entrada',
        'parcela_fixa' # NOVO: Mudança no tipo de carnê exige regeneração
    ]

    if has_payments:
        # Se tem pagamentos, só permite alterar descricao, status_carne, observacoes, data_venda
        allowed_keys_with_payments = ['descricao', 'status_carne', 'observacoes', 'data_venda']
        for key_to_update in list(update_data.keys()):
            if key_to_update not in allowed_keys_with_payments:
                if getattr(db_carne, key_to_update) != update_data[key_to_update]:
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                        detail=f"Não é possível alterar o campo '{key_to_update}' de um carnê que já possui pagamentos.")
    else: # Não tem pagamentos, pode regenerar parcelas
        for key in financial_keys_for_parcel_regeneration:
            if key in update_data:
                current_val = getattr(db_carne, key)
                new_val = update_data.get(key)

                # Tratamento para comparação de Decimals
                if key in ['valor_total_original', 'valor_parcela_sugerido', 'valor_entrada']:
                    current_val = Decimal(str(current_val)) if current_val is not None else None # manter str para Decimal para compatibilidade
                    new_val = Decimal(str(new_val)) if new_val is not None else None # manter str para Decimal para compatibilidade
                # Para booleanos, comparar diretamente
                elif key == 'parcela_fixa':
                    if current_val != new_val: # A mudança no tipo de parcela sempre dispara regeneração
                        regenerate_parcels_flag = True
                        break
                # Para outros tipos, comparação padrão
                if current_val != new_val:
                    regenerate_parcels_flag = True
                    break

    # Aplicar as atualizações aos campos do objeto db_carne
    for key, value in update_data.items():
        if key == 'valor_parcela_original': # Este campo é calculado, não setado diretamente
            continue
        if key in ['valor_total_original', 'valor_entrada'] and value is not None:
            setattr(db_carne, key, value) # Alterado: Pydantic já validou para Decimal
        elif key == 'valor_parcela_sugerido' and value is not None:
            pass # Não armazena diretamente no db_carne, é usado para cálculo
        else:
            setattr(db_carne, key, value)

    # Lógica de regeneração de parcelas
    if regenerate_parcels_flag and not has_payments:
        # Excluir parcelas existentes
        db.query(models.Parcela).filter(models.Parcela.id_carne == carne_id).delete(synchronize_session='fetch')
        db.flush() # Garante que as deleções sejam processadas antes de adicionar novas

        valor_total_original_decimal = db_carne.valor_total_original # Alterado: Pydantic já validou para Decimal
        valor_entrada_decimal = db_carne.valor_entrada # Alterado: Pydantic já validou para Decimal
        valor_a_parcelar = valor_total_original_decimal - valor_entrada_decimal

        # Se o carnê se torna não fixo
        if not db_carne.parcela_fixa:
            db_carne.numero_parcelas = 1
            db_carne.valor_parcela_original = valor_a_parcelar.quantize(Decimal('0.01'))
            db_carne.frequencia_pagamento = "única" # Ou "variável"

            db_parcela_nova = models.Parcela(
                id_carne=db_carne.id_carne,
                numero_parcela=1,
                valor_devido=valor_a_parcelar,
                data_vencimento=db_carne.data_primeiro_vencimento,
                valor_pago=Decimal('0.00'),
                saldo_devedor=valor_a_parcelar,
                status_parcela='Pendente',
                juros_multa=Decimal('0.00'),
                juros_multa_anterior_aplicada=Decimal('0.00'),
                observacoes=None
            )
            db.add(db_parcela_nova)
        else: # Se o carnê é fixo (ou mudou para fixo)
            if db_carne.numero_parcelas <= 0:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Para carnês com parcela fixa, o número de parcelas deve ser maior que zero.")
            if valor_a_parcelar <= Decimal('0.00') and db_carne.numero_parcelas > 0:
                 pass # A validação já é feita no frontend ou no esquema

            valor_parcela_sugerido_decimal = carne_update.valor_parcela_sugerido if carne_update.valor_parcela_sugerido is not None else Decimal('0.00') # Alterado para usar o Decimal do update_data
            if valor_parcela_sugerido_decimal == Decimal('0.00'): # Default se não sugerido
                if valor_a_parcelar > Decimal('0.00'):
                    valor_parcela_original_calculado = (valor_a_parcelar / db_carne.numero_parcelas).quantize(Decimal('0.01'))
                else:
                    valor_parcela_original_calculado = Decimal('0.00')
            else:
                valor_parcela_original_calculado = valor_parcela_sugerido_decimal


            db_carne.valor_parcela_original = valor_parcela_original_calculado # ATUALIZA O VALOR NO OBJETO DO CARNÊ

            current_due_date = db_carne.data_primeiro_vencimento
            for i in range(db_carne.numero_parcelas):
                parcela_valor_devido = valor_parcela_original_calculado
                if i == db_carne.numero_parcelas - 1:
                    soma_parcelas_anteriores = valor_parcela_original_calculado * i
                    parcela_valor_devido = valor_a_parcelar - soma_parcelas_anteriores
                    parcela_valor_devido = parcela_valor_devido.quantize(Decimal('0.01'))

                if parcela_valor_devido < Decimal('0.00'):
                    parcela_valor_devido = Decimal('0.00')

                db_parcela = models.Parcela(
                    id_carne=db_carne.id_carne,
                    numero_parcela=i + 1,
                    valor_devido=parcela_valor_devido,
                    data_vencimento=current_due_date,
                    valor_pago=Decimal('0.00'),
                    saldo_devedor=parcela_valor_devido,
                    status_parcela='Pendente',
                    juros_multa=Decimal('0.00'),
                    juros_multa_anterior_aplicada=Decimal('0.00'),
                    observacoes=None
                )
                db.add(db_parcela)
                current_due_date = calculate_next_due_date(current_due_date, db_carne.frequencia_pagamento)

            db.commit()
            db.refresh(db_carne) # Refresh novamente para carregar as parcelas
        return db_carne


def update_carne(db: Session, carne_id: int, carne_update: schemas.CarneCreate):
    db_carne = db.query(models.Carne).filter(models.Carne.id_carne == carne_id).first()
    if not db_carne:
        return None

    has_payments = db.query(models.Pagamento).join(models.Parcela).filter(models.Parcela.id_carne == carne_id).first()

    update_data = carne_update.model_dump(exclude_unset=False)

    new_data_venda = update_data.get('data_venda', db_carne.data_venda)
    new_data_primeiro_vencimento = update_data.get('data_primeiro_vencimento', db_carne.data_primeiro_vencimento)
    if new_data_venda and new_data_primeiro_vencimento < new_data_venda:
         raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A data do primeiro vencimento não pode ser anterior à data da venda.")

    # Detectar mudança no tipo de carnê (fixo/flexível) ou em campos financeiros que exigem regeneração
    regenerate_parcels_flag = False
    financial_keys_for_parcel_regeneration = [
        'valor_total_original', 'numero_parcelas',
        'valor_parcela_sugerido', # Campo relevante para carnê fixo
        'data_primeiro_vencimento',
        'frequencia_pagamento', 'valor_entrada',
        'parcela_fixa' # NOVO: Mudança no tipo de carnê exige regeneração
    ]

    if has_payments:
        # Se tem pagamentos, só permite alterar descricao, status_carne, observacoes, data_venda
        allowed_keys_with_payments = ['descricao', 'status_carne', 'observacoes', 'data_venda']
        for key_to_update in list(update_data.keys()):
            if key_to_update not in allowed_keys_with_payments:
                if getattr(db_carne, key_to_update) != update_data[key_to_update]:
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                        detail=f"Não é possível alterar o campo '{key_to_update}' de um carnê que já possui pagamentos.")
    else: # Não tem pagamentos, pode regenerar parcelas
        for key in financial_keys_for_parcel_regeneration:
            if key in update_data:
                current_val = getattr(db_carne, key)
                new_val = update_data.get(key)

                # Tratamento para comparação de Decimals
                if key in ['valor_total_original', 'valor_parcela_sugerido', 'valor_entrada']:
                    current_val = Decimal(str(current_val)) if current_val is not None else None # manter str para Decimal para compatibilidade
                    new_val = Decimal(str(new_val)) if new_val is not None else None # manter str para Decimal para compatibilidade
                # Para booleanos, comparar diretamente
                elif key == 'parcela_fixa':
                    if current_val != new_val: # A mudança no tipo de parcela sempre dispara regeneração
                        regenerate_parcels_flag = True
                        break
                # Para outros tipos, comparação padrão
                if current_val != new_val:
                    regenerate_parcels_flag = True
                    break

    # Aplicar as atualizações aos campos do objeto db_carne
    for key, value in update_data.items():
        if key == 'valor_parcela_original': # Este campo é calculado, não setado diretamente
            continue
        if key in ['valor_total_original', 'valor_entrada'] and value is not None:
            setattr(db_carne, key, value) # Alterado: Pydantic já validou para Decimal
        elif key == 'valor_parcela_sugerido' and value is not None:
            pass # Não armazena diretamente no db_carne, é usado para cálculo
        else:
            setattr(db_carne, key, value)

    # Lógica de regeneração de parcelas
    if regenerate_parcels_flag and not has_payments:
        # Excluir parcelas existentes
        db.query(models.Parcela).filter(models.Parcela.id_carne == carne_id).delete(synchronize_session='fetch')
        db.flush() # Garante que as deleções sejam processadas antes de adicionar novas

        valor_total_original_decimal = db_carne.valor_total_original # Alterado: Pydantic já validou para Decimal
        valor_entrada_decimal = db_carne.valor_entrada # Alterado: Pydantic já validou para Decimal
        valor_a_parcelar = valor_total_original_decimal - valor_entrada_decimal

        # Se o carnê se torna não fixo
        if not db_carne.parcela_fixa:
            db_carne.numero_parcelas = 1
            db_carne.valor_parcela_original = valor_a_parcelar.quantize(Decimal('0.01'))
            db_carne.frequencia_pagamento = "única" # Ou "variável"

            db_parcela_nova = models.Parcela(
                id_carne=db_carne.id_carne,
                numero_parcela=1,
                valor_devido=valor_a_parcelar,
                data_vencimento=db_carne.data_primeiro_vencimento,
                valor_pago=Decimal('0.00'),
                saldo_devedor=valor_a_parcelar,
                status_parcela='Pendente',
                juros_multa=Decimal('0.00'),
                juros_multa_anterior_aplicada=Decimal('0.00'),
                observacoes=None
            )
            db.add(db_parcela_nova)
        else: # Se o carnê é fixo (ou mudou para fixo)
            if db_carne.numero_parcelas <= 0:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Para carnês com parcela fixa, o número de parcelas deve ser maior que zero.")
            if valor_a_parcelar <= Decimal('0.00') and db_carne.numero_parcelas > 0:
                 pass # A validação já é feita no frontend ou no esquema

            valor_parcela_sugerido_decimal = carne_update.valor_parcela_sugerido if carne_update.valor_parcela_sugerido is not None else Decimal('0.00') # Alterado para usar o Decimal do update_data
            if valor_parcela_sugerido_decimal == Decimal('0.00'): # Default se não sugerido
                if valor_a_parcelar > Decimal('0.00'):
                    valor_parcela_original_calculado = (valor_a_parcelar / db_carne.numero_parcelas).quantize(Decimal('0.01'))
                else:
                    valor_parcela_original_calculado = Decimal('0.00')
            else:
                valor_parcela_original_calculado = valor_parcela_sugerido_decimal


            db_carne.valor_parcela_original = valor_parcela_original_calculado # ATUALIZA O VALOR NO OBJETO DO CARNÊ

            current_due_date = db_carne.data_primeiro_vencimento
            for i in range(db_carne.numero_parcelas):
                parcela_valor_devido = valor_parcela_original_calculado
                if i == db_carne.numero_parcelas - 1:
                    soma_parcelas_anteriores = valor_parcela_original_calculado * i
                    parcela_valor_devido = valor_a_parcelar - soma_parcelas_anteriores
                    parcela_valor_devido = parcela_valor_devido.quantize(Decimal('0.01'))

                if parcela_valor_devido < Decimal('0.00'):
                    parcela_valor_devido = Decimal('0.00')

                db_parcela = models.Parcela(
                    id_carne=db_carne.id_carne,
                    numero_parcela=i + 1,
                    valor_devido=parcela_valor_devido,
                    data_vencimento=current_due_date,
                    valor_pago=Decimal('0.00'),
                    saldo_devedor=parcela_valor_devido,
                    status_parcela='Pendente',
                    juros_multa=Decimal('0.00'),
                    juros_multa_anterior_aplicada=Decimal('0.00'),
                    observacoes=None
                )
                db.add(db_parcela)
                current_due_date = calculate_next_due_date(current_due_date, db_carne.frequencia_pagamento)

            db.commit()
            db.refresh(db_carne) # Refresh novamente para carregar as parcelas
        return db_carne


def update_carne(db: Session, carne_id: int, carne_update: schemas.CarneCreate):
    db_carne = db.query(models.Carne).filter(models.Carne.id_carne == carne_id).first()
    if not db_carne:
        return None

    has_payments = db.query(models.Pagamento).join(models.Parcela).filter(models.Parcela.id_carne == carne_id).first()

    update_data = carne_update.model_dump(exclude_unset=False)

    new_data_venda = update_data.get('data_venda', db_carne.data_venda)
    new_data_primeiro_vencimento = update_data.get('data_primeiro_vencimento', db_carne.data_primeiro_vencimento)
    if new_data_venda and new_data_primeiro_vencimento < new_data_venda:
         raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A data do primeiro vencimento não pode ser anterior à data da venda.")

    # Detectar mudança no tipo de carnê (fixo/flexível) ou em campos financeiros que exigem regeneração
    regenerate_parcels_flag = False
    financial_keys_for_parcel_regeneration = [
        'valor_total_original', 'numero_parcelas',
        'valor_parcela_sugerido', # Campo relevante para carnê fixo
        'data_primeiro_vencimento',
        'frequencia_pagamento', 'valor_entrada',
        'parcela_fixa' # NOVO: Mudança no tipo de carnê exige regeneração
    ]

    if has_payments:
        # Se tem pagamentos, só permite alterar descricao, status_carne, observacoes, data_venda
        allowed_keys_with_payments = ['descricao', 'status_carne', 'observacoes', 'data_venda']
        for key_to_update in list(update_data.keys()):
            if key_to_update not in allowed_keys_with_payments:
                if getattr(db_carne, key_to_update) != update_data[key_to_update]:
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                        detail=f"Não é possível alterar o campo '{key_to_update}' de um carnê que já possui pagamentos.")
    else: # Não tem pagamentos, pode regenerar parcelas
        for key in financial_keys_for_parcel_regeneration:
            if key in update_data:
                current_val = getattr(db_carne, key)
                new_val = update_data.get(key)

                # Tratamento para comparação de Decimals
                if key in ['valor_total_original', 'valor_parcela_sugerido', 'valor_entrada']:
                    current_val = Decimal(str(current_val)) if current_val is not None else None # manter str para Decimal para compatibilidade
                    new_val = Decimal(str(new_val)) if new_val is not None else None # manter str para Decimal para compatibilidade
                # Para booleanos, comparar diretamente
                elif key == 'parcela_fixa':
                    if current_val != new_val: # A mudança no tipo de parcela sempre dispara regeneração
                        regenerate_parcels_flag = True
                        break
                # Para outros tipos, comparação padrão
                if current_val != new_val:
                    regenerate_parcels_flag = True
                    break

    # Aplicar as atualizações aos campos do objeto db_carne
    for key, value in update_data.items():
        if key == 'valor_parcela_original': # Este campo é calculado, não setado diretamente
            continue
        if key in ['valor_total_original', 'valor_entrada'] and value is not None:
            setattr(db_carne, key, value) # Alterado: Pydantic já validou para Decimal
        elif key == 'valor_parcela_sugerido' and value is not None:
            pass # Não armazena diretamente no db_carne, é usado para cálculo
        else:
            setattr(db_carne, key, value)

    # Lógica de regeneração de parcelas
    if regenerate_parcels_flag and not has_payments:
        # Excluir parcelas existentes
        db.query(models.Parcela).filter(models.Parcela.id_carne == carne_id).delete(synchronize_session='fetch')
        db.flush() # Garante que as deleções sejam processadas antes de adicionar novas

        valor_total_original_decimal = db_carne.valor_total_original # Alterado: Pydantic já validou para Decimal
        valor_entrada_decimal = db_carne.valor_entrada # Alterado: Pydantic já validou para Decimal
        valor_a_parcelar = valor_total_original_decimal - valor_entrada_decimal

        # Se o carnê se torna não fixo
        if not db_carne.parcela_fixa:
            db_carne.numero_parcelas = 1
            db_carne.valor_parcela_original = valor_a_parcelar.quantize(Decimal('0.01'))
            db_carne.frequencia_pagamento = "única" # Ou "variável"

            db_parcela_nova = models.Parcela(
                id_carne=db_carne.id_carne,
                numero_parcela=1,
                valor_devido=valor_a_parcelar,
                data_vencimento=db_carne.data_primeiro_vencimento,
                valor_pago=Decimal('0.00'),
                saldo_devedor=valor_a_parcelar,
                status_parcela='Pendente',
                juros_multa=Decimal('0.00'),
                juros_multa_anterior_aplicada=Decimal('0.00'),
                observacoes=None
            )
            db.add(db_parcela_nova)
        else: # Se o carnê é fixo (ou mudou para fixo)
            if db_carne.numero_parcelas <= 0:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Para carnês com parcela fixa, o número de parcelas deve ser maior que zero.")
            if valor_a_parcelar <= Decimal('0.00') and db_carne.numero_parcelas > 0:
                 pass # A validação já é feita no frontend ou no esquema

            valor_parcela_sugerido_decimal = carne_update.valor_parcela_sugerido if carne_update.valor_parcela_sugerido is not None else Decimal('0.00') # Alterado para usar o Decimal do update_data
            if valor_parcela_sugerido_decimal == Decimal('0.00'): # Default se não sugerido
                if valor_a_parcelar > Decimal('0.00'):
                    valor_parcela_original_calculado = (valor_a_parcelar / db_carne.numero_parcelas).quantize(Decimal('0.01'))
                else:
                    valor_parcela_original_calculado = Decimal('0.00')
            else:
                valor_parcela_original_calculado = valor_parcela_sugerido_decimal


            db_carne.valor_parcela_original = valor_parcela_original_calculado # ATUALIZA O VALOR NO OBJETO DO CARNÊ

            current_due_date = db_carne.data_primeiro_vencimento
            for i in range(db_carne.numero_parcelas):
                parcela_valor_devido = valor_parcela_original_calculado
                if i == db_carne.numero_parcelas - 1:
                    soma_parcelas_anteriores = valor_parcela_original_calculado * i
                    parcela_valor_devido = valor_a_parcelar - soma_parcelas_anteriores
                    parcela_valor_devido = parcela_valor_devido.quantize(Decimal('0.01'))

                if parcela_valor_devido < Decimal('0.00'):
                    parcela_valor_devido = Decimal('0.00')

                db_parcela = models.Parcela(
                    id_carne=db_carne.id_carne,
                    numero_parcela=i + 1,
                    valor_devido=parcela_valor_devido,
                    data_vencimento=current_due_date,
                    valor_pago=Decimal('0.00'),
                    saldo_devedor=parcela_valor_devido,
                    status_parcela='Pendente',
                    juros_multa=Decimal('0.00'),
                    juros_multa_anterior_aplicada=Decimal('0.00'),
                    observacoes=None
                )
                db.add(db_parcela)
                current_due_date = calculate_next_due_date(current_due_date, db_carne.frequencia_pagamento)

            db.commit()
            db.refresh(db_carne) # Refresh novamente para carregar as parcelas
        return db_carne


def update_carne(db: Session, carne_id: int, carne_update: schemas.CarneCreate):
    db_carne = db.query(models.Carne).filter(models.Carne.id_carne == carne_id).first()
    if not db_carne:
        return None

    has_payments = db.query(models.Pagamento).join(models.Parcela).filter(models.Parcela.id_carne == carne_id).first()

    update_data = carne_update.model_dump(exclude_unset=False)

    new_data_venda = update_data.get('data_venda', db_carne.data_venda)
    new_data_primeiro_vencimento = update_data.get('data_primeiro_vencimento', db_carne.data_primeiro_vencimento)
    if new_data_venda and new_data_primeiro_vencimento < new_data_venda:
         raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A data do primeiro vencimento não pode ser anterior à data da venda.")

    # Detectar mudança no tipo de carnê (fixo/flexível) ou em campos financeiros que exigem regeneração
    regenerate_parcels_flag = False
    financial_keys_for_parcel_regeneration = [
        'valor_total_original', 'numero_parcelas',
        'valor_parcela_sugerido', # Campo relevante para carnê fixo
        'data_primeiro_vencimento',
        'frequencia_pagamento', 'valor_entrada',
        'parcela_fixa' # NOVO: Mudança no tipo de carnê exige regeneração
    ]

    if has_payments:
        # Se tem pagamentos, só permite alterar descricao, status_carne, observacoes, data_venda
        allowed_keys_with_payments = ['descricao', 'status_carne', 'observacoes', 'data_venda']
        for key_to_update in list(update_data.keys()):
            if key_to_update not in allowed_keys_with_payments:
                if getattr(db_carne, key_to_update) != update_data[key_to_update]:
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                        detail=f"Não é possível alterar o campo '{key_to_update}' de um carnê que já possui pagamentos.")
    else: # Não tem pagamentos, pode regenerar parcelas
        for key in financial_keys_for_parcel_regeneration:
            if key in update_data:
                current_val = getattr(db_carne, key)
                new_val = update_data.get(key)

                # Tratamento para comparação de Decimals
                if key in ['valor_total_original', 'valor_parcela_sugerido', 'valor_entrada']:
                    current_val = Decimal(str(current_val)) if current_val is not None else None # manter str para Decimal para compatibilidade
                    new_val = Decimal(str(new_val)) if new_val is not None else None # manter str para Decimal para compatibilidade
                # Para booleanos, comparar diretamente
                elif key == 'parcela_fixa':
                    if current_val != new_val: # A mudança no tipo de parcela sempre dispara regeneração
                        regenerate_parcels_flag = True
                        break
                # Para outros tipos, comparação padrão
                if current_val != new_val:
                    regenerate_parcels_flag = True
                    break

    # Aplicar as atualizações aos campos do objeto db_carne
    for key, value in update_data.items():
        if key == 'valor_parcela_original': # Este campo é calculado, não setado diretamente
            continue
        if key in ['valor_total_original', 'valor_entrada'] and value is not None:
            setattr(db_carne, key, value) # Alterado: Pydantic já validou para Decimal
        elif key == 'valor_parcela_sugerido' and value is not None:
            pass # Não armazena diretamente no db_carne, é usado para cálculo
        else:
            setattr(db_carne, key, value)

    # Lógica de regeneração de parcelas
    if regenerate_parcels_flag and not has_payments:
        # Excluir parcelas existentes
        db.query(models.Parcela).filter(models.Parcela.id_carne == carne_id).delete(synchronize_session='fetch')
        db.flush() # Garante que as deleções sejam processadas antes de adicionar novas

        valor_total_original_decimal = db_carne.valor_total_original # Alterado: Pydantic já validou para Decimal
        valor_entrada_decimal = db_carne.valor_entrada # Alterado: Pydantic já validou para Decimal
        valor_a_parcelar = valor_total_original_decimal - valor_entrada_decimal

        # Se o carnê se torna não fixo
        if not db_carne.parcela_fixa:
            db_carne.numero_parcelas = 1
            db_carne.valor_parcela_original = valor_a_parcelar.quantize(Decimal('0.01'))
            db_carne.frequencia_pagamento = "única" # Ou "variável"

            db_parcela_nova = models.Parcela(
                id_carne=db_carne.id_carne,
                numero_parcela=1,
                valor_devido=valor_a_parcelar,
                data_vencimento=db_carne.data_primeiro_vencimento,
                valor_pago=Decimal('0.00'),
                saldo_devedor=valor_a_parcelar,
                status_parcela='Pendente',
                juros_multa=Decimal('0.00'),
                juros_multa_anterior_aplicada=Decimal('0.00'),
                observacoes=None
            )
            db.add(db_parcela_nova)
        else: # Se o carnê é fixo (ou mudou para fixo)
            if db_carne.numero_parcelas <= 0:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Para carnês com parcela fixa, o número de parcelas deve ser maior que zero.")
            if valor_a_parcelar <= Decimal('0.00') and db_carne.numero_parcelas > 0:
                 pass # A validação já é feita no frontend ou no esquema

            valor_parcela_sugerido_decimal = carne_update.valor_parcela_sugerido if carne_update.valor_parcela_sugerido is not None else Decimal('0.00') # Alterado para usar o Decimal do update_data
            if valor_parcela_sugerido_decimal == Decimal('0.00'): # Default se não sugerido
                if valor_a_parcelar > Decimal('0.00'):
                    valor_parcela_original_calculado = (valor_a_parcelar / db_carne.numero_parcelas).quantize(Decimal('0.01'))
                else:
                    valor_parcela_original_calculado = Decimal('0.00')
            else:
                valor_parcela_original_calculado = valor_parcela_sugerido_decimal


            db_carne.valor_parcela_original = valor_parcela_original_calculado # ATUALIZA O VALOR NO OBJETO DO CARNÊ

            current_due_date = db_carne.data_primeiro_vencimento
            for i in range(db_carne.numero_parcelas):
                parcela_valor_devido = valor_parcela_original_calculado
                if i == db_carne.numero_parcelas - 1:
                    soma_parcelas_anteriores = valor_parcela_original_calculado * i
                    parcela_valor_devido = valor_a_parcelar - soma_parcelas_anteriores
                    parcela_valor_devido = parcela_valor_devido.quantize(Decimal('0.01'))

                if parcela_valor_devido < Decimal('0.00'):
                    parcela_valor_devido = Decimal('0.00')

                db_parcela = models.Parcela(
                    id_carne=db_carne.id_carne,
                    numero_parcela=i + 1,
                    valor_devido=parcela_valor_devido,
                    data_vencimento=current_due_date,
                    valor_pago=Decimal('0.00'),
                    saldo_devedor=parcela_valor_devido,
                    status_parcela='Pendente',
                    juros_multa=Decimal('0.00'),
                    juros_multa_anterior_aplicada=Decimal('0.00'),
                    observacoes=None
                )
                db.add(db_parcela)
                current_due_date = calculate_next_due_date(current_due_date, db_carne.frequencia_pagamento)

            db.commit()
            db.refresh(db_carne) # Refresh novamente para carregar as parcelas
        return db_carne


def update_carne(db: Session, carne_id: int, carne_update: schemas.CarneCreate):
    db_carne = db.query(models.Carne).filter(models.Carne.id_carne == carne_id).first()
    if not db_carne:
        return None

    has_payments = db.query(models.Pagamento).join(models.Parcela).filter(models.Parcela.id_carne == carne_id).first()

    update_data = carne_update.model_dump(exclude_unset=False)

    new_data_venda = update_data.get('data_venda', db_carne.data_venda)
    new_data_primeiro_vencimento = update_data.get('data_primeiro_vencimento', db_carne.data_primeiro_vencimento)
    if new_data_venda and new_data_primeiro_vencimento < new_data_venda:
         raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A data do primeiro vencimento não pode ser anterior à data da venda.")

    # Detectar mudança no tipo de carnê (fixo/flexível) ou em campos financeiros que exigem regeneração
    regenerate_parcels_flag = False
    financial_keys_for_parcel_regeneration = [
        'valor_total_original', 'numero_parcelas',
        'valor_parcela_sugerido', # Campo relevante para carnê fixo
        'data_primeiro_vencimento',
        'frequencia_pagamento', 'valor_entrada',
        'parcela_fixa' # NOVO: Mudança no tipo de carnê exige regeneração
    ]

    if has_payments:
        # Se tem pagamentos, só permite alterar descricao, status_carne, observacoes, data_venda
        allowed_keys_with_payments = ['descricao', 'status_carne', 'observacoes', 'data_venda']
        for key_to_update in list(update_data.keys()):
            if key_to_update not in allowed_keys_with_payments:
                if getattr(db_carne, key_to_update) != update_data[key_to_update]:
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                        detail=f"Não é possível alterar o campo '{key_to_update}' de um carnê que já possui pagamentos.")
    else: # Não tem pagamentos, pode regenerar parcelas
        for key in financial_keys_for_parcel_regeneration:
            if key in update_data:
                current_val = getattr(db_carne, key)
                new_val = update_data.get(key)

                # Tratamento para comparação de Decimals
                if key in ['valor_total_original', 'valor_parcela_sugerido', 'valor_entrada']:
                    current_val = Decimal(str(current_val)) if current_val is not None else None # manter str para Decimal para compatibilidade
                    new_val = Decimal(str(new_val)) if new_val is not None else None # manter str para Decimal para compatibilidade
                # Para booleanos, comparar diretamente
                elif key == 'parcela_fixa':
                    if current_val != new_val: # A mudança no tipo de parcela sempre dispara regeneração
                        regenerate_parcels_flag = True
                        break
                # Para outros tipos, comparação padrão
                if current_val != new_val:
                    regenerate_parcels_flag = True
                    break

    # Aplicar as atualizações aos campos do objeto db_carne
    for key, value in update_data.items():
        if key == 'valor_parcela_original': # Este campo é calculado, não setado diretamente
            continue
        if key in ['valor_total_original', 'valor_entrada'] and value is not None:
            setattr(db_carne, key, value) # Alterado: Pydantic já validou para Decimal
        elif key == 'valor_parcela_sugerido' and value is not None:
            pass # Não armazena diretamente no db_carne, é usado para cálculo
        else:
            setattr(db_carne, key, value)

    # Lógica de regeneração de parcelas
    if regenerate_parcels_flag and not has_payments:
        # Excluir parcelas existentes
        db.query(models.Parcela).filter(models.Parcela.id_carne == carne_id).delete(synchronize_session='fetch')
        db.flush() # Garante que as deleções sejam processadas antes de adicionar novas

        valor_total_original_decimal = db_carne.valor_total_original # Alterado: Pydantic já validou para Decimal
        valor_entrada_decimal = db_carne.valor_entrada # Alterado: Pydantic já validou para Decimal
        valor_a_parcelar = valor_total_original_decimal - valor_entrada_decimal

        # Se o carnê se torna não fixo
        if not db_carne.parcela_fixa:
            db_carne.numero_parcelas = 1
            db_carne.valor_parcela_original = valor_a_parcelar.quantize(Decimal('0.01'))
            db_carne.frequencia_pagamento = "única" # Ou "variável"

            db_parcela_nova = models.Parcela(
                id_carne=db_carne.id_carne,
                numero_parcela=1,
                valor_devido=valor_a_parcelar,
                data_vencimento=db_carne.data_primeiro_vencimento,
                valor_pago=Decimal('0.00'),
                saldo_devedor=valor_a_parcelar,
                status_parcela='Pendente',
                juros_multa=Decimal('0.00'),
                juros_multa_anterior_aplicada=Decimal('0.00'),
                observacoes=None
            )
            db.add(db_parcela_nova)
        else: # Se o carnê é fixo (ou mudou para fixo)
            if db_carne.numero_parcelas <= 0:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Para carnês com parcela fixa, o número de parcelas deve ser maior que zero.")
            if valor_a_parcelar <= Decimal('0.00') and db_carne.numero_parcelas > 0:
                 pass # A validação já é feita no frontend ou no esquema

            valor_parcela_sugerido_decimal = carne_update.valor_parcela_sugerido if carne_update.valor_parcela_sugerido is not None else Decimal('0.00') # Alterado para usar o Decimal do update_data
            if valor_parcela_sugerido_decimal == Decimal('0.00'): # Default se não sugerido
                if valor_a_parcelar > Decimal('0.00'):
                    valor_parcela_original_calculado = (valor_a_parcelar / db_carne.numero_parcelas).quantize(Decimal('0.01'))
                else:
                    valor_parcela_original_calculado = Decimal('0.00')
            else:
                valor_parcela_original_calculado = valor_parcela_sugerido_decimal


            db_carne.valor_parcela_original = valor_parcela_original_calculado # ATUALIZA O VALOR NO OBJETO DO CARNÊ

            current_due_date = db_carne.data_primeiro_vencimento
            for i in range(db_carne.numero_parcelas):
                parcela_valor_devido = valor_parcela_original_calculado
                if i == db_carne.numero_parcelas - 1:
                    soma_parcelas_anteriores = valor_parcela_original_calculado * i
                    parcela_valor_devido = valor_a_parcelar - soma_parcelas_anteriores
                    parcela_valor_devido = parcela_valor_devido.quantize(Decimal('0.01'))

                if parcela_valor_devido < Decimal('0.00'):
                    parcela_valor_devido = Decimal('0.00')

                db_parcela = models.Parcela(
                    id_carne=db_carne.id_carne,
                    numero_parcela=i + 1,
                    valor_devido=parcela_valor_devido,
                    data_vencimento=current_due_date,
                    valor_pago=Decimal('0.00'),
                    saldo_devedor=parcela_valor_devido,
                    status_parcela='Pendente',
                    juros_multa=Decimal('0.00'),
                    juros_multa_anterior_aplicada=Decimal('0.00'),
                    observacoes=None
                )
                db.add(db_parcela)
                current_due_date = calculate_next_due_date(current_due_date, db_carne.frequencia_pagamento)

            db.commit()
            db.refresh(db_carne) # Refresh novamente para carregar as parcelas
        return db_carne


def update_carne(db: Session, carne_id: int, carne_update: schemas.CarneCreate):
    db_carne = db.query(models.Carne).filter(models.Carne.id_carne == carne_id).first()
    if not db_carne:
        return None

    has_payments = db.query(models.Pagamento).join(models.Parcela).filter(models.Parcela.id_carne == carne_id).first()

    update_data = carne_update.model_dump(exclude_unset=False)

    new_data_venda = update_data.get('data_venda', db_carne.data_venda)
    new_data_primeiro_vencimento = update_data.get('data_primeiro_vencimento', db_carne.data_primeiro_vencimento)
    if new_data_venda and new_data_primeiro_vencimento < new_data_venda:
         raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A data do primeiro vencimento não pode ser anterior à data da venda.")

    # Detectar mudança no tipo de carnê (fixo/flexível) ou em campos financeiros que exigem regeneração
    regenerate_parcels_flag = False
    financial_keys_for_parcel_regeneration = [
        'valor_total_original', 'numero_parcelas',
        'valor_parcela_sugerido', # Campo relevante para carnê fixo
        'data_primeiro_vencimento',
        'frequencia_pagamento', 'valor_entrada',
        'parcela_fixa' # NOVO: Mudança no tipo de carnê exige regeneração
    ]

    if has_payments:
        # Se tem pagamentos, só permite alterar descricao, status_carne, observacoes, data_venda
        allowed_keys_with_payments = ['descricao', 'status_carne', 'observacoes', 'data_venda']
        for key_to_update in list(update_data.keys()):
            if key_to_update not in allowed_keys_with_payments:
                if getattr(db_carne, key_to_update) != update_data[key_to_update]:
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                        detail=f"Não é possível alterar o campo '{key_to_update}' de um carnê que já possui pagamentos.")
    else: # Não tem pagamentos, pode regenerar parcelas
        for key in financial_keys_for_parcel_regeneration:
            if key in update_data:
                current_val = getattr(db_carne, key)
                new_val = update_data.get(key)

                # Tratamento para comparação de Decimals
                if key in ['valor_total_original', 'valor_parcela_sugerido', 'valor_entrada']:
                    current_val = Decimal(str(current_val)) if current_val is not None else None # manter str para Decimal para compatibilidade
                    new_val = Decimal(str(new_val)) if new_val is not None else None # manter str para Decimal para compatibilidade
                # Para booleanos, comparar diretamente
                elif key == 'parcela_fixa':
                    if current_val != new_val: # A mudança no tipo de parcela sempre dispara regeneração
                        regenerate_parcels_flag = True
                        break
                # Para outros tipos, comparação padrão
                if current_val != new_val:
                    regenerate_parcels_flag = True
                    break

    # Aplicar as atualizações aos campos do objeto db_carne
    for key, value in update_data.items():
        if key == 'valor_parcela_original': # Este campo é calculado, não setado diretamente
            continue
        if key in ['valor_total_original', 'valor_entrada'] and value is not None:
            setattr(db_carne, key, value) # Alterado: Pydantic já validou para Decimal
        elif key == 'valor_parcela_sugerido' and value is not None:
            pass # Não armazena diretamente no db_carne, é usado para cálculo
        else:
            setattr(db_carne, key, value)

    # Lógica de regeneração de parcelas
    if regenerate_parcels_flag and not has_payments:
        # Excluir parcelas existentes
        db.query(models.Parcela).filter(models.Parcela.id_carne == carne_id).delete(synchronize_session='fetch')
        db.flush() # Garante que as deleções sejam processadas antes de adicionar novas

        valor_total_original_decimal = db_carne.valor_total_original # Alterado: Pydantic já validou para Decimal
        valor_entrada_decimal = db_carne.valor_entrada # Alterado: Pydantic já validou para Decimal
        valor_a_parcelar = valor_total_original_decimal - valor_entrada_decimal

        # Se o carnê se torna não fixo
        if not db_carne.parcela_fixa:
            db_carne.numero_parcelas = 1
            db_carne.valor_parcela_original = valor_a_parcelar.quantize(Decimal('0.01'))
            db_carne.frequencia_pagamento = "única" # Ou "variável"

            db_parcela_nova = models.Parcela(
                id_carne=db_carne.id_carne,
                numero_parcela=1,
                valor_devido=valor_a_parcelar,
                data_vencimento=db_carne.data_primeiro_vencimento,
                valor_pago=Decimal('0.00'),
                saldo_devedor=valor_a_parcelar,
                status_parcela='Pendente',
                juros_multa=Decimal('0.00'),
                juros_multa_anterior_aplicada=Decimal('0.00'),
                observacoes=None
            )
            db.add(db_parcela_nova)
        else: # Se o carnê é fixo (ou mudou para fixo)
            if db_carne.numero_parcelas <= 0:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Para carnês com parcela fixa, o número de parcelas deve ser maior que zero.")
            if valor_a_parcelar <= Decimal('0.00') and db_carne.numero_parcelas > 0:
                 pass # A validação já é feita no frontend ou no esquema

            valor_parcela_sugerido_decimal = carne_update.valor_parcela_sugerido if carne_update.valor_parcela_sugerido is not None else Decimal('0.00') # Alterado para usar o Decimal do update_data
            if valor_parcela_sugerido_decimal == Decimal('0.00'): # Default se não sugerido
                if valor_a_parcelar > Decimal('0.00'):
                    valor_parcela_original_calculado = (valor_a_parcelar / db_carne.numero_parcelas).quantize(Decimal('0.01'))
                else:
                    valor_parcela_original_calculado = Decimal('0.00')
            else:
                valor_parcela_original_calculado = valor_parcela_sugerido_decimal


            db_carne.valor_parcela_original = valor_parcela_original_calculado # ATUALIZA O VALOR NO OBJETO DO CARNÊ

            current_due_date = db_carne.data_primeiro_vencimento
            for i in range(db_carne.numero_parcelas):
                parcela_valor_devido = valor_parcela_original_calculado
                if i == db_carne.numero_parcelas - 1:
                    soma_parcelas_anteriores = valor_parcela_original_calculado * i
                    parcela_valor_devido = valor_a_parcelar - soma_parcelas_anteriores
                    parcela_valor_devido = parcela_valor_devido.quantize(Decimal('0.01'))

                if parcela_valor_devido < Decimal('0.00'):
                    parcela_valor_devido = Decimal('0.00')

                db_parcela = models.Parcela(
                    id_carne=db_carne.id_carne,
                    numero_parcela=i + 1,
                    valor_devido=parcela_valor_devido,
                    data_vencimento=current_due_date,
                    valor_pago=Decimal('0.00'),
                    saldo_devedor=parcela_valor_devido,
                    status_parcela='Pendente',
                    juros_multa=Decimal('0.00'),
                    juros_multa_anterior_aplicada=Decimal('0.00'),
                    observacoes=None
                )
                db.add(db_parcela)
                current_due_date = calculate_next_due_date(current_due_date, db_carne.frequencia_pagamento)

            db.commit()
            db.refresh(db_carne) # Refresh novamente para carregar as parcelas
        return db_carne


def update_carne(db: Session, carne_id: int, carne_update: schemas.CarneCreate):
    db_carne = db.query(models.Carne).filter(models.Carne.id_carne == carne_id).first()
    if not db_carne:
        return None

    has_payments = db.query(models.Pagamento).join(models.Parcela).filter(models.Parcela.id_carne == carne_id).first()

    update_data = carne_update.model_dump(exclude_unset=False)

    new_data_venda = update_data.get('data_venda', db_carne.data_venda)
    new_data_primeiro_vencimento = update_data.get('data_primeiro_vencimento', db_carne.data_primeiro_vencimento)
    if new_data_venda and new_data_primeiro_vencimento < new_data_venda:
         raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A data do primeiro vencimento não pode ser anterior à data da venda.")

    # Detectar mudança no tipo de carnê (fixo/flexível) ou em campos financeiros que exigem regeneração
    regenerate_parcels_flag = False
    financial_keys_for_parcel_regeneration = [
        'valor_total_original', 'numero_parcelas',
        'valor_parcela_sugerido', # Campo relevante para carnê fixo
        'data_primeiro_vencimento',
        'frequencia_pagamento', 'valor_entrada',
        'parcela_fixa' # NOVO: Mudança no tipo de carnê exige regeneração
    ]

    if has_payments:
        # Se tem pagamentos, só permite alterar descricao, status_carne, observacoes, data_venda
        allowed_keys_with_payments = ['descricao', 'status_carne', 'observacoes', 'data_venda']
        for key_to_update in list(update_data.keys()):
            if key_to_update not in allowed_keys_with_payments:
                if getattr(db_carne, key_to_update) != update_data[key_to_update]:
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                        detail=f"Não é possível alterar o campo '{key_to_update}' de um carnê que já possui pagamentos.")
    else: # Não tem pagamentos, pode regenerar parcelas
        for key in financial_keys_for_parcel_regeneration:
            if key in update_data:
                current_val = getattr(db_carne, key)
                new_val = update_data.get(key)

                # Tratamento para comparação de Decimals
                if key in ['valor_total_original', 'valor_parcela_sugerido', 'valor_entrada']:
                    current_val = Decimal(str(current_val)) if current_val is not None else None # manter str para Decimal para compatibilidade
                    new_val = Decimal(str(new_val)) if new_val is not None else None # manter str para Decimal para compatibilidade
                # Para booleanos, comparar diretamente
                elif key == 'parcela_fixa':
                    if current_val != new_val: # A mudança no tipo de parcela sempre dispara regeneração
                        regenerate_parcels_flag = True
                        break
                # Para outros tipos, comparação padrão
                if current_val != new_val:
                    regenerate_parcels_flag = True
                    break

    # Aplicar as atualizações aos campos do objeto db_carne
    for key, value in update_data.items():
        if key == 'valor_parcela_original': # Este campo é calculado, não setado diretamente
            continue
        if key in ['valor_total_original', 'valor_entrada'] and value is not None:
            setattr(db_carne, key, value) # Alterado: Pydantic já validou para Decimal
        elif key == 'valor_parcela_sugerido' and value is not None:
            pass # Não armazena diretamente no db_carne, é usado para cálculo
        else:
            setattr(db_carne, key, value)

    # Lógica de regeneração de parcelas
    if regenerate_parcels_flag and not has_payments:
        # Excluir parcelas existentes
        db.query(models.Parcela).filter(models.Parcela.id_carne == carne_id).delete(synchronize_session='fetch')
        db.flush() # Garante que as deleções sejam processadas antes de adicionar novas

        valor_total_original_decimal = db_carne.valor_total_original # Alterado: Pydantic já validou para Decimal
        valor_entrada_decimal = db_carne.valor_entrada # Alterado: Pydantic já validou para Decimal
        valor_a_parcelar = valor_total_original_decimal - valor_entrada_decimal

        # Se o carnê se torna não fixo
        if not db_carne.parcela_fixa:
            db_carne.numero_parcelas = 1
            db_carne.valor_parcela_original = valor_a_parcelar.quantize(Decimal('0.01'))
            db_carne.frequencia_pagamento = "única" # Ou "variável"

            db_parcela_nova = models.Parcela(
                id_carne=db_carne.id_carne,
                numero_parcela=1,
                valor_devido=valor_a_parcelar,
                data_vencimento=db_carne.data_primeiro_vencimento,
                valor_pago=Decimal('0.00'),
                saldo_devedor=valor_a_parcelar,
                status_parcela='Pendente',
                juros_multa=Decimal('0.00'),
                juros_multa_anterior_aplicada=Decimal('0.00'),
                observacoes=None
            )
            db.add(db_parcela_nova)
        else: # Se o carnê é fixo (ou mudou para fixo)
            if db_carne.numero_parcelas <= 0:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Para carnês com parcela fixa, o número de parcelas deve ser maior que zero.")
            if valor_a_parcelar <= Decimal('0.00') and db_carne.numero_parcelas > 0:
                 pass # A validação já é feita no frontend ou no esquema

            valor_parcela_sugerido_decimal = carne_update.valor_parcela_sugerido if carne_update.valor_parcela_sugerido is not None else Decimal('0.00') # Alterado para usar o Decimal do update_data
            if valor_parcela_sugerido_decimal == Decimal('0.00'): # Default se não sugerido
                if valor_a_parcelar > Decimal('0.00'):
                    valor_parcela_original_calculado = (valor_a_parcelar / db_carne.numero_parcelas).quantize(Decimal('0.01'))
                else:
                    valor_parcela_original_calculado = Decimal('0.00')
            else:
                valor_parcela_original_calculado = valor_parcela_sugerido_decimal


            db_carne.valor_parcela_original = valor_parcela_original_calculado # ATUALIZA O VALOR NO OBJETO DO CARNÊ

            current_due_date = db_carne.data_primeiro_vencimento
            for i in range(db_carne.numero_parcelas):
                parcela_valor_devido = valor_parcela_original_calculado
                if i == db_carne.numero_parcelas - 1:
                    soma_parcelas_anteriores = valor_parcela_original_calculado * i
                    parcela_valor_devido = valor_a_parcelar - soma_parcelas_anteriores
                    parcela_valor_devido = parcela_valor_devido.quantize(Decimal('0.01'))

                if parcela_valor_devido < Decimal('0.00'):
                    parcela_valor_devido = Decimal('0.00')

                db_parcela = models.Parcela(
                    id_carne=db_carne.id_carne,
                    numero_parcela=i + 1,
                    valor_devido=parcela_valor_devido,
                    data_vencimento=current_due_date,
                    valor_pago=Decimal('0.00'),
                    saldo_devedor=parcela_valor_devido,
                    status_parcela='Pendente',
                    juros_multa=Decimal('0.00'),
                    juros_multa_anterior_aplicada=Decimal('0.00'),
                    observacoes=None
                )
                db.add(db_parcela)
                current_due_date = calculate_next_due_date(current_due_date, db_carne.frequencia_pagamento)

            db.commit()
            db.refresh(db_carne) # Refresh novamente para carregar as parcelas
        return db_carne


def update_carne(db: Session, carne_id: int, carne_update: schemas.CarneCreate):
    db_carne = db.query(models.Carne).filter(models.Carne.id_carne == carne_id).first()
    if not db_carne:
        return None

    has_payments = db.query(models.Pagamento).join(models.Parcela).filter(models.Parcela.id_carne == carne_id).first()

    update_data = carne_update.model_dump(exclude_unset=False)

    new_data_venda = update_data.get('data_venda', db_carne.data_venda)
    new_data_primeiro_vencimento = update_data.get('data_primeiro_vencimento', db_carne.data_primeiro_vencimento)
    if new_data_venda and new_data_primeiro_vencimento < new_data_venda:
         raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A data do primeiro vencimento não pode ser anterior à data da venda.")

    # Detectar mudança no tipo de carnê (fixo/flexível) ou em campos financeiros que exigem regeneração
    regenerate_parcels_flag = False
    financial_keys_for_parcel_regeneration = [
        'valor_total_original', 'numero_parcelas',
        'valor_parcela_sugerido', # Campo relevante para carnê fixo
        'data_primeiro_vencimento',
        'frequencia_pagamento', 'valor_entrada',
        'parcela_fixa' # NOVO: Mudança no tipo de carnê exige regeneração
    ]

    if has_payments:
        # Se tem pagamentos, só permite alterar descricao, status_carne, observacoes, data_venda
        allowed_keys_with_payments = ['descricao', 'status_carne', 'observacoes', 'data_venda']
        for key_to_update in list(update_data.keys()):
            if key_to_update not in allowed_keys_with_payments:
                if getattr(db_carne, key_to_update) != update_data[key_to_update]:
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                        detail=f"Não é possível alterar o campo '{key_to_update}' de um carnê que já possui pagamentos.")
    else: # Não tem pagamentos, pode regenerar parcelas
        for key in financial_keys_for_parcel_regeneration:
            if key in update_data:
                current_val = getattr(db_carne, key)
                new_val = update_data.get(key)

                # Tratamento para comparação de Decimals
                if key in ['valor_total_original', 'valor_parcela_sugerido', 'valor_entrada']:
                    current_val = Decimal(str(current_val)) if current_val is not None else None # manter str para Decimal para compatibilidade
                    new_val = Decimal(str(new_val)) if new_val is not None else None # manter str para Decimal para compatibilidade
                # Para booleanos, comparar directamente
                elif key == 'parcela_fixa':
                    if current_val != new_val: # A mudança no tipo de parcela sempre dispara regeneração
                        regenerate_parcels_flag = True
                        break
                # Para outros tipos, comparação padrão
                if current_val != new_val:
                    regenerate_parcels_flag = True
                    break

    # Aplicar as atualizações aos campos do objeto db_carne
    for key, value in update_data.items():
        if key == 'valor_parcela_original': # Este campo é calculado, não setado directamente
            continue
        if key in ['valor_total_original', 'valor_entrada'] and value is not None:
            setattr(db_carne, key, value) # Alterado: Pydantic já validou para Decimal
        elif key == 'valor_parcela_sugerido' and value is not None:
            pass # Não armazena directamente no db_carne, é usado para cálculo
        else:
            setattr(db_carne, key, value)

    # Lógica de regeneração de parcelas
    if regenerate_parcels_flag and not has_payments:
        # Excluir parcelas existentes
        db.query(models.Parcela).filter(models.Parcela.id_carne == carne_id).delete(synchronize_session='fetch')
        db.flush() # Garante que as deleções sejam processadas antes de adicionar novas

        valor_total_original_decimal = db_carne.valor_total_original # Alterado: Pydantic já validou para Decimal
        valor_entrada_decimal = db_carne.valor_entrada # Alterado: Pydantic já validou para Decimal
        valor_a_parcelar = valor_total_original_decimal - valor_entrada_decimal

        # Se o carnê se torna não fixo
        if not db_carne.parcela_fixa:
            db_carne.numero_parcelas = 1
            db_carne.valor_parcela_original = valor_a_parcelar.quantize(Decimal('0.01'))
            db_carne.frequencia_pagamento = "única" # Ou "variável"

            db_parcela_nova = models.Parcela(
                id_carne=db_carne.id_carne,
                numero_parcela=1,
                valor_devido=valor_a_parcelar,
                data_vencimento=db_carne.data_primeiro_vencimento,
                valor_pago=Decimal('0.00'),
                saldo_devedor=valor_a_parcelar,
                status_parcela='Pendente',
                juros_multa=Decimal('0.00'),
                juros_multa_anterior_aplicada=Decimal('0.00'),
                observacoes=None
            )
            db.add(db_parcela_nova)
        else: # Se o carnê é fixo (ou mudou para fixo)
            if db_carne.numero_parcelas <= 0:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Para carnês com parcela fixa, o número de parcelas deve ser maior que zero.")
            if valor_a_parcelar <= Decimal('0.00') and db_carne.numero_parcelas > 0:
                 pass # A validação já é feita no frontend ou no esquema

            valor_parcela_sugerido_decimal = carne_update.valor_parcela_sugerido if carne_update.valor_parcela_sugerido is not None else Decimal('0.00') # Alterado para usar o Decimal do update_data
            if valor_parcela_sugerido_decimal == Decimal('0.00'): # Default se não sugerido
                if valor_a_parcelar > Decimal('0.00'):
                    valor_parcela_original_calculado = (valor_a_parcelar / db_carne.numero_parcelas).quantize(Decimal('0.01'))
                else:
                    valor_parcela_original_calculado = Decimal('0.00')
            else:
                valor_parcela_original_calculado = valor_parcela_sugerido_decimal


            db_carne.valor_parcela_original = valor_parcela_original_calculado # ATUALIZA O VALOR NO OBJETO DO CARNÊ

            current_due_date = db_carne.data_primeiro_vencimento
            for i in range(db_carne.numero_parcelas):
                parcela_valor_devido = valor_parcela_original_calculado
                if i == db_carne.numero_parcelas - 1:
                    soma_parcelas_anteriores = valor_parcela_original_calculado * i
                    parcela_valor_devido = valor_a_parcelar - soma_parcelas_anteriores
                    parcela_valor_devido = parcela_valor_devido.quantize(Decimal('0.01'))

                if parcela_valor_devido < Decimal('0.00'):
                    parcela_valor_devido = Decimal('0.00')

                db_parcela = models.Parcela(
                    id_carne=db_carne.id_carne,
                    numero_parcela=i + 1,
                    valor_devido=parcela_valor_devido,
                    data_vencimento=current_due_date,
                    valor_pago=Decimal('0.00'),
                    saldo_devedor=parcela_valor_devido,
                    status_parcela='Pendente',
                    juros_multa=Decimal('0.00'),
                    juros_multa_anterior_aplicada=Decimal('0.00'),
                    observacoes=None
                )
                db.add(db_parcela)
                current_due_date = calculate_next_due_date(current_due_date, db_carne.frequencia_pagamento)

            db.commit()
            db.refresh(db_carne) # Refresh novamente para carregar as parcelas
        return db_carne


def update_carne(db: Session, carne_id: int, carne_update: schemas.CarneCreate):
    db_carne = db.query(models.Carne).filter(models.Carne.id_carne == carne_id).first()
    if not db_carne:
        return None

    has_payments = db.query(models.Pagamento).join(models.Parcela).filter(models.Parcela.id_carne == carne_id).first()

    update_data = carne_update.model_dump(exclude_unset=False)

    new_data_venda = update_data.get('data_venda', db_carne.data_venda)
    new_data_primeiro_vencimento = update_data.get('data_primeiro_vencimento', db_carne.data_primeiro_vencimento)
    if new_data_venda and new_data_primeiro_vencimento < new_data_venda:
         raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A data do primeiro vencimento não pode ser anterior à data da venda.")

    # Detectar mudança no tipo de carnê (fixo/flexível) ou em campos financeiros que exigem regeneração
    regenerate_parcels_flag = False
    financial_keys_for_parcel_regeneration = [
        'valor_total_original', 'numero_parcelas',
        'valor_parcela_sugerido', # Campo relevante para carnê fixo
        'data_primeiro_vencimento',
        'frequencia_pagamento', 'valor_entrada',
        'parcela_fixa' # NOVO: Mudança no tipo de carnê exige regeneração
    ]

    if has_payments:
        # Se tem pagamentos, só permite alterar descricao, status_carne, observacoes, data_venda
        allowed_keys_with_payments = ['descricao', 'status_carne', 'observacoes', 'data_venda']
        for key_to_update in list(update_data.keys()):
            if key_to_update not in allowed_keys_with_payments:
                if getattr(db_carne, key_to_update) != update_data[key_to_update]:
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                        detail=f"Não é possível alterar o campo '{key_to_update}' de um carnê que já possui pagamentos.")
    else: # Não tem pagamentos, pode regenerar parcelas
        for key in financial_keys_for_parcel_regeneration:
            if key in update_data:
                current_val = getattr(db_carne, key)
                new_val = update_data.get(key)

                # Tratamento para comparação de Decimals
                if key in ['valor_total_original', 'valor_parcela_sugerido', 'valor_entrada']:
                    current_val = Decimal(str(current_val)) if current_val is not None else None # manter str para Decimal para compatibilidade
                    new_val = Decimal(str(new_val)) if new_val is not None else None # manter str para Decimal para compatibilidade
                # Para booleanos, comparar diretamente
                elif key == 'parcela_fixa':
                    if current_val != new_val: # A mudança no tipo de parcela sempre dispara regeneração
                        regenerate_parcels_flag = True
                        break
                # Para outros tipos, comparação padrão
                if current_val != new_val:
                    regenerate_parcels_flag = True
                    break

    # Aplicar as atualizações aos campos do objeto db_carne
    for key, value in update_data.items():
        if key == 'valor_parcela_original': # Este campo é calculado, não setado diretamente
            continue
        if key in ['valor_total_original', 'valor_entrada'] and value is not None:
            setattr(db_carne, key, value) # Alterado: Pydantic já validou para Decimal
        elif key == 'valor_parcela_sugerido' and value is not None:
            pass # Não armazena diretamente no db_carne, é usado para cálculo
        else:
            setattr(db_carne, key, value)

    # Lógica de regeneração de parcelas
    if regenerate_parcels_flag and not has_payments:
        # Excluir parcelas existentes
        db.query(models.Parcela).filter(models.Parcela.id_carne == carne_id).delete(synchronize_session='fetch')
        db.flush() # Garante que as deleções sejam processadas antes de adicionar novas

        valor_total_original_decimal = db_carne.valor_total_original # Alterado: Pydantic já validou para Decimal
        valor_entrada_decimal = db_carne.valor_entrada # Alterado: Pydantic já validou para Decimal
        valor_a_parcelar = valor_total_original_decimal - valor_entrada_decimal

        # Se o carnê se torna não fixo
        if not db_carne.parcela_fixa:
            db_carne.numero_parcelas = 1
            db_carne.valor_parcela_original = valor_a_parcelar.quantize(Decimal('0.01'))
            db_carne.frequencia_pagamento = "única" # Ou "variável"

            db_parcela_nova = models.Parcela(
                id_carne=db_carne.id_carne,
                numero_parcela=1,
                valor_devido=valor_a_parcelar,
                data_vencimento=db_carne.data_primeiro_vencimento,
                valor_pago=Decimal('0.00'),
                saldo_devedor=valor_a_parcelar,
                status_parcela='Pendente',
                juros_multa=Decimal('0.00'),
                juros_multa_anterior_aplicada=Decimal('0.00'),
                observacoes=None
            )
            db.add(db_parcela_nova)
        else: # Se o carnê é fixo (ou mudou para fixo)
            if db_carne.numero_parcelas <= 0:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Para carnês com parcela fixa, o número de parcelas deve ser maior que zero.")
            if valor_a_parcelar <= Decimal('0.00') and db_carne.numero_parcelas > 0:
                 pass # A validação já é feita no frontend ou no esquema

            valor_parcela_sugerido_decimal = carne_update.valor_parcela_sugerido if carne_update.valor_parcela_sugerido is not None else Decimal('0.00') # Alterado para usar o Decimal do update_data
            if valor_parcela_sugerido_decimal == Decimal('0.00'): # Default se não sugerido
                if valor_a_parcelar > Decimal('0.00'):
                    valor_parcela_original_calculado = (valor_a_parcelar / db_carne.numero_parcelas).quantize(Decimal('0.01'))
                else:
                    valor_parcela_original_calculado = Decimal('0.00')
            else:
                valor_parcela_original_calculado = valor_parcela_sugerido_decimal


            db_carne.valor_parcela_original = valor_parcela_original_calculado # ATUALIZA O VALOR NO OBJETO DO CARNÊ

            current_due_date = db_carne.data_primeiro_vencimento
            for i in range(db_carne.numero_parcelas):
                parcela_valor_devido = valor_parcela_original_calculado
                if i == db_carne.numero_parcelas - 1:
                    soma_parcelas_anteriores = valor_parcela_original_calculado * i
                    parcela_valor_devido = valor_a_parcelar - soma_parcelas_anteriores
                    parcela_valor_devido = parcela_valor_devido.quantize(Decimal('0.01'))

                if parcela_valor_devido < Decimal('0.00'):
                    parcela_valor_devido = Decimal('0.00')

                db_parcela = models.Parcela(
                    id_carne=db_carne.id_carne,
                    numero_parcela=i + 1,
                    valor_devido=parcela_valor_devido,
                    data_vencimento=current_due_date,
                    valor_pago=Decimal('0.00'),
                    saldo_devedor=parcela_valor_devido,
                    status_parcela='Pendente',
                    juros_multa=Decimal('0.00'),
                    juros_multa_anterior_aplicada=Decimal('0.00'),
                    observacoes=None
                )
                db.add(db_parcela)
                current_due_date = calculate_next_due_date(current_due_date, db_carne.frequencia_pagamento)

            db.commit()
            db.refresh(db_carne) # Refresh novamente para carregar as parcelas
        return db_carne


def update_carne(db: Session, carne_id: int, carne_update: schemas.CarneCreate):
    db_carne = db.query(models.Carne).filter(models.Carne.id_carne == carne_id).first()
    if not db_carne:
        return None

    has_payments = db.query(models.Pagamento).join(models.Parcela).filter(models.Parcela.id_carne == carne_id).first()

    update_data = carne_update.model_dump(exclude_unset=False)

    new_data_venda = update_data.get('data_venda', db_carne.data_venda)
    new_data_primeiro_vencimento = update_data.get('data_primeiro_vencimento', db_carne.data_primeiro_vencimento)
    if new_data_venda and new_data_primeiro_vencimento < new_data_venda:
         raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A data do primeiro vencimento não pode ser anterior à data da venda.")

    # Detectar mudança no tipo de carnê (fixo/flexível) ou em campos financeiros que exigem regeneração
    regenerate_parcels_flag = False
    financial_keys_for_parcel_regeneration = [
        'valor_total_original', 'numero_parcelas',
        'valor_parcela_sugerido', # Campo relevante para carnê fixo
        'data_primeiro_vencimento',
        'frequencia_pagamento', 'valor_entrada',
        'parcela_fixa' # NOVO: Mudança no tipo de carnê exige regeneração
    ]

    if has_payments:
        # Se tem pagamentos, só permite alterar descricao, status_carne, observacoes, data_venda
        allowed_keys_with_payments = ['descricao', 'status_carne', 'observacoes', 'data_venda']
        for key_to_update in list(update_data.keys()):
            if key_to_update not in allowed_keys_with_payments:
                if getattr(db_carne, key_to_update) != update_data[key_to_update]:
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                        detail=f"Não é possível alterar o campo '{key_to_update}' de um carnê que já possui pagamentos.")
    else: # Não tem pagamentos, pode regenerar parcelas
        for key in financial_keys_for_parcel_regeneration:
            if key in update_data:
                current_val = getattr(db_carne, key)
                new_val = update_data.get(key)

                # Tratamento para comparação de Decimals
                if key in ['valor_total_original', 'valor_parcela_sugerido', 'valor_entrada']:
                    current_val = Decimal(str(current_val)) if current_val is not None else None # manter str para Decimal para compatibilidade
                    new_val = Decimal(str(new_val)) if new_val is not None else None # manter str para Decimal para compatibilidade
                # Para booleanos, comparar diretamente
                elif key == 'parcela_fixa':
                    if current_val != new_val: # A mudança no tipo de parcela sempre dispara regeneração
                        regenerate_parcels_flag = True
                        break
                # Para outros tipos, comparação padrão
                if current_val != new_val:
                    regenerate_parcels_flag = True
                    break

    # Aplicar as atualizações aos campos do objeto db_carne
    for key, value in update_data.items():
        if key == 'valor_parcela_original': # Este campo é calculado, não setado diretamente
            continue
        if key in ['valor_total_original', 'valor_entrada'] and value is not None:
            setattr(db_carne, key, value) # Alterado: Pydantic já validou para Decimal
        elif key == 'valor_parcela_sugerido' and value is not None:
            pass # Não armazena diretamente no db_carne, é usado para cálculo
        else:
            setattr(db_carne, key, value)

    # Lógica de regeneração de parcelas
    if regenerate_parcels_flag and not has_payments:
        # Excluir parcelas existentes
        db.query(models.Parcela).filter(models.Parcela.id_carne == carne_id).delete(synchronize_session='fetch')
        db.flush() # Garante que as deleções sejam processadas antes de adicionar novas

        valor_total_original_decimal = db_carne.valor_total_original # Alterado: Pydantic já validou para Decimal
        valor_entrada_decimal = db_carne.valor_entrada # Alterado: Pydantic já validou para Decimal
        valor_a_parcelar = valor_total_original_decimal - valor_entrada_decimal

        # Se o carnê se torna não fixo
        if not db_carne.parcela_fixa:
            db_carne.numero_parcelas = 1
            db_carne.valor_parcela_original = valor_a_parcelar.quantize(Decimal('0.01'))
            db_carne.frequencia_pagamento = "única" # Ou "variável"

            db_parcela_nova = models.Parcela(
                id_carne=db_carne.id_carne,
                numero_parcela=1,
                valor_devido=valor_a_parcelar,
                data_vencimento=db_carne.data_primeiro_vencimento,
                valor_pago=Decimal('0.00'),
                saldo_devedor=valor_a_parcelar,
                status_parcela='Pendente',
                juros_multa=Decimal('0.00'),
                juros_multa_anterior_aplicada=Decimal('0.00'),
                observacoes=None
            )
            db.add(db_parcela_nova)
        else: # Se o carnê é fixo (ou mudou para fixo)
            if db_carne.numero_parcelas <= 0:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Para carnês com parcela fixa, o número de parcelas deve ser maior que zero.")
            if valor_a_parcelar <= Decimal('0.00') and db_carne.numero_parcelas > 0:
                 pass # A validação já é feita no frontend ou no esquema

            valor_parcela_sugerido_decimal = carne_update.valor_parcela_sugerido if carne_update.valor_parcela_sugerido is not None else Decimal('0.00') # Alterado para usar o Decimal do update_data
            if valor_parcela_sugerido_decimal == Decimal('0.00'): # Default se não sugerido
                if valor_a_parcelar > Decimal('0.00'):
                    valor_parcela_original_calculado = (valor_a_parcelar / db_carne.numero_parcelas).quantize(Decimal('0.01'))
                else:
                    valor_parcela_original_calculado = Decimal('0.00')
            else:
                valor_parcela_original_calculado = valor_parcela_sugerido_decimal


            db_carne.valor_parcela_original = valor_parcela_original_calculado # ATUALIZA O VALOR NO OBJETO DO CARNÊ

            current_due_date = db_carne.data_primeiro_vencimento
            for i in range(db_carne.numero_parcelas):
                parcela_valor_devido = valor_parcela_original_calculado
                if i == db_carne.numero_parcelas - 1:
                    soma_parcelas_anteriores = valor_parcela_original_calculado * i
                    parcela_valor_devido = valor_a_parcelar - soma_parcelas_anteriores
                    parcela_valor_devido = parcela_valor_devido.quantize(Decimal('0.01'))

                if parcela_valor_devido < Decimal('0.00'):
                    parcela_valor_devido = Decimal('0.00')

                db_parcela = models.Parcela(
                    id_carne=db_carne.id_carne,
                    numero_parcela=i + 1,
                    valor_devido=parcela_valor_devido,
                    data_vencimento=current_due_date,
                    valor_pago=Decimal('0.00'),
                    saldo_devedor=parcela_valor_devido,
                    status_parcela='Pendente',
                    juros_multa=Decimal('0.00'),
                    juros_multa_anterior_aplicada=Decimal('0.00'),
                    observacoes=None
                )
                db.add(db_parcela)
                current_due_date = calculate_next_due_date(current_due_date, db_carne.frequencia_pagamento)

            db.commit()
            db.refresh(db_carne) # Refresh novamente para carregar as parcelas
        return db_carne


def update_carne(db: Session, carne_id: int, carne_update: schemas.CarneCreate):
    db_carne = db.query(models.Carne).filter(models.Carne.id_carne == carne_id).first()
    if not db_carne:
        return None

    has_payments = db.query(models.Pagamento).join(models.Parcela).filter(models.Parcela.id_carne == carne_id).first()

    update_data = carne_update.model_dump(exclude_unset=False)

    new_data_venda = update_data.get('data_venda', db_carne.data_venda)
    new_data_primeiro_vencimento = update_data.get('data_primeiro_vencimento', db_carne.data_primeiro_vencimento)
    if new_data_venda and new_data_primeiro_vencimento < new_data_venda:
         raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A data do primeiro vencimento não pode ser anterior à data da venda.")

    # Detectar mudança no tipo de carnê (fixo/flexível) ou em campos financeiros que exigem regeneração
    regenerate_parcels_flag = False
    financial_keys_for_parcel_regeneration = [
        'valor_total_original', 'numero_parcelas',
        'valor_parcela_sugerido', # Campo relevante para carnê fixo
        'data_primeiro_vencimento',
        'frequencia_pagamento', 'valor_entrada',
        'parcela_fixa' # NOVO: Mudança no tipo de carnê exige regeneração
    ]

    if has_payments:
        # Se tem pagamentos, só permite alterar descricao, status_carne, observacoes, data_venda
        allowed_keys_with_payments = ['descricao', 'status_carne', 'observacoes', 'data_venda']
        for key_to_update in list(update_data.keys()):
            if key_to_update not in allowed_keys_with_payments:
                if getattr(db_carne, key_to_update) != update_data[key_to_update]:
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                        detail=f"Não é possível alterar o campo '{key_to_update}' de um carnê que já possui pagamentos.")
    else: # Não tem pagamentos, pode regenerar parcelas
        for key in financial_keys_for_parcel_regeneration:
            if key in update_data:
                current_val = getattr(db_carne, key)
                new_val = update_data.get(key)

                # Tratamento para comparação de Decimals
                if key in ['valor_total_original', 'valor_parcela_sugerido', 'valor_entrada']:
                    current_val = Decimal(str(current_val)) if current_val is not None else None # manter str para Decimal para compatibilidade
                    new_val = Decimal(str(new_val)) if new_val is not None else None # manter str para Decimal para compatibilidade
                # Para booleanos, comparar directamente
                elif key == 'parcela_fixa':
                    if current_val != new_val: # A mudança no tipo de parcela sempre dispara regeneração
                        regenerate_parcels_flag = True
                        break
                # Para outros tipos, comparação padrão
                if current_val != new_val:
                    regenerate_parcels_flag = True
                    break

    # Aplicar as atualizações aos campos do objeto db_carne
    for key, value in update_data.items():
        if key == 'valor_parcela_original': # Este campo é calculado, não setado directamente
            continue
        if key in ['valor_total_original', 'valor_entrada'] and value is not None:
            setattr(db_carne, key, value) # Alterado: Pydantic já validou para Decimal
        elif key == 'valor_parcela_sugerido' and value is not None:
            pass # Não armazena directamente no db_carne, é usado para cálculo
        else:
            setattr(db_carne, key, value)

    # Lógica de regeneração de parcelas
    if regenerate_parcels_flag and not has_payments:
        # Excluir parcelas existentes
        db.query(models.Parcela).filter(models.Parcela.id_carne == carne_id).delete(synchronize_session='fetch')
        db.flush() # Garante que as deleções sejam processadas antes de adicionar novas

        valor_total_original_decimal = db_carne.valor_total_original # Alterado: Pydantic já validou para Decimal
        valor_entrada_decimal = db_carne.valor_entrada # Alterado: Pydantic já validou para Decimal
        valor_a_parcelar = valor_total_original_decimal - valor_entrada_decimal

        # Se o carnê se torna não fixo
        if not db_carne.parcela_fixa:
            db_carne.numero_parcelas = 1
            db_carne.valor_parcela_original = valor_a_parcelar.quantize(Decimal('0.01'))
            db_carne.frequencia_pagamento = "única" # Ou "variável"

            db_parcela_nova = models.Parcela(
                id_carne=db_carne.id_carne,
                numero_parcela=1,
                valor_devido=valor_a_parcelar,
                data_vencimento=db_carne.data_primeiro_vencimento,
                valor_pago=Decimal('0.00'),
                saldo_devedor=valor_a_parcelar,
                status_parcela='Pendente',
                juros_multa=Decimal('0.00'),
                juros_multa_anterior_aplicada=Decimal('0.00'),
                observacoes=None
            )
            db.add(db_parcela_nova)
        else: # Se o carnê é fixo (ou mudou para fixo)
            if db_carne.numero_parcelas <= 0:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Para carnês com parcela fixa, o número de parcelas deve ser maior que zero.")
            if valor_a_parcelar <= Decimal('0.00') and db_carne.numero_parcelas > 0:
                 pass # A validação já é feita no frontend ou no esquema

            valor_parcela_sugerido_decimal = carne_update.valor_parcela_sugerido if carne_update.valor_parcela_sugerido is not None else Decimal('0.00') # Alterado para usar o Decimal do update_data
            if valor_parcela_sugerido_decimal == Decimal('0.00'): # Default se não sugerido
                if valor_a_parcelar > Decimal('0.00'):
                    valor_parcela_original_calculado = (valor_a_parcelar / db_carne.numero_parcelas).quantize(Decimal('0.01'))
                else:
                    valor_parcela_original_calculado = Decimal('0.00')
            else:
                valor_parcela_original_calculado = valor_parcela_sugerido_decimal


            db_carne.valor_parcela_original = valor_parcela_original_calculado # ATUALIZA O VALOR NO OBJETO DO CARNÊ

            current_due_date = db_carne.data_primeiro_vencimento
            for i in range(db_carne.numero_parcelas):
                parcela_valor_devido = valor_parcela_original_calculado
                if i == db_carne.numero_parcelas - 1:
                    soma_parcelas_anteriores = valor_parcela_original_calculado * i
                    parcela_valor_devido = valor_a_parcelar - soma_parcelas_anteriores
                    parcela_valor_devido = parcela_valor_devido.quantize(Decimal('0.01'))

                if parcela_valor_devido < Decimal('0.00'):
                    parcela_valor_devido = Decimal('0.00')

                db_parcela = models.Parcela(
                    id_carne=db_carne.id_carne,
                    numero_parcela=i + 1,
                    valor_devido=parcela_valor_devido,
                    data_vencimento=current_due_date,
                    valor_pago=Decimal('0.00'),
                    saldo_devedor=parcela_valor_devido,
                    status_parcela='Pendente',
                    juros_multa=Decimal('0.00'),
                    juros_multa_anterior_aplicada=Decimal('0.00'),
                    observacoes=None
                )
                db.add(db_parcela)
                current_due_date = calculate_next_due_date(current_due_date, db_carne.frequencia_pagamento)

            db.commit()
            db.refresh(db_carne) # Refresh novamente para carregar as parcelas
        return db_carne


def update_carne(db: Session, carne_id: int, carne_update: schemas.CarneCreate):
    db_carne = db.query(models.Carne).filter(models.Carne.id_carne == carne_id).first()
    if not db_carne:
        return None

    has_payments = db.query(models.Pagamento).join(models.Parcela).filter(models.Parcela.id_carne == carne_id).first()

    update_data = carne_update.model_dump(exclude_unset=False)

    new_data_venda = update_data.get('data_venda', db_carne.data_venda)
    new_data_primeiro_vencimento = update_data.get('data_primeiro_vencimento', db_carne.data_primeiro_vencimento)
    if new_data_venda and new_data_primeiro_vencimento < new_data_venda:
         raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A data do primeiro vencimento não pode ser anterior à data da venda.")

    # Detectar mudança no tipo de carnê (fixo/flexível) ou em campos financeiros que exigem regeneração
    regenerate_parcels_flag = False
    financial_keys_for_parcel_regeneration = [
        'valor_total_original', 'numero_parcelas',
        'valor_parcela_sugerido', # Campo relevante para carnê fixo
        'data_primeiro_vencimento',
        'frequencia_pagamento', 'valor_entrada',
        'parcela_fixa' # NOVO: Mudança no tipo de carnê exige regeneração
    ]

    if has_payments:
        # Se tem pagamentos, só permite alterar descricao, status_carne, observacoes, data_venda
        allowed_keys_with_payments = ['descricao', 'status_carne', 'observacoes', 'data_venda']
        for key_to_update in list(update_data.keys()):
            if key_to_update not in allowed_keys_with_payments:
                if getattr(db_carne, key_to_update) != update_data[key_to_update]:
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                        detail=f"Não é possível alterar o campo '{key_to_update}' de um carnê que já possui pagamentos.")
    else: # Não tem pagamentos, pode regenerar parcelas
        for key in financial_keys_for_parcel_regeneration:
            if key in update_data:
                current_val = getattr(db_carne, key)
                new_val = update_data.get(key)

                # Tratamento para comparação de Decimals
                if key in ['valor_total_original', 'valor_parcela_sugerido', 'valor_entrada']:
                    current_val = Decimal(str(current_val)) if current_val is not None else None # manter str para Decimal para compatibilidade
                    new_val = Decimal(str(new_val)) if new_val is not None else None # manter str para Decimal para compatibilidade
                # Para booleanos, comparar diretamente
                elif key == 'parcela_fixa':
                    if current_val != new_val: # A mudança no tipo de parcela sempre dispara regeneração
                        regenerate_parcels_flag = True
                        break
                # Para outros tipos, comparação padrão
                if current_val != new_val:
                    regenerate_parcels_flag = True
                    break

    # Aplicar as atualizações aos campos do objeto db_carne
    for key, value in update_data.items():
        if key == 'valor_parcela_original': # Este campo é calculado, não setado diretamente
            continue
        if key in ['valor_total_original', 'valor_entrada'] and value is not None:
            setattr(db_carne, key, value) # Alterado: Pydantic já validou para Decimal
        elif key == 'valor_parcela_sugerido' and value is not None:
            pass # Não armazena diretamente no db_carne, é usado para cálculo
        else:
            setattr(db_carne, key, value)

    # Lógica de regeneração de parcelas
    if regenerate_parcels_flag and not has_payments:
        # Excluir parcelas existentes
        db.query(models.Parcela).filter(models.Parcela.id_carne == carne_id).delete(synchronize_session='fetch')
        db.flush()