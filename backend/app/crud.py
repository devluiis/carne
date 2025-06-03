from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import IntegrityError
from app import models, schemas
from fastapi import HTTPException, status
from datetime import date, timedelta, datetime
from decimal import Decimal
from typing import Optional
from app.config import MULTA_ATRASO_PERCENTUAL, JUROS_MORA_PERCENTUAL_AO_MES
from sqlalchemy import func # Importar func para agregação


# --- Funções Auxiliares (RF017/RF018) ---
def _apply_interest_and_fine_if_due(db: Session, parcela: models.Parcela):
    today = date.today()
    
    # Apenas aplica juros/multas se a parcela não estiver totalmente paga ou cancelada
    if parcela.status_parcela not in ['Paga', 'Paga com Atraso', 'Cancelada'] and parcela.data_vencimento < today:
        dias_atraso = (today - parcela.data_vencimento).days
        
        # O valor base para cálculo de juros/multa deve ser o valor original devido menos o que já foi pago
        # do PRINCIPAL, sem contar juros/multas anteriores.
        valor_base_para_calculo = parcela.valor_devido - (parcela.valor_pago - parcela.juros_multa_anterior_aplicada)
        
        if valor_base_para_calculo < Decimal('0.00'):
            valor_base_para_calculo = Decimal('0.00')

        multa = (valor_base_para_calculo * Decimal(str(MULTA_ATRASO_PERCENTUAL))) / Decimal('100')
        
        # Juros compostos diários simplificados (mensal / 30 dias)
        juros_diario_percentual = Decimal(str(JUROS_MORA_PERCENTUAL_AO_MES)) / Decimal('30') / Decimal('100')
        juros_mora = (valor_base_para_calculo * juros_diario_percentual * Decimal(str(dias_atraso)))

        total_novos_juros_multa = multa + juros_mora

        # Atualiza juros_multa e saldo_devedor
        # O saldo devedor atual, desconsiderando os juros que serão recalculados
        current_saldo_excluding_old_juros = parcela.valor_devido - parcela.valor_pago

        parcela.juros_multa = total_novos_juros_multa
        parcela.saldo_devedor = current_saldo_excluding_old_juros + total_novos_juros_multa
        
        parcela.juros_multa_anterior_aplicada = total_novos_juros_multa # Guarda o valor para o próximo ciclo

        if parcela.saldo_devedor < Decimal('0.01') and parcela.saldo_devedor > Decimal('-0.01'):
            parcela.saldo_devedor = Decimal('0.00')
            parcela.juros_multa = Decimal('0.00') # Se quitado, juros/multa devem ser zero
            parcela.juros_multa_anterior_aplicada = Decimal('0.00')
            parcela.status_parcela = 'Paga' # Ou Paga com Atraso, será ajustado no pagamento
            parcela.data_pagamento_completo = today # Será ajustado na criação/estorno de pagamento

        elif parcela.data_vencimento < today and parcela.saldo_devedor > Decimal('0.00'):
            parcela.status_parcela = 'Atrasada'
        elif parcela.saldo_devedor > Decimal('0.00') and parcela.valor_pago > Decimal('0.00'):
            parcela.status_parcela = 'Parcialmente Paga'
        elif parcela.saldo_devedor > Decimal('0.00') and parcela.data_vencimento >= today:
            parcela.status_parcela = 'Pendente'

        db.add(parcela)
        # db.commit() # Não comita aqui, pois esta função é chamada em loops. O commit será feito pelo chamador.
        # db.refresh(parcela) # Não precisa refresh aqui, pois o objeto já está em sessão

def calculate_next_due_date(current_date: date, frequency: str) -> date:
    if frequency == "mensal":
        return current_date + timedelta(days=30)
    elif frequency == "quinzenal":
        return current_date + timedelta(days=15)
    elif frequency == "trimestral":
        return current_date + timedelta(days=90)
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

    return query.offset(skip).limit(limit).all()

def create_client(db: Session, client: schemas.ClientCreate):
    db_client = models.Cliente(
        nome=client.nome,
        cpf_cnpj=client.cpf_cnpj,
        endereco=client.endereco,
        telefone=client.telefone,
        email=client.email
    )
    try:
        db.add(db_client)
        db.commit()
        db.refresh(db_client)
        return db_client
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="CPF/CNPJ já registrado")

def update_client(db: Session, client_id: int, client_update: schemas.ClientUpdate):
    db_client = db.query(models.Cliente).filter(models.Cliente.id_cliente == client_id).first()
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
    db_client = db.query(models.Cliente).filter(models.Cliente.id_cliente == client_id).first()
    if not db_client:
        return None
    db.delete(db_client)
    db.commit()
    return db_client

