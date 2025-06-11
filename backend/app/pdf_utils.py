from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image, Table, TableStyle, PageBreak, KeepTogether
from reportlab.lib import colors # Importa o módulo colors inteiro
from reportlab.lib.colors import black, blue, red, HexColor # Importar HexColor e cores específicas
from io import BytesIO
from reportlab.graphics.barcode import qr
from reportlab.graphics.shapes import Drawing
from reportlab.graphics import renderPDF
from decimal import Decimal
from datetime import date, timedelta
import base64
from reportlab.lib.pagesizes import A4, portrait

# --- Funções Auxiliares de Formatação ---

def format_currency(value):
    """Formata um valor Decimal para string de moeda brasileira."""
    if value is None:
        return "R$ 0,00"
    return f"R$ {Decimal(value):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")

def format_date_br(date_obj):
    """Formata um objeto date para string no formato DD/MM/AAAA."""
    if date_obj is None:
        return "N/A"
    return date_obj.strftime("%d/%m/%Y")

def get_base64_image_data(image_path):
    """Lê uma imagem e retorna seus dados em base64."""
    try:
        with open(image_path, "rb") as image_file:
            encoded_string = base64.b64encode(image_file.read()).decode('utf-8')
            return f"data:image/jpeg;base64,{encoded_string}"
    except FileNotFoundError:
        print(f"Erro: Imagem não encontrada em {image_path}")
        return None
    except Exception as e:
        print(f"Erro ao carregar imagem {image_path}: {e}")
        return None

