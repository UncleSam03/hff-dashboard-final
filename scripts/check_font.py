import fitz
doc = fitz.open(r'C:\Users\samuk\Documents\Registers\HFF_Campaign_Groups_Categorization_Audit.pdf')
print("Page 1 text:")
print(repr(doc[0].get_text()[:300]))