def get_client_summary(db: Session, client_id: int):
    db_client = db.query(models.Cliente).options(
        joinedload(models.Cliente.carnes).joinedload(models.Carne.parcelas)
    ).filter(models.Cliente.id_cliente == client_id).first()

    if not db_client:
        return None

    total_divida_aberta = Decimal('0.00')
    total_pago_historico = Decimal('0.00')
    numero_carnes_ativos = 0
    numero_carnes_quitados = 0
    numero_carnes_cancelados = 0

    for carne in db_client.carnes:
        # Aplica juros/multas e atualiza status das parcelas antes de somar (RF017, RF018)
        for parcela in carne.parcelas:
            _apply_interest_and_fine_if_due(db, parcela)
        
        # Comita as alterações de juros/multa das parcelas antes de reavaliar o status do carnê
        # Isso garante que o estado da sessão esteja atualizado para a lógica de status do carnê
        db.commit() 
        db.refresh(carne) # Recarrega o carne para ter as parcelas atualizadas após a aplicação de juros/multa

        # Reavaliar o status do carnê com base nas parcelas atualizadas
        if carne.status_carne != 'Cancelado': # Carnês cancelados não devem ter o status alterado automaticamente
            all_paid = True
            has_overdue = False
            is_partially_paid_carne = False # Novo para verificar se alguma parcela está parcialmente paga
            for parcela in carne.parcelas:
                # Refresh de cada parcela para ter o estado mais recente após _apply_interest_and_fine_if_due
                db.refresh(parcela) 
                if parcela.status_parcela not in ['Paga', 'Paga com Atraso']:
                    all_paid = False
                if parcela.status_parcela == 'Atrasada':
                    has_overdue = True
                if parcela.status_parcela == 'Parcialmente Paga':
                    is_partially_paid_carne = True
            
            if all_paid:
                carne.status_carne = 'Quitado'
            elif has_overdue:
                carne.status_carne = 'Em Atraso'
            elif is_partially_paid_carne: # Se não está quitado nem em atraso, mas tem pagamentos parciais
                carne.status_carne = 'Ativo' # Considera ativo, pois não está "limpo" mas também não está totalmente atrasado
            else:
                carne.status_carne = 'Ativo' # Se não está quitado, nem em atraso, nem parcialmente pago (todas Pendentes)

        db.add(carne) # Adiciona o carne atualizado para ser commitado
        db.commit() # Comita as alterações de status e juros/multa
        db.refresh(carne) # Recarrega o carne para ter os dados mais recentes após o commit

        if carne.status_carne == 'Quitado':
            numero_carnes_quitados += 1
        elif carne.status_carne == 'Cancelado':
            numero_carnes_cancelados += 1
        else: # Inclui 'Ativo' e 'Em Atraso'
            numero_carnes_ativos += 1
            for parcela in carne.parcelas:
                if parcela.status_parcela not in ['Paga', 'Paga com Atraso']:
                    total_divida_aberta += parcela.saldo_devedor
        
        for parcela in carne.parcelas:
            total_pago_historico += parcela.valor_pago


    client_summary = schemas.ClientSummaryResponse.model_validate(db_client)
    
    client_summary.total_divida_aberta = float(total_divida_aberta)
    client_summary.total_pago_historico = float(total_pago_historico)
    client_summary.numero_carnes_ativos = numero_carnes_ativos
    client_summary.numero_carnes_quitados = numero_carnes_quitados
    client_summary.numero_carnes_cancelados = numero_carnes_cancelados

    return client_summary


# --- Operações de Carne ---
def get_carne(db: Session, carne_id: int):
    carne = db.query(models.Carne).filter(models.Carne.id_carne == carne_id).first()
    if carne:
        for parcela in carne.parcelas:
            _apply_interest_and_fine_if_due(db, parcela)
        db.commit() # Comita as alterações de juros/multa
        db.refresh(carne)
    return carne

