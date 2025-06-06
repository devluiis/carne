from fpdf import FPDF
from datetime import datetime, date
from app import models
from sqlalchemy.orm import Session
from app.config import DATABASE_URL # Apenas para exemplo, não usado diretamente aqui
import os
from pathlib import Path
import qrcode
import io

# Informações da Loja
STORE_NAME = "Bios Store"
STORE_CNPJ = "23.123.123/0001-01"
STORE_ADDRESS = "Rua José Bonifácio nº 27"
STORE_PHONE = "(63) 99285-1025"
STORE_EMAIL = "leandroxam@hotmail.com"

# Caminho para o logo - CORREÇÃO APLICADA AQUI
# Assumindo que logobios.jpg está em backend/app/static/logobios.jpg
LOGO_PATH = Path(__file__).resolve().parent / "static" / "logobios.jpg"


class PDF(FPDF):
    def header(self):
        # Logo
        if os.path.exists(str(LOGO_PATH)): # Converter Path para string para os.path.exists
            # self.image(str(LOGO_PATH), 10, 8, 33) # Descomente para ativar a imagem
            self.set_font('Arial', 'B', 10)
            self.cell(0, 10, '>>> LOGO TESTE OK <<<', 0, 1, 'L') # Placeholder para o logo
        else:
            self.set_font('Arial', 'B', 10)
            self.cell(0, 10, 'Logo Nao Encontrado', 0, 1, 'L')

        # Informações da Loja
        self.set_font('Arial', 'B', 15)
        self.cell(80) # Mover para a direita do logo
        self.cell(30, 10, STORE_NAME, 0, 1, 'L')
        
        self.set_font('Arial', '', 9)
        self.cell(80)
        self.cell(30, 5, f"CNPJ: {STORE_CNPJ}", 0, 1, 'L')
        self.cell(80)
        self.cell(30, 5, STORE_ADDRESS, 0, 1, 'L')
        self.cell(80)
        self.cell(30, 5, f"Tel: {STORE_PHONE} | Email: {STORE_EMAIL}", 0, 1, 'L')
        
        # Título do Carnê
        self.ln(15) # Pular linha
        self.set_font('Arial', 'B', 16)
        self.cell(0, 10, 'CARNÊ DE PAGAMENTO', 0, 1, 'C')
        self.ln(5)

    def footer(self):
        self.set_y(-15)
        self.set_font('Arial', 'I', 8)
        self.cell(0, 10, f'Página {self.page_no()}', 0, 0, 'C')

    def chapter_title(self, title):
        self.set_font('Arial', 'B', 12)
        self.cell(0, 6, title, 0, 1, 'L')
        self.ln(2)

    def chapter_body(self, data, is_multicell=False):
        self.set_font('Arial', '', 10)
        if is_multicell:
            self.multi_cell(0, 5, data)
        else:
            self.cell(0, 5, data)
        self.ln()
        
    # MÉTODO ANTIGO DA TABELA DE PARCELAS (NÃO MAIS USADO DIRETAMENTE PARA CADA PARCELA)
    # def installment_table(self, parcelas):
    #     self.set_font('Arial', 'B', 10)
    #     col_widths = [20, 40, 40, 90] 
    #     
    #     self.cell(col_widths[0], 7, 'Parcela', 1, 0, 'C')
    #     self.cell(col_widths[1], 7, 'Vencimento', 1, 0, 'C')
    #     self.cell(col_widths[2], 7, 'Valor (R$)', 1, 0, 'C')
    #     self.cell(col_widths[3], 7, 'Recebi (Assinatura do Credor)', 1, 1, 'C')
    #     self.set_font('Arial', '', 10)
    #     for parcela in parcelas:
    #         vencimento_str = parcela.data_vencimento.strftime('%d/%m/%Y')
    #         valor_str = f"{parcela.valor_devido:.2f}".replace('.', ',')
    #         
    #         self.cell(col_widths[0], 7, str(parcela.numero_parcela), 1, 0, 'C')
    #         self.cell(col_widths[1], 7, vencimento_str, 1, 0, 'C')
    #         self.cell(col_widths[2], 7, valor_str, 1, 0, 'R')
    #         self.cell(col_widths[3], 7, '', 1, 1, 'C')
    #     self.ln(5)

    # NOVO MÉTODO para desenhar uma única parcela com QR Code
    def draw_parcela_with_qr(self, parcela, pix_cnpj, carne_descricao=""):
    # Adicionar margem superior para espaçamento entre parcelas
        self.set_y(self.get_y() + 5) 
        
        self.set_font('Arial', 'B', 12)
        self.cell(0, 8, f'PARCELA {parcela.numero_parcela} / {parcela.id_carne} - {carne_descricao}', 1, 1, 'L', fill=True)
        
        self.set_font('Arial', '', 10)
        self.cell(0, 6, f"Valor Devido: R$ {parcela.valor_devido:.2f}".replace('.', ','), 0, 1, 'L')
        self.cell(0, 6, f"Vencimento: {parcela.data_vencimento.strftime('%d/%m/%Y')}", 0, 1, 'L')
        self.cell(0, 6, f"Status: {parcela.status_parcela}", 0, 1, 'L')
        self.cell(0, 6, f"Juros/Multa: R$ {parcela.juros_multa:.2f}".replace('.', ','), 0, 1, 'L')
        
        self.ln(3)
        self.set_font('Arial', 'B', 10)
        self.cell(0, 6, f"PIX CNPJ: {pix_cnpj}", 0, 1, 'L')
        self.ln(2)

        qr_content = f"CNPJ PIX: {pix_cnpj}, Valor: R$ {parcela.valor_devido:.2f}, Parcela: {parcela.numero_parcela}, Carnê ID: {parcela.id_carne}"
    
        try:
            # Gera QR Code
            qr_img = qrcode.make(qr_content)
        
        # Salva em arquivo temporário
            with tempfile.NamedTemporaryFile(delete=False, suffix=".png") as tmp_qr:
                qr_img.save(tmp_qr, format="PNG")
                tmp_qr_path = tmp_qr.name

        # Adiciona ao PDF
            qr_x = self.get_x() + 150
            qr_y = self.get_y() - 30
            self.image(tmp_qr_path, qr_x, qr_y, 30)

            # Remove imagem temporária após uso
            os.remove(tmp_qr_path)

        except Exception as e:
            self.set_font('Arial', 'I', 8)
            self.cell(0, 10, f"Erro ao gerar QR Code: {e}", 0, 1, 'L')
            print(f"Erro ao gerar QR Code: {e}")
        
            self.ln(10)
            self.cell(0, 5, "_" * 60, 0, 1, 'C')
            self.set_font('Arial', '', 9)
            self.cell(0, 5, 'Assinatura do Credor', 0, 1, 'C')
            self.ln(10)


