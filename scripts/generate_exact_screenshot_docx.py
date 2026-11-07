import os
import shutil
import re
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.section import WD_ORIENT
from docx.oxml import parse_xml, OxmlElement
from docx.oxml.ns import nsdecls, qn

def set_cell_margins(cell, top=100, bottom=100, left=130, right=130):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = OxmlElement('w:tcMar')
    for m, val in [('top', top), ('bottom', bottom), ('left', left), ('right', right)]:
        node = OxmlElement(f'w:{m}')
        node.set(qn('w:w'), str(val))
        node.set(qn('w:type'), 'dxa')
        tcMar.append(node)
    tcPr.append(tcMar)

def set_cell_shading(cell, color_hex="F1F5F9"):
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{color_hex}"/>')
    cell._tc.get_or_add_tcPr().append(shd)

def set_table_borders(table, color="CBD5E1", sz="4", val="single"):
    tblPr = table._tbl.tblPr
    borders = parse_xml(f'''
        <w:tblBorders {nsdecls("w")}>
            <w:top w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>
            <w:bottom w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>
            <w:left w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>
            <w:right w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>
            <w:insideH w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>
            <w:insideV w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>
        </w:tblBorders>
    ''')
    tblPr.append(borders)

def make_cant_split(row):
    trPr = row._tr.get_or_add_trPr()
    trPr.append(parse_xml(f'<w:cantSplit {nsdecls("w")}/>'))

def make_repeat_header(row):
    trPr = row._tr.get_or_add_trPr()
    trPr.append(parse_xml(f'<w:tblHeader {nsdecls("w")}/>'))

def clean_text(s):
    if not s:
        return ''
    s = str(s).strip()
    s = s.replace('\u2014', ' - ').replace('\u2013', ' - ')
    s = re.sub(r'\s+', ' ', s)
    return s

