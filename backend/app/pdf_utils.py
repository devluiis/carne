from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image, Table, TableStyle, PageBreak, Frame
from reportlab.lib.colors import black, blue, red
from reportlab.lib import colors
from io import BytesIO
from reportlab.graphics.barcode import qr
from reportlab.graphics.shapes import Drawing
from reportlab.graphics import renderPDF
from decimal import Decimal
from datetime import date, timedelta
import base64
from reportlab.lib.pagesizes import A4, portrait # Importar portrait para garantir A4 retrato

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

# --- REMOVIDA: generate_pix_payload (usaremos imagem estática por enquanto) ---
# Se você precisar de QR codes dinâmicos por parcela, esta função precisará ser re-adicionada e implementada.

# --- Geração do PDF ---

def _get_parcela_slip_elements(parcela, cliente_info, carne_info, styles, logo_data, qrcode_image):
    """
    Gera os elementos para um único recibo de parcela.
    """
    slip_elements = []

    # Linha tracejada de corte superior
    slip_elements.append(Paragraph("<font size=8>--------------------------------------------------------------------------------------------------------------------------------</font>", styles['Small']))
    slip_elements.append(Spacer(1, 0.1*cm))

    # RECIBO DO PAGADOR (Topo Esquerdo)
    slip_elements.append(Paragraph("<b>RECIBO DO PAGADOR</b>", styles['SmallBold']))
    slip_elements.append(Spacer(1, 0.1*cm))

    # Dados do Recibo do Pagador
    recibo_pagador_data = [
        [Paragraph(f"<b>Nº do Documento</b>", styles['Tiny']), Paragraph(str(parcela['id_parcela']), styles['Tiny'])],
        [Paragraph(f"<b>Vencimento</b>", styles['Tiny']), Paragraph(format_date_br(parcela['data_vencimento']), styles['Tiny'])],
        [Paragraph(f"<b>Valor</b>", styles['Tiny']), Paragraph(format_currency(parcela['valor_devido']), styles['Tiny'])],
        [Paragraph(f"<b>Valor Cobrado</b>", styles['Tiny']), Paragraph(format_currency(parcela['saldo_devedor']), styles['Tiny'])] # Saldo devedor atualizado
    ]
    recibo_pagador_table = Table(recibo_pagador_data, colWidths=[2.5*cm, 3.5*cm])
    recibo_pagador_table.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('GRID', (0,0), (-1,-1), 0.25, colors.grey),
        ('LEFTPADDING', (0,0), (-1,-1), 1),
        ('RIGHTPADDING', (0,0), (-1,-1), 1),
        ('TOPPADDING', (0,0), (-1,-1), 1),
        ('BOTTOMPADDING', (0,0), (-1,-1), 1),
    ]))
    slip_elements.append(recibo_pagador_table)
    slip_elements.append(Spacer(1, 0.2*cm))

    # Dados do Pagador (abaixo do recibo)
    slip_elements.append(Paragraph("<b>Pagador</b>", styles['SmallBold']))
    slip_elements.append(Paragraph(cliente_info['nome'], styles['Tiny']))
    slip_elements.append(Paragraph(f"{cliente_info.get('endereco', '')}", styles['Tiny']))
    slip_elements.append(Paragraph(f"{cliente_info.get('cidade', '')}, {cliente_info.get('estado', '')}", styles['Tiny']))
    slip_elements.append(Spacer(1, 0.5*cm)) # Espaço para o final do recibo

    # --- Seção Principal do Boleto ---
    # Cabeçalho do Boleto (Logo, Nome da Empresa, "Pague usando PIX")
    header_data = []
    if logo_data:
        logo = Image(logo_data, width=1.5*cm, height=1.5*cm)
        header_data.append([
            logo,
            Paragraph("<b>Bios Store</b>", styles['ReceiptHeader']),
            Paragraph("Pague sua cobrança usando o Pix", styles['Small'])
        ])
    else:
        header_data.append([
            Paragraph("<b>Bios Store</b>", styles['ReceiptHeader']),
            Paragraph("Pague sua cobrança usando o Pix", styles['Small'])
        ])

    header_table = Table(header_data, colWidths=[2*cm, 7*cm, 4*cm])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('ALIGN', (0,0), (0,0), 'LEFT'),
        ('ALIGN', (1,0), (1,0), 'CENTER'),
        ('ALIGN', (2,0), (2,0), 'RIGHT'),
    ]))
    slip_elements.append(header_table)
    slip_elements.append(Spacer(1, 0.2*cm))

    # Informações do Beneficiário, Vencimento e Valor
    main_info_data = [
        [Paragraph("<b>Beneficiário</b>", styles['Small']), Paragraph("<b>Vencimento</b>", styles['SmallBold']), Paragraph("<b>Valor</b>", styles['SmallBold'])],
        [
            Paragraph(carne_info['beneficiario_nome'], styles['Small']),
            Paragraph(format_date_br(parcela['data_vencimento']), styles['ReceiptValue']),
            Paragraph(format_currency(parcela['valor_devido']), styles['ReceiptValue']) # Valor devido com juros/multa
        ],
        [Paragraph(f"<b>CNPJ do Beneficiário:</b> {carne_info['beneficiario_cnpj_cpf']}", styles['Small']), "", ""]
    ]
    main_info_table = Table(main_info_data, colWidths=[6.5*cm, 3.5*cm, 3.5*cm]) # Ajuste as larguras conforme necessário
    main_info_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('ALIGN', (1,0), (1,0), 'CENTER'),
        ('ALIGN', (2,0), (2,0), 'CENTER'),
        ('ALIGN', (1,1), (1,1), 'CENTER'),
        ('ALIGN', (2,1), (2,1), 'CENTER'),
        ('LEFTPADDING', (0,0), (-1,-1), 0),
        ('RIGHTPADDING', (0,0), (-1,-1), 0),
    ]))
    slip_elements.append(main_info_table)
    slip_elements.append(Spacer(1, 0.2*cm))

    # Instruções Adicionais
    instructions = f"<b>Instruções Adicionais:</b> Multa {float(parcela['juros_multa_percentual']):.2f}% e Juros {float(parcela['juros_mora_percentual_ao_dia']):.4f}% a.d. após vencimento."
    slip_elements.append(Paragraph(instructions, styles['Small']))
    slip_elements.append(Spacer(1, 0.5*cm))

    # QR Code e Instruções de Pagamento PIX
    pix_section_data = []
    if qrcode_image:
        pix_section_data.append([
            qrcode_image, # Imagem do QR Code estático
            Paragraph("1. Abra o aplicativo do seu banco ou instituição financeira.<br/>"
                      "2. Entre no ambiente Pix.<br/>"
                      "3. Escolha a opção <b>Pagar com QRcode</b>.<br/>"
                      "4. Aponte a câmera para o QRcode acima.<br/>"
                      "5. <b>DIGITE O VALOR MANUALMENTE.</b> Confirme as informações e finalize o pagamento.", styles['Tiny'])
        ])
    else:
        pix_section_data.append([
            Paragraph("QR Code não disponível.", styles['Tiny']),
            Paragraph("Use a chave PIX para pagamento direto.", styles['Tiny'])
        ])
    
    pix_section_table = Table(pix_section_data, colWidths=[3.5*cm, 10*cm])
    pix_section_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('LEFTPADDING', (0,0), (-1,-1), 0),
        ('RIGHTPADDING', (0,0), (-1,-1), 0),
        ('TOPPADDING', (0,0), (-1,-1), 0),
        ('BOTTOMPADDING', (0,0), (-1,-1), 0),
    ]))
    slip_elements.append(pix_section_table)
    slip_elements.append(Spacer(1, 0.2*cm))
    slip_elements.append(Paragraph(f"<b>Chave PIX:</b> {carne_info['pix_key']}", styles['Small']))
    slip_elements.append(Spacer(1, 0.5*cm))


    # Informações do Pagador (Parte inferior do boleto)
    slip_elements.append(Paragraph("<b>Pagador</b>", styles['SmallBold']))
    slip_elements.append(Paragraph(f"{cliente_info['nome']} (CPF/CNPJ: {cliente_info['cpf_cnpj']})", styles['Tiny']))
    slip_elements.append(Paragraph(f"Endereço: {cliente_info.get('endereco', '')}, {cliente_info.get('cidade', '')} - {cliente_info.get('estado', '')}", styles['Tiny']))
    slip_elements.append(Spacer(1, 0.2*cm))
    slip_elements.append(Paragraph(f"<i>Telefone: {cliente_info.get('telefone', '')} | Email: {cliente_info.get('email', '')}</i>", styles['Tiny']))
    slip_elements.append(Spacer(1, 0.5*cm))
    
    # Rodapé da Parcela
    slip_elements.append(Paragraph(f"<i>Gerado em {format_date_br(date.today())} - Parcela {parcela['numero_parcela']} de {carne_info['numero_parcelas']}</i>", styles['Tiny']))

    return slip_elements

