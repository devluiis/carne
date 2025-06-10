from sqlalchemy import Column, Integer, String, Boolean, DateTime, Date, DECIMAL, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class Usuario(Base):
    __tablename__ = "usuario"
    id_usuario = Column(Integer, primary_key=True, index=True)
    nome = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    senha_hash = Column(String(255), nullable=False)
    data_cadastro = Column(DateTime, default=func.now())
    ultimo_login = Column(DateTime)
    ativo = Column(Boolean, default=True)
    perfil = Column(String(50), default='admin', nullable=False)

    pagamentos = relationship("Pagamento", back_populates="usuario_registro")
    # Se um usuário puder cadastrar produtos (opcional):
    # produtos_cadastrados = relationship("Produto", back_populates="cadastrado_por_usuario")

class Cliente(Base):
    __tablename__ = "cliente"
    id_cliente = Column(Integer, primary_key=True, index=True)
    nome = Column(String(255), nullable=False)
    cpf_cnpj = Column(String(20), unique=True, index=True, nullable=False)
    endereco = Column(String(500))
    telefone = Column(String(20))
    email = Column(String(255))
    data_cadastro = Column(DateTime, default=func.now())
    carnes = relationship("Carne", back_populates="cliente", cascade="all, delete-orphan")

class Carne(Base):
    __tablename__ = "carne"
    id_carne = Column(Integer, primary_key=True, index=True)
    id_cliente = Column(Integer, ForeignKey("cliente.id_cliente"), nullable=False)
    data_venda = Column(Date, nullable=True)
    descricao = Column(String(500))
    valor_total_original = Column(DECIMAL(10, 2), nullable=False)
    numero_parcelas = Column(Integer, nullable=False)
    valor_parcela_original = Column(DECIMAL(10, 2), nullable=False) # Este valor agora pode ser a média ou o valor da primeira parcela em carnês fixos, ou o total em carnês não fixos
    data_criacao = Column(DateTime, default=func.now())
    data_primeiro_vencimento = Column(Date, nullable=False)
    frequencia_pagamento = Column(String(50), nullable=False)
    status_carne = Column(String(50), default='Ativo', nullable=False)
    observacoes = Column(String)
    valor_entrada = Column(DECIMAL(10, 2), default=0.00, nullable=False)
    forma_pagamento_entrada = Column(String(50), nullable=True)
    parcela_fixa = Column(Boolean, default=True, nullable=False) # NOVO CAMPO

    cliente = relationship("Cliente", back_populates="carnes", lazy="joined")
    parcelas = relationship("Parcela", back_populates="carne", cascade="all, delete-orphan")

class Parcela(Base):
    __tablename__ = "parcela"
    id_parcela = Column(Integer, primary_key=True, index=True)
    id_carne = Column(Integer, ForeignKey("carne.id_carne"), nullable=False)
    numero_parcela = Column(Integer, nullable=False)
    valor_devido = Column(DECIMAL(10, 2), nullable=False)
    data_vencimento = Column(Date, nullable=False)
    valor_pago = Column(DECIMAL(10, 2), default=0.00, nullable=False)
    saldo_devedor = Column(DECIMAL(10, 2), nullable=False)
    data_pagamento_completo = Column(Date)
    status_parcela = Column(String(50), default='Pendente', nullable=False)
    juros_multa = Column(DECIMAL(10, 2), default=0.00, nullable=False)
    juros_multa_anterior_aplicada = Column(DECIMAL(10, 2), default=0.00, nullable=False)
    # Adicionando campo para observações específicas da parcela
    observacoes = Column(String, nullable=True)

    carne = relationship("Carne", back_populates="parcelas")
    pagamentos = relationship("Pagamento", back_populates="parcela", cascade="all, delete-orphan")

class Pagamento(Base):
    __tablename__ = "pagamento"
    id_pagamento = Column(Integer, primary_key=True, index=True)
    id_parcela = Column(Integer, ForeignKey("parcela.id_parcela"), nullable=False)
    data_pagamento = Column(DateTime, nullable=False) # ALTERADO: Removido default=func.now() para permitir data_pagamento
    valor_pago = Column(DECIMAL(10, 2), nullable=False)
    forma_pagamento = Column(String(50), nullable=False)
    observacoes = Column(String)
    id_usuario_registro = Column(Integer, ForeignKey("usuario.id_usuario"), nullable=False)

    parcela = relationship("Parcela", back_populates="pagamentos")
    usuario_registro = relationship("Usuario", back_populates="pagamentos")

# <<<< NOVO MODELO: Produto >>>>
class Produto(Base):
    __tablename__ = "produto"

    id_produto = Column(Integer, primary_key=True, index=True)
    nome = Column(String(255), nullable=False, index=True)
    descricao = Column(Text, nullable=True)
    categoria = Column(String(100), nullable=True, index=True)
    marca = Column(String(100), nullable=True, index=True)
    imei = Column(String(50), nullable=True, unique=True, index=True)
    codigo_sku = Column(String(50), nullable=True, unique=True, index=True)

    preco_venda = Column(DECIMAL(10, 2), nullable=True) # Pode ser False se obrigatório
    preco_custo = Column(DECIMAL(10, 2), nullable=True) # Pode ser False se obrigatório

    estoque_atual = Column(Integer, nullable=True, default=0)
    unidade_medida = Column(String(20), nullable=True, default="unidade")

    data_cadastro = Column(DateTime, default=func.now())
    # Opcional: Rastrear quem cadastrou
    # id_usuario_cadastro = Column(Integer, ForeignKey("usuario.id_usuario"), nullable=True)
    # cadastrado_por_usuario = relationship("Usuario", back_populates="produtos_cadastrados")