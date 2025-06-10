# backend/Dockerfile

# Use uma imagem base oficial do Python para Linux
FROM python:3.11-slim-bookworm

# Define o diretório de trabalho dentro do contêiner
WORKDIR /app

# Copia o arquivo requirements.txt para o diretório de trabalho
COPY requirements.txt .

# Instala as dependências do sistema operacional que weasyprint/reportlab podem precisar
# Estas são comuns para weasyprint em ambientes Debian/Ubuntu (bookworm é Debian)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    build-essential \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libgdk-pixbuf2.0-0 \
    libcairo2 \
    libffi-dev \
    # Outras libs que podem ser necessárias dependendo do reportlab e pillow
    libjpeg-dev \
    zlib1g-dev \
    # Limpa o cache apt para reduzir o tamanho da imagem
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Instala as dependências Python
RUN pip install --no-cache-dir -r requirements.txt

# Copia o restante do seu código da aplicação
# Assumindo que a estrutura do seu projeto é /backend/app/...
COPY ./app /app/app
COPY ./alembic /app/alembic
COPY alembic.ini .
COPY .env . # Se você usa .env no deploy, copie-o (com cuidado para não expor segredos)

# Cria a pasta static para os assets
RUN mkdir -p /app/app/static

# Copia os arquivos estáticos (logo e qrcode)
COPY ./app/static/logobios.jpg /app/app/static/
COPY ./app/static/meu_qrcode_pix.jpeg /app/app/static/

# Expõe a porta que a aplicação FastAPI vai usar (Render usa $PORT)
EXPOSE 8000

# Comando para rodar as migrações do Alembic e iniciar o Uvicorn
# Certifique-se de que o Alembic.ini está no diretório de trabalho para que alembic funcione
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT"]