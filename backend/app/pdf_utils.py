import os
from pathlib import Path
from datetime import datetime, date
from app import models
from sqlalchemy.orm import Session # Mantido para type hinting, embora não usado diretamente
import qrcode
import io
import base64
from weasyprint import HTML, CSS # Importar WeasyPrint

# Informações da Loja
STORE_NAME = "Bios Store"
STORE_CNPJ = "23.123.123/0001-01"
STORE_ADDRESS = "Rua José Bonifácio nº 27"
STORE_PHONE = "(63) 99285-1025"
STORE_EMAIL = "leandroxam@hotmail.com"

# Caminho para o logo
LOGO_PATH = Path(__file__).resolve().parent / "static" / "logobios.jpg"

# CNPJ PIX Constante (para ser usado no QR Code)
PIX_CNPJ_CONSTANT = "23888763000116"

# Função auxiliar para converter imagem para Base64
def image_to_base64(image_path, image_format="jpeg"):
    if os.path.exists(str(image_path)):
        try:
            with open(str(image_path), "rb") as image_file:
                encoded_string = base64.b64encode(image_file.read()).decode('utf-8')
                return f"data:image/{image_format};base64,{encoded_string}"
        except Exception as e:
            print(f"Erro ao ler imagem {image_path}: {e}")
            return None
    return None

