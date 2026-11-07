import json

with open('scripts/group_audit_results.json', 'r', encoding='utf-8') as f:
    groups = json.load(f)

for f_num in ['59', '123', '182']:
    for g in groups:
        if g['formNumber'] == f_num:
            print(f"\n================ Form {f_num} ================")
            print(json.dumps(g, indent=2))
