# backend/app/schemas.py
from pydantic import BaseModel, EmailStr, Field
from datetime import datetime, date
from typing import Optional, List
from decimal import Decimal # Importado Decimal

# --- Usuário ---
class UserBase(BaseModel):
    email: EmailStr
    nome: str
    perfil: Optional[str] = "atendente"

class UserCreate(UserBase):
    senha: str = Field(..., min_length=6)

class UserUpdate(BaseModel):
    nome: Optional[str] = None
    email: Optional[EmailStr] = None

class UserResponse(UserBase):
    id_usuario: int
    data_cadastro: datetime
    ultimo_login: Optional[datetime] = None
    ativo: bool

    class Config:
        from_attributes = True

class UserLogin(BaseModel):
    email: EmailStr
    senha: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user_data: UserResponse

class TokenData(BaseModel):
    email: Optional[str] = None

class UserRegisterAdmin(BaseModel):
    email: EmailStr
    nome: str
    senha: str = Field(..., min_length=6)
    perfil: str = Field('admin', pattern=r"^(admin|atendente)$", description="Perfil do usuário (admin ou atendente)")

# --- Cliente ---
class ClientBase(BaseModel):
    nome: str
    cpf_cnpj: str = Field(..., max_length=20)
    endereco: Optional[str] = None
    telefone: Optional[str] = None
    email: Optional[EmailStr] = None

class ClientCreate(ClientBase):
    pass

class ClientUpdate(ClientBase): # Baseado no seu upload, ClientUpdate herda de ClientBase
    nome: Optional[str] = None # Tornando explícito que podem ser opcionais aqui
    cpf_cnpj: Optional[str] = Field(None, max_length=20)
    # endereco, telefone, email já são Optional em ClientBase

class ClientResponse(ClientBase):
    id_cliente: int
    data_cadastro: datetime

    class Config:
        from_attributes = True

class ClientResponseMin(BaseModel):
    id_cliente: int
    nome: str
    cpf_cnpj: str

    class Config:
        from_attributes = True

class ClientSummaryResponse(ClientResponse): # ClientResponse já tem os campos base
    total_divida_aberta: float = Field(0.0)
    total_pago_historico: float = Field(0.0)
    numero_carnes_ativos: int = Field(0)
    numero_carnes_quitados: int = Field(0)
    numero_carnes_cancelados: int = Field(0)

    class Config:
        from_attributes = True


# --- Pagamento (Schema para uso dentro de ParcelaResponse) ---
class PagamentoResponseMin(BaseModel):
    id_pagamento: int
    data_pagamento: datetime
    valor_pago: float # Pydantic converterá Decimal para float na serialização
    forma_pagamento: str
    observacoes: Optional[str] = None
    id_usuario_registro: int
    # Adicionar campos extras para o histórico de pagamentos consolidado
    parcela_numero: Optional[int] = None
    parcela_data_vencimento: Optional[date] = None
    usuario_registro_nome: Optional[str] = None

    class Config:
        from_attributes = True

# --- Parcela (Schemas) ---
class ParcelaBase(BaseModel):
    id_carne: int
    numero_parcela: int
    valor_devido: float
    data_vencimento: date
    status_parcela: Optional[str] = "Pendente"
    # Campo adicionado para observações da parcela
    observacoes: Optional[str] = None

class ParcelaCreate(ParcelaBase):
    pass

class ParcelaResponse(ParcelaBase):
    id_parcela: int
    valor_pago: float
    saldo_devedor: float
    data_pagamento_completo: Optional[date] = None
    juros_multa: float
    juros_multa_anterior_aplicada: float = Field(0.00)
    pagamentos: List[PagamentoResponseMin] = [] # Esta lista é de pagamentos da PARCELA específica

    # Campos adicionais para o PDF, podem ser calculados no CRUD
    juros_multa_percentual: Optional[float] = None
    juros_mora_percentual_ao_dia: Optional[float] = None
    # observacoes: Optional[str] = None # Já existe em ParcelaBase

    class Config:
        from_attributes = True

# NOVO SCHEMA PARA RENEGOCIAÇÃO DE PARCELA
class ParcelaRenegotiate(BaseModel):
    new_data_vencimento: date
    new_valor_devido: Optional[float] = None # Para permitir ajuste de valor, se aplicável
    status_parcela_apos_renegociacao: Optional[str] = "Renegociada" # Ou "Pendente"

# --- Pagamento (Schemas completos para CRUD) ---
class PagamentoCreate(BaseModel):
    id_parcela: int
    valor_pago: float
    forma_pagamento: str = Field(..., description="Forma de pagamento (e.g., 'Dinheiro', 'PIX', 'Cartão')")
    observacoes: Optional[str] = None
    data_pagamento: Optional[datetime] = None # ALTERADO: Campo opcional para a data do pagamento

class PagamentoResponse(PagamentoCreate):
    id_pagamento: int
    data_pagamento: datetime
    id_usuario_registro: int

    class Config:
        from_attributes = True

class PagamentoReportItem(PagamentoResponse):
    cliente_nome: str
    carnes_descricao: Optional[str] = None
    parcela_numero: int
    parcela_data_vencimento: date

    class Config:
        from_attributes = True

