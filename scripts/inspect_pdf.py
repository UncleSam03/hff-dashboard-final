import fitz

doc = fitz.open(r'C:\Users\samuk\Documents\Registers\HFF_Campaign_Groups_Categorization_Audit_Updated.pdf')
print(f"Total pages: {len(doc)}")
for i, page in enumerate(doc):
    text = page.get_text()
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    first_line = lines[0] if lines else 'Empty'
    last_line = lines[-1] if lines else 'Empty'
    print(f"Page {i+1}: lines={len(lines)}, first=\"{first_line[:50]}\", last=\"{last_line[:50]}\"")
