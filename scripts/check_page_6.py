import fitz
doc = fitz.open(r'C:\Users\samuk\Documents\Registers\HFF_Campaign_Groups_Categorization_Audit.pdf')
print("=== PAGE 5 (0-indexed) ===")
print(doc[4].get_text()[:400])
print("=== PAGE 6 (0-indexed) ===")
print(doc[5].get_text())
print("=== PAGE 7 (0-indexed) ===")
print(doc[6].get_text()[:400])
