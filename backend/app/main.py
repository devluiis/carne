# backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import Base, engine

from app.routers import auth_router, clients_router, carnes_router, reports_router
from app.models import Usuario
from app.routers import auth_router, clients_router, carnes_router, reports_router, produtos_router

# IMPORTES NECESSÁRIOS PARA SERVIR ARQUIVOS ESTÁTICOS
from fastapi.staticfiles import StaticFiles
import os
import sys # Importa o módulo sys

# NOVO: TENTA ADICIONAR O DIRETÓRIO site-packages DO AMBIENTE VIRTUAL AO PATH
# Isso é um fallback para resolver ModuleNotFoundError em ambientes de deploy problemáticos.
# O Render instala as libs em /opt/render/project/src/.venv/lib/python3.11/site-packages
try:
    VENV_SITE_PACKAGES = os.path.join(os.environ.get('VIRTUAL_ENV', '/opt/render/project/src/.venv'), 'lib', f'python{sys.version_info.major}.{sys.version_info.minor}', 'site-packages')
    if os.path.exists(VENV_SITE_PACKAGES) and VENV_SITE_PACKAGES not in sys.path:
        sys.path.insert(0, VENV_SITE_PACKAGES)
        print(f"DEBUG: Adicionado {VENV_SITE_PACKAGES} ao sys.path para resolução de módulos.")
    else:
        print(f"DEBUG: Não foi possível adicionar {VENV_SITE_PACKAGES} ao sys.path ou já estava presente.")
except Exception as e:
    print(f"ERRO DEBUG: Falha ao tentar adicionar site-packages ao sys.path: {e}")


# NOVO: Criação da pasta 'static' se não existir para o logo
static_folder_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")
if not os.path.exists(static_folder_path):
    os.makedirs(static_folder_path)
    print(f"Pasta 'static' criada em: {static_folder_path}")
# Certifique-se de ter um arquivo 'logo.png' dentro desta pasta 'static' no backend/app/static/


# Cria as tabelas no banco de dados
def create_db_tables():
    Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="API de Gerenciamento de Carnês de Pagamento",
    description="API para gerenciar clientes, carnês, parcelas e pagamentos.",
    version="1.0.0"
)

# --- SEÇÃO DE CONFIGURAÇÃO DO CORS ---
origins = [
    "https://biosxambioa.netlify.app",    # SEU DOMÍNIO DO NETLIFY
    "http://localhost:5173",            # Para desenvolvimento local do frontend
    "http://localhost:8000",            # Para desenvolvimento local do backend/Swagger
    "https://carne.onrender.com"        # Seu próprio domínio do backend (opcional, mas boa prática para requests internas)
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# --- FIM DA SEÇÃO DE CONFIGURAÇÃO DO CORS ---



# Inclui os routers da API
app.include_router(auth_router.router, tags=["Autenticação"])
app.include_router(clients_router.router, tags=["Clientes"])
app.include_router(carnes_router.router, tags=["Carnês"])
app.include_router(reports_router.router, tags=["Relatórios e Dashboard"])
app.include_router(produtos_router.router, prefix="/api", tags=["Produtos"])


@app.on_event("startup")
async def startup_event():
    print("Criando tabelas do banco de dados (se não existirem)...")
    create_db_tables()
    print("Tabelas verificadas/criadas.")

# Rota de status da API (opcional, mas útil)
@app.get("/api-status", tags=["Status"])
async def api_status_check():
    return {"message": "API de Gerenciamento de Carnês de Pagamento está operacional!"}


# --- SERVIR ARQUIVOS ESTÁTICOS DO FRONTEND ---
# Esta seção deve vir DEPOIS de incluir os routers da API para que as rotas da API
# tenham prioridade sobre o "catch-all" do StaticFiles.

# Define o caminho para a pasta 'dist' do seu build do frontend.
# Este caminho é relativo à localização do arquivo main.py (backend/app/main.py)
frontend_build_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist"))

if not os.path.exists(frontend_build_path):
    print(f"AVISO: Diretório de build do frontend não encontrado em '{frontend_build_path}'. O frontend não será servido pela API na raiz.")
    # Se o frontend não for encontrado, você pode ter uma rota raiz de fallback para a API
    @app.get("/", tags=["Status"])
    async def root_fallback_api_message():
        return {"message": "Frontend não encontrado. API está operacional. Acesse /docs ou /api-status."}
else:
    print(f"Servindo frontend de: {frontend_build_path}")
    # Monta os arquivos estáticos. O html=True serve o index.html para rotas não encontradas (bom para SPAs)
    # e o index.html será servido para a rota "/"
    app.mount("/", StaticFiles(directory=frontend_build_path, html=True), name="static-frontend")