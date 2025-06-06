import os
from pathlib import Path
from datetime import datetime, date
from app import models
from sqlalchemy.orm import Session # Mantido para type hinting
import base64 # Importar para conversão para base64
from weasyprint import HTML, CSS # Importar WeasyPrint

# Informações da Loja
STORE_NAME = "Bios Store"
STORE_CNPJ = "23.123.123/0001-01"
STORE_ADDRESS = "Rua José Bonifácio nº 27"
STORE_PHONE = "(63) 99285-1025"
STORE_EMAIL = "leandroxam@hotmail.com"

# Caminho para o logo e QR Code estático
LOGO_PATH = Path(__file__).resolve().parent / "static" / "logobios.jpg"
QR_CODE_PATH = Path(__file__).resolve().parent / "static" / "meu_qrcode_pix.jpeg" # AJUSTE O NOME DO SEU ARQUIVO AQUI!

# CNPJ PIX Constante (para ser usado no texto)
PIX_CNPJ_CONSTANT = "23888763000116"

# Função auxiliar para converter imagem para Base64
def image_to_base64(image_path, image_format="png"): # Default para PNG, ajuste se sua logo for JPG
    if os.path.exists(str(image_path)):
        try:
            with open(str(image_path), "rb") as image_file:
                encoded_string = base64.b64encode(image_file.read()).decode('utf-8')
                return f"data:image/{image_format};base64,{encoded_string}"
        except Exception as e:
            print(f"Erro ao ler imagem {image_path}: {e}")
            return None
    return None

