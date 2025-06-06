import os
from pathlib import Path
from datetime import datetime, date
from app import models # Para type hinting
from sqlalchemy.orm import Session # Para type hinting
from app.config import DATABASE_URL # Apenas para exemplo, não usado diretamente aqui
import qrcode
import io
import base64 # Importar para conversão para base64
from weasyprint import HTML, CSS # Importar WeasyPrint

# Informações da Loja
STORE_NAME = "Bios Store"
STORE_CNPJ = "23.123.123/0001-01"
STORE_ADDRESS = "Rua José Bonifácio nº 27"
STORE_PHONE = "(63) 99285-1025"
STORE_EMAIL = "leandroxam@hotmail.com"

# Caminho para o logo - Ajuste se o nome/local do seu logo for diferente
LOGO_PATH = Path(__file__).resolve().parent / "static" / "logobios.jpg"

# CNPJ PIX Constante (para ser usado no QR Code)
PIX_CNPJ_CONSTANT = "23888763000116"

# Função auxiliar para converter imagem para Base64
def image_to_base64(image_path):
    if os.path.exists(str(image_path)):
        with open(str(image_path), "rb") as image_file:
            encoded_string = base64.b64encode(image_file.read()).decode('utf-8')
            return f"data:image/jpeg;base64,{encoded_string}" # Ajuste o tipo MIME (jpeg/png) conforme sua imagem
    return None

def generate_qr_code_base64(content, size_pixels=128):
    try:
        qr_img = qrcode.make(content, box_size=3) # box_size para controlar o tamanho
        buffer = io.BytesIO()
        qr_img.save(buffer, format="PNG") 
        encoded_string = base64.b64encode(buffer.getvalue()).decode('utf-8')
        return f"data:image/png;base64,{encoded_string}"
    except Exception as e:
        print(f"Erro ao gerar QR Code para '{content}': {e}")
        return None