def get_carnes(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    id_cliente: Optional[int] = None,
    status_carne: Optional[str] = None,
    data_vencimento_inicio: Optional[date] = None,
    data_vencimento_fim: Optional[date] = None,
    search_query: Optional[str] = None
):
    query = db.query(models.Carne).options(joinedload(models.Carne.cliente)) # Carrega o cliente junto
    
    if id_cliente:
        query = query.filter(models.Carne.id_cliente == id_cliente)
    
    if status_carne:
        query = query.filter(models.Carne.status_carne == status_carne)

    if data_vencimento_inicio:
        # Join com parcelas para filtrar pela data de vencimento de QUALQUER parcela do carnê
        query = query.join(models.Carne.parcelas).filter(models.Parcela.data_vencimento >= data_vencimento_inicio)
    
    if data_vencimento_fim:
        query = query.join(models.Carne.parcelas).filter(models.Parcela.data_vencimento <= data_vencimento_fim)
    
    if search_query:
        # Busca por descrição do carnê OU nome/CPF do cliente
        query = query.filter(
            (models.Carne.descricao.ilike(f"%{search_query}%")) |
            (models.Carne.cliente.has(models.Cliente.nome.ilike(f"%{search_query}%"))) |
            (models.Carne.cliente.has(models.Cliente.cpf_cnpj.ilike(f"%{search_query}%")))
        )

    # Ordena para garantir consistência
    query = query.order_by(models.Carne.data_criacao.desc())

    carnes = query.offset(skip).limit(limit).all()
    for carne in carnes:
        for parcela in carne.parcelas:
            _apply_interest_and_fine_if_due(db, parcela)
        # Reavaliar o status do carnê após aplicar juros/multa nas parcelas (RF016, RF017)
        if carne.status_carne != 'Cancelado':
            all_paid = True
            has_overdue = False
            is_partially_paid_carne = False
            for parcela in carne.parcelas:
                db.refresh(parcela) # Garante que a parcela está atualizada
                if parcela.status_parcela not in ['Paga', 'Paga com Atraso']:
                    all_paid = False
                if parcela.status_parcela == 'Atrasada':
                    has_overdue = True
                if parcela.status_parcela == 'Parcialmente Paga':
                    is_partially_paid_carne = True
            
            if all_paid:
                carne.status_carne = 'Quitado'
            elif has_overdue:
                carne.status_carne = 'Em Atraso'
            elif is_partially_paid_carne:
                carne.status_carne = 'Ativo'
            else:
                carne.status_carne = 'Ativo'

        db.add(carne) # Adiciona o carne atualizado para ser commitado

    db.commit() # Comita todas as alterações de status e juros/multa em lote
    # O refresh é implicito para os objetos que foram 'add' e 'commit' em uma sessão
    for carne in carnes:
        db.refresh(carne) # Garante que os objetos retornados tenham os dados mais recentes
    return carnes


def create_carne(db: Session, carne: schemas.CarneCreate):
    valor_total_original_decimal = Decimal(str(carne.valor_total_original))
    valor_entrada_decimal = Decimal(str(carne.valor_entrada))
    valor_parcela_original_decimal = Decimal(str(carne.valor_parcela_original))

    if valor_entrada_decimal > valor_total_original_decimal: # Validação RF009
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="O valor de entrada não pode ser maior que o valor total original da dívida.")

    # Valor remanescente a ser parcelado após a entrada
    valor_a_parcelar = valor_total_original_decimal - valor_entrada_decimal

    if abs(valor_a_parcelar - (valor_parcela_original_decimal * carne.numero_parcelas)) > Decimal('0.01'):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="O valor a parcelar não corresponde ao número de parcelas x valor da parcela. Ajuste o valor da parcela ou número de parcelas.")

    db_carne = models.Carne(
        id_cliente=carne.id_cliente,
        descricao=carne.descricao,
        valor_total_original=valor_total_original_decimal,
        numero_parcelas=carne.numero_parcelas,
        valor_parcela_original=valor_parcela_original_decimal,
        data_primeiro_vencimento=carne.data_primeiro_vencimento,
        frequencia_pagamento=carne.frequencia_pagamento,
        status_carne=carne.status_carne,
        observacoes=carne.observacoes,
        valor_entrada=valor_entrada_decimal, # RF009
        forma_pagamento_entrada=carne.forma_pagamento_entrada # RF009
    )
    db.add(db_carne)
    db.commit()
    db.refresh(db_carne)

    current_due_date = carne.data_primeiro_vencimento
    for i in range(carne.numero_parcelas):
        parcela_valor_devido = valor_parcela_original_decimal
        # Ajusta a última parcela para que a soma seja exatamente o valor a parcelar
        if i == carne.numero_parcelas - 1:
            soma_parcelas_anteriores = valor_parcela_original_decimal * i
            parcela_valor_devido = valor_a_parcelar - soma_parcelas_anteriores
            # Garante que não haja pequenos erros de arredondamento
            parcela_valor_devido = parcela_valor_devido.quantize(Decimal('0.01'))


        db_parcela = models.Parcela(
            id_carne=db_carne.id_carne,
            numero_parcela=i + 1,
            valor_devido=parcela_valor_devido,
            data_vencimento=current_due_date,
            valor_pago=Decimal('0.00'),
            saldo_devedor=parcela_valor_devido, # Saldo inicial é o valor devido
            status_parcela='Pendente',
            juros_multa=Decimal('0.00'),
            juros_multa_anterior_aplicada=Decimal('0.00') # Inicializa a nova coluna
        )
        db.add(db_parcela)
        
        current_due_date = calculate_next_due_date(current_due_date, carne.frequencia_pagamento)

    db.commit()
    db.refresh(db_carne)
    return db_carne

