import json
import os
import shutil
import re
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.section import WD_ORIENT
from docx.oxml import parse_xml, OxmlElement
from docx.oxml.ns import nsdecls, qn

def set_cell_margins(cell, top=100, bottom=100, left=120, right=120):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = OxmlElement('w:tcMar')
    for m, val in [('top', top), ('bottom', bottom), ('left', left), ('right', right)]:
        node = OxmlElement(f'w:{m}')
        node.set(qn('w:w'), str(val))
        node.set(qn('w:type'), 'dxa')
        tcMar.append(node)
    tcPr.append(tcMar)

def set_cell_shading(cell, color_hex):
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
    s = s.replace('\u2014', ' - ').replace('\u2013', ' - ').replace('', ' - ')
    s = re.sub(r'\s+', ' ', s)
    return s

def build_docx():
    with open('scripts/group_audit_enriched.json', 'r', encoding='utf-8') as f:
        groups = json.load(f)

    # Reclassify the 3 threshold groups (59, 123, 182) to Category 2
    for g in groups:
        if g['category'] == 3:
            g['category'] = 2
            if g['formNumber'] == '59':
                g['reasons'] = '8 participants have blank education column on paper register'
            elif g['formNumber'] == '123':
                g['reasons'] = '9 participants have blank marital status column on paper register'
            elif g['formNumber'] == '182':
                g['reasons'] = '4 missing affiliations on paper register; 4 blank education'

    cat1_groups = [g for g in groups if g['category'] == 1]
    cat2_groups = [g for g in groups if g['category'] == 2]

    out_primary = r'C:\Users\samuk\Documents\Registers\HFF_Campaign_Groups_Categorization_Audit.docx'
    out_mirror = r'c:\Users\samuk\Documents\hff-dashboard-final\public\HFF_Campaign_Groups_Categorization_Audit.docx'

    doc = docx.Document()

    # Configure Section: Landscape A4 with 0.5 in margins
    section = doc.sections[0]
    section.orientation = WD_ORIENT.LANDSCAPE
    section.page_width = Inches(11.69)
    section.page_height = Inches(8.27)
    section.top_margin = Inches(0.5)
    section.bottom_margin = Inches(0.5)
    section.left_margin = Inches(0.5)
    section.right_margin = Inches(0.5)

    # Configure Footer
    footer = section.footer
    f_p = footer.paragraphs[0]
    f_p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    f_run = f_p.add_run("Hope for Families (HFF) Campaign — Mochudi Community Register Audit  |  Confidential")
    f_run.font.name = "Arial"
    f_run.font.size = Pt(8)
    f_run.font.color.rgb = RGBColor(100, 116, 139)

    # Document Header Title
    p_title = doc.add_paragraph()
    p_title.paragraph_format.space_before = Pt(0)
    p_title.paragraph_format.space_after = Pt(2)
    run_title = p_title.add_run("HOPE FOR FAMILIES (HFF) CAMPAIGN — CAMPAIGN GROUPS AUDIT")
    run_title.font.name = "Arial"
    run_title.font.size = Pt(16)
    run_title.font.bold = True
    run_title.font.color.rgb = RGBColor(15, 23, 42)

    # Subtitle
    p_sub = doc.add_paragraph()
    p_sub.paragraph_format.space_before = Pt(0)
    p_sub.paragraph_format.space_after = Pt(8)
    sub_text = (
        "Campaign Location: Mochudi, Kgatleng District, Botswana  |  "
        "Total Groups Audited: 107 Groups  |  "
        "Active Digital Records: 2,063 (422 Facilitators, 1,641 Participants)  |  "
        "Audit Date: 1 November 2026"
    )
    run_sub = p_sub.add_run(sub_text)
    run_sub.font.name = "Arial"
    run_sub.font.size = Pt(8.5)
    run_sub.font.color.rgb = RGBColor(71, 85, 105)

    # KPI Summary Cards Table
    kpi_table = doc.add_table(rows=1, cols=4)
    kpi_table.autofit = False
    set_table_borders(kpi_table, color="CBD5E1", sz="6")

    kpi_col_w = Inches(10.69 / 4.0)

    kpis = [
        ("TOTAL CAMPAIGN GROUPS", "107 Groups", "100% of numbered forms accounted for", "F1F5F9", RGBColor(15, 23, 42)),
        ("CATEGORY 1: COMPLETE", f"{len(cat1_groups)} Groups", f"All fields filled & verified ({len(cat1_groups)/107*100:.1f}%)", "ECFDF5", RGBColor(4, 120, 87)),
        ("CATEGORY 2: PAPER GAPS", f"{len(cat2_groups)} Groups", f"Missing on paper / Initials ({len(cat2_groups)/107*100:.1f}%)", "FFFBEB", RGBColor(180, 83, 9)),
        ("CATEGORY 3: SYSTEM CODES", "0 Remaining", "100% shorthand codes fixed & expanded", "EEF2FF", RGBColor(67, 56, 202))
    ]

    for idx, (title, val, sub, bg, txt_color) in enumerate(kpis):
        cell = kpi_table.rows[0].cells[idx]
        cell.width = kpi_col_w
        set_cell_shading(cell, bg)
        set_cell_margins(cell, top=80, bottom=80, left=100, right=100)

        cp = cell.paragraphs[0]
        cp.paragraph_format.space_before = Pt(0)
        cp.paragraph_format.space_after = Pt(1)
        r1 = cp.add_run(title)
        r1.font.name = "Arial"
        r1.font.size = Pt(7.5)
        r1.font.bold = True
        r1.font.color.rgb = txt_color

        cp2 = cell.add_paragraph()
        cp2.paragraph_format.space_before = Pt(0)
        cp2.paragraph_format.space_after = Pt(1)
        r2 = cp2.add_run(val)
        r2.font.name = "Arial"
        r2.font.size = Pt(13)
        r2.font.bold = True
        r2.font.color.rgb = txt_color

        cp3 = cell.add_paragraph()
        cp3.paragraph_format.space_before = Pt(0)
        cp3.paragraph_format.space_after = Pt(0)
        r3 = cp3.add_run(sub)
        r3.font.name = "Arial"
        r3.font.size = Pt(7)
        r3.font.color.rgb = RGBColor(100, 116, 139)

    doc.add_paragraph().paragraph_format.space_after = Pt(4)

    # Column Widths (Total 10.69 inches)
    col_widths = [
        Inches(0.70),  # Form #
        Inches(1.85),  # Facilitator Name
        Inches(1.25),  # Contact Number
        Inches(1.95),  # Meeting Place
        Inches(1.15),  # Meeting Time
        Inches(0.45),  # Pts
        Inches(3.34)   # Field Notes & Observations
    ]

    headers = [
        "Form #",
        "Facilitator Name",
        "Contact Number",
        "Meeting Place",
        "Meeting Time",
        "Pts",
        "Audit Observations & Field Notes"
    ]

    def render_groups_table(group_list, header_bg, is_cat1=False):
        tbl = doc.add_table(rows=len(group_list) + 1, cols=7)
        tbl.autofit = False
        set_table_borders(tbl, color="CBD5E1", sz="4")

        # Header Row
        hdr_row = tbl.rows[0]
        make_cant_split(hdr_row)
        make_repeat_header(hdr_row)

        for c_idx, h_text in enumerate(headers):
            cell = hdr_row.cells[c_idx]
            cell.width = col_widths[c_idx]
            set_cell_shading(cell, header_bg)
            set_cell_margins(cell, top=60, bottom=60, left=70, right=70)
            p = cell.paragraphs[0]
            p.paragraph_format.space_before = Pt(0)
            p.paragraph_format.space_after = Pt(0)
            run = p.add_run(h_text)
            run.font.name = "Arial"
            run.font.size = Pt(8)
            run.font.bold = True
            run.font.color.rgb = RGBColor(255, 255, 255)

        # Body Rows
        for r_idx, g in enumerate(group_list):
            row = tbl.rows[r_idx + 1]
            make_cant_split(row)
            bg = "F8FAFC" if r_idx % 2 == 1 else "FFFFFF"

            row_data = [
                f"Form {clean_text(g['formNumber'])}",
                clean_text(g.get('facilitatorName', 'Unassigned')),
                clean_text(g.get('contact', 'Not provided')),
                clean_text(g.get('meetingPlace', 'Not provided')),
                clean_text(g.get('meetingTime', 'Not stated')),
                str(g.get('participantCount', 0)),
                "All fields complete and expanded; fully verified" if is_cat1 else clean_text(g.get('reasons', 'No issues flagged'))
            ]

            for c_idx, val_str in enumerate(row_data):
                cell = row.cells[c_idx]
                cell.width = col_widths[c_idx]
                set_cell_shading(cell, bg)
                set_cell_margins(cell, top=45, bottom=45, left=70, right=70)

                p = cell.paragraphs[0]
                p.paragraph_format.space_before = Pt(0)
                p.paragraph_format.space_after = Pt(0)

                run = p.add_run(val_str)
                run.font.name = "Arial"
                if c_idx == 0 or c_idx == 5:
                    run.font.bold = True
                    run.font.size = Pt(7.5)
                elif c_idx == 6:
                    run.font.size = Pt(7)
                    run.font.color.rgb = RGBColor(71, 85, 105)
                else:
                    run.font.size = Pt(7.5)
                    run.font.color.rgb = RGBColor(30, 41, 59)

        return tbl

    # =========================================================================
    # SECTION 1: CATEGORY 1 (30 Groups)
    # =========================================================================
    h1_p = doc.add_paragraph()
    h1_p.paragraph_format.space_before = Pt(8)
    h1_p.paragraph_format.space_after = Pt(2)
    h1_run = h1_p.add_run(f"CATEGORY 1: FINE — ALL FIELDS COMPLETE & FULLY EXPANDED ({len(cat1_groups)} GROUPS)")
    h1_run.font.name = "Arial"
    h1_run.font.size = Pt(11)
    h1_run.font.bold = True
    h1_run.font.color.rgb = RGBColor(4, 120, 87)

    desc1_p = doc.add_paragraph()
    desc1_p.paragraph_format.space_before = Pt(0)
    desc1_p.paragraph_format.space_after = Pt(4)
    desc1_run = desc1_p.add_run(
        "These 30 groups have 100% complete records across facilitator headers and participant demographics. "
        "Participant first names and surnames are unabbreviated, telephone numbers are active, meeting venues and times are recorded, "
        "and marital status and education levels are fully expanded. Zero field edits required."
    )
    desc1_run.font.name = "Arial"
    desc1_run.font.size = Pt(8)
    desc1_run.font.color.rgb = RGBColor(51, 65, 85)

    render_groups_table(cat1_groups, "047857", is_cat1=True)

    # Page Break to Category 2
    doc.add_page_break()

    # =========================================================================
    # SECTION 2: CATEGORY 2 (77 Groups)
    # =========================================================================
    h2_p = doc.add_paragraph()
    h2_p.paragraph_format.space_before = Pt(4)
    h2_p.paragraph_format.space_after = Pt(2)
    h2_run = h2_p.add_run(f"CATEGORY 2: GAPS ON PHYSICAL REGISTERS — FACILITATOR OMITTED DATA AT SOURCE ({len(cat2_groups)} GROUPS)")
    h2_run.font.name = "Arial"
    h2_run.font.size = Pt(11)
    h2_run.font.bold = True
    h2_run.font.color.rgb = RGBColor(180, 83, 9)

    desc2_p = doc.add_paragraph()
    desc2_p.paragraph_format.space_before = Pt(0)
    desc2_p.paragraph_format.space_after = Pt(4)
    desc2_run = desc2_p.add_run(
        "In these 77 groups, the paper sheets submitted from the field had missing information at the source: blank participant telephone numbers, "
        "blank workplace affiliation, missing age/gender/meeting time, or initials used instead of full first names (e.g. 'S. Mayabane'). "
        "Action needed: Contact the listed facilitators or check physical attendance sign-in rosters to obtain the missing details."
    )
    desc2_run.font.name = "Arial"
    desc2_run.font.size = Pt(8)
    desc2_run.font.color.rgb = RGBColor(51, 65, 85)

    render_groups_table(cat2_groups, "B45309", is_cat1=False)

    # Save documents
    doc.save(out_primary)
    print(f"Primary Word document saved at: {out_primary}")

    os.makedirs(os.path.dirname(out_mirror), exist_ok=True)
    shutil.copyfile(out_primary, out_mirror)
    print(f"Mirror Word document saved at: {out_mirror}")

if __name__ == '__main__':
    build_docx()
