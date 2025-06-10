# backend/app/pdf_utils.py
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image, KeepInFrame, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.colors import black
from io import BytesIO
from datetime import date
from decimal import Decimal
import os
from typing import Optional, List

# Caminho para o logo (ajuste conforme a sua estrutura de arquivos)
# Assumindo que o logo está em backend/app/static/logo.png
LOGO_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static", "logobios.jpeg")
if not os.path.exists(LOGO_PATH):
    print(f"AVISO: Logo da empresa não encontrado em {LOGO_PATH}. O PDF será gerado sem logo da empresa.")
    LOGO_PATH = None

# NOVO: Caminho para a imagem do QR Code Pix estático
# Substitua 'qrcode_pix_picpay.png' pelo nome real do seu arquivo de imagem QR Code.
QRCODE_STATIC_IMAGE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static", "meu_qrcode_pix.jpeg")
if not os.path.exists(QRCODE_STATIC_IMAGE_PATH):
    print(f"ERRO CRÍTICO: Imagem do QR Code Pix estático não encontrada em {QRCODE_STATIC_IMAGE_PATH}. O PDF será gerado sem o QR Code.")
    QRCODE_STATIC_IMAGE_PATH = None


# Stylesheets
styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name='Center', alignment=TA_CENTER))
styles.add(ParagraphStyle(name='Right', alignment=TA_RIGHT))
styles.add(ParagraphStyle(name='Left', alignment=TA_LEFT))
styles.add(ParagraphStyle(name='Small', fontSize=8, leading=10, alignment=TA_LEFT))
styles.add(ParagraphStyle(name='SmallCenter', fontSize=8, leading=10, alignment=TA_CENTER))
styles.add(ParagraphStyle(name='Bold', fontName='Helvetica-Bold', fontSize=10, leading=12))
styles.add(ParagraphStyle(name='BoldLarge', fontName='Helvetica-Bold', fontSize=12, leading=14))

# --- CONFIGURAÇÕES PIX (APENAS PARA TEXTO NO PDF, JÁ QUE O QR CODE É ESTÁTICO) ---
# **ESTES SÃO DADOS DE EXEMPLO. VOCÊ PRECISA SUBSTITUÍ-LOS PELOS DADOS REAIS DA SUA EMPRESA/NEGÓCIO.**
PIX_BENEFICIARIO_NOME = "BIOS STORE" # Ex: "BIOS STORE LTDA"
PIX_BENEFICIARIO_CNPJ = "23.888.763/0001-16" # Ex: "12.345.678/0001-90" (pode ser CPF também)
PIX_CHAVE_FIXA = "sua_chave_pix@dominio.com" # Ex: "contato@biosstore.com" ou seu CPF/CNPJ/telefone
PIX_LOCALIDADE = "SUA CIDADE/UF" # Ex: "SAO PAULO/SP"
# --- FIM CONFIGURAÇÕES PIX ---

# Não precisamos mais de generate_pix_qrcode_image ou create_pix_payload_string
# pois estamos usando uma imagem estática.