def update_carne(db: Session, carne_id: int, carne_update: schemas.CarneCreate):
    db_carne = db.query(models.Carne).filter(models.Carne.id_carne == carne_id).first()
    if not db_carne:
        return None
    
    # Validação: Não permite alterar campos que afetam parcelas se houver pagamentos (RF011)
    # Adicionado valor_entrada e forma_pagamento_entrada nas restrições
    has_payments = db.query(models.Pagamento).join(models.Parcela).filter(models.Parcela.id_carne == carne_id).first()
    
    if has_payments:
        # Se houver pagamentos, só permite alterar campos "seguros"
        allowed_keys = ['descricao', 'status_carne', 'observacoes']
        for key in carne_update.model_dump(exclude_unset=True).keys():
            if key not in allowed_keys:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, 
                                    detail=f"Não é possível alterar '{key}' de um carnê que já possui pagamentos registrados. Você pode alterar apenas descrição, status e observações.")
    
    update_data = carne_update.model_dump(exclude_unset=True)
    
    # Validação adicional para valor_entrada se estiver sendo atualizado
    if 'valor_entrada' in update_data and update_data['valor_entrada'] is not None:
        valor_entrada_decimal = Decimal(str(update_data['valor_entrada']))
        valor_total_original_decimal = Decimal(str(db_carne.valor_total_original)) # Use o valor_total_original atual do DB ou do update_data se estiver no update
        if 'valor_total_original' in update_data:
            valor_total_original_decimal = Decimal(str(update_data['valor_total_original']))

        if valor_entrada_decimal > valor_total_original_decimal:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="O valor de entrada não pode ser maior que o valor total original da dívida.")


    for key, value in update_data.items():
        setattr(db_carne, key, value)
    
    db.add(db_carne)
    
    # Se o número de parcelas, valor total, valor da parcela, data do 1º vencimento,
    # frequência ou VALOR DE ENTRADA mudarem, as parcelas precisam ser regeneradas
    # Isso só acontece se o `has_payments` for False (validado acima).
    # Adicionado 'valor_entrada' na condição de regeneração.
    if not has_payments and any(k in update_data for k in ['numero_parcelas', 'valor_total_original', 'valor_parcela_original', 'data_primeiro_vencimento', 'frequencia_pagamento', 'valor_entrada']):
        # Exclui parcelas existentes
        db.query(models.Parcela).filter(models.Parcela.id_carne == carne_id).delete(synchronize_session=False)
        db.flush() # Persiste a exclusão antes de adicionar novas

        # Regenera as parcelas (lógica similar à de create_carne)
        valor_total_original_decimal = Decimal(str(db_carne.valor_total_original))
        valor_entrada_decimal = Decimal(str(db_carne.valor_entrada))
        valor_parcela_original_decimal = Decimal(str(db_carne.valor_parcela_original))
        
        valor_a_parcelar = valor_total_original_decimal - valor_entrada_decimal # RF009
        if valor_a_parcelar < Decimal('0.00'): valor_a_parcelar = Decimal('0.00') # Garante que não seja negativo

        current_due_date = db_carne.data_primeiro_vencimento

        for i in range(db_carne.numero_parcelas):
            parcela_valor_devido = valor_parcela_original_decimal
            if i == db_carne.numero_parcelas - 1:
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
            current_due_date = calculate_next_due_date(current_due_date, db_carne.frequencia_pagamento)

    db.commit()
    db.refresh(db_carne)
    return db_carne

def delete_carne(db: Session, carne_id: int):
    db_carne = db.query(models.Carne).filter(models.Carne.id_carne == carne_id).first()
    if not db_carne:
        return None
    # A deleção em cascata (cascade="all, delete-orphan" nos modelos) cuidará de parcelas e pagamentos.
    db.delete(db_carne)
    db.commit()
    return db_carne


# --- Operações de Parcela ---
def get_parcela(db: Session, parcela_id: int):
    parcela = db.query(models.Parcela).filter(models.Parcela.id_parcela == parcela_id).first()
    if parcela:
        _apply_interest_and_fine_if_due(db, parcela)
        db.commit() # Comita as alterações de juros/multa
        db.refresh(parcela)
    return parcela

def get_parcelas_by_carne(db: Session, carne_id: int, skip: int = 0, limit: int = 100):
    parcelas = db.query(models.Parcela).filter(models.Parcela.id_carne == carne_id).order_by(models.Parcela.numero_parcela).offset(skip).limit(limit).all()
    for parcela in parcelas:
        _apply_interest_and_fine_if_due(db, parcela)
    db.commit() # Comita todas as alterações de status e juros/multa em lote
    for parcela in parcelas:
        db.refresh(parcela) # Garante que os objetos retornados tenham os dados mais recentes
    return parcelas

def update_parcela(db: Session, parcela_id: int, parcela_update: schemas.ParcelaBase):
    db_parcela = db.query(models.Parcela).filter(models.Parcela.id_parcela == parcela_id).first()
    if not db_parcela:
        return None
    
    update_data = parcela_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_parcela, key, value)

    # Se o status da parcela foi explicitamente definido (e não é uma atualização automática),
    # não aplicamos juros/multa, pois isso pode ser um status manual.
    # No entanto, se o status for alterado para algo diferente de Paga/Paga com Atraso,
    # devemos recalcular os juros se a parcela estiver atrasada.
    if 'status_parcela' in update_data and update_data['status_parcela'] != db_parcela.status_parcela:
        if db_parcela.status_parcela in ['Paga', 'Paga com Atraso']:
            db_parcela.saldo_devedor = Decimal('0.00')
            db_parcela.juros_multa = Decimal('0.00')
            db_parcela.juros_multa_anterior_aplicada = Decimal('0.00')
            db_parcela.data_pagamento_completo = date.today()
        else: # Se o status foi mudado para algo que não é pago (ex: Pendente, Atrasada, Parcialmente Paga)
            _apply_interest_and_fine_if_due(db, db_parcela)
    else: # Se o status não foi alterado explicitamente, ou não está no update_data
        _apply_interest_and_fine_if_due(db, db_parcela)

    db.add(db_parcela)
    db.commit()
    db.refresh(db_parcela)
    return db_parcela

