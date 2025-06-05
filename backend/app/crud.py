from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import IntegrityError
from app import models, schemas # Garanta que models.py e schemas.py já foram atualizados com data_venda
from fastapi import HTTPException, status
from datetime import date, timedelta, datetime # <<< GARANTA QUE datetime ESTÁ IMPORTADO
from decimal import Decimal
from typing import Optional
from app.config import MULTA_ATRASO_PERCENTUAL, JUROS_MORA_PERCENTUAL_AO_MES
from sqlalchemy import func


# --- Funções Auxiliares (RF017/RF018) ---
def _apply_interest_and_fine_if_due(db: Session, parcela: models.Parcela):
    today = date.today()
    if parcela.status_parcela not in ['Paga', 'Paga com Atraso', 'Cancelada'] and parcela.data_vencimento < today:
        dias_atraso = (today - parcela.data_vencimento).days
        valor_base_para_calculo = parcela.valor_devido - (parcela.valor_pago - parcela.juros_multa_anterior_aplicada)
        if valor_base_para_calculo < Decimal('0.00'):
            valor_base_para_calculo = Decimal('0.00')

        multa = (valor_base_para_calculo * Decimal(str(MULTA_ATRASO_PERCENTUAL))) / Decimal('100')
        juros_diario_percentual = Decimal(str(JUROS_MORA_PERCENTUAL_AO_MES)) / Decimal('30') / Decimal('100')
        juros_mora = (valor_base_para_calculo * juros_diario_percentual * Decimal(str(dias_atraso)))
        total_novos_juros_multa = multa + juros_mora
        current_saldo_excluding_old_juros = parcela.valor_devido - parcela.valor_pago # Base para recalcular saldo com novos juros

        parcela.juros_multa = total_novos_juros_multa
        # Saldo devedor é o que falta do principal + novos juros/multas
        parcela.saldo_devedor = (parcela.valor_devido - parcela.valor_pago) + total_novos_juros_multa
        parcela.juros_multa_anterior_aplicada = total_novos_juros_multa

        if parcela.saldo_devedor < Decimal('0.01') and parcela.saldo_devedor > Decimal('-0.01'): # Quitado com juros
            parcela.saldo_devedor = Decimal('0.00')
            # parcela.juros_multa = Decimal('0.00') # Juros/multa aplicados devem ser mantidos para histórico, mas saldo é zero
            # parcela.juros_multa_anterior_aplicada = Decimal('0.00') # Idem
            if parcela.status_parcela != 'Paga com Atraso': # Evita sobrescrever se já foi pago com atraso
                 parcela.status_parcela = 'Paga' # Pode ser 'Paga' ou 'Paga com Atraso' dependendo do pagamento
            # data_pagamento_completo é setada na lógica de pagamento
        elif parcela.data_vencimento < today and parcela.saldo_devedor > Decimal('0.00'):
            parcela.status_parcela = 'Atrasada'
        # Outros status (Parcialmente Paga, Pendente) são mais afetados pela lógica de pagamento
        # mas 'Atrasada' é uma consequência direta da data e saldo aqui.
        
        db.add(parcela)

def calculate_next_due_date(current_date: date, frequency: str) -> date:
    if frequency == "mensal":
        # Para maior precisão, especialmente com meses de tamanhos diferentes,
        # bibliotecas como python-dateutil (relativedelta) são melhores.
        # Por simplicidade, usando timedelta(days=30) como aproximação.
        return current_date + timedelta(days=30) 
    elif frequency == "quinzenal":
        return current_date + timedelta(days=15)
    elif frequency == "trimestral":
        return current_date + timedelta(days=90) # Aproximação
    else:
        raise ValueError(f"Frequência de pagamento inválida: {frequency}")

def calculate_parcela_saldo_devedor(parcela_valor_devido: Decimal, pagos: Decimal, juros: Decimal) -> Decimal:
    return (parcela_valor_devido + juros) - pagos


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
    # Verificar se há carnês associados antes de excluir, se essa for a regra de negócio.
    # if db_client.carnes:
    #     raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cliente possui carnês associados e não pode ser excluído.")
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

    for carne_obj in db_client.carnes: # Renomeado para evitar conflito com models.Carne
        for parcela in carne_obj.parcelas:
            _apply_interest_and_fine_if_due(db, parcela)
        
        # Recalcular status do carnê
        if carne_obj.status_carne != 'Cancelado':
            all_parcels_paid = all(p.status_parcela in ['Paga', 'Paga com Atraso'] for p in carne_obj.parcelas)
            has_overdue_parcel = any(p.status_parcela == 'Atrasada' for p in carne_obj.parcelas)

            if all_parcels_paid and carne_obj.parcelas: # Garante que há parcelas para ser quitado
                carne_obj.status_carne = 'Quitado'
            elif has_overdue_parcel:
                carne_obj.status_carne = 'Em Atraso'
            else: # Pode ser 'Ativo' ou 'Parcialmente Pago' se houver pagamentos parciais mas não tudo atrasado/quitado
                is_partially_paid_carne = any(p.status_parcela == 'Parcialmente Paga' for p in carne_obj.parcelas)
                if is_partially_paid_carne or not carne_obj.parcelas : # Se não tem parcelas, pode ser considerado Ativo
                    carne_obj.status_carne = 'Ativo'
                # Se todas pendentes e não atrasadas, mantém 'Ativo'
        
        db.add(carne_obj)
    db.commit() # Commit todas as alterações de parcelas e status de carnês

    # Recalcular os totais após commit e refresh
    for carne_obj in db_client.carnes:
        db.refresh(carne_obj) # Garante que temos o status mais recente
        if carne_obj.status_carne == 'Quitado':
            numero_carnes_quitados += 1
        elif carne_obj.status_carne == 'Cancelado':
            numero_carnes_cancelados += 1
        else: # 'Ativo' ou 'Em Atraso'
            numero_carnes_ativos += 1
            for parcela in carne_obj.parcelas:
                db.refresh(parcela) # Garante parcela atualizada
                if parcela.status_parcela not in ['Paga', 'Paga com Atraso']:
                    total_divida_aberta += parcela.saldo_devedor
        
        for parcela in carne_obj.parcelas:
            total_pago_historico += parcela.valor_pago
            
    client_data_for_summary = schemas.ClientResponse.model_validate(db_client).model_dump()
    client_summary = schemas.ClientSummaryResponse(
        **client_data_for_summary,
        total_divida_aberta=float(total_divida_aberta),
        total_pago_historico=float(total_pago_historico),
        numero_carnes_ativos=numero_carnes_ativos,
        numero_carnes_quitados=numero_carnes_quitados,
        numero_carnes_cancelados=numero_carnes_cancelados
    )
    return client_summary