def _get_single_parcela_receipt_flowable(parcela, cliente_info, carne_info, styles, logo_data, qrcode_image):
    """
    Gera um Flowable completo para um único recibo de parcela, conforme o Doc1.jpg.
    Isso permitirá inseri-lo diretamente em uma célula de tabela.
    """
    slip_elements = []

    # 1. Linha tracejada de corte (acima de cada recibo, exceto o primeiro da página)
    slip_elements.append(Paragraph("------------------------------------------------------------------------------------------------", styles['DashLine']))
    slip_elements.append(Spacer(1, 0.02*cm)) # Espaçamento ainda mais reduzido

    # 2. Seção do Recibo do Pagador (Esquerda) e Informações do Boleto (Direita)
    # Colocar tudo dentro de uma única tabela de duas colunas
    
    # Conteúdo do Recibo do Pagador (coluna esquerda)
    recibo_pagador_content = [
        Paragraph("<b>RECIBO DO PAGADOR</b>", styles['SmallBold']),
        Spacer(1, 0.02*cm), # Espaçamento ainda mais reduzido
        Table([
            [Paragraph(f"<b>Nº do Documento</b>", styles['Tiny']), Paragraph(str(parcela['id_parcela']), styles['Tiny'])],
            [Paragraph(f"<b>Vencimento</b>", styles['Tiny']), Paragraph(format_date_br(parcela['data_vencimento']), styles['Tiny'])],
            [Paragraph(f"<b>Valor</b>", styles['Tiny']), Paragraph(format_currency(parcela['valor_devido']), styles['Tiny'])],
            [Paragraph(f"<b>Valor Cobrado</b>", styles['Tiny']), Paragraph(format_currency(parcela['saldo_devedor']), styles['Tiny'])]
        ], colWidths=[2.5*cm, 3.5*cm], # Total 6.0cm
        style=TableStyle([
            ('ALIGN', (0,0), (-1,-1), 'LEFT'),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('GRID', (0,0), (-1,-1), 0.25, colors.grey),
            ('LEFTPADDING', (0,0), (-1,-1), 0.5), # Padding reduzido
            ('RIGHTPADDING', (0,0), (-1,-1), 0.5), # Padding reduzido
            ('TOPPADDING', (0,0), (-1,-1), 0.5), # Padding reduzido
            ('BOTTOMPADDING', (0,0), (-1,-1), 0.5), # Padding reduzido
        ])),
        Spacer(1, 0.03*cm), # Espaçamento ainda mais reduzido
        Paragraph("<b>Pagador</b>", styles['SmallBold']),
        Paragraph(cliente_info['nome'], styles['Tiny']),
        Paragraph(f"{cliente_info.get('endereco', '')}", styles['Tiny']),
        Paragraph(f"{cliente_info.get('cidade', '')}, {cliente_info.get('estado', '')}", styles['Tiny']),
        Spacer(1, 0.05*cm) # Espaçamento ainda mais reduzido
    ]

    # Conteúdo da Seção Principal do Boleto (coluna direita)
    main_boleto_content = [
        # Cabeçalho do Boleto (Logo, Nome da Empresa, "Pague usando PIX")
        Table([
            [Image(logo_data, width=0.9*cm, height=0.9*cm) if logo_data else "", # Logo menor (ainda mais reduzido)
             Paragraph("<b>Bios Store</b>", styles['ReceiptHeader']),
             Paragraph("Pague sua cobrança usando o Pix", styles['Small'])]
        ], colWidths=[1.0*cm, 6*cm, 5*cm], # Coluna da logo ajustada
        style=TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('ALIGN', (0,0), (0,0), 'LEFT'),
            ('ALIGN', (1,0), (1,0), 'CENTER'),
            ('ALIGN', (2,0), (2,0), 'RIGHT'),
        ])),
        Spacer(1, 0.02*cm), # Espaçamento ainda mais reduzido
        # Informações do Beneficiário, Vencimento e Valor
        Table([
            [Paragraph("<b>Beneficiário</b>", styles['Small']), Paragraph("<b>Vencimento</b>", styles['SmallBold']), Paragraph("<b>Valor</b>", styles['SmallBold'])],
            [
                Paragraph(carne_info['beneficiario_nome'], styles['Small']),
                Paragraph(format_date_br(parcela['data_vencimento']), styles['ReceiptValue']),
                Paragraph(format_currency(parcela['valor_devido']), styles['ReceiptValue'])
            ],
            [Paragraph(f"<b>CNPJ do Beneficiário:</b> {carne_info['beneficiario_cnpj_cpf']}", styles['Small']), "", ""]
        ], colWidths=[6.5*cm, 3.5*cm, 3.5*cm], # Total 13.5cm
        style=TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('ALIGN', (1,0), (1,0), 'CENTER'),
            ('ALIGN', (2,0), (2,0), 'CENTER'),
            ('ALIGN', (1,1), (1,1), 'CENTER'),
            ('ALIGN', (2,1), (2,1), 'CENTER'),
            ('LEFTPADDING', (0,0), (-1,-1), 0),
            ('RIGHTPADDING', (0,0), (-1,-1), 0),
        ])),
        Spacer(1, 0.02*cm), # Espaçamento ainda mais reduzido
        # Instruções Adicionais
        Paragraph(f"<b>Instruções Adicionais:</b> Multa {float(parcela['juros_multa_percentual']):.2f}%, Juros {float(parcela['juros_mora_percentual_ao_dia']):.4f}% a.d.", styles['Tiny']),
        Spacer(1, 0.03*cm), # Espaçamento ainda mais reduzido
        # QR Code e Instruções de Pagamento PIX
        Table([
            [qrcode_image if qrcode_image else Paragraph("QR Code não disponível.", styles['Tiny']), # QR Code estático
             Paragraph("1. Abra o aplicativo do seu banco ou instituição financeira.<br/>"
                       "2. Entre no ambiente Pix.<br/>"
                       "3. Escolha a opção <b>Pagar com QRcode</b>.<br/>"
                       "4. Aponte a câmera para o QRcode acima.<br/>"
                       "5. <b>DIGITE O VALOR MANUALMENTE.</b> Confirme as informações e finalize o pagamento.", styles['Tiny'])]
        ], colWidths=[2.5*cm, 10.5*cm], # QR Code reduzido e espaço para texto aumentado
        style=TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('LEFTPADDING', (0,0), (-1,-1), 0),
            ('RIGHTPADDING', (0,0), (-1,-1), 0),
            ('TOPPADDING', (0,0), (-1,-1), 0),
            ('BOTTOMPADDING', (0,0), (-1,-1), 0),
        ])),
        Spacer(1, 0.02*cm), # Espaçamento ainda mais reduzido
        Paragraph(f"<b>Chave PIX:</b> {carne_info['pix_key']}", styles['Small']),
        Spacer(1, 0.03*cm), # Espaçamento ainda mais reduzido
        # Informações do Pagador (Parte inferior do boleto - repetido, mais compacto)
        Paragraph("<b>Pagador</b>", styles['SmallBold']),
        Paragraph(f"{cliente_info['nome']} (CPF/CNPJ: {cliente_info['cpf_cnpj']})", styles['Tiny']),
        Paragraph(f"Endereço: {cliente_info.get('endereco', '')}, {cliente_info.get('cidade', '')} - {cliente_info.get('estado', '')}", styles['Tiny']),
        Spacer(1, 0.02*cm), # Espaçamento ainda mais reduzido
        Paragraph(f"<i>Telefone: {cliente_info.get('telefone', '')} | Email: {cliente_info.get('email', '')}</i>", styles['Tiny']),
        Spacer(1, 0.03*cm), # Espaçamento ainda mais reduzido
        # Rodapé da Parcela
        Paragraph(f"<i>Gerado em {format_date_br(date.today())} - Parcela {parcela['numero_parcela']} de {carne_info['numero_parcelas']}</i>", styles['Tiny'])
    ]

    # Tabela principal de 2 colunas para o layout do recibo (Recibo Pagador | Boleto Principal)
    main_receipt_table = Table([
        [recibo_pagador_content, main_boleto_content]
    ], colWidths=[6.0*cm, 13.0*cm]) 

    main_receipt_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('LEFTPADDING', (0,0), (-1,-1), 0),
        ('RIGHTPADDING', (0,0), (-1,-1), 0),
        ('TOPPADDING', (0,0), (-1,-1), 0),
        ('BOTTOMPADDING', (0,0), (-1,-1), 0),
        ('LINEAFTER', (0,0), (0,0), 0.5, HexColor('#808080')), # Linha vertical entre as duas seções (cinza)
        ('GRID', (0,0), (-1,-1), 0.25, HexColor('#D3D3D3')) # Grid leve ao redor do recibo inteiro
    ]))
    
    return KeepTogether(main_receipt_table)