def delete_parcela(db: Session, parcela_id: int):
    db_parcela = db.query(models.Parcela).filter(models.Parcela.id_parcela == parcela_id).first()
    if not db_parcela:
        return None
    # A deleção em cascata (cascade="all, delete-orphan" nos modelos) cuidará dos pagamentos.
    db.delete(db_parcela)
    db.commit()
    return db_parcela


# --- Operações de Pagamento ---
def get_pagamento(db: Session, pagamento_id: int):
    return db.query(models.Pagamento).filter(models.Pagamento.id_pagamento == pagamento_id).first()

def get_pagamentos_by_parcela(db: Session, parcela_id: int, skip: int = 0, limit: int = 100):
    return db.query(models.Pagamento).filter(models.Pagamento.id_parcela == parcela_id).offset(skip).limit(limit).all()

def create_pagamento(db: Session, pagamento: schemas.PagamentoCreate, usuario_id: int):
    db_parcela = db.query(models.Parcela).filter(models.Parcela.id_parcela == pagamento.id_parcela).first()
    if not db_parcela:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parcela não encontrada para registrar pagamento.")
    
    # Aplica juros/multa antes de registrar o pagamento para ter o saldo devedor atualizado
    _apply_interest_and_fine_if_due(db, db_parcela)
    db.refresh(db_parcela) # Atualiza o objeto db_parcela na sessão com os novos valores

    valor_pago_decimal = Decimal(str(pagamento.valor_pago))
    if valor_pago_decimal <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Valor pago deve ser maior que zero.")

    # Verifica se o valor pago excede o saldo devedor (com uma pequena tolerância para arredondamento)
    if valor_pago_decimal > db_parcela.saldo_devedor + Decimal('0.01'):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, 
                            detail=f"Valor pago ({valor_pago_decimal.quantize(Decimal('0.01'))}) excede o saldo total da parcela (R$ {db_parcela.saldo_devedor.quantize(Decimal('0.01'))} - incluindo juros/multas).")

    db_pagamento = models.Pagamento(
        id_parcela=pagamento.id_parcela,
        valor_pago=valor_pago_decimal,
        forma_pagamento=pagamento.forma_pagamento,
        observacoes=pagamento.observacoes,
        id_usuario_registro=usuario_id
    )
    db.add(db_pagamento)
    # db.commit() # Não comita aqui, comita no final para transação atômica
    # db.refresh(db_pagamento)

    db_parcela.valor_pago += valor_pago_decimal
    db_parcela.saldo_devedor -= valor_pago_decimal

    # Ajusta o saldo devedor para zero se for muito próximo de zero devido a flutuações de ponto flutuante
    if db_parcela.saldo_devedor < Decimal('0.01') and db_parcela.saldo_devedor > Decimal('-0.01'):
        db_parcela.saldo_devedor = Decimal('0.00')
        db_parcela.juros_multa = Decimal('0.00') # Se quitado, zera juros
        db_parcela.juros_multa_anterior_aplicada = Decimal('0.00')


    # Atualiza o status da parcela (RF016)
    if db_parcela.saldo_devedor <= Decimal('0.00'):
        db_parcela.status_parcela = 'Paga'
        db_parcela.data_pagamento_completo = date.today()
        # Se a data do pagamento é após o vencimento, marca como 'Paga com Atraso'
        if db_pagamento.data_pagamento.date() > db_parcela.data_vencimento:
            db_parcela.status_parcela = 'Paga com Atraso'
    elif db_parcela.saldo_devedor < (db_parcela.valor_devido + db_parcela.juros_multa_anterior_aplicada) and db_parcela.valor_pago > Decimal('0.00'): 
        db_parcela.status_parcela = 'Parcialmente Paga'
    
    # Mantém o status 'Atrasada' se ainda houver saldo e já passou do vencimento
    if db_parcela.saldo_devedor > Decimal('0.00') and db_parcela.data_vencimento < date.today():
        db_parcela.status_parcela = 'Atrasada'
    elif db_parcela.saldo_devedor > Decimal('0.00') and db_parcela.data_vencimento >= date.today() and db_parcela.valor_pago == Decimal('0.00'):
         db_parcela.status_parcela = 'Pendente' # Volta para pendente se não está mais atrasada e não teve pagamento
    elif db_parcela.saldo_devedor > Decimal('0.00') and db_parcela.valor_pago > Decimal('0.00') and db_parcela.data_vencimento >= date.today():
        db_parcela.status_parcela = 'Parcialmente Paga' # Mantém parcial se ainda tem saldo e não está atrasada


    db.add(db_parcela)
    db.commit() # Comita o pagamento e a atualização da parcela
    db.refresh(db_pagamento)
    db.refresh(db_parcela)

    # Verifica e atualiza o status do carnê após o pagamento (RF016)
    db_carne = db.query(models.Carne).filter(models.Carne.id_carne == db_parcela.id_carne).first()
    if db_carne:
        all_paid_carne = True
        has_overdue_carne = False
        is_partially_paid_carne = False
        for p in db_carne.parcelas:
            db.refresh(p) # Garante que a parcela está atualizada
            if p.status_parcela not in ['Paga', 'Paga com Atraso']:
                all_paid_carne = False
            if p.status_parcela == 'Atrasada':
                has_overdue_carne = True
            if p.status_parcela == 'Parcialmente Paga':
                is_partially_paid_carne = True
            
            if all_paid_carne:
                db_carne.status_carne = 'Quitado'
            elif has_overdue_carne:
                db_carne.status_carne = 'Em Atraso'
            elif is_partially_paid_carne:
                db_carne.status_carne = 'Ativo'
            else:
                db_carne.status_carne = 'Ativo'
            
            db.add(db_carne)
            db.commit()
            db.refresh(db_carne)
    
    return db_pagamento

