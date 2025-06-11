from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image, Table, TableStyle, PageBreak # Removido 'Flowables'
from reportlab.lib.colors import black, blue, red
from reportlab.lib import colors
from io import BytesIO
from reportlab.graphics.barcode import qr
from reportlab.graphics.shapes import Drawing
from reportlab.graphics import renderPDF
from decimal import Decimal
from datetime import date, timedelta
import base64 # para a imagem do QR code
from reportlab.lib.pagesizes import A4 # Importar A4 para definição de tamanho

# --- Funções Auxiliares de Formatação ---

def format_currency(value):
    """Formata um valor Decimal para string de moeda brasileira."""
    if value is None:
        return "R$ 0,00"
    return f"R$ {value:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")

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

# --- Geração do PDF ---

def generate_carne_parcelas_pdf(parcelas_data, cliente_info, carne_info, buffer):
    doc = SimpleDocTemplate(buffer, pagesize=A4)
    styles = getSampleStyleSheet()

    # --- ADICIONADO: Definição do estilo 'SmallBold' ---
    styles.add(ParagraphStyle(name='SmallBold',
                              parent=styles['Normal'], # Baseado no estilo 'Normal'
                              fontSize=7,
                              fontName='Helvetica-Bold', # Define a fonte como negrito
                              alignment=TA_CENTER # Centraliza o texto
                             ))
    # --- NOVO: Definição do estilo 'Small' ---
    styles.add(ParagraphStyle(name='Small',
                              parent=styles['Normal'], # Baseado no estilo 'Normal'
                              fontSize=7,
                              fontName='Helvetica' # Fonte normal para texto pequeno
                             ))
    # --- FIM DAS ADIÇÕES ---

    elements = []

    # Caminhos para as imagens (ajuste se necessário, /app/app/static é o WORKDIR do Dockerfile)
    logo_path = "/app/app/static/logobios.jpg"
    qrcode_path = "/app/app/static/meu_qrcode_pix.jpeg"

    # Cabeçalho (Logo e Dados da Empresa - ajustar conforme necessário)
    logo_data = get_base64_image_data(logo_path)
    if logo_data:
        logo = Image(logo_data, width=2*cm, height=2*cm)
        elements.append(logo)
        elements.append(Spacer(1, 0.2*cm))

    elements.append(Paragraph("<b>Empresa de Vendas</b>", styles['h2']))
    elements.append(Paragraph("Rua Exemplo, 123 - Centro", styles['Normal']))
    elements.append(Paragraph("Cidade, Estado - CEP 12345-678", styles['Normal']))
    elements.append(Paragraph("Telefone: (XX) XXXX-XXXX | Email: contato@empresa.com", styles['Normal']))
    elements.append(Spacer(1, 0.5*cm))

    # Título do Carnê
    elements.append(Paragraph(f"<b>CARNÊ DE PAGAMENTO - ID: {carne_info['id_carne']}</b>", styles['h2']))
    elements.append(Spacer(1, 0.5*cm))

    # Dados do Cliente
    elements.append(Paragraph("<b>DADOS DO CLIENTE:</b>", styles['h3']))
    elements.append(Paragraph(f"<b>Nome:</b> {cliente_info['nome']}", styles['Normal']))
    elements.append(Paragraph(f"<b>CPF/CNPJ:</b> {cliente_info['cpf_cnpj']}", styles['Normal']))
    elements.append(Paragraph(f"<b>Endereço:</b> {cliente_info['endereco']}", styles['Normal']))
    elements.append(Paragraph(f"<b>Telefone:</b> {cliente_info['telefone']}", styles['Normal']))
    elements.append(Paragraph(f"<b>Email:</b> {cliente_info['email']}", styles['Normal']))
    elements.append(Spacer(1, 0.5*cm))

    # Dados Gerais do Carnê
    elements.append(Paragraph("<b>DETALHES DO CARNÊ:</b>", styles['h3']))
    elements.append(Paragraph(f"<b>Descrição:</b> {carne_info['descricao']}", styles['Normal']))
    elements.append(Paragraph(f"<b>Valor Total Original:</b> {format_currency(carne_info['valor_total_original'])}", styles['Normal']))
    elements.append(Paragraph(f"<b>Número de Parcelas:</b> {carne_info['numero_parcelas']}", styles['Normal']))
    elements.append(Spacer(1, 1*cm))

    # Tabela de Parcelas
    elements.append(Paragraph("<b>DETALHES DAS PARCELAS:</b>", styles['h3']))
    elements.append(Spacer(1, 0.2*cm))

    # Definir colunas da tabela
    data = [
        ["#", "Vencimento", "Valor Devido", "Multa (%)", "Juros Diário (%)", "Saldo Devedor", "Status"]
    ]
    for p in sorted(parcelas_data, key=lambda x: x['numero_parcela']):
        data.append([
            p['numero_parcela'],
            format_date_br(p['data_vencimento']),
            format_currency(p['valor_devido']),
            f"{float(p['juros_multa_percentual']):.2f}%",
            f"{float(p['juros_mora_percentual_ao_dia']):.4f}%",
            format_currency(p['saldo_devedor']),
            p['status_parcela']
        ])

    # Definir estilos da tabela
    table_style = TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.grey),
        ('TEXTCOLOR', (0,0), (-1,0), colors.whitesmoke),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0,0), (-1,0), 12),
        ('BACKGROUND', (0,1), (-1,-1), colors.beige),
        ('GRID', (0,0), (-1,-1), 1, colors.black),
        ('BOX', (0,0), (-1,-1), 1, colors.black),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('FONTSIZE', (0,0), (-1,-1), 8),
    ])

    # Ajustar a largura das colunas
    col_widths = [0.8*cm, 2.5*cm, 2.5*cm, 1.8*cm, 2.0*cm, 2.5*cm, 2.0*cm] # Total A4 aprox 18.5cm

    table = Table(data, colWidths=col_widths)
    table.setStyle(table_style)
    elements.append(table)
    elements.append(Spacer(1, 1*cm))

    # Seções de Observações (opcional, se você quiser incluir observações do carnê no PDF)
    if carne_info.get('observacoes'):
        elements.append(Paragraph("<b>OBSERVAÇÕES GERAIS DO CARNÊ:</b>", styles['h3']))
        elements.append(Paragraph(carne_info['observacoes'], styles['Normal']))
        elements.append(Spacer(1, 0.5*cm))

    # Seção de QR Code para Pagamento PIX (exemplo)
    elements.append(Paragraph("<b>PAGAMENTO VIA PIX (CÓPIA E COLA OU QR CODE):</b>", styles['h3']))
    elements.append(Spacer(1, 0.2*cm))

    qr_code_elements = []
    # Assumindo que você tem um QR code estático ou dinâmico
    # Para este exemplo, estamos usando um QR code de imagem estática
    qrcode_data = get_base64_image_data(qrcode_path)
    if qrcode_data:
        img_qr = Image(qrcode_data, width=3*cm, height=3*cm)
        qr_code_elements.append(img_qr)
        qr_code_elements.append(Spacer(1, 0.1*cm))
        
        qr_code_elements.append(Paragraph(f"<font size=7><b>ATENÇÃO: Digite o valor manualmente!</b></font>", styles['SmallBold']))
        qr_code_elements.append(Spacer(1, 0.2*cm))
        qr_code_elements.append(Paragraph("<i>Escaneie para detalhes ou use a chave PIX: seu.email@pix.com</i>", styles['Small'])) 
        qr_code_elements.append(Spacer(1, 0.2*cm)) # Adicionei um Spacer para melhor espaçamento
        qr_code_elements.append(Paragraph("<b>Chave PIX:</b> (XX) XXXXX-XXXX ou CPF/CNPJ", styles['Normal']))
        qr_code_elements.append(Spacer(1, 0.5*cm))

    # Adiciona os elementos do QR code ao documento principal
    elements.extend(qr_code_elements)

    # Nota de rodapé (opcional)
    elements.append(Spacer(1, 1*cm))
    elements.append(Paragraph(f"<i>Documento gerado em {format_date_br(date.today())}</i>", styles['Small']))

    doc.build(elements)
    buffer.seek(0)
    return buffer