# --- Operações de Carne ---
def get_carne(db: Session, carne_id: int, apply_interest: bool = True):
    db_carne = db.query(models.Carne).options(
        joinedload(models.Carne.cliente),
        joinedload(models.Carne.parcelas).joinedload(models.Parcela.pagamentos)
    ).filter(models.Carne.id_carne == carne_id).first()
    
    if db_carne and apply_interest:
        for parcela in db_carne.parcelas:
            _apply_interest_and_fine_if_due(db, parcela)
        # Após aplicar juros, recalcular status do carnê
        if db_carne.status_carne != 'Cancelado':
            all_parcels_paid = all(p.status_parcela in ['Paga', 'Paga com Atraso'] for p in db_carne.parcelas)
            has_overdue_parcel = any(p.status_parcela == 'Atrasada' for p in db_carne.parcelas)
            if all_parcels_paid and db_carne.parcelas:
                db_carne.status_carne = 'Quitado'
            elif has_overdue_parcel:
                db_carne.status_carne = 'Em Atraso'
            else:
                db_carne.status_carne = 'Ativo' # Simplificado, pode ser 'Parcialmente Pago'
        db.commit()
        db.refresh(db_carne)
    return db_carne

def get_carnes(
    db: Session, skip: int = 0, limit: int = 100, id_cliente: Optional[int] = None,
    status_carne: Optional[str] = None, data_vencimento_inicio: Optional[date] = None,
    data_vencimento_fim: Optional[date] = None, search_query: Optional[str] = None
):
    query = db.query(models.Carne).options(joinedload(models.Carne.cliente))
    
    if id_cliente:
        query = query.filter(models.Carne.id_cliente == id_cliente)
    if status_carne:
        query = query.filter(models.Carne.status_carne == status_carne)

    # Para filtros de data de vencimento, precisamos garantir que o join não duplique carnês
    # se um carnê tiver múltiplas parcelas no intervalo. Usamos distinct().
    if data_vencimento_inicio or data_vencimento_fim:
        query = query.join(models.Carne.parcelas)
        if data_vencimento_inicio:
            query = query.filter(models.Parcela.data_vencimento >= data_vencimento_inicio)
        if data_vencimento_fim:
            query = query.filter(models.Parcela.data_vencimento <= data_vencimento_fim)
        query = query.distinct()

    if search_query:
        query = query.filter(
            (models.Carne.descricao.ilike(f"%{search_query}%")) |
            (models.Carne.cliente.has(models.Cliente.nome.ilike(f"%{search_query}%"))) |
            (models.Carne.cliente.has(models.Cliente.cpf_cnpj.ilike(f"%{search_query}%")))
        )
    
    # Ordena por data_venda (novo campo) se existir, senão por data_criacao
    query = query.order_by(models.Carne.data_venda.desc().nullslast(), models.Carne.data_criacao.desc())

    db_carnes = query.offset(skip).limit(limit).all()
    
    # Aplicar juros e atualizar status para cada carnê individualmente
    # Isso pode ser pesado para listas grandes. Uma alternativa seria uma tarefa em background.
    for carne_obj in db_carnes:
        needs_commit = False
        for parcela in carne_obj.parcelas:
            original_status = parcela.status_parcela
            original_juros = parcela.juros_multa
            _apply_interest_and_fine_if_due(db, parcela)
            if parcela.status_parcela != original_status or parcela.juros_multa != original_juros:
                needs_commit = True
        
        if carne_obj.status_carne != 'Cancelado':
            all_parcels_paid = all(p.status_parcela in ['Paga', 'Paga com Atraso'] for p in carne_obj.parcelas)
            has_overdue_parcel = any(p.status_parcela == 'Atrasada' for p in carne_obj.parcelas)
            new_status_carne = carne_obj.status_carne # Pega o status atual
            if all_parcels_paid and carne_obj.parcelas:
                new_status_carne = 'Quitado'
            elif has_overdue_parcel:
                new_status_carne = 'Em Atraso'
            else:
                is_partially_paid_carne = any(p.status_parcela == 'Parcialmente Paga' for p in carne_obj.parcelas)
                if is_partially_paid_carne or not carne_obj.parcelas:
                     new_status_carne = 'Ativo'
                else: # Todas pendentes, não atrasadas
                     new_status_carne = 'Ativo'

            if carne_obj.status_carne != new_status_carne:
                carne_obj.status_carne = new_status_carne
                needs_commit = True
        
        if needs_commit:
            db.add(carne_obj) # Adiciona à sessão se houve mudança
    
    db.commit() # Um único commit para todas as alterações da lista
    
    # Refresh para garantir que os objetos retornados tenham os dados mais recentes
    refreshed_carnes = []
    for carne_obj in db_carnes:
        db.refresh(carne_obj)
        for parcela in carne_obj.parcelas: # Refresh nas parcelas também
            db.refresh(parcela)
        refreshed_carnes.append(carne_obj)
        
    return refreshed_carnes