def update_pagamento(db: Session, pagamento_id: int, pagamento_update: schemas.PagamentoCreate):
    db_pagamento = db.query(models.Pagamento).filter(models.Pagamento.id_pagamento == pagamento_id).first()
    if not db_pagamento:
        return None
    
    original_valor_pago = db_pagamento.valor_pago
    
    update_data = pagamento_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_pagamento, key, value)
    
    db.add(db_pagamento)
    # db.commit() # Comita no final após atualizar a parcela
    # db.refresh(db_pagamento)

    db_parcela = db.query(models.Parcela).filter(models.Parcela.id_parcela == db_pagamento.id_parcela).first()
    if db_parcela:
        # Reverte o impacto do valor original
        db_parcela.valor_pago -= original_valor_pago
        db_parcela.saldo_devedor += original_valor_pago
        
        # Aplica o impacto do novo valor
        db_parcela.valor_pago += db_pagamento.valor_pago
        db_parcela.saldo_devedor -= db_pagamento.valor_pago

        # Recalcula juros/multa e status
        _apply_interest_and_fine_if_due(db, db_parcela)
        db.refresh(db_parcela)

        if db_parcela.saldo_devedor < Decimal('0.01') and db_parcela.saldo_devedor > Decimal('-0.01'):
            db_parcela.saldo_devedor = Decimal('0.00')
            db_parcela.juros_multa = Decimal('0.00')
            db_parcela.juros_multa_anterior_aplicada = Decimal('0.00')


        if db_parcela.saldo_devedor <= Decimal('0.00'):
            db_parcela.status_parcela = 'Paga'
            db_parcela.data_pagamento_completo = date.today()
            if db_pagamento.data_pagamento.date() > db_parcela.data_vencimento:
                db_parcela.status_parcela = 'Paga com Atraso'
        elif db_parcela.saldo_devedor < (db_parcela.valor_devido + db_parcela.juros_multa_anterior_aplicada) and db_parcela.valor_pago > Decimal('0.00'):
            db_parcela.status_parcela = 'Parcialmente Paga'
        else:
            db_parcela.status_parcela = 'Pendente'
        
        if db_parcela.status_parcela != 'Paga' and db_parcela.data_vencimento < date.today():
            db_parcela.status_parcela = 'Atrasada'
        elif db_parcela.saldo_devedor > Decimal('0.00') and db_parcela.valor_pago > Decimal('0.00') and db_parcela.data_vencimento >= date.today():
            db_parcela.status_parcela = 'Parcialmente Paga'


        db.add(db_parcela)
        db.commit()
        db.refresh(db_parcela)

        # Atualiza o status do carnê
        db_carne = db.query(models.Carne).filter(models.Carne.id_carne == db_parcela.id_carne).first()
        if db_carne:
            all_paid_carne = True
            has_overdue_carne = False
            is_partially_paid_carne = False
            for p in db_carne.parcelas:
                db.refresh(p)
                if p.status_parcela not in ['Paga', 'Paga com Atraso']:
                    all_paid_carne = False
                if p.status_parcela == 'Atrasada':
                    has_overdue_carne = True
                if p.status_parcela == 'Parcialmente Paga':
                    is_partially_paid_carne = True
            
            if all_paid_carne:
                db_carne.status_carne = 'Quitado'
            elif has_overdue_carne:
                db_carne.status_carne = 'Em Atraso'
            elif is_partially_paid_carne:
                db_carne.status_carne = 'Ativo'
            else:
                db_carne.status_carne = 'Ativo'
            
            db.add(db_carne)
            db.commit()
            db.refresh(db_carne)

    return db_pagamento

