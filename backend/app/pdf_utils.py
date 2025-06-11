from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image, Table, TableStyle, PageBreak
from reportlab.lib.colors import black, blue, red
from reportlab.lib import colors
from io import BytesIO
from reportlab.graphics.barcode import qr
from reportlab.graphics.shapes import Drawing
from reportlab.graphics import renderPDF
from decimal import Decimal
from datetime import date, timedelta
import base64
from reportlab.lib.pagesizes import A4

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

# --- NOVA: Função para gerar o Payload do Código QR PIX (SUBSTITUÍVEL) ---
# VOCÊ PRECISA IMPLEMENTAR ISSO COM BASE NA SUA INTEGRAÇÃO PIX
def generate_pix_payload(parcel_value, beneficiary_name, pix_key, transaction_id=None):
    """
    Gera um payload simplificado de código QR PIX estático.
    ESTE É UM EXEMPLO SIMPLIFICADO. VOCÊ DEVE SUBSTITUÍ-LO PELA SUA LÓGICA REAL DE PAYLOAD PIX.
    O 'parcel_value' deve ser um Decimal.
    """
    if not isinstance(parcel_value, Decimal):
        parcel_value = Decimal(str(parcel_value))

    # Estrutura de payload de exemplo - Você DEVE adaptá-la aos requisitos do seu provedor PIX
    # Este é um exemplo muito básico e pode não funcionar diretamente com sua conta PIX.
    # O payload real depende do seu banco/gateway de pagamento.
    # Para um valor fixo, a estrutura geralmente envolve um formato específico.

    # Este é um placeholder. Uma geração real de payload PIX é mais complexa e envolve
    # cálculo de CRC e aderência aos padrões EMVCo BR Code.
    # Para testes, você pode usar uma string de código QR estática conhecida se a geração dinâmica for muito complexa inicialmente.

    # Exemplo: Simulando uma chave PIX estática e beneficiário para o payload
    # Em um cenário real, esta 'pix_key' pode ser um telefone, e-mail, CPF/CNPJ.
    # E 'beneficiary_name' é o nome da sua empresa.

    amount_str = f"{parcel_value:.2f}"
    # Remover pontos e substituir vírgula para o padrão PIX
    # amount_str = amount_str.replace('.', '').replace(',', '') # Isso está incorreto para o campo de valor, deve ser com ponto.
    amount_str = f"{parcel_value:.2f}" # Manter com ponto para o campo de valor PIX

    # Payload de exemplo simplificado - ISSO NÃO É UMA IMPLEMENTAÇÃO COMPLETA DO BR CODE
    # Você normalmente usaria uma biblioteca ou um serviço para gerar payloads PIX adequados.
    # Este é um placeholder para fins de demonstração na geração de PDF.
    payload = (
        f"00020126580014BR.GOV.BCB.PIX0136{pix_key}" # Chave PIX
        f"52040000530398654{len(amount_str):02d}{amount_str}" # Valor
        f"5802BR59{len(beneficiary_name):02d}{beneficiary_name}" # Nome do Beneficiário
        f"6009Xambioa62070503***6304B039" # Cidade do Comerciante, ID da Transação (simplificado), CRC
    )

    # Nota: Um payload PIX real precisa de cálculo CRC16 e formatação adequada de todos os campos.
    # O exemplo acima é altamente simplificado e provavelmente não funcionará para pagamentos reais.
    # Você precisa integrar com uma API PIX ou uma biblioteca que lide com a geração do BR Code.

    return payload


# --- Geração do PDF ---