def create_carne(db: Session, carne: schemas.CarneCreate):
    valor_total_original_decimal = Decimal(str(carne.valor_total_original))
    valor_entrada_decimal = Decimal(str(carne.valor_entrada))
    valor_parcela_original_decimal = Decimal(str(carne.valor_parcela_original)) # Calculado pelo frontend

    if valor_entrada_decimal > valor_total_original_decimal:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="O valor de entrada não pode ser maior que o valor total original da dívida.")

    valor_a_parcelar = valor_total_original_decimal - valor_entrada_decimal

    if carne.numero_parcelas > 0:
        # Aumentando a tolerância para 0.015 para cobrir pequenas diferenças de arredondamento do float no frontend
        if abs(valor_a_parcelar - (valor_parcela_original_decimal * carne.numero_parcelas)) > Decimal('0.015'):
            # Comentado para permitir que o ajuste da última parcela lide com isso.
            # Se a diferença for grande, pode indicar um erro de lógica no cálculo do frontend.
            # print(f"ALERTA: Discrepância no valor total vs parcelas: {abs(valor_a_parcelar - (valor_parcela_original_decimal * carne.numero_parcelas))}")
            pass # raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="O valor a parcelar não corresponde ao (Nº de parcelas x Valor da parcela). Verifique os valores.")
    elif valor_a_parcelar != Decimal('0.00'): # Se 0 parcelas, valor a parcelar deve ser 0
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Se o número de parcelas é zero, o valor total deve ser igual ao valor de entrada.")
    
    # Validação da data da venda vs data do primeiro vencimento
    if carne.data_venda and carne.data_primeiro_vencimento < carne.data_venda:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A data do primeiro vencimento não pode ser anterior à data da venda.")


    db_carne = models.Carne(
        id_cliente=carne.id_cliente,
        data_venda=carne.data_venda,  # <<<< CAMPO NOVO ADICIONADO
        descricao=carne.descricao,
        valor_total_original=valor_total_original_decimal,
        numero_parcelas=carne.numero_parcelas,
        valor_parcela_original=valor_parcela_original_decimal, # Vem calculado do frontend
        data_primeiro_vencimento=carne.data_primeiro_vencimento,
        frequencia_pagamento=carne.frequencia_pagamento,
        status_carne=carne.status_carne if carne.status_carne else "Ativo", # Default se não vier
        observacoes=carne.observacoes,
        valor_entrada=valor_entrada_decimal,
        forma_pagamento_entrada=carne.forma_pagamento_entrada
        # data_criacao é preenchida pelo default=func.now() no modelo
    )
    db.add(db_carne)
    db.commit()
    db.refresh(db_carne)

    current_due_date = carne.data_primeiro_vencimento
    # Somente gera parcelas se numero_parcelas > 0
    if carne.numero_parcelas > 0:
        for i in range(carne.numero_parcelas):
            parcela_valor_devido = valor_parcela_original_decimal
            
            if i == carne.numero_parcelas - 1: # Ajusta a última parcela
                soma_parcelas_anteriores = valor_parcela_original_decimal * i
                parcela_valor_devido = valor_a_parcelar - soma_parcelas_anteriores
                parcela_valor_devido = parcela_valor_devido.quantize(Decimal('0.01'))

            db_parcela = models.Parcela(
                id_carne=db_carne.id_carne,
                numero_parcela=i + 1,
                valor_devido=parcela_valor_devido,
                data_vencimento=current_due_date,
                valor_pago=Decimal('0.00'),
                saldo_devedor=parcela_valor_devido,
                status_parcela='Pendente',
                juros_multa=Decimal('0.00'),
                juros_multa_anterior_aplicada=Decimal('0.00')
            )
            db.add(db_parcela)
            current_due_date = calculate_next_due_date(current_due_date, carne.frequencia_pagamento)
        
        db.commit()
        db.refresh(db_carne) # Refresh para carregar as parcelas criadas
    return db_carne


