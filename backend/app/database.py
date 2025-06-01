from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.config import DATABASE_URL

# Crie o engine do SQLAlchemy para o PostgreSQL
engine = create_engine(DATABASE_URL)

# Configure a sessão do banco de dados
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base declarativa para seus modelos SQLAlchemy
Base = declarative_base()

# Função de conveniência para obter uma sessão de banco de dados
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()