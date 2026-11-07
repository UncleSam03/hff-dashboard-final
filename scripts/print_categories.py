import json

with open('scripts/group_audit_enriched.json', 'r', encoding='utf-8') as f:
    groups = json.load(f)

for cat_num in [1, 2, 3]:
    cat_groups = [g for g in groups if g['category'] == cat_num]
    print(f"\n==========================================")
    print(f" CATEGORY {cat_num} ({len(cat_groups)} Groups)")
    print(f"==========================================")
    for g in cat_groups:
        form = g['formNumber']
        fac = g['facilitatorName']
        phone = g['contact']
        place = g['meetingPlace']
        time = g['meetingTime']
        pts = g['participantCount']
        issues = g['reasons']
        print(f"Form {form:>6} | Fac: {fac:<32} | Tel: {phone:<22} | Pl: {place[:24]:<24} | Tm: {time:<15} | Pts: {pts:>2} | {issues}")
