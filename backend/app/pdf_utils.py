import os
from pathlib import Path
from datetime import datetime, date
from app import models 
from sqlalchemy.orm import Session 
import base64 
from weasyprint import HTML, CSS 

# Informações da Loja
STORE_NAME = "Bios Store"
STORE_CNPJ = "23.123.123/0001-01"
STORE_ADDRESS = "Rua José Bonifácio nº 27"
STORE_PHONE = "(63) 99285-1025"
STORE_EMAIL = "leandroxam@hotmail.com"

# Caminho para o logo e QR Code estático
LOGO_PATH = Path(__file__).resolve().parent / "static" / "logobios.jpg"
QR_CODE_PATH = Path(__file__).resolve().parent / "static" / "meu_qrcode_pix.jpeg" # AJUSTE O NOME E FORMATO DO SEU ARQUIVO AQUI!

# CNPJ PIX Constante (para ser usado no texto)
PIX_CNPJ_CONSTANT = "23888763000116"

# Função auxiliar para converter imagem para Base64
def image_to_base64(image_path, image_format="jpeg"): # Default para JPEG, ajuste se sua logo for JPG/PNG
    if os.path.exists(str(image_path)):
        try:
            with open(str(image_path), "rb") as image_file:
                encoded_string = base64.b64encode(image_file.read()).decode('utf-8')
                return f"data:image/{image_format};base64,{encoded_string}"
        except Exception as e:
            print(f"DEBUG: Erro ao ler imagem {image_path}: {e}") # Print de depuração
            return None
    print(f"DEBUG: Arquivo de imagem NÃO ENCONTRADO: {image_path}") # Print de depuração
    return None