def generate_carne_parcelas_pdf(parcelas_data, cliente_info, carne_info, buffer):
    doc = SimpleDocTemplate(buffer, pagesize=portrait(A4), rightMargin=cm, leftMargin=cm, topMargin=cm, bottomMargin=cm)
    styles = getSampleStyleSheet()

    # --- Definição dos estilos de texto ---
    styles.add(ParagraphStyle(name='SmallBold',
                              parent=styles['Normal'],
                              fontSize=8, # Um pouco maior para títulos de seção
                              fontName='Helvetica-Bold',
                              alignment=TA_LEFT # Alinhado à esquerda como na imagem
                             ))
    styles.add(ParagraphStyle(name='Small',
                              parent=styles['Normal'],
                              fontSize=8,
                              fontName='Helvetica'
                             ))
    styles.add(ParagraphStyle(name='Tiny',
                              parent=styles['Normal'],
                              fontSize=6,
                              fontName='Helvetica'
                             ))
    styles.add(ParagraphStyle(name='ReceiptHeader',
                              parent=styles['Normal'],
                              fontSize=10,
                              fontName='Helvetica-Bold',
                              alignment=TA_CENTER
                             ))
    styles.add(ParagraphStyle(name='ReceiptValue',
                              parent=styles['Normal'],
                              fontSize=12, # Valor maior para destaque
                              fontName='Helvetica-Bold',
                              alignment=TA_CENTER # Centralizado para valor e vencimento
                             ))
    # --- FIM DA DEFINIÇÃO DOS ESTILOS ---

    elements = []

    # Caminhos para as imagens
    logo_path = "/app/app/static/logobios.jpg"
    qrcode_static_path = "/app/app/static/meu_qrcode_pix.jpeg" # QR Code estático

    logo_data = get_base64_image_data(logo_path)
    qrcode_image_data = get_base64_image_data(qrcode_static_path)
    
    # Prepara a imagem do QR code se existir
    qrcode_for_pdf = None
    if qrcode_image_data:
        qrcode_for_pdf = Image(qrcode_image_data, width=3*cm, height=3*cm)


    # Organiza as parcelas para caberem 3 por página
    sorted_parcelas = sorted(parcelas_data, key=lambda x: x['numero_parcela'])
    
    # A altura da página A4 é de 29.7 cm. Com margens de 1cm em cima e embaixo, sobram 27.7 cm.
    # Para 3 recibos, cada um terá ~9.23 cm de altura.
    # Ajuste o height para cada recibo conforme necessário.
    slip_height = 9.23 * cm # Altura aproximada para cada recibo (1/3 da página utilizável)

    for i in range(0, len(sorted_parcelas), 3):
        # Cria uma lista para os elementos da página atual
        page_elements = []

        # Posições y para os 3 recibos na página
        # O ReportLab começa do canto inferior esquerdo (0,0)
        # Recibo superior: 1cm (bottom margin) + 2/3 * (page_height - 2*margin)
        # Recibo do meio: 1cm (bottom margin) + 1/3 * (page_height - 2*margin)
        # Recibo inferior: 1cm (bottom margin)
        
        # Margens gerais da página
        left_margin = cm
        right_margin = cm
        top_margin = cm
        bottom_margin = cm

        # Área utilizável da página
        page_width, page_height = A4
        usable_width = page_width - left_margin - right_margin
        usable_height = page_height - top_margin - bottom_margin
        
        # Define a altura de cada "faixa" para o recibo, incluindo espaçamento
        single_slip_full_height = usable_height / 3

        # Frames para os três recibos na página
        # Note que a ordem dos frames é de baixo para cima.
        frame_bottom = Frame(left_margin, bottom_margin, usable_width, single_slip_full_height,
                             leftPadding=0, bottomPadding=0, rightPadding=0, topPadding=0,
                             showBoundary=0) # showBoundary=1 para depurar bordas
        
        frame_middle = Frame(left_margin, bottom_margin + single_slip_full_height, usable_width, single_slip_full_height,
                             leftPadding=0, bottomPadding=0, rightPadding=0, topPadding=0,
                             showBoundary=0) # showBoundary=1 para depurar bordas

        frame_top = Frame(left_margin, bottom_margin + 2 * single_slip_full_height, usable_width, single_slip_full_height,
                          leftPadding=0, bottomPadding=0, rightPadding=0, topPadding=0,
                          showBoundary=0) # showBoundary=1 para depurar bordas

        frames_on_page = [frame_bottom, frame_middle, frame_top]
        
        # Adiciona os elementos de cada recibo ao respectivo frame
        for j in range(3):
            if i + j < len(sorted_parcelas):
                parcela = sorted_parcelas[i + j]
                slip_elements = _get_parcela_slip_elements(
                    parcela, cliente_info, carne_info, styles, logo_data, qrcode_for_pdf
                )
                # Adiciona todos os elementos do slip ao frame correspondente
                frames_on_page[j].addFromList(slip_elements, elements)
        
        # Adiciona os frames como elementos da página
        # Na verdade, a maneira mais robusta com SimpleDocTemplate é usar PageTemplate
        # mas para uma implementação simples, podemos adicionar os elementos e o PageBreak.
        # Contudo, para múltiplos frames por página, o PageTemplate é o caminho correto.
        # Por simplicidade e para encaixar no seu modelo existente, vamos "simular"
        # a adição de múltiplos slips que o SimpleDocTemplate pode lidar,
        # adicionando um PageBreak a cada 3 slips.
        
        # A forma mais direta de usar PageTemplate para múltiplos frames é mais complexa
        # para adicionar diretamente a um SimpleDocTemplate existente sem reestruturar.
        # Vamos manter o loop de adicionar elementos e PageBreak, ajustando o conteúdo
        # de cada "slip" para ser mais compacto.
        
        # O problema com SimpleDocTemplate e PageBreak é que ele não "combina" frames.
        # Ele desenha os elementos na ordem, então o que precisamos é que cada bloco
        # de elementos (_get_parcela_slip_elements) seja uma unidade que se encaixa
        # dentro de uma das três "faixas" da página.

        # Para forçar 3 por página de forma mais simples com SimpleDocTemplate:
        # cada _get_parcela_slip_elements deve retornar um Flowable que encapsule
        # o conteúdo do recibo.
        
        # Para evitar reestruturar muito o _get_parcela_slip_elements para retornar um Flowable
        # que seria inserido em um Frame, vamos gerar os elementos em sequência e usar
        # PageBreak a cada 3, confiando no ReportLab para "quebrar" corretamente.
        # Isso pode não dar o layout exato de "3 colunas" que você quer, mas sim
        # um item após o outro até a página encher, então uma nova página.

        # *** RE-AVALIAÇÃO DA ESTRUTURA PARA 3 POR PÁGINA: ***
        # A maneira mais eficaz de ter 3 por página, com layout fixo,
        # é usar PageTemplate com múltiplos Frames.
        # No entanto, a sua função atual gera elementos de forma linear.
        # Requereria uma reestruturação para que _get_parcela_slip_elements
        # criasse um 'Container' Flowable com seus próprios sub-elementos.

        # Dado o seu objetivo e a estrutura do código,
        # A melhor abordagem para este caso específico é usar uma Tabela de 1x3 (ou 3x1)
        # onde cada célula contém o conteúdo de um recibo.

        # --- NOVA ABORDAGEM: Tabela de 1x3 (ou 3x1) por página ---
        # Definir a tabela que conterá os recibos
        # Cada "recibo" será uma lista de flowables (elementos de texto, imagem, etc.)

        # Coleta os elementos para os 3 recibos (ou menos se for a última página)
        slips_on_current_page = []
        for k in range(3):
            current_parcel_index = i + k
            if current_parcel_index < len(sorted_parcelas):
                parcela = sorted_parcelas[current_parcel_index]
                slips_on_current_page.append(_get_parcela_slip_elements(
                    parcela, cliente_info, carne_info, styles, logo_data, qrcode_for_pdf
                ))
            else:
                slips_on_current_page.append([]) # Adiciona uma célula vazia para preencher a tabela

        # Cria uma tabela com 1 coluna e 3 linhas (ou 3 colunas e 1 linha, dependendo do design)
        # Vamos usar 1 coluna e 3 linhas, o que é mais fácil para o A4 retrato.
        # Cada célula da tabela será uma lista de flowables para um recibo.
        table_data = [[slips_on_current_page[0]],
                      [slips_on_current_page[1]],
                      [slips_on_current_page[2]]]

        # Coluna única, com largura total da área utilizável
        table = Table(table_data, colWidths=[usable_width])
        table.setStyle(TableStyle([
            ('LEFTPADDING', (0,0), (-1,-1), 0),
            ('RIGHTPADDING', (0,0), (-1,-1), 0),
            ('TOPPADDING', (0,0), (-1,-1), 0),
            ('BOTTOMPADDING', (0,0), (-1,-1), 0),
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ]))
        
        elements.append(table)
        
        if i + 3 < len(sorted_parcelas): # Se houver mais parcelas, adicione uma quebra de página
            elements.append(PageBreak())

    doc.build(elements)
    buffer.seek(0)
    return buffer