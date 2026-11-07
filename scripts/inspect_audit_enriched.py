import json

with open('scripts/group_audit_enriched.json', 'r', encoding='utf-8') as f:
    groups = json.load(f)

print(f"Total groups: {len(groups)}")
cat1 = [g for g in groups if g['category'] == 1]
cat2 = [g for g in groups if g['category'] == 2]
cat3 = [g for g in groups if g['category'] == 3]

print(f"Cat 1: {len(cat1)}")
print(f"Cat 2: {len(cat2)}")
print(f"Cat 3: {len(cat3)}")
