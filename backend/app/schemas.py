from pydantic import BaseModel, EmailStr, Field
from datetime import datetime, date
from typing import Optional, List
from decimal import Decimal

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

class ClientUpdate(ClientBase):
    nome: Optional[str] = None
    cpf_cnpj: Optional[str] = None

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

class ClientSummaryResponse(ClientResponse):
    total_divida_aberta: float = Field(0.0, description="Soma dos saldos devedores de todas as parcelas pendentes e parcialmente pagas do cliente.")
    total_pago_historico: float = Field(0.0, description="Soma de todos os valores pagos em carnês do cliente.")
    numero_carnes_ativos: int = Field(0, description="Número de carnês com status 'Ativo' ou 'Em Atraso'.")
    numero_carnes_quitados: int = Field(0, description="Número de carnês com status 'Quitado'.")
    numero_carnes_cancelados: int = Field(0, description="Número de carnês com status 'Cancelado'.")

    class Config:
        from_attributes = True


# --- Pagamento (Schema para uso dentro de ParcelaResponse) ---
class PagamentoResponseMin(BaseModel):
    id_pagamento: int
    data_pagamento: datetime
    valor_pago: float
    forma_pagamento: str
    observacoes: Optional[str] = None
    id_usuario_registro: int

    class Config:
        from_attributes = True

# --- Parcela (Schemas) ---
class ParcelaBase(BaseModel):
    id_carne: int
    numero_parcela: int
    valor_devido: float
    data_vencimento: date
    status_parcela: Optional[str] = "Pendente"

class ParcelaCreate(ParcelaBase):
    pass

class ParcelaResponse(ParcelaBase):
    id_parcela: int
    valor_pago: float
    saldo_devedor: float
    data_pagamento_completo: Optional[date] = None
    juros_multa: float
    juros_multa_anterior_aplicada: float = Field(0.00, description="Valor de juros/multa aplicado anteriormente, para cálculo preciso.")
    pagamentos: List[PagamentoResponseMin] = []

    class Config:
        from_attributes = True

# --- Pagamento (Schemas completos para CRUD) ---
class PagamentoCreate(BaseModel):
    id_parcela: int
    valor_pago: float
    forma_pagamento: str = Field(..., description="Forma de pagamento (e.g., 'Dinheiro', 'PIX', 'Cartão')")
    observacoes: Optional[str] = None

class PagamentoResponse(PagamentoCreate):
    id_pagamento: int
    data_pagamento: datetime
    id_usuario_registro: int

    class Config:
        from_attributes = True

# PagamentoResponse com detalhes da parcela e do carnê/cliente para relatórios (RF022)
class PagamentoReportItem(PagamentoResponse):
    cliente_nome: str
    carnes_descricao: Optional[str] = None
    parcela_numero: int
    parcela_data_vencimento: date

    class Config:
        from_attributes = True


# Schema para o Relatório de Recebimentos (RF022)
class ReceiptsReportResponse(BaseModel):
    start_date: date
    end_date: date
    total_recebido_periodo: float
    pagamentos: List[PagamentoReportItem] # Lista dos pagamentos detalhados

    class Config:
        from_attributes = True

# Schema para um item de dívida pendente para o relatório (RF023)
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

# Schema para o Relatório de Dívidas por Cliente (RF023)
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
    data_venda: Optional[date] = None  # <<<< ALTERADO PARA OPCIONAL
    descricao: Optional[str] = None
    valor_total_original: float = Field(..., gt=0)
    numero_parcelas: int = Field(..., gt=0)
    valor_parcela_original: float 
    data_primeiro_vencimento: date
    frequencia_pagamento: str 
    status_carne: Optional[str] = "Ativo" 
    observacoes: Optional[str] = None
    valor_entrada: float = Field(0.00, ge=0)
    forma_pagamento_entrada: Optional[str] = None


class CarneCreate(CarneBase):
    # data_venda já é herdada de CarneBase e definida como obrigatória lá
    pass

class CarneResponse(CarneBase):
    id_carne: int
    data_criacao: datetime # Data de inserção no sistema
    # data_venda é herdada de CarneBase
    cliente: ClientResponseMin
    parcelas: List[ParcelaResponse] = []

    class Config:
        from_attributes = True

# Schema para o Dashboard Resumido (RF021)
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

# --- Schemas Aninhados para Respostas Completas ---
class ClientResponseFull(ClientResponse): # Supondo que você tenha esta definição
    data_cadastro: datetime # Adicionando de volta se estava no seu original
    carnes: List[CarneResponse] = []
    class Config: from_attributes = True


class UserResponseFull(UserResponse): # Supondo que você tenha esta definição
    pagamentos: List[PagamentoResponseMin] = []
    class Config: from_attributes = True