def update_carne(db: Session, carne_id: int, carne_update: schemas.CarneCreate): # CarneCreate é usado para garantir todos os campos necessários
    db_carne = db.query(models.Carne).filter(models.Carne.id_carne == carne_id).first()
    if not db_carne:
        return None
    
    has_payments = db.query(models.Pagamento).join(models.Parcela).filter(models.Parcela.id_carne == carne_id).first()
    
    update_data = carne_update.model_dump(exclude_unset=False) # Usar False para pegar todos os campos do schema de update
                                                              # ou True se quiser atualizar só os campos enviados.
                                                              # Para CarneCreate, todos os campos são esperados.

    # Validação da data da venda vs data do primeiro vencimento na atualização
    new_data_venda = update_data.get('data_venda', db_carne.data_venda)
    new_data_primeiro_vencimento = update_data.get('data_primeiro_vencimento', db_carne.data_primeiro_vencimento)
    if new_data_venda and new_data_primeiro_vencimento < new_data_venda:
         raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A data do primeiro vencimento não pode ser anterior à data da venda.")

    regenerate_parcels_flag = False
    financial_keys_for_parcel_regeneration = [
        'valor_total_original', 'numero_parcelas', 
        'valor_parcela_original', 'data_primeiro_vencimento', 
        'frequencia_pagamento', 'valor_entrada'
    ]

    if has_payments:
        allowed_keys_with_payments = ['descricao', 'status_carne', 'observacoes', 'data_venda'] # <<<< data_venda PODE SER ATUALIZADA
        for key_to_update in list(update_data.keys()): 
            if key_to_update not in allowed_keys_with_payments:
                # Se tentar atualizar um campo não permitido quando há pagamentos, levanta erro
                # Isso é mais estrito do que ignorar silenciosamente
                if getattr(db_carne, key_to_update) != update_data[key_to_update]: # Só levanta erro se o valor realmente mudou
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, 
                                        detail=f"Não é possível alterar o campo '{key_to_update}' de um carnê que já possui pagamentos.")
    else: # Se não tem pagamentos, todos os campos podem ser alterados, e alguns podem requerer regeneração de parcelas
        for key in financial_keys_for_parcel_regeneration:
            if key in update_data and getattr(db_carne, key) != update_data.get(key): # Checa se o valor mudou
                # Converte para Decimal para comparação se necessário
                current_val = getattr(db_carne, key)
                new_val = update_data.get(key)
                if key in ['valor_total_original', 'valor_parcela_original', 'valor_entrada']:
                    current_val = Decimal(str(current_val))
                    new_val = Decimal(str(new_val))

                if current_val != new_val:
                    regenerate_parcels_flag = True
                    break 

    # Aplicar as atualizações aos campos do objeto db_carne
    for key, value in update_data.items():
        if key in ['valor_total_original', 'valor_parcela_original', 'valor_entrada'] and value is not None:
            setattr(db_carne, key, Decimal(str(value)))
        else:
            setattr(db_carne, key, value) # Inclui data_venda, descricao, status_carne, observacoes, etc.

    if regenerate_parcels_flag and not has_payments:
        # Validações antes de regenerar (similar ao create_carne)
        valor_total_original_decimal = Decimal(str(db_carne.valor_total_original))
        valor_entrada_decimal = Decimal(str(db_carne.valor_entrada))
        valor_parcela_original_decimal = Decimal(str(db_carne.valor_parcela_original))

        if valor_entrada_decimal > valor_total_original_decimal:
             raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Valor de entrada não pode ser maior que o total.")
        
        valor_a_parcelar = valor_total_original_decimal - valor_entrada_decimal
        
        if db_carne.numero_parcelas > 0:
            if abs(valor_a_parcelar - (valor_parcela_original_decimal * db_carne.numero_parcelas)) > Decimal('0.015'):
                # print(f"ALERTA UPDATE: Discrepância no valor total vs parcelas: {abs(valor_a_parcelar - (valor_parcela_original_decimal * db_carne.numero_parcelas))}")
                pass # raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Valor a parcelar não corresponde ao (Nº parcelas x Valor da parcela).")
        elif valor_a_parcelar != Decimal('0.00'):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Se 0 parcelas, valor total deve ser igual à entrada.")

        # Excluir parcelas existentes
        db.query(models.Parcela).filter(models.Parcela.id_carne == carne_id).delete(synchronize_session='fetch') # Ou False
        
        # Regenerar parcelas
        if db_carne.numero_parcelas > 0:
            current_due_date = db_carne.data_primeiro_vencimento
            for i in range(db_carne.numero_parcelas):
                parcela_valor_devido = valor_parcela_original_decimal
                if i == db_carne.numero_parcelas - 1:
                    soma_parcelas_anteriores = valor_parcela_original_decimal * i
                    parcela_valor_devido = valor_a_parcelar - soma_parcelas_anteriores
                    parcela_valor_devido = parcela_valor_devido.quantize(Decimal('0.01'))
                
                db_parcela_nova = models.Parcela(
                    id_carne=db_carne.id_carne, numero_parcela=i + 1, valor_devido=parcela_valor_devido,
                    data_vencimento=current_due_date, valor_pago=Decimal('0.00'), saldo_devedor=parcela_valor_devido,
                    status_parcela='Pendente', juros_multa=Decimal('0.00'), juros_multa_anterior_aplicada=Decimal('0.00')
                )
                db.add(db_parcela_nova)
                current_due_date = calculate_next_due_date(current_due_date, db_carne.frequencia_pagamento)

    db.add(db_carne)
    db.commit()
    db.refresh(db_carne)
    return db_carne


def delete_carne(db: Session, carne_id: int):
    db_carne = db.query(models.Carne).filter(models.Carne.id_carne == carne_id).first() # Não precisa de get_carne que aplica juros
    if not db_carne:
        return None
    db.delete(db_carne) # Cascade deve cuidar das parcelas e pagamentos
    db.commit()
    return db_carne # Retorna o objeto deletado para confirmação (opcional)


# --- Operações de Parcela ---
def get_parcela(db: Session, parcela_id: int, apply_interest: bool = True):
    db_parcela = db.query(models.Parcela).options(
        joinedload(models.Parcela.carne).joinedload(models.Carne.cliente), # Carrega carne e cliente
        joinedload(models.Parcela.pagamentos) # Carrega pagamentos da parcela
    ).filter(models.Parcela.id_parcela == parcela_id).first()
    
    if db_parcela and apply_interest:
        _apply_interest_and_fine_if_due(db, db_parcela)
        db.commit()
        db.refresh(db_parcela)
    return db_parcela

def get_parcelas_by_carne(db: Session, carne_id: int, skip: int = 0, limit: int = 100):
    db_parcelas = db.query(models.Parcela).filter(models.Parcela.id_carne == carne_id)\
        .order_by(models.Parcela.numero_parcela)\
        .offset(skip).limit(limit).all()
    
    needs_commit = False
    for parcela in db_parcelas:
        original_status = parcela.status_parcela
        original_juros = parcela.juros_multa
        _apply_interest_and_fine_if_due(db, parcela)
        if parcela.status_parcela != original_status or parcela.juros_multa != original_juros:
            needs_commit = True
            db.add(parcela) # Adiciona à sessão apenas se houve mudança

    if needs_commit:
        db.commit()
    
    refreshed_parcelas = []
    for parcela in db_parcelas:
        db.refresh(parcela) # Garante que os objetos retornados tenham os dados mais recentes
        refreshed_parcelas.append(parcela)
        
    return refreshed_parcelas