def generate_carne_pdf_bytes(db_carne: models.Carne) -> bytes:
    # DEBUG: Dados do Carnê (manter temporariamente para depuração)
    print(f"DEBUG: Dados do Carnê recebidos para PDF: ID={db_carne.id_carne}, Cliente={db_carne.cliente.nome if db_carne.cliente else 'N/A'}, Parcelas={len(db_carne.parcelas) if db_carne.parcelas else 0}")
    print(f"DEBUG: Descricao do Carne: {db_carne.descricao}")
    print(f"DEBUG: Valor Total Original: {db_carne.valor_total_original}")

    # Converte logo e QR Code estático para base64 UMA VEZ
    logo_base64 = image_to_base64(LOGO_PATH, "jpeg") # Assegure o formato correto da sua logo
    logo_html = f'<img class="logo" src="{logo_base64}">' if logo_base64 else '<div class="logo-placeholder">Logo não encontrada</div>'

    qr_code_base64 = image_to_base64(QR_CODE_PATH, "jpeg") # AJUSTE AQUI O FORMATO DO SEU QR CODE JPG/JPEG
    qr_code_html = f'<div class="qr-code-img-container"><img class="qr-code-img" src="{qr_code_base64}" /></div>' if qr_code_base64 else '<div class="qr-code-img-container"><p>QR Code não disponível</p></div>'

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
            .installments-page-grid {{
                display: flex;
                flex-wrap: wrap;
                justify-content: space-between; /* Espaço entre os itens */
                align-content: flex-start; /* Alinhar ao topo */
                min-height: 270mm; /* Altura da página A4 menos margens */
                max-height: 270mm; /* Força quebra de página se exceder */
                page-break-after: always;
            }}
            .installments-page-grid:last-child {{
                page-break-after: avoid; /* Não quebrar página após o último grid */
            }}

            .installment-receipt-block {{
                width: 49%; /* Para 2 comprovantes por linha (2x49% + 2% de gap) */
                box-sizing: border-box; /* Incluir padding/border na largura */
                border: 1px solid #000;
                padding: 5px; /* Reduzir padding interno */
                margin-bottom: 10px; /* Espaço entre linhas de comprovantes */
                page-break-inside: avoid; /* Evita que o bloco seja quebrado no meio da página */
                position: relative;
                min-height: 125mm; /* Altura de cada comprovante (aprox. metade de uma folha A4) */
            }}
            /* Ajuste para o segundo item de cada linha */
            .installment-receipt-block:nth-child(2n) {{ margin-left: 1%; margin-right: 0; }} 
            /* Ajuste para o primeiro item de cada linha */
            .installment-receipt-block:nth-child(2n+1) {{ margin-right: 1%; margin-left: 0; }}


            /* Layout interno do comprovante (estilo PJBank) */
            .receipt-content {{
                border: 1px solid #ccc;
                padding: 5px;
                margin-bottom: 5px;
            }}
            .receipt-row {{
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                margin-bottom: 3px;
            }}
            .receipt-field {{ flex: 1; font-size: 8pt; }}
            .receipt-field.half {{ width: 49%; }} /* Para campos lado a lado */
            .receipt-field.value {{ text-align: right; font-weight: bold; }}
            .receipt-label {{ font-size: 6pt; color: #555; margin-bottom: 1px; }}
            .receipt-value {{ font-size: 9pt; font-weight: bold; margin-top: 0; }}

            .qr-code-area {{ text-align: center; margin-top: 5px; }}
            .qr-code-img-container {{ display: inline-block; border: 1px solid #ccc; padding: 2px; }}
            .qr-code-img {{ width: 60px; height: 60px; }} /* Tamanho do QR */
            .qr-code-label {{ font-size: 7pt; margin-top: 2px; }}

            .bottom-info {{ font-size: 7pt; text-align: center; margin-top: 5px; }}
            .date-signature-line {{ font-size: 7pt; text-align: left; margin-top: 10px; }}
            
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
                <p class="signature-cpf">CPF/CPN: {db_carne.cliente.cpf_cnpj}</p>
                <p class="signature-date">Data: ___/___/_____</p>
            </div>
        </div>
    """

    # --- SEÇÕES: PARCELAS INDIVIDUAIS (agrupadas para múltiplos por página) ---
    if db_carne.parcelas:
        sorted_parcelas = sorted(db_carne.parcelas, key=lambda p: p.numero_parcela)
        
        # Iniciar a área de grid para as parcelas em uma nova página
        html_content += """<div class="page-break"></div><div class="installments-page-grid">"""
        
        for i, parcela in enumerate(sorted_parcelas):
            html_content += f"""
                <div class="installment-receipt-block">
                    <div class="receipt-header">
                        <img class="logo" src="{logo_base64}" style="width: 20px; height: auto; float: left; margin-right: 5px; margin-top: 0px; padding: 0;">
                        <h4 style="font-size: 10pt; text-align: left; flex-grow: 1; margin: 0; padding-left: 25px;">COMPROVANTE - PARCELA {parcela.numero_parcela}</h4>
                    </div>
                    
                    <div class="receipt-content">
                        <div class="receipt-row">
                            <div class="receipt-field">
                                <p class="receipt-label">Recibo do Pagador</p>
                                <p class="receipt-value">{db_carne.cliente.nome}</p>
                                <p class="receipt-label">CPF/CNPJ</p>
                                <p class="receipt-value">{db_carne.cliente.cpf_cnpj}</p>
                                <p class="receipt-label">Carnê ID / Descrição</p>
                                <p class="receipt-value">{parcela.id_carne} - {db_carne.descricao or 'N/A'}</p>
                            </div>
                            <div class="receipt-field value">
                                <p class="receipt-label">Vencimento</p>
                                <p class="receipt-value">{parcela.data_vencimento.strftime('%d/%m/%Y')}</p>
                                <p class="receipt-label">Valor</p>
                                <p class="receipt-value">R$ {f"{parcela.valor_devido:.2f}".replace('.', ',')}</p>
                            </div>
                        </div>
                    </div>

                    <div class="receipt-content" style="border-top: none;">
                        <div class="receipt-row">
                            <div class="receipt-field">
                                <p class="receipt-label">Beneficiário</p>
                                <p class="receipt-value">{STORE_NAME}</p>
                                <p class="receipt-label">CNPJ</p>
                                <p class="receipt-value">{STORE_CNPJ}</p>
                                <p class="receipt-label">Telefone</p>
                                <p class="receipt-value">{STORE_PHONE}</p>
                            </div>
                            <div class="receipt-field value">
                                <div class="qr-code-area">
                                    {qr_code_html}
                                    <p class="qr-code-label">Pague sua cobrança usando o Pix</p>
                                    <p class="qr-code-label">CNPJ PIX: {PIX_CNPJ_CONSTANT}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <p class="bottom-info">Verifique os dados antes de pagar: {db_carne.descricao or 'N/A'} - Parcela {parcela.numero_parcela}</p>
                    <p class="date-signature-line">Data do Pagamento: ___/___/_____</p>
                </div>
            """
        html_content += """</div>""" # Fechar o último installments-page-grid

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