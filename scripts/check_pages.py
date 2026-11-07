import fitz

doc = fitz.open(r'C:\Users\samuk\Documents\Registers\HFF_Campaign_Groups_Categorization_Audit.pdf')
for p_num in [1, 2, 5, 6]:
    print(f"\n--- Page {p_num+1} ---")
    print(doc[p_num].get_text())
