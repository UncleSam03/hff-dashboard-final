import json
import os
import shutil
import re
from reportlab.lib.pagesizes import A4, landscape
from reportlab.pdfgen import canvas
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
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
            self.draw_decorations(num_pages)
            canvas.Canvas.showPage(self)
        canvas.Canvas.save(self)

    def draw_decorations(self, page_count):
        self.saveState()
        w, h = self._pagesize

        # Running top header for pages > 1
        if self._pageNumber > 1:
            self.setStrokeColor(colors.HexColor("#cbd5e1"))
            self.setLineWidth(0.5)
            self.line(36, h - 25, w - 36, h - 25)

            self.setFont("Helvetica-Bold", 7.5)
            self.setFillColor(colors.HexColor("#1e293b"))
            self.drawString(36, h - 20, "HOPE FOR FAMILIES (HFF) CAMPAIGN")
            self.setFont("Helvetica", 7.5)
            self.setFillColor(colors.HexColor("#64748b"))
            self.drawString(200, h - 20, "|  Campaign Groups Categorization & Field Verification Audit")
            self.drawRightString(w - 36, h - 20, "Mochudi, Botswana  |  1 Nov 2026")

        # Bottom footer line on all pages
        self.setStrokeColor(colors.HexColor("#cbd5e1"))
        self.setLineWidth(0.5)
        self.line(36, 25, w - 36, 25)

        self.setFont("Helvetica", 7.5)
        self.setFillColor(colors.HexColor("#64748b"))
        self.drawString(36, 15, "Confidential  -  Hope for Families Campaign Field Operations  |  Total 107 Groups Audited")
        self.drawRightString(w - 36, 15, f"Page {self._pageNumber} of {page_count}")
        self.restoreState()

def clean_txt(s):
    if not s:
        return ''
    s = str(s).strip()
    s = s.replace('\u2014', ' - ').replace('\u2013', ' - ').replace('', ' - ')
    s = s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    s = re.sub(r'\s+', ' ', s)
    return s

