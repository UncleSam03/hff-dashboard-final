import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.section import WD_ORIENT
from docx.oxml import parse_xml
from docx.oxml.ns import nsdecls

doc = docx.Document()
section = doc.sections[0]
section.orientation = WD_ORIENT.LANDSCAPE
section.page_width = Inches(11.69)
section.page_height = Inches(8.27)

p = doc.add_paragraph("Test Document Title")
table = doc.add_table(rows=2, cols=3)
row0 = table.rows[0]
for idx, text in enumerate(["Col 1", "Col 2", "Col 3"]):
    cell = row0.cells[idx]
    cell.text = text
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="059669"/>')
    cell._tc.get_or_add_tcPr().append(shd)

doc.save("test_docx.docx")
print("Saved test_docx.docx successfully.")
