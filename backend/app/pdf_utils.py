import io
import base64
import os
from datetime import datetime
import logging
from weasyprint import HTML

logger = logging.getLogger(__name__)

# Configurações para PIX (ajuste conforme necessário)
# Idealmente, estas informações deveriam vir do banco de dados ou variáveis de ambiente.
# Para este exemplo, manteremos como hardcoded, mas considere a parametrização.
beneficiario_nome = "BIOS STORE COMERCIO E SERVICOS LTDA"
beneficiario_cnpj_cpf = "23.888.763/0001-16" # CNPJ ou CPF do beneficiário
pix_key = "23.888.763/0001-16" # Chave PIX (esta chave será apenas texto, não usada para gerar o QR code se ele for estático)
pix_city = "Xambioá - TO" # Cidade do beneficiário

# Obtenha o diretório base do aplicativo para caminhos estáticos
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")

logo_path = os.path.join(STATIC_DIR, "logobios.jpg")
# Caminho para a imagem estática do QR Code
qrcode_static_path = os.path.join(STATIC_DIR, "meu_qrcode_pix.jpeg")

def format_currency(value):
    return f"R$ {value:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")

def format_date(date_str):
    if not date_str:
        return ""
    # Assume date_str is in 'YYYY-MM-DD' format or datetime object
    if isinstance(date_str, str):
        date_obj = datetime.strptime(date_str, '%Y-%m-%d').date()
    elif isinstance(date_str, datetime):
        date_obj = date_str.date()
    else:
        date_obj = date_str # Assume it's already a date object
    return date_obj.strftime('%d/%m/%Y')