class ReceiptsReportResponse(BaseModel):
    start_date: date
    end_date: date
    total_recebido_periodo: float
    pagamentos: List[PagamentoReportItem]

    class Config:
        from_attributes = True

class PendingDebtItem(BaseModel):
    id_parcela: int
    numero_parcela: int
    valor_devido: float
    valor_pago: float
    saldo_devedor: float
    juros_multa: float
    data_vencimento: date
    status_parcela: str
    id_carne: int
    carnes_descricao: Optional[str] = None
    carne_status: str

    class Config:
        from_attributes = True

class PendingDebtsReportResponse(BaseModel):
    cliente_id: int
    cliente_nome: str
    cliente_cpf_cnpj: str
    total_divida_pendente: float
    parcelas_pendentes: List[PendingDebtItem]

    class Config:
        from_attributes = True

# --- Carne (Schemas) ---
class CarneBase(BaseModel):
    id_cliente: int
    data_venda: date
    descricao: Optional[str] = None
    valor_total_original: float = Field(..., gt=0)
    numero_parcelas: int = Field(..., gt=0)
    valor_parcela_sugerido: Optional[float] = Field(None, gt=0, description="Valor sugerido para cada parcela pelo usuário.") # NOVO CAMPO
    data_primeiro_vencimento: date
    frequencia_pagamento: str
    status_carne: Optional[str] = "Ativo"
    observacoes: Optional[str] = None
    valor_entrada: float = Field(0.00, ge=0)
    forma_pagamento_entrada: Optional[str] = None
    parcela_fixa: Optional[bool] = True # NOVO CAMPO: Indica se as parcelas têm valor fixo ou flexível

class CarneCreate(CarneBase):
    pass

# NOVO SCHEMA: CarneUpdate - para atualizar um carnê
class CarneUpdate(CarneBase):
    id_cliente: Optional[int] = None # Tornar opcionais para atualização
    data_venda: Optional[date] = None
    descricao: Optional[str] = None
    valor_total_original: Optional[float] = Field(None, gt=0)
    numero_parcelas: Optional[int] = Field(None, gt=0)
    valor_parcela_sugerido: Optional[float] = Field(None, gt=0, description="Valor sugerido para cada parcela pelo usuário.")
    data_primeiro_vencimento: Optional[date] = None
    frequencia_pagamento: Optional[str] = None
    status_carne: Optional[str] = None
    observacoes: Optional[str] = None
    valor_entrada: Optional[float] = Field(None, ge=0)
    forma_pagamento_entrada: Optional[str] = None
    parcela_fixa: Optional[bool] = None

class CarneResponse(CarneBase):
    id_carne: int
    data_criacao: datetime
    valor_parcela_original: float # Este é o valor da parcela calculado ou o valor total para carnê flexível
    cliente: ClientResponseMin
    # Mudei de PagamentoResponse para PagamentoResponseMin para garantir que os campos extras sejam aceitos
    # Esta lista representa TODOS os pagamentos do carnê, consolidados das parcelas.
    pagamentos: List[PagamentoResponseMin] = [] 
    parcelas: List[ParcelaResponse] = [] # Esta lista é das parcelas do carnê

    class Config:
        from_attributes = True

class DashboardSummaryResponse(BaseModel):
    total_clientes: int
    total_carnes: int
    total_carnes_ativos: int
    total_carnes_quitados: int
    total_carnes_atrasados: int
    total_divida_geral_aberta: float
    total_recebido_hoje: float
    total_recebido_mes: float
    parcelas_a_vencer_7dias: int
    parcelas_atrasadas: int

    class Config:
        from_attributes = True

# --- Schemas Aninhados para Respostas Completas (conforme seu último upload) ---
class ClientResponseFull(ClientResponse): # ClientResponse já herda de ClientBase
    # data_cadastro já está em ClientResponse via ClientBase
    carnes: List[CarneResponse] = []
    class Config: from_attributes = True

class UserResponseFull(UserResponse): # UserResponse já herda de UserBase
    pagamentos: List[PagamentoResponseMin] = []
    class Config: from_attributes = True


# <<<< NOVOS SCHEMAS PARA PRODUTO >>>>
class ProdutoBase(BaseModel):
    nome: str = Field(..., min_length=1, max_length=255)
    descricao: Optional[str] = None
    categoria: Optional[str] = Field(None, max_length=100)
    marca: Optional[str] = Field(None, max_length=100)
    imei: Optional[str] = Field(None, max_length=50) # Não é unique no schema, o DB garante
    codigo_sku: Optional[str] = Field(None, max_length=50) # Não é unique no schema, o DB garante
    preco_venda: Optional[Decimal] = Field(None, ge=0, description="Preço de venda ao cliente")
    preco_custo: Optional[Decimal] = Field(None, ge=0, description="Preço de custo para a loja")
    estoque_atual: Optional[int] = Field(0, ge=0, description="Quantidade em estoque")
    unidade_medida: Optional[str] = Field("unidade", max_length=20, description="Unidade de medida (un, pç, kg, etc.)")

class ProdutoCreate(ProdutoBase):
    pass

class ProdutoUpdate(ProdutoBase):
    nome: Optional[str] = Field(None, min_length=1, max_length=255)

class ProdutoResponse(ProdutoBase):
    id_produto: int
    data_cadastro: datetime

    class Config:
        from_attributes = True