def delete_pagamento(db: Session, pagamento_id: int):
    db_pagamento = db.query(models.Pagamento).filter(models.Pagamento.id_pagamento == pagamento_id).first()
    if not db_pagamento:
        return None
    
    db_parcela = db.query(models.Parcela).filter(models.Parcela.id_parcela == db_pagamento.id_parcela).first()
    if db_parcela:
        db_parcela.valor_pago -= db_pagamento.valor_pago
        db_parcela.saldo_devedor += db_pagamento.valor_pago
        db_parcela.data_pagamento_completo = None

        _apply_interest_and_fine_if_due(db, db_parcela) # Recalcula juros/multa após estorno
        db.refresh(db_parcela)

        if db_parcela.saldo_devedor < Decimal('0.01') and db_parcela.saldo_devedor > Decimal('-0.01'):
            db_parcela.saldo_devedor = Decimal('0.00')
            db_parcela.juros_multa = Decimal('0.00')
            db_parcela.juros_multa_anterior_aplicada = Decimal('0.00')


        # Ajusta o status da parcela
        if db_parcela.saldo_devedor <= Decimal('0.00'):
            db_parcela.status_parcela = 'Paga'
        elif db_parcela.saldo_devedor > Decimal('0.00') and db_parcela.saldo_devedor < (db_parcela.valor_devido + db_parcela.juros_multa_anterior_aplicada):
            db_parcela.status_parcela = 'Parcialmente Paga'
        else: # saldo_devedor >= (valor_devido + juros_multa)
            db_parcela.status_parcela = 'Pendente'
        
        # Garante que o status 'Atrasada' seja aplicado se a data de vencimento já passou
        if db_parcela.status_parcela != 'Paga' and db_parcela.data_vencimento < date.today():
            db_parcela.status_parcela = 'Atrasada'
        elif db_parcela.saldo_devedor > Decimal('0.00') and db_parcela.valor_pago == Decimal('0.00') and db_parcela.data_vencimento >= date.today():
            db_parcela.status_parcela = 'Pendente'
        elif db_parcela.saldo_devedor > Decimal('0.00') and db_parcela.valor_pago > Decimal('0.00') and db_parcela.data_vencimento >= date.today():
            db_parcela.status_parcela = 'Parcialmente Paga'


        db.add(db_parcela)
        db.commit() # Comita o estorno do pagamento e a atualização da parcela
        db.refresh(db_parcela)

        # Atualiza o status do carnê
        db_carne = db.query(models.Carne).filter(models.Carne.id_carne == db_parcela.id_carne).first()
        if db_carne:
            all_paid_carne = True
            has_overdue_carne = False
            is_partially_paid_carne = False
            for p in db_carne.parcelas:
                db.refresh(p)
                if p.status_parcela not in ['Paga', 'Paga com Atraso']:
                    all_paid_carne = False
                if p.status_parcela == 'Atrasada':
                    has_overdue_carne = True
                if p.status_parcela == 'Parcialmente Paga':
                    is_partially_paid_carne = True
            
            if all_paid_carne:
                db_carne.status_carne = 'Quitado'
            elif has_overdue_carne:
                db_carne.status_carne = 'Em Atraso'
            elif is_partially_paid_carne:
                db_carne.status_carne = 'Ativo'
            else:
                db_carne.status_carne = 'Ativo'
            
            db.add(db_carne)
            db.commit()
            db.refresh(db_carne)


    db.delete(db_pagamento)
    db.commit()
    return db_pagamento


# NOVO: Função para obter relatório de recebimentos por período (RF022)
def get_receipts_report(db: Session, start_date: date, end_date: date):
    # Garante que a end_date inclua todo o dia
    end_of_day_datetime = datetime.combine(end_date, datetime.max.time())

    # Consulta pagamentos dentro do período
    pagamentos_no_periodo = db.query(models.Pagamento).filter(
        models.Pagamento.data_pagamento >= start_date,
        models.Pagamento.data_pagamento <= end_of_day_datetime
    ).options(
        # Carrega a parcela e o carnê/cliente para ter os dados necessários para o relatório
        joinedload(models.Pagamento.parcela).joinedload(models.Parcela.carne).joinedload(models.Carne.cliente)
    ).order_by(models.Pagamento.data_pagamento).all()

    total_recebido = Decimal('0.00')
    report_items = []

    for pagamento in pagamentos_no_periodo:
        total_recebido += pagamento.valor_pago
        
        # Cria um item de relatório com os dados combinados (RF022)
        report_item = schemas.PagamentoReportItem(
            id_pagamento=pagamento.id_pagamento,
            data_pagamento=pagamento.data_pagamento,
            valor_pago=float(pagamento.valor_pago),
            forma_pagamento=pagamento.forma_pagamento,
            observacoes=pagamento.observacoes,
            id_usuario_registro=pagamento.id_usuario_registro,
            parcela_numero=pagamento.parcela.numero_parcela,
            parcela_data_vencimento=pagamento.parcela.data_vencimento,
            cliente_nome=pagamento.parcela.carne.cliente.nome,
            carnes_descricao=pagamento.parcela.carne.descricao,
        )
        report_items.append(report_item)

    return schemas.ReceiptsReportResponse(
        start_date=start_date,
        end_date=end_date,
        total_recebido_periodo=float(total_recebido),
        pagamentos=report_items
    )