def generate_carne_pdf_bytes(db_carne: models.Carne) -> bytes:
    # DEBUG: Dados do Carnê (manter temporariamente para depuração)
    print(f"DEBUG: Dados do Carnê recebidos para PDF: ID={db_carne.id_carne}, Cliente={db_carne.cliente.nome if db_carne.cliente else 'N/A'}, Parcelas={len(db_carne.parcelas) if db_carne.parcelas else 0}")
    print(f"DEBUG: Descricao do Carne: {db_carne.descricao}")
    print(f"DEBUG: Valor Total Original: {db_carne.valor_total_original}")

    # Converter logo para base64
    logo_base64 = image_to_base64(LOGO_PATH)
    logo_html = f'<img class="logo" src="{logo_base64}">' if logo_base64 else '<div class="logo-placeholder">Logo não encontrada</div>'

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>Carnê de Pagamento - {db_carne.descricao}</title>
        <style>
            body {{ font-family: 'Arial', sans-serif; font-size: 10pt; margin: 15mm; }}
            .page {{ page-break-after: always; padding: 10mm; }}
            .page:last-child {{ page-break-after: avoid; }}
            .header-info {{ overflow: hidden; margin-bottom: 20px; border-bottom: 1px solid #ccc; padding-bottom: 10px; }}
            .logo {{ width: 60px; float: left; margin-right: 15px; border: 1px solid #eee; padding: 5px; }}
            .store-details {{ float: left; margin-top: -5px; }} /* Ajustar se precisar alinhar com logo */
            .store-details h1 {{ font-size: 14pt; margin: 0 0 5px 0; }}
            .store-details p {{ font-size: 8pt; margin: 0 0 2px 0; }}
            
            .title {{ text-align: center; font-size: 16pt; font-weight: bold; margin: 20px 0; }}
            
            .section {{ margin-bottom: 15px; border: 1px solid #eee; padding: 10px; background-color: #f9f9f9; border-radius: 5px; }}
            .section h3 {{ font-size: 11pt; margin-top: 0; margin-bottom: 10px; border-bottom: 1px solid #ddd; padding-bottom: 5px; }}
            .section p {{ margin: 0 0 5px 0; }}

            .terms {{ margin-top: 20px; }}
            .terms h3 {{ text-align: center; font-size: 11pt; margin-bottom: 10px; }}
            .signature-line {{ text-align: center; margin-top: 40px; margin-bottom: 5px; }}
            .signature-line span {{ border-bottom: 1px solid black; padding: 0 50px; display: inline-block; }}
            .signature-name {{ text-align: center; font-size: 9pt; margin: 0; }}
            .signature-cpf {{ text-align: center; font-size: 9pt; margin: 0; }}
            .signature-date {{ text-align: left; font-size: 9pt; margin-top: 20px; }}

            .installment-card {{
                border: 1px solid #000; /* Borda da parcela */
                padding: 10px;
                margin-bottom: 15px;
                overflow: hidden; /* Para float */
                position: relative; /* Para posicionar QR */
                min-height: 120px; /* Altura mínima para o conteúdo */
            }}
            .installment-details {{
                float: left;
                width: 70%; /* Largura dos detalhes */
            }}
            .qr-container {{
                float: right;
                width: 25%; /* Largura do QR */
                text-align: center;
            }}
            .qr-code-img {{
                width: 80px; /* Tamanho fixo para o QR */
                height: 80px;
            }}
            .qr-code-label {{ font-size: 7pt; margin-top: 5px; }}
            .received-signature {{ text-align: center; margin-top: 20px; }}
            .received-signature span {{ border-bottom: 1px solid black; padding: 0 40px; display: inline-block; }}
            .received-label {{ font-size: 8pt; margin-top: 5px; }}
            
            /* Rodapé de página - Apenas para numerar */
            @page {{
                @bottom-center {{ content: "Página " counter(page) " de " counter(pages); }}
            }}
        </style>
    </head>
    <body>
    """

    # --- PRIMEIRA PÁGINA: Resumo do Carnê ---
    html_content += f"""
        <div class="page">
            <div class="header-info">
                {logo_html}
                <div class="store-details">
                    <h1>{STORE_NAME}</h1>
                    <p>CNPJ: {STORE_CNPJ}</p>
                    <p>{STORE_ADDRESS}</p>
                    <p>Tel: {STORE_PHONE} | Email: {STORE_EMAIL}</p>
                </div>
            </div>
            <h2 class="title">CARNÊ DE PAGAMENTO</h2>

            <div class="section">
                <h3>Dados do Cliente</h3>
                <p><strong>Nome:</strong> {db_carne.cliente.nome}</p>
                <p><strong>CPF/CNPJ:</strong> {db_carne.cliente.cpf_cnpj}</p>
                <p><strong>Endereço:</strong> {db_carne.cliente.endereco or 'N/A'}</p>
                <p><strong>Telefone:</strong> {db_carne.cliente.telefone or 'N/A'}</p>
            </div>

            <div class="section">
                <h3>Detalhes do Carnê</h3>
                <p><strong>Descrição:</strong> {db_carne.descricao or 'N/A'}</p>
                <p><strong>Valor Total Original:</strong> R$ {db_carne.valor_total_original:.2f}".replace('.', ',')</p>
                <p><strong>Valor de Entrada:</strong> R$ {db_carne.valor_entrada:.2f}".replace('.', ',')</p>
                <p><strong>Forma Pag. Entrada:</strong> {db_carne.forma_pagamento_entrada or 'N/A'}</p>
                <p><strong>Valor a Parcelar:</strong> R$ {(db_carne.valor_total_original - (db_carne.valor_entrada or 0)):.2f}".replace('.', ',')</p>
                <p><strong>Número de Parcelas:</strong> {db_carne.numero_parcelas}</p>
                <p><strong>Valor da Parcela Original:</strong> R$ {db_carne.valor_parcela_original:.2f}".replace('.', ',')</p>
                <p><strong>Primeiro Vencimento:</strong> {db_carne.data_primeiro_vencimento.strftime('%d/%m/%Y')}</p>
                <p><strong>Frequência:</strong> {db_carne.frequencia_pagamento.capitalize()}</p>
                <p><strong>Observações:</strong> {db_carne.observacoes or 'N/A'}</p>
            </div>

            <div class="section terms">
                <h3>Termos e Assinatura do Devedor</h3>
                <p>Declaro que recebi o(s) produto(s) e/ou serviço(s) referente(s) a este carnê e concordo com os termos de pagamento aqui estabelecidos. O não pagamento de qualquer parcela na data de vencimento implicará na cobrança de multa e juros conforme legislação vigente e/ou contrato.</p>
                <div class="signature-line"><span></span></div>
                <p class="signature-name">{db_carne.cliente.nome}</p>
                <p class="signature-cpf">CPF/CNPJ: {db_carne.cliente.cpf_cnpj}</p>
                <p class="signature-date">Data: ___/___/_____</p>
            </div>
        </div>
    """

    # --- SEÇÕES: PARCELAS INDIVIDUAIS (cada uma em sua própria página) ---
    if db_carne.parcelas:
        sorted_parcelas = sorted(db_carne.parcelas, key=lambda p: p.numero_parcela)
        
        for i, parcela in enumerate(sorted_parcelas):
            qr_data_content = f"pix_cnpj={PIX_CNPJ_CONSTANT}&valor={parcela.valor_devido:.2f}&parcela={parcela.numero_parcela}&carne_id={parcela.id_carne}"
            qr_base64 = generate_qr_code_base64(qr_data_content)
            qr_html = f'<div class="qr-container"><img class="qr-code-img" src="{qr_base64}" /><div class="qr-code-label">Scan para pagar!</div></div>' if qr_base64 else '<div class="qr-container"><p>QR Code não gerado</p></div>'

            html_content += f"""
                <div class="page-break"></div>
                <div class="page">
                    <div class="header-info">
                        {logo_html}
                        <div class="store-details">
                            <h1>{STORE_NAME}</h1>
                            <p>CNPJ: {STORE_CNPJ}</p>
                            <p>Endereço: {STORE_ADDRESS}</p>
                            <p>Tel: {STORE_PHONE} | Email: {STORE_EMAIL}</p>
                        </div>
                    </div>
                    <h2 class="title">COMPROVANTE DE PAGAMENTO - PARCELA</h2>

                    <div class="installment-card">
                        <div class="installment-details">
                            <h3>Parcela {parcela.numero_parcela} / {db_carne.numero_parcelas}</h3>
                            <p><strong>Carnê ID:</strong> {parcela.id_carne} - {db_carne.descricao or 'N/A'}</p>
                            <p><strong>Cliente:</strong> {db_carne.cliente.nome}</p>
                            <p><strong>CPF/CNPJ:</strong> {db_carne.cliente.cpf_cnpj}</p>
                            <p><strong>Valor Devido:</strong> R$ {parcela.valor_devido:.2f}".replace('.', ',')</p>
                            <p><strong>Vencimento:</strong> {parcela.data_vencimento.strftime('%d/%m/%Y')}</p>
                            <p><strong>Juros/Multa:</strong> R$ {parcela.juros_multa:.2f}".replace('.', ',')</p>
                            <p><strong>Saldo Devedor:</strong> R$ {parcela.saldo_devedor:.2f}".replace('.', ',')</p>
                            <p><strong>Status:</strong> {parcela.status_parcela}</p>
                            <p><strong>PIX CNPJ:</strong> {PIX_CNPJ_CONSTANT}</p>
                        </div>
                        {qr_html}
                    </div>

                    <div class="received-signature">
                        <span></span>
                        <p class="received-label">Assinatura do Recebedor</p>
                    </div>
                    <p class="signature-date" style="text-align: left;">Data do Pagamento: ___/___/_____</p>
                </div>
            """
    else:
        html_content += """
        <div class="page-break"></div>
        <div class="page">
            <h2 class="title">Nenhuma parcela gerada para este carnê.</h2>
        </div>
        """
    
    html_content += """
    </body>
    </html>
    """

    # Geração do PDF com WeasyPrint
    html = HTML(string=html_content, base_url=os.path.dirname(os.path.abspath(__file__)))
    # WeasyPrint pode precisar de um CSS para fontes ou outras coisas.
    # Se precisar de um arquivo CSS separado:
    # css_file_path = Path(__file__).resolve().parent / "static" / "styles.css"
    # if os.path.exists(str(css_file_path)):
    #     css = CSS(filename=str(css_file_path))
    #     pdf_bytes = html.write_pdf(stylesheets=[css])
    # else:
    #     pdf_bytes = html.write_pdf()

    pdf_bytes = html.write_pdf() # Gera o PDF em bytes

    return pdf_bytes