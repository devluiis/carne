# backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import Base, engine
from app.routers import auth_router, clients_router, carnes_router, reports_router

# IMPORTES NECESSÁRIOS PARA SERVIR ARQUIVOS ESTÁTICOS
from fastapi.staticfiles import StaticFiles
import os
# from fastapi.responses import FileResponse # Não é estritamente necessário se html=True em StaticFiles cobre o index.html

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
    "http://localhost:5173",    # Frontend Vite em desenvolvimento
    "http://127.0.0.1:5173",   # Frontend Vite em desenvolvimento
    "http://localhost:3000",    # Outra porta comum para frontend dev
    "http://127.0.0.1:3000",
    # Adicione aqui o URL do seu frontend no Netlify/produção quando tiver, ex:
    # "https://seusite.netlify.app"
    "http://localhost:8000", # Adicione o próprio backend se o frontend for servido por ele
    "http://127.0.0.1:8000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# --- FIM DA SEÇÃO DE CONFIGURAÇÃO DO CORS ---


# Inclui os routers da API PRIMEIRO
# Os prefixos e tags já estão definidos dentro de cada arquivo de router.
app.include_router(auth_router.router)
app.include_router(clients_router.router)
app.include_router(carnes_router.router)
app.include_router(reports_router.router)


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