# Implementação RF023: Relatório de Dívidas por Cliente
def get_pending_debts_by_client(db: Session, client_id: int):
    # Garante que o cliente existe
    db_client = db.query(models.Cliente).filter(models.Cliente.id_cliente == client_id).first()
    if not db_client:
        return None

    # Busca todas as parcelas pendentes ou atrasadas de um cliente específico
    # Carrega também o carnê associado para a descrição
    pending_parcelas = db.query(models.Parcela).join(models.Carne).filter(
        models.Carne.id_cliente == client_id,
        models.Parcela.status_parcela.in_(['Pendente', 'Atrasada', 'Parcialmente Paga'])
    ).options(
        joinedload(models.Parcela.carne)
    ).order_by(models.Parcela.data_vencimento).all()

    total_divida_pendente = Decimal('0.00')
    report_items = []

    for parcela in pending_parcelas:
        _apply_interest_and_fine_if_due(db, parcela) # Garante que juros/multas estão atualizados
        db.refresh(parcela) # Atualiza o objeto na sessão

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
    
    db.commit() # Comita todas as alterações de juros/multa e status
    
    return schemas.PendingDebtsReportResponse(
        cliente_id=client_id,
        cliente_nome=db_client.nome,
        cliente_cpf_cnpj=db_client.cpf_cnpj,
        total_divida_pendente=float(total_divida_pendente),
        parcelas_pendentes=report_items
    )

# Dashboard Resumido (RF021)
def get_dashboard_summary(db: Session):
    total_clientes = db.query(models.Cliente).count()
    total_carnes = db.query(models.Carne).count()
    total_carnes_ativos = db.query(models.Carne).filter(models.Carne.status_carne.in_(['Ativo', 'Em Atraso', 'Parcialmente Paga'])).count() # Inclui Parcialmente Paga no ativo
    total_carnes_quitados = db.query(models.Carne).filter(models.Carne.status_carne == 'Quitado').count()
    total_carnes_atrasados = db.query(models.Carne).filter(models.Carne.status_carne == 'Em Atraso').count()

    # Dívida geral em aberto (soma de saldos devedores de todas as parcelas não pagas)
    total_divida_geral_aberta = db.query(func.sum(models.Parcela.saldo_devedor)).filter(
        models.Parcela.status_parcela.in_(['Pendente', 'Atrasada', 'Parcialmente Paga'])
    ).scalar() or Decimal('0.00')

    today = date.today()
    start_of_day = datetime.combine(today, datetime.min.time())
    end_of_day = datetime.combine(today, datetime.max.time())

    # Total recebido hoje (RF021)
    total_recebido_hoje = db.query(func.sum(models.Pagamento.valor_pago)).filter(
        models.Pagamento.data_pagamento >= start_of_day,
        models.Pagamento.data_pagamento <= end_of_day
    ).scalar() or Decimal('0.00')

    # Total recebido no mês (RF021)
    first_day_of_month = date(today.year, today.month, 1)
    total_recebido_mes = db.query(func.sum(models.Pagamento.valor_pago)).filter(
        models.Pagamento.data_pagamento >= first_day_of_month,
        models.Pagamento.data_pagamento <= end_of_day # Garante que inclui o dia atual
    ).scalar() or Decimal('0.00')

    # Parcelas a vencer nos próximos 7 dias (excluindo hoje)
    next_7_days = today + timedelta(days=7)
    parcelas_a_vencer_7dias = db.query(models.Parcela).filter(
        models.Parcela.data_vencimento > today,
        models.Parcela.data_vencimento <= next_7_days,
        models.Parcela.status_parcela.in_(['Pendente', 'Parcialmente Paga'])
    ).count()

    # Parcelas atrasadas
    parcelas_atrasadas = db.query(models.Parcela).filter(
        models.Parcela.data_vencimento < today,
        models.Parcela.status_parcela.in_(['Pendente', 'Parcialmente Paga', 'Atrasada']) # Inclui Atrasada para garantir
    ).count()
    
    return schemas.DashboardSummaryResponse(
        total_clientes=total_clientes,
        total_carnes=total_carnes,
        total_carnes_ativos=total_carnes_ativos,
        total_carnes_quitados=total_carnes_quitados,
        total_carnes_atrasados=total_carnes_atrasados,
        total_divida_geral_aberta=float(total_divida_geral_aberta),
        total_recebido_hoje=float(total_recebido_hoje),
        total_recebido_mes=float(total_recebido_mes),
        parcelas_a_vencer_7dias=parcelas_a_vencer_7dias,
        parcelas_atrasadas=parcelas_atrasadas
    )