def build_screenshot_docx():
    with open('scripts/original_markdown_tables.md', 'r', encoding='utf-8') as f:
        md_text = f.read()

    # Parse sections and tables
    sections_raw = md_text.split('### ')
    data_sections = {}

    for sec in sections_raw:
        if not sec.strip(): continue
        lines = sec.splitlines()
        sec_title = lines[0].strip()
        t_lines = [l.strip() for l in lines if l.strip().startswith('|') and not l.strip().startswith('| :---')]
        if t_lines:
            headers = [clean_text(c) for c in t_lines[0].split('|')[1:-1]]
            rows = []
            for l in t_lines[1:]:
                cells = [clean_text(c) for c in l.split('|')[1:-1]]
                rows.append(cells)
            data_sections[sec_title] = {
                'headers': headers,
                'rows': rows
            }

    out_primary = r'C:\Users\samuk\Documents\Registers\HFF_Campaign_Groups_Categorization_Audit.docx'
    out_mirror = r'c:\Users\samuk\Documents\hff-dashboard-final\public\HFF_Campaign_Groups_Categorization_Audit.docx'

    # Handle file lock if user has the docx open in MS Word
    try:
        with open(out_primary, 'ab') as f:
            pass
    except Exception:
        out_primary = r'C:\Users\samuk\Documents\Registers\HFF_Campaign_Groups_Categorization_Audit_V2.docx'
        out_mirror = r'c:\Users\samuk\Documents\hff-dashboard-final\public\HFF_Campaign_Groups_Categorization_Audit_V2.docx'

    doc = docx.Document()

    # Configure Landscape A4
    section = doc.sections[0]
    section.orientation = WD_ORIENT.LANDSCAPE
    section.page_width = Inches(11.69)
    section.page_height = Inches(8.27)
    section.top_margin = Inches(0.5)
    section.bottom_margin = Inches(0.5)
    section.left_margin = Inches(0.5)
    section.right_margin = Inches(0.5)

    # Footer
    footer = section.footer
    f_p = footer.paragraphs[0]
    f_p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    f_run = f_p.add_run("Hope for Families (HFF) Campaign — Groups Categorization Audit  |  Confidential")
    f_run.font.name = "Segoe UI"
    f_run.font.size = Pt(8)
    f_run.font.color.rgb = RGBColor(100, 116, 139)

    # Document Header Title
    p_title = doc.add_paragraph()
    p_title.paragraph_format.space_before = Pt(0)
    p_title.paragraph_format.space_after = Pt(2)
    r_title = p_title.add_run("Hope for Families (HFF) Campaign — Groups Categorization Audit")
    r_title.font.name = "Segoe UI"
    r_title.font.size = Pt(16)
    r_title.font.bold = True
    r_title.font.color.rgb = RGBColor(15, 23, 42)

    # Subtitle
    p_sub = doc.add_paragraph()
    p_sub.paragraph_format.space_before = Pt(0)
    p_sub.paragraph_format.space_after = Pt(8)
    r_sub = p_sub.add_run(
        "Campaign Location: Mochudi, Kgatleng District, Botswana  |  "
        "Total Groups: 107 Groups  |  "
        "Active Digital Records: 2,063 (422 Facilitators, 1,641 Participants)  |  "
        "Audit Date: 1 November 2026"
    )
    r_sub.font.name = "Segoe UI"
    r_sub.font.size = Pt(8.5)
    r_sub.font.color.rgb = RGBColor(71, 85, 105)

    # =========================================================================
    # 1. SUMMARY TABLE (EXACT SCREENSHOT 1)
    # =========================================================================
    p_s1 = doc.add_paragraph()
    p_s1.paragraph_format.space_before = Pt(4)
    p_s1.paragraph_format.space_after = Pt(4)
    r_s1 = p_s1.add_run("Executive Breakdown")
    r_s1.font.name = "Segoe UI"
    r_s1.font.size = Pt(11)
    r_s1.font.bold = True
    r_s1.font.color.rgb = RGBColor(15, 23, 42)

    # Data from Screenshot 1
    # Headers: Category | Description | Group Count | % Share | Action Required
    sum_headers = ["Category", "Description", "Group Count", "% Share", "Action Required"]
    sum_widths = [Inches(1.20), Inches(4.10), Inches(1.15), Inches(0.95), Inches(3.29)]
    sum_rows = [
        [
            "Category 1",
            "Fine / Complete: All fields filled, full names, fully expanded demographics",
            "12 Groups",
            "11.2%",
            "Ready for reporting; zero edits needed."
        ],
        [
            "Category 2",
            "Physical Register Gaps: Missing phone numbers, affiliations, initials used (e.g. S. Mayabane ), missing age/gender",
            "40 Groups",
            "37.4%",
            "Contact facilitator / inspect physical field sheets for missing info."
        ],
        [
            "Category 3",
            "System Shorthand / Omissions: Raw codes ( S, M, D, J, S, U, T, P ) or parser omissions",
            "55 Groups",
            "51.4%",
            "Automated batch expansion tomorrow (no field calls needed)."
        ],
        [
            "TOTAL",
            "All Campaign Numbered Groups",
            "107 Groups",
            "100%",
            "Full audit captured in generated 14-page PDF."
        ]
    ]

    t_sum = doc.add_table(rows=len(sum_rows) + 1, cols=5)
    t_sum.autofit = False
    set_table_borders(t_sum, color="CBD5E1", sz="4")

    # Header Row
    h_row = t_sum.rows[0]
    make_cant_split(h_row)
    make_repeat_header(h_row)

    for c_idx, h_text in enumerate(sum_headers):
        cell = h_row.cells[c_idx]
        cell.width = sum_widths[c_idx]
        set_cell_shading(cell, "F1F5F9")
        set_cell_margins(cell, top=100, bottom=100, left=130, right=130)

        p = cell.paragraphs[0]
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(0)
        if c_idx in [2, 3]:
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        else:
            p.alignment = WD_ALIGN_PARAGRAPH.LEFT

        run = p.add_run(h_text)
        run.font.name = "Segoe UI"
        run.font.size = Pt(8.5)
        run.font.bold = True
        run.font.color.rgb = RGBColor(30, 41, 59)

    # Body Rows
    for r_idx, row_vals in enumerate(sum_rows):
        b_row = t_sum.rows[r_idx + 1]
        make_cant_split(b_row)
        is_total = (r_idx == len(sum_rows) - 1)

        for c_idx, val in enumerate(row_vals):
            cell = b_row.cells[c_idx]
            cell.width = sum_widths[c_idx]
            set_cell_shading(cell, "FFFFFF")
            set_cell_margins(cell, top=90, bottom=90, left=130, right=130)

            p = cell.paragraphs[0]
            p.paragraph_format.space_before = Pt(0)
            p.paragraph_format.space_after = Pt(0)

            if c_idx in [2, 3]:
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            else:
                p.alignment = WD_ALIGN_PARAGRAPH.LEFT

            # Formatting like Screenshot 1
            if c_idx == 0:
                run = p.add_run(val)
                run.font.name = "Segoe UI"
                run.font.size = Pt(8.5)
                run.font.bold = True
                run.font.color.rgb = RGBColor(15, 23, 42)
            elif c_idx == 1:
                # Leading bold label
                if ':' in val:
                    parts = val.split(':', 1)
                    r1 = p.add_run(parts[0] + ':')
                    r1.font.name = "Segoe UI"
                    r1.font.size = Pt(8)
                    r1.font.bold = True
                    r1.font.color.rgb = RGBColor(15, 23, 42)

                    r2 = p.add_run(parts[1])
                    r2.font.name = "Segoe UI"
                    r2.font.size = Pt(8)
                    r2.font.color.rgb = RGBColor(51, 65, 85)
                else:
                    run = p.add_run(val)
                    run.font.name = "Segoe UI"
                    run.font.size = Pt(8)
                    if is_total:
                        run.font.bold = True
                    run.font.color.rgb = RGBColor(15, 23, 42) if is_total else RGBColor(51, 65, 85)
            elif c_idx == 2:
                # Group count: centered, bold
                run = p.add_run(val)
                run.font.name = "Segoe UI"
                run.font.size = Pt(8.5)
                run.font.bold = True
                run.font.color.rgb = RGBColor(15, 23, 42)
            elif c_idx == 3:
                # % Share: centered
                run = p.add_run(val)
                run.font.name = "Segoe UI"
                run.font.size = Pt(8)
                if is_total:
                    run.font.bold = True
                run.font.color.rgb = RGBColor(15, 23, 42) if is_total else RGBColor(51, 65, 85)
            else:
                run = p.add_run(val)
                run.font.name = "Segoe UI"
                run.font.size = Pt(8)
                run.font.color.rgb = RGBColor(51, 65, 85)

    doc.add_paragraph().paragraph_format.space_after = Pt(6)

    # Table columns for Categories 1, 2, 3 (Total 10.69 in)
    detail_widths = [
        Inches(0.75),  # Form #
        Inches(1.85),  # Facilitator Name
        Inches(1.25),  # Contact Number
        Inches(1.95),  # Meeting Place
        Inches(1.15),  # Meeting Time
        Inches(0.45),  # Pts
        Inches(3.29)   # Verification Status / Observations
    ]

    def render_detail_table(headers, rows):
        t = doc.add_table(rows=len(rows) + 1, cols=7)
        t.autofit = False
        set_table_borders(t, color="CBD5E1", sz="4")

        # Header Row
        hr = t.rows[0]
        make_cant_split(hr)
        make_repeat_header(hr)

        for c_idx, h_text in enumerate(headers):
            cell = hr.cells[c_idx]
            cell.width = detail_widths[c_idx]
            set_cell_shading(cell, "F1F5F9")
            set_cell_margins(cell, top=90, bottom=90, left=110, right=110)

            p = cell.paragraphs[0]
            p.paragraph_format.space_before = Pt(0)
            p.paragraph_format.space_after = Pt(0)
            if c_idx in [0, 5]:
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            else:
                p.alignment = WD_ALIGN_PARAGRAPH.LEFT

            run = p.add_run(clean_text(h_text))
            run.font.name = "Segoe UI"
            run.font.size = Pt(8.5)
            run.font.bold = True
            run.font.color.rgb = RGBColor(30, 41, 59)

        # Body Rows
        for r_idx, row_vals in enumerate(rows):
            br = t.rows[r_idx + 1]
            make_cant_split(br)

            for c_idx, val in enumerate(row_vals):
                cell = br.cells[c_idx]
                cell.width = detail_widths[c_idx]
                set_cell_shading(cell, "FFFFFF")
                set_cell_margins(cell, top=70, bottom=70, left=110, right=110)

                p = cell.paragraphs[0]
                p.paragraph_format.space_before = Pt(0)
                p.paragraph_format.space_after = Pt(0)

                if c_idx == 0:
                    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
                    run = p.add_run(clean_text(val).replace('**', ''))
                    run.font.name = "Segoe UI"
                    run.font.size = Pt(8)
                    run.font.bold = True
                    run.font.color.rgb = RGBColor(15, 23, 42)
                elif c_idx == 5:
                    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                    run = p.add_run(clean_text(val))
                    run.font.name = "Segoe UI"
                    run.font.size = Pt(8)
                    run.font.color.rgb = RGBColor(15, 23, 42)
                else:
                    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
                    run = p.add_run(clean_text(val).replace('**', ''))
                    run.font.name = "Segoe UI"
                    run.font.size = Pt(8)
                    run.font.color.rgb = RGBColor(51, 65, 85)

        return t

    # =========================================================================
    # 2. CATEGORY 1 TABLE (EXACT SCREENSHOT 2)
    # =========================================================================
    cat1_key = [k for k in data_sections if 'Category 1:' in k][0]
    cat1_data = data_sections[cat1_key]

    p_c1 = doc.add_paragraph()
    p_c1.paragraph_format.space_before = Pt(6)
    p_c1.paragraph_format.space_after = Pt(2)
    r_c1 = p_c1.add_run("Category 1: Fine — All Fields Filled & Expanded (12 Groups)")
    r_c1.font.name = "Segoe UI"
    r_c1.font.size = Pt(11)
    r_c1.font.bold = True
    r_c1.font.color.rgb = RGBColor(15, 23, 42)

    p_c1_desc = doc.add_paragraph()
    p_c1_desc.paragraph_format.space_before = Pt(0)
    p_c1_desc.paragraph_format.space_after = Pt(4)
    r_c1_desc = p_c1_desc.add_run(
        "All participant demographics and facilitator headers are complete with full first names, "
        "valid contact numbers, meeting venues, and fully expanded values."
    )
    r_c1_desc.font.name = "Segoe UI"
    r_c1_desc.font.size = Pt(8)
    r_c1_desc.font.color.rgb = RGBColor(71, 85, 105)

    render_detail_table(cat1_data['headers'], cat1_data['rows'])

    doc.add_page_break()

    # =========================================================================
    # 3. CATEGORY 2 TABLE (EXACT SCREENSHOT 3)
    # =========================================================================
    cat2_key = [k for k in data_sections if 'Category 2:' in k][0]
    cat2_data = data_sections[cat2_key]

    p_c2 = doc.add_paragraph()
    p_c2.paragraph_format.space_before = Pt(4)
    p_c2.paragraph_format.space_after = Pt(2)
    r_c2 = p_c2.add_run("Category 2: Gaps on Physical Paper Registers (40 Groups)")
    r_c2.font.name = "Segoe UI"
    r_c2.font.size = Pt(11)
    r_c2.font.bold = True
    r_c2.font.color.rgb = RGBColor(15, 23, 42)

    p_c2_desc = doc.add_paragraph()
    p_c2_desc.paragraph_format.space_before = Pt(0)
    p_c2_desc.paragraph_format.space_after = Pt(4)
    r_c2_desc = p_c2_desc.add_run(
        "Omissions originated on the physical sheets (facilitator left blank spaces for participant phones, "
        "affiliations, meeting times, or used initials like S. Mayabane)."
    )
    r_c2_desc.font.name = "Segoe UI"
    r_c2_desc.font.size = Pt(8)
    r_c2_desc.font.color.rgb = RGBColor(71, 85, 105)

    # Use header from screenshot 3: 'Specific Physical Register Findings'
    cat2_headers_screenshot = [
        "Form #",
        "Facilitator Name",
        "Contact Number",
        "Meeting Place",
        "Meeting Time",
        "Pts",
        "Specific Physical Register Findings"
    ]
    render_detail_table(cat2_headers_screenshot, cat2_data['rows'])

    doc.add_page_break()

    # =========================================================================
    # 4. CATEGORY 3 TABLE (55 Groups)
    # =========================================================================
    cat3_key = [k for k in data_sections if 'Category 3:' in k][0]
    cat3_data = data_sections[cat3_key]

    p_c3 = doc.add_paragraph()
    p_c3.paragraph_format.space_before = Pt(4)
    p_c3.paragraph_format.space_after = Pt(2)
    r_c3 = p_c3.add_run("Category 3: System Shorthand Codes & Parser Omissions (55 Groups)")
    r_c3.font.name = "Segoe UI"
    r_c3.font.size = Pt(11)
    r_c3.font.bold = True
    r_c3.font.color.rgb = RGBColor(15, 23, 42)

    p_c3_desc = doc.add_paragraph()
    p_c3_desc.paragraph_format.space_before = Pt(0)
    p_c3_desc.paragraph_format.space_after = Pt(4)
    r_c3_desc = p_c3_desc.add_run(
        "Registers where standard shorthand abbreviations (S, M, D, J, S, U, T, P) were captured from the physical sheet "
        "into the digital database without expansion."
    )
    r_c3_desc.font.name = "Segoe UI"
    r_c3_desc.font.size = Pt(8)
    r_c3_desc.font.color.rgb = RGBColor(71, 85, 105)

    cat3_headers = [
        "Form #",
        "Facilitator Name",
        "Contact Number",
        "Meeting Place",
        "Meeting Time",
        "Pts",
        "Shorthand Codes & System Omissions"
    ]
    render_detail_table(cat3_headers, cat3_data['rows'])

    # Save to primary and mirror
    doc.save(out_primary)
    print(f"Generated exact screenshot Word document: {out_primary}")

    os.makedirs(os.path.dirname(out_mirror), exist_ok=True)
    shutil.copyfile(out_primary, out_mirror)
    print(f"Mirror copied to: {out_mirror}")

if __name__ == '__main__':
    build_screenshot_docx()