def generate_carne_parcelas_pdf(parcelas_data, cliente_info, carne_info, buffer):
    doc = SimpleDocTemplate(buffer, pagesizes=A4, rightMargin=cm, leftMargin=cm, topMargin=cm, bottomMargin=cm)
    styles = getSampleStyleSheet()

    # --- ADICIONADO: Definição do estilo 'SmallBold' ---
    styles.add(ParagraphStyle(name='SmallBold',
                              parent=styles['Normal'],
                              fontSize=7,
                              fontName='Helvetica-Bold',
                              alignment=TA_CENTER
                             ))
    # --- NOVO: Definição do estilo 'Small' ---
    styles.add(ParagraphStyle(name='Small',
                              parent=styles['Normal'],
                              fontSize=7,
                              fontName='Helvetica'
                             ))
    # --- NOVO: Definição do estilo 'Tiny' ---
    styles.add(ParagraphStyle(name='Tiny',
                              parent=styles['Normal'],
                              fontSize=6,
                              fontName='Helvetica'
                             ))
    # --- NOVO: Definição do estilo 'ReceiptHeader' ---
    styles.add(ParagraphStyle(name='ReceiptHeader',
                              parent=styles['Normal'],
                              fontSize=9,
                              fontName='Helvetica-Bold',
                              alignment=TA_CENTER
                             ))
    # --- NOVO: Definição do estilo 'ReceiptValue' ---
    styles.add(ParagraphStyle(name='ReceiptValue',
                              parent=styles['Normal'],
                              fontSize=10,
                              fontName='Helvetica-Bold',
                              alignment=TA_RIGHT # Alinha o valor à direita
                             ))
    # --- FIM DAS ADIÇÕES ---

    elements = []

    logo_path = "/app/app/static/logobios.jpg"
    logo_data = get_base64_image_data(logo_path)

    # Loop através de cada parcela para criar um recibo separado
    for i, p in enumerate(sorted(parcelas_data, key=lambda x: x['numero_parcela'])):
        if i > 0:
            elements.append(PageBreak()) # Inicia uma nova página para cada parcela após a primeira

        # --- Seção Superior (Recibo do Beneficiário/Pagador) ---
        elements.append(Paragraph("<font size=8><b>RECIBO DO PAGADOR</b></font>", styles['Normal']))
        elements.append(Spacer(1, 0.1*cm))

        # Tabela de informações do beneficiário e pagador para o recibo
        stub_data = [
            [Paragraph("<b>Beneficiário:</b>", styles['Small']), Paragraph(carne_info['beneficiario_nome'], styles['Small'])],
            [Paragraph("<b>CNPJ do Beneficiário:</b>", styles['Small']), Paragraph(carne_info['beneficiario_cnpj_cpf'], styles['Small'])],
            [Paragraph("<b>Nome do Devedor:</b>", styles['Small']), Paragraph(cliente_info['nome'], styles['Small'])],
            [Paragraph("<b>CPF/CNPJ Devedor:</b>", styles['Small']), Paragraph(cliente_info['cpf_cnpj'], styles['Small'])],
            [Paragraph("<b>Parcela:</b>", styles['Small']), Paragraph(f"{p['numero_parcela']} de {carne_info['numero_parcelas']}", styles['Small'])],
            [Paragraph("<b>Vencimento:</b>", styles['Small']), Paragraph(format_date_br(p['data_vencimento']), styles['Small'])],
            [Paragraph("<b>Valor Devido:</b>", styles['Small']), Paragraph(format_currency(p['valor_devido']), styles['Small'])],
            [Paragraph("<b>Status:</b>", styles['Small']), Paragraph(p['status_parcela'], styles['Small'])],
        ]
        stub_table = Table(stub_data, colWidths=[4*cm, 8*cm]) # Ajustar larguras das colunas conforme necessário
        stub_table.setStyle(TableStyle([
            ('GRID', (0,0), (-1,-1), 0.5, colors.lightgrey),
            ('FONTNAME', (0,0), (-1,-1), 'Helvetica'),
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('LEFTPADDING', (0,0), (-1,-1), 2),
            ('RIGHTPADDING', (0,0), (-1,-1), 2),
            ('TOPPADDING', (0,0), (-1,-1), 2),
            ('BOTTOMPADDING', (0,0), (-1,-1), 2),
        ]))
        elements.append(stub_table)
        elements.append(Spacer(1, 0.5*cm))
        elements.append(Paragraph("-" * 100, styles['Normal'])) # Linha divisória
        elements.append(Spacer(1, 0.5*cm))


        # --- Seção Principal do Recibo da Parcela ---

        # Cabeçalho do recibo
        header_table_data = []
        if logo_data:
            logo = Image(logo_data, width=1.5*cm, height=1.5*cm)
            header_table_data.append([logo, Paragraph("<b>Bios Store</b>", styles['ReceiptHeader']), Paragraph(f"Pague sua cobrança usando o Pix", styles['Small'])])
        else:
            header_table_data.append([Paragraph("<b>Bios Store</b>", styles['ReceiptHeader']), Paragraph(f"Pague sua cobrança usando o Pix", styles['Small'])])

        header_table = Table(header_table_data, colWidths=[2*cm, 8*cm, 6*cm])
        header_table.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('ALIGN', (0,0), (0,0), 'LEFT'),
            ('ALIGN', (1,0), (1,0), 'CENTER'),
            ('ALIGN', (2,0), (2,0), 'RIGHT'),
        ]))
        elements.append(header_table)
        elements.append(Spacer(1, 0.2*cm))

        # Detalhes principais (Beneficiário, Data de Vencimento, Valor)
        parcel_details_data = [
            [Paragraph("<b>Beneficiário:</b>", styles['Small']), Paragraph(carne_info['beneficiario_nome'], styles['Small']), Paragraph("<b>Vencimento</b>", styles['SmallBold']), Paragraph("<b>Valor</b>", styles['SmallBold'])],
            [Paragraph("<b>CNPJ do Beneficiário:</b>", styles['Small']), Paragraph(carne_info['beneficiario_cnpj_cpf'], styles['Small']), Paragraph(format_date_br(p['data_vencimento']), styles['ReceiptValue']), Paragraph(format_currency(p['valor_devido']), styles['ReceiptValue'])]
        ]
        parcel_details_table = Table(parcel_details_data, colWidths=[3*cm, 5*cm, 4*cm, 4*cm])
        parcel_details_table.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('ALIGN', (2,0), (2,0), 'CENTER'), # Cabeçalho Vencimento
            ('ALIGN', (3,0), (3,0), 'CENTER'), # Cabeçalho Valor
            ('ALIGN', (2,1), (2,1), 'CENTER'), # Valor Vencimento
            ('ALIGN', (3,1), (3,1), 'CENTER'), # Valor Valor
            ('LEFTPADDING', (0,0), (-1,-1), 0),
            ('RIGHTPADDING', (0,0), (-1,-1), 0),
        ]))
        elements.append(parcel_details_table)
        elements.append(Spacer(1, 0.2*cm))

        # Instruções Adicionais / Notas (como multa e juros)
        instructions = f"<b>Instruções Adicionais:</b> Após vencimento: Multa {float(p['juros_multa_percentual']):.2f}%, Juros {float(p['juros_mora_percentual_ao_dia']):.4f}% a.d."
        elements.append(Paragraph(instructions, styles['Small']))
        elements.append(Spacer(1, 0.2*cm))

        # Código QR PIX e instruções
        elements.append(Paragraph("<font size=8><b>PAGAMENTO VIA PIX</b></font>", styles['Normal']))
        elements.append(Spacer(1, 0.2*cm))

        # Gerar código QR PIX dinamicamente para a parcela atual
        pix_key = carne_info.get('pix_key', 'your.pix.key@example.com') # Obter chave PIX de carne_info
        beneficiary_name = carne_info.get('beneficiario_nome', 'Bios Store')
        # Você pode querer um ID de transação exclusivo para cada parcela
        parcel_transaction_id = f"CARNE{carne_info['id_carne']}_PARCELA{p['numero_parcela']}"

        # Construir o payload PIX - ESTA É A PARTE CRÍTICA QUE VOCÊ PRECISA REFINAR
        # Este exemplo usa um payload simplificado e não padrão.
        # Uma implementação real requer a construção adequada do BR Code.
        # Para testes, você pode usar uma string PIX codificada que gera um código QR.
        pix_string = generate_pix_payload(
            parcel_value=Decimal(p['valor_devido']),
            beneficiary_name=beneficiary_name,
            pix_key=pix_key,
            transaction_id=parcel_transaction_id
        )

        if pix_string:
            qr_code = qr.QrCodeWidget(pix_string)
            bounds = qr_code.getBounds()
            width = bounds[2] - bounds[0]
            height = bounds[3] - bounds[1]
            d = Drawing(width, height, transform=[3*cm/width,0,0,3*cm/height,0,0])
            d.add(qr_code)
            
            qr_image = Image(d, width=3*cm, height=3*cm)

            # Layout para código QR e instruções de texto
            qr_text_data = [
                [qr_image, Paragraph("1. Abra o aplicativo do seu banco ou instituição financeira.", styles['Small'])],
                ["", Paragraph("2. Entre no ambiente Pix.", styles['Small'])],
                ["", Paragraph("3. Escolha a opção <b>Pagar com QRcode</b>.", styles['Small'])],
                ["", Paragraph("4. Aponte a câmera para o QRcode acima.", styles['Small'])],
                ["", Paragraph("5. Confirme as informações e finalize o pagamento.", styles['Small'])]
            ]
            qr_text_table = Table(qr_text_data, colWidths=[4*cm, 12*cm])
            qr_text_table.setStyle(TableStyle([
                ('VALIGN', (0,0), (-1,-1), 'TOP'),
                ('LEFTPADDING', (0,0), (-1,-1), 0),
                ('RIGHTPADDING', (0,0), (-1,-1), 0),
                ('TOPPADDING', (0,0), (-1,0), 0), # Reduzir preenchimento superior para a primeira linha
                ('BOTTOMPADDING', (0,0), (-1,-1), 0),
            ]))
            elements.append(qr_text_table)
            elements.append(Spacer(1, 0.5*cm))

        # Informações do Pagador (na parte inferior do recibo)
        elements.append(Paragraph("<b>Pagador</b>", styles['SmallBold']))
        elements.append(Paragraph(cliente_info['nome'], styles['Normal']))
        elements.append(Paragraph(cliente_info['endereco'], styles['Normal'])) # Assumindo que o endereço está disponível
        elements.append(Paragraph(f"{cliente_info.get('cidade', '')}, {cliente_info.get('estado', '')}", styles['Normal'])) # Assumindo cidade/estado
        elements.append(Spacer(1, 0.5*cm))

        # Rodapé
        elements.append(Paragraph(f"<i>Documento gerado em {format_date_br(date.today())}</i>", styles['Tiny']))

    doc.build(elements)
    buffer.seek(0)
    return buffer