import json

with open('scripts/cat3_blanks_stats.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

print('Summary:', data['summary'])
forms = data['formStats']
sorted_forms = sorted(forms.items(), key=lambda x: (x[1]['blankMarital'] + x[1]['blankEdu']), reverse=True)
for f_num, st in sorted_forms:
    if st['blankMarital'] > 0 or st['blankEdu'] > 0:
        bm = st['blankMarital']
        be = st['blankEdu']
        rm = st['rawMarital']
        re = st['rawEdu']
        tot = st['total']
        print(f"Form {f_num:>6}: Blank Marital={bm:>2}, Blank Edu={be:>2} | Raw Marital={rm:>2}, Raw Edu={re:>2} | Total={tot:>2}")
