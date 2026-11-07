import json
import re

with open('scripts/group_audit_enriched.json', 'r', encoding='utf-8') as f:
    groups = json.load(f)

for g in groups:
    # Clean up strings
    for k in ['facilitatorName', 'contact', 'meetingPlace', 'meetingTime', 'reasons']:
        if k in g and g[k]:
            g[k] = str(g[k]).replace('`', '').strip()
            g[k] = g[k].replace('', '—')
            g[k] = re.sub(r'\s+', ' ', g[k])

    # Specific fixes
    if g['formNumber'] == '227':
        g['facilitatorName'] = '[Blank on register] Contact: Laone Motlhabanku (Manager)'
        g['contact'] = '72390199'
        g['meetingPlace'] = 'Just Formu One, Mochudi'
        g['meetingTime'] = 'Not stated on register'
        g['reasons'] += '; Register header (Leader, Time) blank on physical form'

    if g['formNumber'] == '223':
        g['meetingPlace'] = 'Arise & Shine Day Care, Mochudi'
        if g['meetingTime'] in ['[Blank]', '']:
            g['meetingTime'] = 'Not stated on register'

    if g['formNumber'] == '224':
        if g['meetingPlace'] in ['[Blank]', '']:
            g['meetingPlace'] = 'Mochudi (Grace Mokgadi Community)'

    if g['formNumber'] == '168':
        if g['meetingTime'] in ['[Blank]', '']:
            g['meetingTime'] = 'Not stated on register'

    if g['meetingTime'] == 'Not specified':
        g['meetingTime'] = 'Not stated on register'

with open('scripts/group_audit_enriched.json', 'w', encoding='utf-8') as f:
    json.dump(groups, f, indent=2)

print("Polished enriched groups successfully.")
