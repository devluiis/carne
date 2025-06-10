import os
from dotenv import load_dotenv
from typing import Optional

load_dotenv()

# Configurações JWT
SECRET_KEY = os.getenv("SECRET_KEY", "chave-secreta-padrao-para-desenvolvimento")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))

# Configurações do banco de dados
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://devuser:devpassword@localhost/carnedb")

class ConfigError(Exception):
    """Exceção personalizada para erros de configuração"""
    pass

def get_required_env(var_name: str, default: Optional[str] = None) -> str:
    """Obtém variável de ambiente obrigatória com tratamento de erro"""
    value = os.getenv(var_name, default)
    if value is None:
        raise ConfigError(f"Variável de ambiente obrigatória {var_name} não configurada")
    return value

# Configurações principais com validação rigorosa
try:
    SECRET_KEY = get_required_env("SECRET_KEY")
    if len(SECRET_KEY) < 32:
        raise ConfigError("SECRET_KEY deve ter pelo menos 32 caracteres")

    ALGORITHM = get_required_env("ALGORITHM", "HS256").upper()
    valid_algorithms = {"HS256", "HS384", "HS512", "RS256", "RS384", "RS512"}
    if ALGORITHM not in valid_algorithms:
        raise ConfigError(f"Algoritmo inválido. Use um destes: {', '.join(valid_algorithms)}")

    ACCESS_TOKEN_EXPIRE_MINUTES = int(get_required_env("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
    DATABASE_URL = get_required_env("DATABASE_URL")
    
    # Configurações financeiras
    MULTA_ATRASO_PERCENTUAL = float(get_required_env("MULTA_ATRASO_PERCENTUAL", "0"))
    JUROS_MORA_PERCENTUAL_AO_MES = float(get_required_env("JUROS_MORA_PERCENTUAL_AO_MES", "0"))

except (ValueError, ConfigError) as e:
    raise ConfigError(f"Erro na configuração: {str(e)}") from e