def update_parcela(db: Session, parcela_id: int, parcela_update_data: schemas.ParcelaBase): # Renomeado para clareza
    db_parcela = db.query(models.Parcela).filter(models.Parcela.id_parcela == parcela_id).first()
    if not db_parcela:
        return None
    
    update_values = parcela_update_data.model_dump(exclude_unset=True)
    status_changed_manually = 'status_parcela' in update_values and update_values['status_parcela'] != db_parcela.status_parcela

    for key, value in update_values.items():
        setattr(db_parcela, key, value)

    if status_changed_manually:
        if db_parcela.status_parcela in ['Paga', 'Paga com Atraso']:
            db_parcela.saldo_devedor = Decimal('0.00')
            db_parcela.juros_multa = Decimal('0.00')
            db_parcela.juros_multa_anterior_aplicada = Decimal('0.00')
            if not db_parcela.data_pagamento_completo: # Só seta se não estiver já setado
                 db_parcela.data_pagamento_completo = date.today()
        # Se mudou para Pendente/Atrasada/Parcialmente Paga, a _apply_interest_and_fine_if_due pode ser chamada.
        # No entanto, a atualização manual de status geralmente tem prioridade.
        # Se um pagamento for feito depois, _apply_interest_and_fine_if_due será chamada.
    else: # Se status não foi alterado manualmente, ou não está no update_data, recalcular
        _apply_interest_and_fine_if_due(db, db_parcela)

    db.add(db_parcela)
    db.commit()
    db.refresh(db_parcela)
    
    # Após atualizar parcela, recalcular status do carnê pai
    if db_parcela.carne:
        get_carne(db, db_parcela.id_carne, apply_interest=True) # apply_interest=True para recalcular tudo

    return db_parcela

def delete_parcela(db: Session, parcela_id: int):
    db_parcela = db.query(models.Parcela).filter(models.Parcela.id_parcela == parcela_id).first()
    if not db_parcela:
        return None
    # Adicionar validação: não permitir excluir parcela se houver pagamentos? Ou excluir pagamentos em cascata?
    # O modelo já tem cascade="all, delete-orphan" para pagamentos na parcela.
    id_carne_pai = db_parcela.id_carne
    db.delete(db_parcela)
    db.commit()
    # Após deletar parcela, recalcular status do carnê pai
    if id_carne_pai:
         get_carne(db, id_carne_pai, apply_interest=True)
    return {"ok": True} # Ou retornar o objeto deletado


# --- Operações de Pagamento ---
def get_pagamento(db: Session, pagamento_id: int):
    return db.query(models.Pagamento).filter(models.Pagamento.id_pagamento == pagamento_id).first()

def get_pagamentos_by_parcela(db: Session, parcela_id: int, skip: int = 0, limit: int = 100):
    return db.query(models.Pagamento).filter(models.Pagamento.id_parcela == parcela_id)\
        .order_by(models.Pagamento.data_pagamento.desc())\
        .offset(skip).limit(limit).all()

def create_pagamento(db: Session, pagamento: schemas.PagamentoCreate, usuario_id: int):
    db_parcela = db.query(models.Parcela).filter(models.Parcela.id_parcela == pagamento.id_parcela).first()
    if not db_parcela:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parcela não encontrada.")
    if db_parcela.status_parcela in ['Paga', 'Paga com Atraso']:
         raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Esta parcela já está totalmente paga.")

    _apply_interest_and_fine_if_due(db, db_parcela) # Garante que juros e status de atraso estão aplicados
    db.refresh(db_parcela)

    valor_pago_decimal = Decimal(str(pagamento.valor_pago))
    if valor_pago_decimal <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Valor pago deve ser maior que zero.")
    if valor_pago_decimal > db_parcela.saldo_devedor + Decimal('0.01'): # Tolerância para arredondamento
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, 
                            detail=f"Valor pago (R${valor_pago_decimal:.2f}) excede saldo devedor (R${db_parcela.saldo_devedor:.2f}).")

    # >>>>> INÍCIO DA MODIFICAÇÃO <<<<<
    data_atual_pagamento = datetime.utcnow() # Usar UTC para consistência ou datetime.now() para fuso local do servidor

    db_pagamento_obj = models.Pagamento(
        id_parcela=pagamento.id_parcela,
        data_pagamento=data_atual_pagamento,  # Definindo explicitamente a data do pagamento
        valor_pago=valor_pago_decimal,
        forma_pagamento=pagamento.forma_pagamento,
        observacoes=pagamento.observacoes,
        id_usuario_registro=usuario_id
    )
    # >>>>> FIM DA MODIFICAÇÃO <<<<<
    db.add(db_pagamento_obj)
    
    db_parcela.valor_pago += valor_pago_decimal
    db_parcela.saldo_devedor = (db_parcela.valor_devido + db_parcela.juros_multa_anterior_aplicada) - db_parcela.valor_pago # Recalcula com base no valor_devido + juros - total_pago
    
    if db_parcela.saldo_devedor < Decimal('0.01') and db_parcela.saldo_devedor > Decimal('-0.01'):
        db_parcela.saldo_devedor = Decimal('0.00')

    if db_parcela.saldo_devedor <= Decimal('0.00'):
        db_parcela.status_parcela = 'Paga'
        # db_pagamento_obj.data_pagamento já foi definida acima.
        # Se você quiser que a data_pagamento_completo da parcela seja a data do último pagamento:
        db_parcela.data_pagamento_completo = db_pagamento_obj.data_pagamento.date() 
        if db_pagamento_obj.data_pagamento.date() > db_parcela.data_vencimento: # Comparação corrigida
            db_parcela.status_parcela = 'Paga com Atraso'
        # Se quitado, zera juros pendentes, mas mantém o que foi aplicado para o cálculo do saldo
        # db_parcela.juros_multa = Decimal('0.00') # Juros pagos são parte do valor_pago
        # db_parcela.juros_multa_anterior_aplicada = Decimal('0.00')
    elif db_parcela.valor_pago > Decimal('0.00'):
        db_parcela.status_parcela = 'Parcialmente Paga'
        if db_parcela.data_vencimento < date.today(): # Se parcialmente paga e vencida
            db_parcela.status_parcela = 'Atrasada' # Poderia ser 'Parcialmente Paga e Atrasada'
    
    if db_parcela.status_parcela == 'Pendente' and db_parcela.data_vencimento < date.today():
        db_parcela.status_parcela = 'Atrasada'

    db.add(db_parcela)
    db.commit()
    db.refresh(db_pagamento_obj)
    db.refresh(db_parcela)

    # Atualiza status do carnê pai
    get_carne(db, db_parcela.id_carne, apply_interest=False) # apply_interest=False para evitar loop, status do carnê será recalculado

    return db_pagamento_obj

