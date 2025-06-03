import os
import sys
from sqlalchemy.orm import Session

# Adiciona o diretório 'app' ao path do sistema para que possamos importar os módulos
# Isso é necessário porque estamos executando o script de fora do diretório 'app'
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))

from app.database import SessionLocal, engine
from app.models import Base
from app import crud, schemas

# --- DADOS DO PRIMEIRO ADMINISTRADOR ---
# !!! IMPORTANTE: Altere estes valores para o seu admin principal !!!
ADMIN_EMAIL = "luispaulo@gmail.com"
ADMIN_NOME = "Luis Paulo"
ADMIN_SENHA = "Luis#44"

def create_first_admin():
    """
    Função para criar o primeiro usuário administrador no banco de dados.
    """
    print("Iniciando a criação do primeiro administrador...")
    
    # Cria uma sessão com o banco de dados
    db: Session = SessionLocal()

    try:
        # 1. Verifica se o usuário já existe
        print(f"Verificando se o usuário com e-mail '{ADMIN_EMAIL}' já existe...")
        db_user = crud.get_user_by_email(db, email=ADMIN_EMAIL)
        
        if db_user:
            print(f"O usuário administrador com e-mail '{ADMIN_EMAIL}' já existe. Nenhuma ação necessária.")
            return

        # 2. Se não existir, cria o usuário
        print("Usuário não encontrado. Criando um novo administrador...")
        
        user_in = schemas.UserCreate(
            email=ADMIN_EMAIL,
            nome=ADMIN_NOME,
            senha=ADMIN_SENHA,
            perfil="admin" # Garante que o perfil seja 'admin'
        )
        
        user = crud.create_user(db=db, user=user_in)
        
        print("\n" + "="*50)
        print("🎉 Usuário administrador criado com sucesso! 🎉")
        print(f"   Nome: {user.nome}")
        print(f"   E-mail (usuário de login): {user.email}")
        print("   Senha: (a que você definiu no script)")
        print("="*50 + "\n")

    except Exception as e:
        print(f"❌ Ocorreu um erro ao tentar criar o administrador: {e}")
    finally:
        # Fecha a sessão com o banco de dados
        db.close()
        print("Script finalizado.")

if __name__ == "__main__":
    # Garante que as tabelas existam no banco de dados antes de tentar criar o usuário
    # Isso é útil se você estiver executando o script em um banco de dados limpo
    print("Verificando se as tabelas do banco de dados existem...")
    Base.metadata.create_all(bind=engine)
    print("Tabelas verificadas/criadas.")
    
    create_first_admin()