def generate_qr_code_base64(content, box_size=3, border=4):
    try:
        qr_img = qrcode.make(content, box_size=box_size, border=border)
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
    logo_base64 = image_to_base64(LOGO_PATH, "jpeg") # Assegure o formato correto da sua logo
    logo_html = f'<img class="logo" src="{logo_base64}">' if logo_base64 else '<div class="logo-placeholder">Logo não encontrada</div>'

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>Carnê de Pagamento - {db_carne.descricao}</title>
        <style>
            body {{ font-family: 'Arial', sans-serif; font-size: 10pt; margin: 10mm; }} /* Reduzir margem para mais espaço */
            .page {{ page-break-after: always; padding: 5mm; }} /* Reduzir padding */
            .page:last-child {{ page-break-after: avoid; }}
            
            .header-info {{ overflow: hidden; margin-bottom: 10px; border-bottom: 1px solid #ccc; padding-bottom: 5px; }}
            .logo {{ width: 50px; height: auto; float: left; margin-right: 10px; }} /* Ajustar tamanho da logo */
            .logo-placeholder {{ width: 50px; height: 50px; float: left; margin-right: 10px; border: 1px dashed gray; text-align: center; line-height: 50px; font-size: 7pt; }}
            .store-details {{ float: left; margin-top: -5px; }}
            .store-details h1 {{ font-size: 12pt; margin: 0 0 3px 0; }} /* Ajustar fonte */
            .store-details p {{ font-size: 7pt; margin: 0 0 1px 0; }} /* Ajustar fonte */
            
            .title {{ text-align: center; font-size: 14pt; font-weight: bold; margin: 10px 0; }} /* Ajustar fonte */
            
            .section {{ margin-bottom: 10px; border: 1px solid #eee; padding: 8px; background-color: #f9f9f9; border-radius: 5px; }} /* Reduzir padding */
            .section h3 {{ font-size: 10pt; margin-top: 0; margin-bottom: 5px; border-bottom: 1px solid #ddd; padding-bottom: 3px; }} /* Ajustar fonte */
            .section p {{ font-size: 9pt; margin: 0 0 3px 0; }} /* Ajustar fonte */

            .terms {{ margin-top: 15px; }}
            .terms h3 {{ text-align: center; font-size: 10pt; margin-bottom: 8px; }}
            .terms p {{ font-size: 8pt; }} /* Ajustar fonte */
            .signature-line {{ text-align: center; margin-top: 25px; margin-bottom: 3px; }}
            .signature-line span {{ border-bottom: 1px solid black; padding: 0 40px; display: inline-block; }}
            .signature-name, .signature-cpf, .signature-date {{ text-align: center; font-size: 8pt; margin: 0; }}
            .signature-date {{ text-align: left; margin-top: 10px; }}

            /* Layout para 3 comprovantes por página */
            .installments-grid {{
                display: flex; /* Usar flexbox */
                flex-wrap: wrap; /* Quebrar para a próxima linha */
                justify-content: space-between; /* Espaço entre os itens */
                align-content: flex-start; /* Alinhar ao topo */
                height: 270mm; /* Altura da página A4 menos margens */
            }}
            .installment-block {{
                width: 32%; /* Aproximadamente 1/3 da largura, ajuste para caber 3 */
                box-sizing: border-box; /* Incluir padding/border na largura */
                border: 1px solid #ccc;
                padding: 5px; /* Reduzir padding */
                margin-bottom: 10px; /* Espaçamento entre blocos */
                position: relative;
                min-height: 140px; /* Ajuste a altura mínima */
            }}
            .installment-block .header-info, .installment-block .title {{ display: none; }} /* Ocultar header/title repetidos nas parcelas */
            
            .installment-details-wrapper {{ overflow: hidden; }}
            .installment-details {{ float: left; width: 65%; font-size: 8pt; }} /* Ajustar fonte e largura */
            .installment-details p {{ margin: 0 0 2px 0; }}

            .qr-container {{ float: right; width: 30%; text-align: center; }} /* Ajustar largura */
            .qr-code-img {{ width: 50px; height: 50px; margin-top: 5px; }} /* Ajustar tamanho do QR */
            .qr-code-label {{ font-size: 6pt; margin-top: 2px; }}

            .received-signature {{ text-align: center; margin-top: 10px; }}
            .received-signature span {{ border-bottom: 1px solid black; padding: 0 30px; display: inline-block; }}
            .received-label {{ font-size: 7pt; margin-top: 2px; }}
            
            /* Rodapé de página */
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
                <div style="clear:both;"></div>
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
                <p><strong>Valor Total Original:</strong> R$ {f"{db_carne.valor_total_original:.2f}".replace('.', ',')}</p>
                <p><strong>Valor de Entrada:</strong> R$ {f"{db_carne.valor_entrada:.2f}".replace('.', ',')}</p>
                <p><strong>Forma Pag. Entrada:</strong> {db_carne.forma_pagamento_entrada or 'N/A'}</p>
                <p><strong>Valor a Parcelar:</strong> R$ {f"{(db_carne.valor_total_original - (db_carne.valor_entrada or 0)):.2f}".replace('.', ',')}</p>
                <p><strong>Número de Parcelas:</strong> {db_carne.numero_parcelas}</p>
                <p><strong>Valor da Parcela Original:</strong> R$ {f"{db_carne.valor_parcela_original:.2f}".replace('.', ',')}</p>
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

    # --- SEÇÕES: PARCELAS INDIVIDUAIS (agrupadas em 3 por página) ---
    if db_carne.parcelas:
        sorted_parcelas = sorted(db_carne.parcelas, key=lambda p: p.numero_parcela)
        
        html_content += """<div class="page-break"></div><div class="installments-grid">""" # Iniciar nova página e grid
        
        for i, parcela in enumerate(sorted_parcelas):
            qr_data_content = f"pix_cnpj={PIX_CNPJ_CONSTANT}&valor={parcela.valor_devido:.2f}&parcela={parcela.numero_parcela}&carne_id={parcela.id_carne}"
            qr_base64 = generate_qr_code_base64(qr_data_content)
            qr_html = f'<div class="qr-container"><img class="qr-code-img" src="{qr_base64}" /><div class="qr-code-label">Scan para pagar!</div></div>' if qr_base64 else '<div class="qr-container"><p>QR Code não gerado</p></div>'

            html_content += f"""
                <div class="installment-block">
                    <h3 style="text-align: center; margin: 0 0 5px 0; font-size: 10pt;">COMPROVANTE - PARCELA {parcela.numero_parcela}</h3>
                    <div class="installment-details-wrapper">
                        <div class="installment-details">
                            <p><strong>Carnê ID:</strong> {parcela.id_carne} - {db_carne.descricao or 'N/A'}</p>
                            <p><strong>Cliente:</strong> {db_carne.cliente.nome}</p>
                            <p><strong>CPF/CNPJ:</strong> {db_carne.cliente.cpf_cnpj}</p>
                            <p><strong>Valor Devido:</strong> R$ {f"{parcela.valor_devido:.2f}".replace('.', ',')}</p>
                            <p><strong>Vencimento:</strong> {parcela.data_vencimento.strftime('%d/%m/%Y')}</p>
                            <p><strong>Juros/Multa:</strong> R$ {f"{parcela.juros_multa:.2f}".replace('.', ',')}</p>
                            <p><strong>Saldo Devedor:</strong> R$ {f"{parcela.saldo_devedor:.2f}".replace('.', ',')}</p>
                            <p><strong>Status:</strong> {parcela.status_parcela}</p>
                            <p><strong>PIX CNPJ:</strong> {PIX_CNPJ_CONSTANT}</p>
                        </div>
                        {qr_html}
                    </div>

                    <div style="clear:both;"></div>
                    <div class="received-signature">
                        <span></span>
                        <p class="received-label">Assinatura do Recebedor</p>
                    </div>
                    <p class="signature-date" style="text-align: left;">Data do Pagamento: ___/___/_____</p>
                </div>
            """
            # Se for a última parcela de um grupo de 3, ou a última de todas, fechar o grid e abrir nova página.
            if (i + 1) % 3 == 0 and (i + 1) < len(sorted_parcelas):
                html_content += """</div><div class="page-break"></div><div class="installments-grid">"""
            
        html_content += """</div>""" # Fechar o último installments-grid

    else: # Caso não haja parcelas para o carnê
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
    # base_url é importante para WeasyPrint resolver caminhos relativos de CSS/imagens
    html = HTML(string=html_content, base_url=str(Path(__file__).resolve().parent))
    # Para CSS externo, você poderia carregar assim:
    # css_file_path = Path(__file__).resolve().parent / "static" / "styles.css"
    # if os.path.exists(str(css_file_path)):
    #     css = CSS(filename=str(css_file_path))
    #     pdf_bytes = html.write_pdf(stylesheets=[css])
    # else:
    #     pdf_bytes = html.write_pdf()

    pdf_bytes = html.write_pdf() # Gera o PDF em bytes

    return pdf_bytes