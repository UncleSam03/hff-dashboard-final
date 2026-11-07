import json

with open('scripts/group_audit_enriched.json', 'r', encoding='utf-8') as f:
    groups = json.load(f)

print(f"Total groups: {len(groups)}")
blank_or_unassigned = []
for g in groups:
    fn = str(g.get('facilitatorName', ''))
    ct = str(g.get('contact', ''))
    pl = str(g.get('meetingPlace', ''))
    tm = str(g.get('meetingTime', ''))
    
    issues = []
    if 'blank' in fn.lower() or 'unassigned' in fn.lower() or not fn:
        issues.append(f"fac:{fn}")
    if 'not provided' in ct.lower() or not ct or ct == '-':
        issues.append(f"contact:{ct}")
    if 'blank' in pl.lower() or 'not provided' in pl.lower() or not pl:
        issues.append(f"place:{pl}")
    if 'blank' in tm.lower() or 'not specified' in tm.lower() or not tm:
        issues.append(f"time:{tm}")
        
    if issues:
        blank_or_unassigned.append((g['formNumber'], g['category'], issues, g['facilitatorName'], g['contact'], g['meetingPlace'], g['meetingTime']))

print(f"Groups with some blank/not provided header fields: {len(blank_or_unassigned)}")
for item in blank_or_unassigned:
    print(f"Form {item[0]} (Cat {item[1]}): {item[2]} | {item[3]} | {item[4]} | {item[5]} | {item[6]}")
