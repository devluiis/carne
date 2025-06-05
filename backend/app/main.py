from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import Base, engine
from app.routers import auth_router, clients_router, carnes_router, reports_router # <<< ADICIONE reports_router AQUI
from app.models import Usuario
from app.routers import auth_router, clients_router, carnes_router, reports_router, produtos_router # <<<< ADICIONE produtos_router

# Cria as tabelas no banco de dados
def create_db_tables():
    Base.metadata.create_all(bind=engine)

app = FastAPI(title="API de Gerenciamento de Carnês de Pagamento")

# --- SEÇÃO DE CONFIGURAÇÃO DO CORS ---
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
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
app.include_router(reports_router.router, tags=["Relatórios e Dashboard"]) # <<< ADICIONE ESTA LINHA
app.include_router(produtos_router.router, prefix="/api", tags=["Produtos"]) # <<<< ADICIONE ESTA LINHA


@app.on_event("startup")
async def startup_event():
    print("Criando tabelas do banco de dados (se não existirem)...")
    create_db_tables()
    print("Tabelas criadas ou já existentes.")

@app.get("/")
async def root():
    return {"message": "Bem-vindo à API de Gerenciamento de Carnês de Pagamento!"}