import fitz

doc = fitz.open(r'C:\Users\samuk\Documents\Registers\HFF_Campaign_Groups_Categorization_Audit.pdf')
lines = doc[0].get_text().splitlines()
for l in lines[:40]:
    print(repr(l))
