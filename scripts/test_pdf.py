from reportlab.lib.pagesizes import letter, landscape, A4
from reportlab.pdfgen import canvas
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib import colors

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super(NumberedCanvas, self).__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_number(num_pages)
            canvas.Canvas.showPage(self)
        canvas.Canvas.save(self)

    def draw_page_number(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748b"))
        self.drawString(50, 30, "Hope for Families Campaign | Group Categorization Audit")
        self.drawRightString(self._pagesize[0] - 50, 30, f"Page {self._pageNumber} of {page_count}")
        self.restoreState()

doc = SimpleDocTemplate("test_output.pdf", pagesize=landscape(A4))
styles = getSampleStyleSheet()
story = [Paragraph("Hello World", styles['Normal'])]
doc.build(story, canvasmaker=NumberedCanvas)
print("Test PDF built successfully.")