def generate_carne_pdf_bytes(db_carne: models.Carne) -> bytes:
    # DEBUG: Dados do Carnê (manter temporariamente para depuração)
    print(f"DEBUG: Dados do Carnê recebidos para PDF: ID={db_carne.id_carne}, Cliente={db_carne.cliente.nome if db_carne.cliente else 'N/A'}, Parcelas={len(db_carne.parcelas) if db_carne.parcelas else 0}")
    print(f"DEBUG: Descricao do Carne: {db_carne.descricao}")
    print(f"DEBUG: Valor Total Original: {db_carne.valor_total_original}")

    # Inicialização do PDF (DESCOMENTADAS E CORRETAS)
    pdf = PDF()
    pdf.add_page() # PRIMEIRA PÁGINA

    # --- SEÇÃO: PRIMEIRA PÁGINA ---
    # Dados do Cliente
    pdf.chapter_title('Dados do Cliente')
    pdf.chapter_body(f"Nome: {db_carne.cliente.nome}")
    pdf.chapter_body(f"CPF/CNPJ: {db_carne.cliente.cpf_cnpj}")
    if db_carne.cliente.endereco:
        pdf.chapter_body(f"Endereço: {db_carne.cliente.endereco}")
    if db_carne.cliente.telefone:
        pdf.chapter_body(f"Telefone: {db_carne.cliente.telefone}")
    pdf.ln(5)

    # Detalhes do Carnê
    pdf.chapter_title('Detalhes do Carnê')
    if db_carne.descricao:
        pdf.chapter_body(f"Descrição: {db_carne.descricao}")
    pdf.chapter_body(f"Valor Total Original: R$ {db_carne.valor_total_original:.2f}".replace('.', ','))
    if db_carne.valor_entrada > 0:
        pdf.chapter_body(f"Valor de Entrada: R$ {db_carne.valor_entrada:.2f}".replace('.', ','))
        pdf.chapter_body(f"Forma Pag. Entrada: {db_carne.forma_pagamento_entrada or 'N/A'}")
    
    valor_a_parcelar = db_carne.valor_total_original - (db_carne.valor_entrada or 0)
    pdf.chapter_body(f"Valor a Parcelar: R$ {valor_a_parcelar:.2f}".replace('.', ','))
    pdf.chapter_body(f"Número de Parcelas: {db_carne.numero_parcelas}")
    pdf.chapter_body(f"Valor da Parcela Original: R$ {db_carne.valor_parcela_original:.2f}".replace('.', ','))
    pdf.chapter_body(f"Primeiro Vencimento: {db_carne.data_primeiro_vencimento.strftime('%d/%m/%Y')}")
    pdf.chapter_body(f"Frequência: {db_carne.frequencia_pagamento.capitalize()}")
    if db_carne.observacoes:
         pdf.chapter_body(f"Observações: {db_carne.observacoes}")
    pdf.ln(5)

    # Termos e Assinatura do Devedor (NA PRIMEIRA PÁGINA)
    pdf.ln(10)
    pdf.chapter_title('Termos e Assinatura do Devedor')
    texto_termos = (
        "Declaro que recebi o(s) produto(s) e/ou serviço(s) referente(s) a este carnê e concordo com os termos de pagamento aqui estabelecidos. "
        "O não pagamento de qualquer parcela na data de vencimento implicará na cobrança de multa e juros conforme legislação vigente e/ou contrato."
    )
    pdf.chapter_body(texto_termos, is_multicell=True)
    pdf.ln(15)
    pdf.cell(0, 5, "_" * 60, 0, 1, 'C')
    pdf.set_font('Arial', '', 10)
    pdf.cell(0, 5, db_carne.cliente.nome, 0, 1, 'C')
    pdf.cell(0, 5, f"CPF/CNPJ: {db_carne.cliente.cpf_cnpj}", 0, 1, 'C')
    pdf.ln(5)
    pdf.cell(0, 5, f"Data: ___/___/_____", 0, 0, 'L')
    
    # --- SEÇÃO: SEGUNDA PÁGINA EM DIANTE: PARCELAS INDIVIDUAIS ---
    if db_carne.parcelas:
        sorted_parcelas = sorted(db_carne.parcelas, key=lambda p: p.numero_parcela)
        
        pix_cnpj_constant = "23888763000116" # Seu CNPJ PIX

        for i, parcela in enumerate(sorted_parcelas):
            pdf.add_page() # Adiciona uma nova página para cada parcela
            pdf.draw_parcela_with_qr(parcela, pix_cnpj_constant, db_carne.descricao)
    else:
        pdf.add_page() # Adiciona uma página para o caso de não ter parcelas
        pdf.chapter_body("Nenhuma parcela gerada para este carnê.")

    pdf_byte_data = pdf.output(dest='S')
    if isinstance(pdf_byte_data, bytearray):
        return bytes(pdf_byte_data)
    return pdf_byte_data
