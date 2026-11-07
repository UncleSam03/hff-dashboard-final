import fitz
import re

doc = fitz.open(r'C:\Users\samuk\Documents\Registers\HFF_Campaign_Groups_Categorization_Audit.pdf')
full_text = ""
for page in doc:
    full_text += page.get_text() + "\n--- PAGE ---\n"

lines = full_text.splitlines()
forms_by_cat = {1: [], 2: [], 3: []}
current_cat = None

for line in lines:
    line_clean = line.strip()
    if 'CATEGORY 1:' in line_clean.upper():
        current_cat = 1
    elif 'CATEGORY 2:' in line_clean.upper():
        current_cat = 2
    elif 'CATEGORY 3:' in line_clean.upper():
        current_cat = 3

    m = re.match(r'^Form\s+([0-9]+[A-Z]?(?:\s+[A-Z])?)$', line_clean, re.IGNORECASE)
    if m and current_cat:
        form_id = m.group(1).strip()
        if form_id not in forms_by_cat[current_cat]:
            forms_by_cat[current_cat].append(form_id)

print(f"Extracted from PDF:")
print(f"Category 1 ({len(forms_by_cat[1])}):", forms_by_cat[1])
print(f"Category 2 ({len(forms_by_cat[2])}):", forms_by_cat[2])
print(f"Category 3 ({len(forms_by_cat[3])}):", forms_by_cat[3])
print(f"Total: {len(forms_by_cat[1]) + len(forms_by_cat[2]) + len(forms_by_cat[3])}")
