import os
from dotenv import load_dotenv

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 30))
DATABASE_URL = os.getenv("DATABASE_URL")

# NOVO: Configurações para Juros e Multas (RF018)
MULTA_ATRASO_PERCENTUAL = float(os.getenv("MULTA_ATRASO_PERCENTUAL", 2.0)) # Ex: 2.0 para 2%
JUROS_MORA_PERCENTUAL_AO_MES = float(os.getenv("JUROS_MORA_PERCENTUAL_AO_MES", 1.0)) # Ex: 1.0 para 1% ao mês