def build_pdf():
    with open('scripts/group_audit_enriched.json', 'r', encoding='utf-8') as f:
        groups = json.load(f)

    out_primary = r'C:\Users\samuk\Documents\Registers\HFF_Campaign_Groups_Categorization_Audit.pdf'
    out_mirror = r'c:\Users\samuk\Documents\hff-dashboard-final\public\HFF_Campaign_Groups_Categorization_Audit.pdf'

    # Check if primary is locked by user's viewer
    try:
        with open(out_primary, 'ab') as f:
            pass
    except Exception:
        out_primary = r'C:\Users\samuk\Documents\Registers\HFF_Campaign_Groups_Categorization_Audit_Updated.pdf'
        out_mirror = r'c:\Users\samuk\Documents\hff-dashboard-final\public\HFF_Campaign_Groups_Categorization_Audit_Updated.pdf'

    # Landscape A4: 841.89 x 595.27 pt.
    doc = SimpleDocTemplate(
        out_primary,
        pagesize=landscape(A4),
        leftMargin=36,
        rightMargin=36,
        topMargin=32,
        bottomMargin=32
    )

    styles = getSampleStyleSheet()

    # Typography styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=15,
        leading=18,
        textColor=colors.HexColor('#0f172a')
    )

    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor('#475569')
    )

    kpi_title_style = ParagraphStyle(
        'KPITitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=7.5,
        leading=9.5,
        alignment=1
    )

    kpi_val_style = ParagraphStyle(
        'KPIVal',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=14,
        leading=16,
        alignment=1
    )

    kpi_sub_style = ParagraphStyle(
        'KPISub',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=7,
        leading=8.5,
        alignment=1,
        textColor=colors.HexColor('#64748b')
    )

    sec_title_style = ParagraphStyle(
        'SecTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=12,
        textColor=colors.HexColor('#0f172a')
    )

    sec_desc_style = ParagraphStyle(
        'SecDesc',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=7.5,
        leading=10,
        textColor=colors.HexColor('#334155')
    )

    th_style = ParagraphStyle(
        'TH',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=7.5,
        leading=9.5,
        textColor=colors.white
    )

    td_style = ParagraphStyle(
        'TD',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=7,
        leading=8.5,
        textColor=colors.HexColor('#1e293b')
    )

    td_bold = ParagraphStyle(
        'TDBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=7,
        leading=8.5,
        textColor=colors.HexColor('#0f172a')
    )

    td_notes = ParagraphStyle(
        'TDNotes',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=6.5,
        leading=8,
        textColor=colors.HexColor('#475569')
    )

    story = []

    # Title & Executive Header
    story.append(Paragraph("HOPE FOR FAMILIES (HFF) CAMPAIGN - GROUPS CATEGORIZATION AUDIT", title_style))
    story.append(Spacer(1, 3))
    story.append(Paragraph(
        "<b>Campaign:</b> Mochudi Community, Botswana  |  <b>Total Groups:</b> 107 Groups  |  "
        "<b>Active Digital Records:</b> 2,063 (422 Facilitators, 1,641 Participants)  |  <b>Audit Date:</b> 1 November 2026",
        subtitle_style
    ))
    story.append(Spacer(1, 6))

    # KPI summary bar
    cat1_groups = [g for g in groups if g['category'] == 1]
    cat2_groups = [g for g in groups if g['category'] == 2]
    cat3_groups = [g for g in groups if g['category'] == 3]

    kpi_card_1 = [
        Paragraph("<font color='#1e293b'>TOTAL CAMPAIGN GROUPS</font>", kpi_title_style),
        Paragraph("<font color='#0f172a'>107</font>", kpi_val_style),
        Paragraph("100% of numbered registers", kpi_sub_style)
    ]
    kpi_card_2 = [
        Paragraph("<font color='#047857'>CAT 1: ALL FIELDS FILLED</font>", kpi_title_style),
        Paragraph(f"<font color='#065f46'>{len(cat1_groups)} Groups</font>", kpi_val_style),
        Paragraph(f"100% complete & expanded ({len(cat1_groups)/len(groups)*100:.1f}%)", kpi_sub_style)
    ]
    kpi_card_3 = [
        Paragraph("<font color='#b45309'>CAT 2: PHYSICAL REGISTER GAPS</font>", kpi_title_style),
        Paragraph(f"<font color='#92400e'>{len(cat2_groups)} Groups</font>", kpi_val_style),
        Paragraph(f"Missing on paper / Initials ({len(cat2_groups)/len(groups)*100:.1f}%)", kpi_sub_style)
    ]
    kpi_card_4 = [
        Paragraph("<font color='#4338ca'>CAT 3: SYSTEM CODES & OMISSIONS</font>", kpi_title_style),
        Paragraph(f"<font color='#3730a3'>{len(cat3_groups)} Groups</font>", kpi_val_style),
        Paragraph(f"Remaining code gaps ({len(cat3_groups)/len(groups)*100:.1f}%)", kpi_sub_style)
    ]

    col_w_kpi = (841.89 - 72) / 4.0
    kpi_table = Table([[kpi_card_1, kpi_card_2, kpi_card_3, kpi_card_4]], colWidths=[col_w_kpi]*4)
    kpi_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (0,0), colors.HexColor('#f1f5f9')),
        ('BACKGROUND', (1,0), (1,0), colors.HexColor('#ecfdf5')),
        ('BACKGROUND', (2,0), (2,0), colors.HexColor('#fffbeb')),
        ('BACKGROUND', (3,0), (3,0), colors.HexColor('#eef2ff')),
        ('BOX', (0,0), (0,0), 1, colors.HexColor('#cbd5e1')),
        ('BOX', (1,0), (1,0), 1, colors.HexColor('#a7f3d0')),
        ('BOX', (2,0), (2,0), 1, colors.HexColor('#fde68a')),
        ('BOX', (3,0), (3,0), 1, colors.HexColor('#c7d2fe')),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(kpi_table)
    story.append(Spacer(1, 8))

    # Columns configuration (Total 769.89 pt)
    # Form# (48), Facilitator Name (130), Contact (90), Place (140), Time (80), Pts (30), Notes (251)
    col_widths = [48, 130, 90, 140, 80, 30, 251]

    def build_cat_table(group_list, cat_color):
        table_rows = []
        th_cols = [
            Paragraph("Form #", th_style),
            Paragraph("Facilitator Name", th_style),
            Paragraph("Contact Phone", th_style),
            Paragraph("Meeting Place", th_style),
            Paragraph("Meeting Time", th_style),
            Paragraph("Pts", th_style),
            Paragraph("Audit Details & Observations", th_style),
        ]
        table_rows.append(th_cols)

        for g in group_list:
            f_num = f"Form {clean_txt(g['formNumber'])}"
            f_name = clean_txt(g.get('facilitatorName', 'Unassigned'))
            f_tel = clean_txt(g.get('contact', 'Not provided'))
            f_place = clean_txt(g.get('meetingPlace', 'Not provided'))
            f_time = clean_txt(g.get('meetingTime', 'Not stated'))
            f_pts = str(g.get('participantCount', 0))
            f_notes = clean_txt(g.get('reasons', 'No issues flagged'))

            row = [
                Paragraph(f_num, td_bold),
                Paragraph(f_name, td_style),
                Paragraph(f_tel, td_style),
                Paragraph(f_place, td_style),
                Paragraph(f_time, td_style),
                Paragraph(f_pts, td_bold),
                Paragraph(f_notes, td_notes),
            ]
            table_rows.append(row)

        t = Table(table_rows, colWidths=col_widths, repeatRows=1)
        t_style = [
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor(cat_color)),
            ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
            ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
            ('TOPPADDING', (0,0), (-1,-1), 2.2),
            ('BOTTOMPADDING', (0,0), (-1,-1), 2.2),
            ('LEFTPADDING', (0,0), (-1,-1), 3.5),
            ('RIGHTPADDING', (0,0), (-1,-1), 3.5),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ]

        for r_idx in range(1, len(table_rows)):
            bg = colors.HexColor('#f8fafc') if r_idx % 2 == 1 else colors.white
            t_style.append(('BACKGROUND', (0, r_idx), (-1, r_idx), bg))

        t.setStyle(TableStyle(t_style))
        return t

    # SECTION 1: CATEGORY 1 (Page 1)
    story.append(Paragraph(
        f"<font color='#047857'><b>CATEGORY 1: FINE - ALL FIELDS COMPLETE & EXPANDED ({len(cat1_groups)} GROUPS)</b></font>",
        sec_title_style
    ))
    story.append(Spacer(1, 1))
    story.append(Paragraph(
        "Registers with 100% complete records across facilitator headers and participant demographics. Full first names provided, "
        "phone numbers recorded, meeting venues and times logged, and all demographic fields fully expanded.",
        sec_desc_style
    ))
    story.append(Spacer(1, 4))
    story.append(build_cat_table(cat1_groups, "#047857"))

    # Page Break to Category 2
    story.append(PageBreak())

    # SECTION 2: CATEGORY 2 (Pages 2-3)
    story.append(Paragraph(
        f"<font color='#b45309'><b>CATEGORY 2: GAPS ON PHYSICAL REGISTERS - FACILITATOR OMITTED DATA AT SOURCE ({len(cat2_groups)} GROUPS)</b></font>",
        sec_title_style
    ))
    story.append(Spacer(1, 1))
    story.append(Paragraph(
        "Registers where the paper sheets submitted from the field had missing data: blank phone numbers, blank workplace affiliation, "
        "missing gender/age/meeting time, or initials used instead of full first names (e.g., 'S. Mayabane'). "
        "These require field follow-up with the facilitator or physical attendance list verification.",
        sec_desc_style
    ))
    story.append(Spacer(1, 4))
    story.append(build_cat_table(cat2_groups, "#b45309"))

    # Page Break to Category 3
    story.append(PageBreak())

    # SECTION 3: CATEGORY 3 (Pages 4-6)
    story.append(Paragraph(
        f"<font color='#4338ca'><b>CATEGORY 3: REMAINING SYSTEM SHORTHAND CODES & OMISSIONS ({len(cat3_groups)} GROUPS)</b></font>",
        sec_title_style
    ))
    story.append(Spacer(1, 1))
    story.append(Paragraph(
        "Registers where the physical sheets had shorthand abbreviations that the digital system stored verbatim as raw single letters or omitted "
        "(e.g., Marital status stored as 'S', 'M', 'D', 'W' instead of 'Single', 'Married'; Education stored as 'J', 'S', 'U', 'T', 'P' "
        "instead of 'Junior Secondary', 'Senior Secondary', 'Tertiary', 'Primary'). These can be systematically expanded via automation.",
        sec_desc_style
    ))
    story.append(Spacer(1, 4))
    story.append(build_cat_table(cat3_groups, "#4338ca"))

    # Build document
    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"Generated primary PDF: {out_primary}")

    # Mirror copy
    os.makedirs(os.path.dirname(out_mirror), exist_ok=True)
    shutil.copyfile(out_primary, out_mirror)
    print(f"Generated mirror PDF: {out_mirror}")

if __name__ == '__main__':
    build_pdf()