def update_pagamento(db: Session, pagamento_id: int, pagamento_update: schemas.PagamentoCreate):
    # A atualização de pagamentos pode ser complexa (ex: estornar o antigo e criar um novo).
    # Por simplicidade, vamos assumir que é uma correção de dados do pagamento existente,
    # mas isso requer cuidado com os saldos e status da parcela.
    # Uma abordagem mais segura seria proibir a edição e permitir apenas estorno e novo registro.
    db_pagamento = get_pagamento(db, pagamento_id)
    if not db_pagamento:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pagamento não encontrado.")
    
    db_parcela_original = db.query(models.Parcela).filter(models.Parcela.id_parcela == db_pagamento.id_parcela).first()
    if not db_parcela_original:
         raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parcela original do pagamento não encontrada.")

    # Reverte o efeito do pagamento antigo na parcela original
    db_parcela_original.valor_pago -= db_pagamento.valor_pago
    # Recalcular saldo devedor e status da parcela original
    _apply_interest_and_fine_if_due(db, db_parcela_original) # Recalcula juros
    db_parcela_original.saldo_devedor = (db_parcela_original.valor_devido + db_parcela_original.juros_multa) - db_parcela_original.valor_pago
    db_parcela_original.data_pagamento_completo = None # Anula data de pagamento completo
    # Reajusta status da parcela original (Pendente, Atrasada, Parcialmente Paga)
    if db_parcela_original.valor_pago <= Decimal('0.00'):
        db_parcela_original.status_parcela = 'Pendente'
        if db_parcela_original.data_vencimento < date.today():
            db_parcela_original.status_parcela = 'Atrasada'
    else:
        db_parcela_original.status_parcela = 'Parcialmente Paga'
        if db_parcela_original.data_vencimento < date.today():
            db_parcela_original.status_parcela = 'Atrasada' # Ou 'Parcialmente Paga e Atrasada'
    db.add(db_parcela_original)
    
    # Atualiza os dados do pagamento
    update_data_dict = pagamento_update.model_dump(exclude_unset=True)
    for key, value in update_data_dict.items():
        if key == 'valor_pago' and value is not None: # Converte para Decimal
            setattr(db_pagamento, key, Decimal(str(value)))
        else:
            setattr(db_pagamento, key, value)
    
    # Aplica o efeito do pagamento atualizado na parcela (que pode ser a mesma ou outra, se id_parcela mudar)
    db_parcela_nova = db.query(models.Parcela).filter(models.Parcela.id_parcela == db_pagamento.id_parcela).first()
    if not db_parcela_nova:
        # Se a parcela do pagamento foi alterada para uma que não existe
        db.rollback() # Desfaz a reversão na parcela original
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Nova parcela associada ao pagamento não encontrada.")

    _apply_interest_and_fine_if_due(db, db_parcela_nova)
    db.refresh(db_parcela_nova) # Garante que temos os juros atualizados

    if db_pagamento.valor_pago > db_parcela_nova.saldo_devedor + Decimal('0.01'):
        db.rollback() # Desfaz tudo
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Novo valor pago excede o saldo devedor da parcela.")

    db_parcela_nova.valor_pago += db_pagamento.valor_pago
    db_parcela_nova.saldo_devedor = (db_parcela_nova.valor_devido + db_parcela_nova.juros_multa) - db_parcela_nova.valor_pago
    
    if db_parcela_nova.saldo_devedor < Decimal('0.01') and db_parcela_nova.saldo_devedor > Decimal('-0.01'):
        db_parcela_nova.saldo_devedor = Decimal('0.00')

    if db_parcela_nova.saldo_devedor <= Decimal('0.00'):
        db_parcela_nova.status_parcela = 'Paga'
        db_parcela_nova.data_pagamento_completo = db_pagamento.data_pagamento.date()
        if db_pagamento.data_pagamento.date() > db_parcela_nova.data_vencimento:
            db_parcela_nova.status_parcela = 'Paga com Atraso'
    elif db_parcela_nova.valor_pago > Decimal('0.00'):
        db_parcela_nova.status_parcela = 'Parcialmente Paga'
        if db_parcela_nova.data_vencimento < date.today():
            db_parcela_nova.status_parcela = 'Atrasada' # Ou 'Parcialmente Paga e Atrasada'
            
    db.add(db_parcela_nova)
    db.add(db_pagamento)
    db.commit()
    db.refresh(db_pagamento)
    db.refresh(db_parcela_original)
    if db_parcela_original.id_parcela != db_parcela_nova.id_parcela:
        db.refresh(db_parcela_nova)

    # Atualiza status dos carnês envolvidos
    get_carne(db, db_parcela_original.id_carne, apply_interest=False)
    if db_parcela_original.id_carne != db_parcela_nova.id_carne:
        get_carne(db, db_parcela_nova.id_carne, apply_interest=False)
        
    return db_pagamento


