from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import fitz

pdfmetrics.registerFont(TTFont('Arial', r'C:\Windows\Fonts\arial.ttf'))
pdfmetrics.registerFont(TTFont('Arial-Bold', r'C:\Windows\Fonts\arialbd.ttf'))

from reportlab.platypus import SimpleDocTemplate, Paragraph
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.pagesizes import A4, landscape

doc = SimpleDocTemplate("test_arial.pdf", pagesize=landscape(A4))
p_style = ParagraphStyle('Test', fontName='Arial', fontSize=12, leading=15)
doc.build([Paragraph("Hope for Families (HFF) — Complete & Verified • Form 227", p_style)])

doc_check = fitz.open("test_arial.pdf")
print("Extracted text with Arial TTF:")
print(repr(doc_check[0].get_text()))