def generate_carne_parcelas_pdf(
    parcelas_data: List[dict],
    cliente_info: dict,
    carne_info: dict,
    output_buffer: BytesIO
):
    """
    Gera um PDF contendo múltiplos recibos de parcela de carnê, cada um com QR Code Pix estático.
    A intenção é que caibam aproximadamente 3 recibos por página A4.
    """
    doc = SimpleDocTemplate(
        output_buffer,
        pagesize=A4,
        rightMargin=10 * mm,
        leftMargin=10 * mm,
        topMargin=10 * mm,
        bottomMargin=10 * mm
    )
    
    elements = []
    
    # Estilo para linha divisória
    hr_style = ParagraphStyle(name='HR', spaceBefore=0, spaceAfter=0, borderPadding=0, leading=0)
    
    for i, parcela in enumerate(parcelas_data):
        story_for_parcela = []
        
        # Bloco Superior do Recibo (informações do beneficiário e vencimento)
        header_table_data = []
        # Logo e "Recibo do Pagador"
        if LOGO_PATH:
            logo_img = Image(LOGO_PATH, width=25*mm, height=12*mm) # Ajuste o tamanho do logo
            header_table_data.append([logo_img, Paragraph(f"<font size=10><b>Recibo do Pagador</b></font>", styles['Right'])])
        else:
            header_table_data.append(["", Paragraph(f"<font size=10><b>Recibo do Pagador</b></font>", styles['Right'])])
        
        # Adicionar informações de documento e vencimento/valor (similar ao modelo)
        header_table_data.append([Paragraph(f"<font size=9><b>Beneficiário:</b> {PIX_BENEFICIARIO_NOME}</font>", styles['Left']),
                                  Paragraph(f"<font size=9><b>Vencimento:</b> {parcela['data_vencimento'].strftime('%d/%m/%Y')}</font>", styles['Right'])])
        header_table_data.append([Paragraph(f"<font size=9><b>CNPJ/CPF:</b> {PIX_BENEFICIARIO_CNPJ}</font>", styles['Left']),
                                  Paragraph(f"<font size=9><b>Valor:</b> R$ {parcela['saldo_devedor']:.2f}</font>", styles['Right'])])
        header_table_data.append([Paragraph(f"<font size=9><b>Parcela Nº:</b> {parcela['numero_parcela']} de {carne_info['numero_parcelas']}</font>", styles['Left']), ""])
        
        from reportlab.platypus import Table, TableStyle
        from reportlab.lib import colors
        
        header_table = Table(header_table_data, colWidths=[doc.width/2.0, doc.width/2.0])
        header_table.setStyle(TableStyle([
            ('ALIGN', (0,0), (-1,-1), 'LEFT'),
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('BOTTOMPADDING', (0,0), (-1,-1), 1*mm),
            ('LEFTPADDING', (0,0), (-1,-1), 0),
            ('RIGHTPADDING', (0,0), (-1,-1), 0),
            ('SPAN',(0,0),(0,0)), # Logo takes first column (adjust if you change structure)
            ('SPAN',(1,0),(1,0)), # Title takes second column (adjust if you change structure)
        ]))
        story_for_parcela.append(header_table)
        story_for_parcela.append(Spacer(0, 3*mm))
        
        # Linha para separar o cabeçalho das instruções
        story_for_parcela.append(Paragraph('<hr color="#000000" size="1" noshade />', hr_style))
        story_for_parcela.append(Spacer(0, 3*mm))

        # Informações de Pagamento (Instruções Adicionais e Pagador) e QR Code
        main_content_table_data = []
        
        # Coluna da esquerda: Instruções Adicionais e Pagador
        instructions_text = []
        instructions_text.append(Paragraph(f"<font size=9><b>Instruções Adicionais:</b></font>", styles['Left']))
        
        # Formata os percentuais para exibição
        multa_percentual_formatado = f"{parcela['juros_multa_percentual']:.2f}".replace('.', ',')
        juros_diario_percentual_formatado = f"{parcela['juros_mora_percentual_ao_dia']:.4f}".replace('.', ',')

        instructions_text.append(Paragraph(f"<font size=8>Após vencimento: Multa {multa_percentual_formatado}% Juros {juros_diario_percentual_formatado}% a.d.</font>", styles['Left']))
        instructions_text.append(Paragraph(f"<font size=8><b>Descrição Carnê:</b> {carne_info['descricao'] or 'N/A'}</font>", styles['Left']))
        if parcela['observacoes']:
            instructions_text.append(Paragraph(f"<font size=8><b>Obs. Parcela:</b> {parcela['observacoes']}</font>", styles['Left']))
        instructions_text.append(Spacer(0, 5*mm))

        instructions_text.append(Paragraph(f"<font size=9><b>Pagador:</b> {cliente_info['nome']}</font>", styles['Left']))
        instructions_text.append(Paragraph(f"<font size=9><b>CPF/CNPJ:</b> {cliente_info['cpf_cnpj']}</font>", styles['Left']))
        instructions_text.append(Paragraph(f"<font size=9><b>Endereço:</b> {cliente_info['endereco'] or 'N/A'}</font>", styles['Left']))
        
        # Coluna da direita: QR Code Pix e instruções para pagamento
        qr_code_elements = []
        
        # Inserir a imagem do QR Code estático
        if QRCODE_STATIC_IMAGE_PATH:
            qr_image = Image(QRCODE_STATIC_IMAGE_PATH, width=40*mm, height=40*mm) # Tamanho da imagem do QR Code
            qr_code_elements.append(qr_image)
            qr_code_elements.append(Paragraph(f"<font size=8><b>Chave PIX:</b> {PIX_CHAVE_FIXA}</font>", styles['Small']))
            qr_code_elements.append(Paragraph(f"<font size=8>Pague sua cobrança usando o Pix:</font>", styles['Small']))
            qr_code_elements.append(Paragraph(f"<font size=7>1. Abra o aplicativo do seu banco ou instituição financeira</font>", styles['Small']))
            qr_code_elements.append(Paragraph(f"<font size=7>2. Escolha a opção 'Pagar com QR Code Pix' ou 'Pix Copia e Cola'</font>", styles['Small']))
            qr_code_elements.append(Paragraph(f"<font size=7>3. Aponte a câmera para o QR Code acima (se aplicável)</font>", styles['Small']))
            qr_code_elements.append(Paragraph(f"<font size=7>4. Confirme as informações e DIGITE O VALOR R$ {parcela['saldo_devedor']:.2f}</font>", styles['Small']))
            qr_code_elements.append(Paragraph(f"<font size=7>5. Finalize o pagamento.</font>", styles['Small']))
            qr_code_elements.append(Paragraph(f"<font size=7><b>ATENÇÃO: Digite o valor manualmente!</b></font>", styles['SmallBold']))
        else:
            qr_code_elements.append(Paragraph("<i>Imagem do QR Code não disponível.</i>", styles['SmallCenter']))
            qr_code_elements.append(Paragraph(f"<font size=8><b>Chave PIX:</b> {PIX_CHAVE_FIXA}</font>", styles['Small']))
            qr_code_elements.append(Paragraph(f"<font size=8><b>Valor para pagamento: R$ {parcela['saldo_devedor']:.2f}</b></font>", styles['Small']))
            qr_code_elements.append(Paragraph(f"<font size=8>Use o Pix Copia e Cola com a chave acima e digite o valor.</font>", styles['Small']))

        main_content_table_data.append([instructions_text, qr_code_elements])

        main_content_table = Table(main_content_table_data, colWidths=[doc.width - 45*mm, 45*mm]) # Ajuste largura para o QR Code
        main_content_table.setStyle(TableStyle([
            ('ALIGN', (0,0), (-1,-1), 'LEFT'),
            ('VALIGN', (0,0), (0,0), 'TOP'), # Left column top aligned
            ('VALIGN', (1,0), (1,0), 'MIDDLE'), # Right column middle aligned (for QR)
            ('BOTTOMPADDING', (0,0), (-1,-1), 1*mm),
            ('LEFTPADDING', (0,0), (-1,-1), 0),
            ('RIGHTPADDING', (0,0), (-1,-1), 0),
        ]))
        story_for_parcela.append(main_content_table)
        
        elements.extend(story_for_parcela)
        
        # Adicionar uma linha divisória para separar os recibos no PDF
        if (i + 1) % len(parcelas_data) != 0: # Não adiciona divisória após o último recibo
            elements.append(Spacer(0, 5*mm))
            elements.append(Paragraph('<hr color="#333333" size="1" noshade />', hr_style)) # Linha sólida cinza escuro
            elements.append(Spacer(0, 5*mm))

        # Quebra de página após cada 3 recibos
        if (i + 1) % 3 == 0 and (i + 1) < len(parcelas_data):
            elements.append(PageBreak())

    doc.build(elements)

    return output_buffer