def delete_pagamento(db: Session, pagamento_id: int): # Estorno
    db_pagamento = get_pagamento(db, pagamento_id)
    if not db_pagamento:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pagamento não encontrado para estorno.")
    
    db_parcela = db.query(models.Parcela).filter(models.Parcela.id_parcela == db_pagamento.id_parcela).first()
    if db_parcela:
        db_parcela.valor_pago -= db_pagamento.valor_pago
        # Recalcular saldo devedor e status da parcela após estorno
        _apply_interest_and_fine_if_due(db, db_parcela) # Recalcula juros e status de atraso se aplicável
        db_parcela.saldo_devedor = (db_parcela.valor_devido + db_parcela.juros_multa) - db_parcela.valor_pago
        db_parcela.data_pagamento_completo = None # Anula data de pagamento completo

        if db_parcela.valor_pago <= Decimal('0.00'):
            db_parcela.valor_pago = Decimal('0.00') # Garante que não seja negativo
            db_parcela.status_parcela = 'Pendente'
            if db_parcela.data_vencimento < date.today():
                db_parcela.status_parcela = 'Atrasada'
        else: # Ainda tem algum valor pago
            db_parcela.status_parcela = 'Parcialmente Paga'
            if db_parcela.data_vencimento < date.today():
                 db_parcela.status_parcela = 'Atrasada' # Ou 'Parcialmente Paga e Atrasada'
        
        db.add(db_parcela)
    
    id_carne_pai = db_parcela.id_carne if db_parcela else None
    db.delete(db_pagamento)
    db.commit()

    # Atualiza status do carnê pai
    if id_carne_pai:
        get_carne(db, id_carne_pai, apply_interest=False) # apply_interest=False para evitar loop

    return {"ok": True} # Ou o objeto db_pagamento deletado se preferir


# --- Funções de Relatório ---
def get_receipts_report(db: Session, start_date: date, end_date: date):
    # Garante que a end_date inclua todo o dia
    end_datetime = datetime.combine(end_date, datetime.max.time())
    start_datetime = datetime.combine(start_date, datetime.min.time())


    pagamentos_no_periodo = db.query(models.Pagamento).filter(
        models.Pagamento.data_pagamento >= start_datetime,
        models.Pagamento.data_pagamento <= end_datetime
    ).options(
        joinedload(models.Pagamento.parcela).joinedload(models.Parcela.carne).joinedload(models.Carne.cliente),
        joinedload(models.Pagamento.usuario_registro) # Para pegar nome do usuário que registrou
    ).order_by(models.Pagamento.data_pagamento).all()

    total_recebido = Decimal('0.00')
    report_items = []

    for pagamento in pagamentos_no_periodo:
        total_recebido += pagamento.valor_pago
        report_item = schemas.PagamentoReportItem(
            id_pagamento=pagamento.id_pagamento,
            data_pagamento=pagamento.data_pagamento,
            valor_pago=float(pagamento.valor_pago),
            forma_pagamento=pagamento.forma_pagamento,
            observacoes=pagamento.observacoes,
            id_usuario_registro=pagamento.id_usuario_registro,
            # Adicionar nome do usuário que registrou, se quiser
            # usuario_registro_nome=pagamento.usuario_registro.nome if pagamento.usuario_registro else "N/A",
            parcela_numero=pagamento.parcela.numero_parcela,
            parcela_data_vencimento=pagamento.parcela.data_vencimento,
            cliente_nome=pagamento.parcela.carne.cliente.nome if pagamento.parcela.carne.cliente else "N/A",
            carnes_descricao=pagamento.parcela.carne.descricao,
        )
        report_items.append(report_item)

    return schemas.ReceiptsReportResponse(
        start_date=start_date,
        end_date=end_date,
        total_recebido_periodo=float(total_recebido),
        pagamentos=report_items
    )

