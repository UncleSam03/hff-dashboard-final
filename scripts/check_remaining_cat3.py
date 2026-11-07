import json

with open('scripts/group_audit_results.json', 'r', encoding='utf-8') as f:
    groups = json.load(f)

print("=== REMAINING CATEGORY 3 GROUPS ===")
for g in groups:
    if g['category'] == 3:
        print(f"Form {g['formNumber']}: {g['reasons']} | Fac: {g['facilitatorName']}")
