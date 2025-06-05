import psycopg2

DATABASE_URL_TEST = "postgresql://devuser:devpassword@localhost/carnedb"
# ou, para ter certeza que é idêntico ao que o FastAPI usa:
# from app.config import DATABASE_URL as DATABASE_URL_TEST

print(f"Tentando conectar com: '{DATABASE_URL_TEST}'")

try:
    conn = psycopg2.connect(DATABASE_URL_TEST)
    print("Conexão bem-sucedida!")
    conn.close()
except UnicodeDecodeError as ude:
    print(f"Erro de UnicodeDecodeError ao conectar: {ude}")
    print(f"  Byte problemático: {ude.object[ude.start:ude.end]}")
    print(f"  Posição inicial: {ude.start}")
    print(f"  Posição final: {ude.end}")
    print(f"  Encoding: {ude.encoding}")
    print(f"  Objeto (string) onde ocorreu o erro (primeiros 100 chars): {ude.object[:100]}")
except Exception as e:
    print(f"Outro erro ao conectar: {e}")