def get_pending_debts_by_client(db: Session, client_id: int):
    db_client = get_client(db, client_id)
    if not db_client:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cliente não encontrado.")

    pending_parcelas = db.query(models.Parcela)\
        .join(models.Carne)\
        .filter(models.Carne.id_cliente == client_id)\
        .filter(models.Parcela.status_parcela.in_(['Pendente', 'Atrasada', 'Parcialmente Paga']))\
        .options(joinedload(models.Parcela.carne))\
        .order_by(models.Parcela.data_vencimento)\
        .all()

    total_divida_pendente = Decimal('0.00')
    report_items = []
    
    needs_commit = False
    for parcela in pending_parcelas:
        original_status = parcela.status_parcela
        original_juros = parcela.juros_multa
        _apply_interest_and_fine_if_due(db, parcela) # Garante que juros/multas estão atualizados
        if parcela.status_parcela != original_status or parcela.juros_multa != original_juros:
            needs_commit = True
            db.add(parcela)

    if needs_commit:
        db.commit() # Comita todas as alterações de juros/multa e status

    # Re-query ou refresh para pegar os dados atualizados para o relatório
    # (ou usar os objetos já modificados se confiante que a sessão está 100% atualizada)
    # Para simplicidade, vamos re-usar a lista `pending_parcelas` já modificada em memória
    # mas um refresh individual seria mais seguro se a lógica de _apply_interest_and_fine_if_due fizesse commits parciais.
    # Como não faz, os objetos em `pending_parcelas` devem estar atualizados.

    for parcela in pending_parcelas: # Agora os objetos parcela estão atualizados
        db.refresh(parcela) # Garantir que estamos com o objeto da sessão mais recente
        total_divida_pendente += parcela.saldo_devedor
        report_item = schemas.PendingDebtItem(
            id_parcela=parcela.id_parcela,
            numero_parcela=parcela.numero_parcela,
            valor_devido=float(parcela.valor_devido),
            valor_pago=float(parcela.valor_pago),
            saldo_devedor=float(parcela.saldo_devedor),
            juros_multa=float(parcela.juros_multa),
            data_vencimento=parcela.data_vencimento,
            status_parcela=parcela.status_parcela,
            id_carne=parcela.carne.id_carne,
            carnes_descricao=parcela.carne.descricao,
            carne_status=parcela.carne.status_carne
        )
        report_items.append(report_item)
    
    return schemas.PendingDebtsReportResponse(
        cliente_id=client_id,
        cliente_nome=db_client.nome,
        cliente_cpf_cnpj=db_client.cpf_cnpj,
        total_divida_pendente=float(total_divida_pendente),
        parcelas_pendentes=report_items
    )

def get_dashboard_summary(db: Session):
    # Para dados precisos no dashboard, precisamos que os status dos carnês e parcelas estejam atualizados.
    # Uma opção é buscar todos os carnês ativos e aplicar a lógica de atualização, mas pode ser pesado.
    # Outra é assumir que as interações (get_carne, get_carnes) já mantêm isso atualizado.
    # Para um dashboard mais preciso, uma atualização periódica ou uma query mais complexa seria ideal.
    # Por agora, vamos confiar nos status como estão no banco, assumindo que são razoavelmente atuais.

    total_clientes = db.query(func.count(models.Cliente.id_cliente)).scalar()
    total_carnes = db.query(func.count(models.Carne.id_carne)).scalar()
    
    # Status dos carnês são recalculados ao buscar a lista via get_carnes,
    # mas para o dashboard, fazemos uma contagem direta, então o status no DB é usado.
    # Idealmente, teríamos uma função `update_all_carnes_status(db)` chamada periodicamente.
    total_carnes_ativos = db.query(func.count(models.Carne.id_carne)).filter(models.Carne.status_carne.in_(['Ativo', 'Parcialmente Paga'])).scalar()
    total_carnes_quitados = db.query(func.count(models.Carne.id_carne)).filter(models.Carne.status_carne == 'Quitado').scalar()
    total_carnes_atrasados = db.query(func.count(models.Carne.id_carne)).filter(models.Carne.status_carne == 'Em Atraso').scalar()

    total_divida_geral_aberta = db.query(func.sum(models.Parcela.saldo_devedor))\
        .filter(models.Parcela.status_parcela.in_(['Pendente', 'Atrasada', 'Parcialmente Paga']))\
        .scalar() or Decimal('0.00')

    today = date.today()
    start_of_today = datetime.combine(today, datetime.min.time())
    end_of_today = datetime.combine(today, datetime.max.time())

    total_recebido_hoje = db.query(func.sum(models.Pagamento.valor_pago)).filter(
        models.Pagamento.data_pagamento >= start_of_today,
        models.Pagamento.data_pagamento <= end_of_today
    ).scalar() or Decimal('0.00')

    first_day_current_month = today.replace(day=1)
    # Para o último dia do mês, uma lógica mais complexa é necessária ou usar dateutil.
    # Por simplicidade, vamos pegar até o final do dia atual para "recebido no mês".
    # Isso não é "mês corrente completo" se hoje não for o último dia.
    total_recebido_mes_corrente = db.query(func.sum(models.Pagamento.valor_pago)).filter(
        models.Pagamento.data_pagamento >= datetime.combine(first_day_current_month, datetime.min.time()),
        models.Pagamento.data_pagamento <= end_of_today 
    ).scalar() or Decimal('0.00')

    next_7_days_end = today + timedelta(days=7)
    parcelas_a_vencer_7dias = db.query(func.count(models.Parcela.id_parcela)).filter(
        models.Parcela.data_vencimento > today,
        models.Parcela.data_vencimento <= next_7_days_end,
        models.Parcela.status_parcela.in_(['Pendente', 'Parcialmente Paga'])
    ).scalar()

    # Para parcelas atrasadas, a função _apply_interest_and_fine_if_due deveria ter atualizado o status.
    parcelas_atrasadas = db.query(func.count(models.Parcela.id_parcela)).filter(
        models.Parcela.status_parcela == 'Atrasada', # Confia que o status foi atualizado
        # models.Parcela.data_vencimento < today, # Redundante se o status 'Atrasada' está correto
        # models.Parcela.saldo_devedor > Decimal('0.00') # Implícito em 'Atrasada'
    ).scalar()
    
    return schemas.DashboardSummaryResponse(
        total_clientes=total_clientes,
        total_carnes=total_carnes,
        total_carnes_ativos=total_carnes_ativos,
        total_carnes_quitados=total_carnes_quitados,
        total_carnes_atrasados=total_carnes_atrasados,
        total_divida_geral_aberta=float(total_divida_geral_aberta),
        total_recebido_hoje=float(total_recebido_hoje),
        total_recebido_mes=float(total_recebido_mes_corrente),
        parcelas_a_vencer_7dias=parcelas_a_vencer_7dias,
        parcelas_atrasadas=parcelas_atrasadas
    )