def generate_carne_pdf_bytes(db_carne: models.Carne) -> bytes:
    # DEBUG: Dados do Carnê (manter temporariamente para depuração)
    print(f"DEBUG: Dados do Carnê recebidos para PDF: ID={db_carne.id_carne}, Cliente={db_carne.cliente.nome if db_carne.cliente else 'N/A'}, Parcelas={len(db_carne.parcelas) if db_carne.parcelas else 0}")
    print(f"DEBUG: Descricao do Carne: {db_carne.descricao}")
    print(f"DEBUG: Valor Total Original: {db_carne.valor_total_original}")

    # Converte logo e QR Code estático para base64 UMA VEZ
    logo_base64 = image_to_base64(LOGO_PATH, "jpeg") # Ajuste "jpeg" para o formato da sua logo
    logo_html = f'<img class="logo" src="{logo_base64}">' if logo_base64 else '<div class="logo-placeholder">Logo não encontrada</div>'

    qr_code_base64 = image_to_base64(QR_CODE_PATH, "png") # Ajuste "png" para o formato do seu QR Code
    qr_code_html = f'<div class="qr-container"><img class="qr-code-img" src="{qr_code_base64}" /><div class="qr-code-label">Scan para pagar!</div></div>' if qr_code_base64 else '<div class="qr-container"><p>QR Code não disponível</p></div>'

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>Carnê de Pagamento - {db_carne.descricao}</title>
        <style>
            body {{ font-family: 'Arial', sans-serif; font-size: 10pt; margin: 10mm; }}
            .page {{ page-break-after: always; padding: 5mm; }}
            .page:last-child {{ page-break-after: avoid; }}
            
            /* Header e Título da Primeira Página (Resumo) */
            .header-info {{ overflow: hidden; margin-bottom: 10px; border-bottom: 1px solid #ccc; padding-bottom: 5px; }}
            .logo {{ width: 50px; height: auto; float: left; margin-right: 10px; border: 1px solid #eee; padding: 5px; }}
            .logo-placeholder {{ width: 50px; height: 50px; float: left; margin-right: 10px; border: 1px dashed gray; text-align: center; line-height: 50px; font-size: 7pt; }}
            .store-details {{ float: left; margin-top: -5px; }}
            .store-details h1 {{ font-size: 12pt; margin: 0 0 3px 0; }}
            .store-details p {{ font-size: 7pt; margin: 0 0 1px 0; }}
            
            .title {{ text-align: center; font-size: 14pt; font-weight: bold; margin: 10px 0; }}
            
            .section {{ margin-bottom: 10px; border: 1px solid #eee; padding: 8px; background-color: #f9f9f9; border-radius: 5px; }}
            .section h3 {{ font-size: 10pt; margin-top: 0; margin-bottom: 5px; border-bottom: 1px solid #ddd; padding-bottom: 3px; }}
            .section p {{ font-size: 9pt; margin: 0 0 3px 0; }}

            .terms {{ margin-top: 15px; }}
            .terms h3 {{ text-align: center; font-size: 10pt; margin-bottom: 8px; }}
            .terms p {{ font-size: 8pt; }}
            .signature-line {{ text-align: center; margin-top: 25px; margin-bottom: 3px; }}
            .signature-line span {{ border-bottom: 1px solid black; padding: 0 40px; display: inline-block; }}
            .signature-name, .signature-cpf, .signature-date {{ text-align: center; font-size: 8pt; margin: 0; }}
            .signature-date {{ text-align: left; margin-top: 10px; }}

            /* Layout para Comprovantes de Parcela (Múltiplos por página) */
            .installments-grid {{
                display: flex;
                flex-wrap: wrap;
                justify-content: flex-start; /* Alinhar à esquerda */
                align-content: flex-start;
                /* Altura aproximada de uma folha A4 menos margens para quebra automática */
                min-height: 270mm; 
                max-height: 270mm; 
            }}
            .installment-block {{
                width: 48%; /* Para 2 comprovantes por linha (2x48% + margens) */
                box-sizing: border-box;
                border: 1px solid #000; /* Borda externa do comprovante */
                padding: 8px; /* Padding interno */
                margin-right: 1%; /* Espaço entre os comprovantes na mesma linha */
                margin-left: 0.5%; /* Pequena margem para centralizar */
                margin-bottom: 10px; /* Espaço entre linhas */
                position: relative;
                min-height: 150px; /* Altura mínima para o conteúdo, ajuste conforme necessário */
                page-break-inside: avoid; /* Evita que o bloco seja quebrado no meio da página */
            }}
            /* Ajuste para o último item de cada linha para não ter margem à direita */
            .installment-block:nth-child(2n) {{ margin-right: 0; }} /* Cada segundo item */

            .installment-header {{ text-align: center; font-size: 10pt; font-weight: bold; margin: 0 0 5px 0; }}
            
            .installment-content {{ overflow: hidden; }} /* Para conter floats */
            .installment-details {{ float: left; width: 65%; font-size: 8pt; }}
            .installment-details p {{ margin: 0 0 2px 0; }}

            .qr-container {{ float: right; width: 30%; text-align: center; }}
            .qr-code-img {{ width: 50px; height: 50px; margin-top: 5px; }}
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

    # --- SEÇÕES: PARCELAS INDIVIDUAIS (agrupadas para múltiplos por página) ---
    if db_carne.parcelas:
        sorted_parcelas = sorted(db_carne.parcelas, key=lambda p: p.numero_parcela)
        
        # Iniciar a área de grid para as parcelas em uma nova página
        html_content += """<div class="page-break"></div><div class="installments-grid">"""
        
        for i, parcela in enumerate(sorted_parcelas):
            html_content += f"""
                <div class="installment-block">
                    <h3 class="installment-header">COMPROVANTE - PARCELA {parcela.numero_parcela}</h3>
                    <div class="installment-content">
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
                        {qr_code_html} </div>

                    <div style="clear:both;"></div>
                    <div class="received-signature">
                        <span></span>
                        <p class="received-label">Assinatura do Recebedor</p>
                    </div>
                    <p class="signature-date" style="text-align: left;">Data do Pagamento: ___/___/_____</p>
                </div>
            """
        html_content += """</div>""" # Fechar o installments-grid

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
    html = HTML(string=html_content, base_url=str(Path(__file__).resolve().parent))
    pdf_bytes = html.write_pdf()

    return pdf_bytes