def generate_carne_pdf_weasyprint(carne_data: dict, parcels_data: list):
    """
    Gera um PDF de carnê com múltiplas parcelas por página,
    cada uma usando o QR Code estático, usando WeasyPrint.
    """
    nome_cliente = carne_data.get("nome_cliente", "Cliente Não Informado")
    cpf_cnpj_cliente = carne_data.get("cpf_cnpj_cliente", "Não Informado")
    endereco_cliente = carne_data.get("endereco_cliente", "Não Informado")
    descricao_carne = carne_data.get("descricao", "Carnê de Pagamento")
    
    html_parts = []
    carnes_per_page = 2 # Definir quantos carnês por página A4

    for i, parcela in enumerate(parcels_data):
        parcel_id = parcela.get('id_parcela', f'parcela-{i+1}')
        valor_devido = parcela.get('valor_devido', 0.0)
        data_vencimento = format_date(parcela.get('data_vencimento'))
        numero_parcela = parcela.get('numero_parcela')
        
        # Construção do HTML para um carnê individual
        carne_html = f"""
        <div class="carne-item">
            <div class="header-carne">
                <img src="file://{logo_path}" alt="Logo" class="logo">
                <div class="beneficiario-info">
                    <strong>{beneficiario_nome}</strong><br/>
                    CNPJ/CPF: {beneficiario_cnpj_cpf}<br/>
                </div>
            </div>
            <div class="divider"></div>
            <div class="info-block">
                <strong>Cliente:</strong> {nome_cliente}<br/>
                <strong>CPF/CNPJ:</strong> {cpf_cnpj_cliente}<br/>
                <strong>Endereço:</strong> {endereco_cliente}<br/>
                <strong>Descrição do Carnê:</strong> {descricao_carne}
            </div>
            <div class="divider"></div>
            <div class="parcela-details">
                <div class="parcela-main-info">
                    <div class="parcela-box">
                        <span class="label">Parcela</span>
                        <span class="value">{numero_parcela}/{carne_data.get('numero_parcelas')}</span>
                    </div>
                    <div class="parcela-box">
                        <span class="label">Vencimento</span>
                        <span class="value">{data_vencimento}</span>
                    </div>
                    <div class="parcela-box">
                        <span class="label">Valor</span>
                        <span class="value">{format_currency(valor_devido)}</span>
                    </div>
                </div>
                <div class="qr-code-area">
                    <img src="file://{qrcode_static_path}" class="qr-code-img" alt="QR Code Pix">
                    <p class="pix-key-info">Chave Pix: {pix_key}</p>
                    <p class="pix-key-info">Valor da Parcela: {format_currency(valor_devido)}</p>
                    <p class="pix-key-info">Vencimento: {data_vencimento}</p>
                </div>
            </div>
            <div class="divider"></div>
            <div class="footer-carne">
                <p>Corte aqui</p>
                <div class="dashed-line"></div>
            </div>
        </div>
        """
        html_parts.append(carne_html)

    full_html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>Carnê de Pagamento</title>
        <style>
            @page {{
                size: A4;
                margin: 10mm; /* Margens da página */
            }}
            body {{
                font-family: 'Arial', sans-serif;
                margin: 0;
                padding: 0;
            }}
            .carne-container-wrapper {{
                display: flex;
                flex-wrap: wrap;
                justify-content: space-around; /* Distribui os carnês na página */
                align-content: flex-start; /* Alinha o conteúdo ao topo */
                width: 190mm; /* A4 width - 2*margin */
                margin: 0 auto;
            }}
            .carne-item {{
                width: 100%; /* Para 2 carnês por página */
                height: calc((297mm - 20mm - 5mm) / {carnes_per_page}); /* A4 height - 2*margin - spacing / num_carnes */
                border: 1px solid #000;
                padding: 5mm;
                margin-bottom: 5mm; /* Espaçamento entre os carnês */
                box-sizing: border-box;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                font-size: 10pt;
                position: relative;
                page-break-inside: avoid; /* Evita quebras de página dentro de um carnê */
            }}
            /* Se for para 3 carnês por página, ajuste width e height */
            /*
            .carne-item {{
                width: calc( (190mm - 10mm) / 1); Ajuste se precisar de mais colunas
                height: calc((297mm - 20mm - 10mm) / 3);
            }}
            */
            .header-carne {{
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 5mm;
            }}
            .logo {{
                max-width: 80px;
                height: auto;
            }}
            .beneficiario-info {{
                text-align: right;
            }}
            .divider {{
                border-bottom: 1px solid #ccc;
                margin: 5mm 0;
            }}
            .info-block {{
                margin-bottom: 5mm;
            }}
            .parcela-details {{
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                margin-bottom: 5mm;
            }}
            .parcela-main-info {{
                display: flex;
                flex-grow: 1;
                justify-content: space-around;
            }}
            .parcela-box {{
                border: 1px solid #eee;
                padding: 3mm;
                text-align: center;
                margin: 0 2mm;
                flex-basis: 30%; /* Ajuste para espaçamento */
            }}
            .parcela-box .label {{
                display: block;
                font-size: 8pt;
                color: #555;
            }}
            .parcela-box .value {{
                display: block;
                font-size: 12pt;
                font-weight: bold;
            }}
            .qr-code-area {{
                text-align: center;
                margin-left: 10mm;
            }}
            .qr-code-img {{
                width: 70px;
                height: 70px;
                border: 1px solid #eee;
                padding: 2px;
            }}
            .pix-key-info {{
                font-size: 8pt;
                margin-top: 2mm;
                line-height: 1.2;
            }}
            .footer-carne {{
                text-align: center;
                margin-top: auto; /* Empurra para o final do container */
            }}
            .dashed-line {{
                border-top: 1px dashed #000;
                margin-top: 2mm;
            }}
        </style>
    </head>
    <body>
        <div class="carne-container-wrapper">
            {''.join(html_parts)}
        </div>
    </body>
    </html>
    """

    output_buffer = io.BytesIO()
    # Usamos o `base_url` para que o WeasyPrint possa encontrar as imagens referenciadas por `file://`
    HTML(string=full_html_content, base_url=STATIC_DIR).write_pdf(output_buffer)
    output_buffer.seek(0)
    return output_buffer