def generate_carne_parcelas_pdf(parcelas_data, cliente_info, carne_info, buffer):
    doc = SimpleDocTemplate(buffer, pagesize=portrait(A4), rightMargin=cm, leftMargin=cm, topMargin=cm, bottomMargin=cm)
    styles = getSampleStyleSheet()

    # --- Definição dos estilos de texto (reforçando cores e tamanhos) ---
    styles.add(ParagraphStyle(name='SmallBold',
                              parent=styles['Normal'],
                              fontSize=7,
                              fontName='Helvetica-Bold',
                              alignment=TA_LEFT,
                              textColor=colors.black
                             ))
    styles.add(ParagraphStyle(name='Small',
                              parent=styles['Normal'],
                              fontSize=6.5, # Fonte reduzida
                              fontName='Helvetica',
                              textColor=colors.black
                             ))
    styles.add(ParagraphStyle(name='Tiny',
                              parent=styles['Normal'],
                              fontSize=4.5, # Fonte reduzida
                              fontName='Helvetica',
                              textColor=colors.black
                             ))
    styles.add(ParagraphStyle(name='ReceiptHeader',
                              parent=styles['Normal'],
                              fontSize=8, # Cabeçalho da empresa reduzido
                              fontName='Helvetica-Bold',
                              alignment=TA_CENTER,
                              textColor=colors.black
                             ))
    styles.add(ParagraphStyle(name='ReceiptValue',
                              parent=styles['Normal'],
                              fontSize=9, # Valor e vencimento em destaque reduzido
                              fontName='Helvetica-Bold',
                              alignment=TA_CENTER,
                              textColor=colors.black
                             ))
    styles.add(ParagraphStyle(name='DashLine',
                              parent=styles['Normal'],
                              fontSize=6,
                              fontName='Helvetica',
                              alignment=TA_CENTER,
                              textColor=HexColor('#A9A9A9')))
    # --- FIM DA DEFINIÇÃO DOS ESTILOS ---

    elements = []

    logo_path = "/app/app/static/logobios.jpg"
    qrcode_static_path = "/app/app/static/meu_qrcode_pix.jpeg"

    logo_data = get_base64_image_data(logo_path)
    if not logo_data:
        print(f"AVISO: Logo não carregada em {logo_path}. O PDF pode ter problemas de layout ou ausência da logo.")
    
    qrcode_image_data = get_base64_image_data(qrcode_static_path)
    qrcode_for_pdf = None
    if qrcode_image_data:
        qrcode_for_pdf = Image(qrcode_image_data, width=2.5*cm, height=2.5*cm) # QR Code ainda mais reduzido
    else:
        print(f"AVISO: QR Code estático não carregado em {qrcode_static_path}. O PDF pode ter problemas de layout ou ausência do QR Code.")

    sorted_parcelas = sorted(parcelas_data, key=lambda x: x['numero_parcela'])
    
    page_width, page_height = A4
    usable_width = page_width - (2 * cm)

    # --- ALTERAÇÃO PRINCIPAL AQUI: PROCESSAR 2 RECIBOS POR VEZ ---
    for i in range(0, len(sorted_parcelas), 2): # Mudado de 3 para 2
        receipts_for_current_page = []

        current_batch_parcelas = sorted_parcelas[i : i + 2] # Pega as próximas 2 parcelas

        for parcela in current_batch_parcelas:
            receipt_flowable = _get_single_parcela_receipt_flowable(
                parcela, cliente_info, carne_info, styles, logo_data, qrcode_for_pdf
            )
            receipts_for_current_page.append(receipt_flowable)
        
        # Se houver menos de 2 recibos na última página, preenche com Spacer
        while len(receipts_for_current_page) < 2: # Mudado de 3 para 2
            # Estimativa de altura para UM recibo (agora com apenas 2 por página, cada um terá mais espaço)
            # A altura útil da página é ~27.7cm. Para 2 recibos, cada um pode ter ~13.8cm.
            # Um recibo compactado tem ~7.5cm, então 2 deles (15cm) cabem bem.
            receipts_for_current_page.append(Spacer(1, 13.5 * cm)) # Ajuste para espaçamento de 2 recibos
            
        table_for_page = Table(
            [[r] for r in receipts_for_current_page],
            colWidths=[usable_width]
        )
        
        table_for_page.setStyle(TableStyle([
            ('LEFTPADDING', (0,0), (-1,-1), 0),
            ('RIGHTPADDING', (0,0), (-1,-1), 0),
            ('TOPPADDING', (0,0), (-1,-1), 0),
            ('BOTTOMPADDING', (0,0), (-1,-1), 0),
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            # A linha abaixo deve estar apenas após o primeiro recibo, já que agora temos 2.
            ('LINEBELOW', (0,0), (0,0), 0.5, HexColor('#A9A9A9')),
            # Remover a linha para o segundo recibo se só houver 2
            # ('LINEBELOW', (0,1), (0,1), 0.5, HexColor('#A9A9A9')), # Removido, pois só haverá 2 linhas no máximo
        ]))
        
        elements.append(table_for_page)
        
        # Adiciona uma quebra de página se houver mais parcelas a serem processadas
        if i + 2 < len(sorted_parcelas): # Mudado de 3 para 2
            elements.append(PageBreak())

    doc.build(elements)
    buffer.seek(0)
    return buffer