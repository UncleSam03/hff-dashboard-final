import json

with open('scripts/cat3_planned_updates.json', 'r', encoding='utf-8') as f:
    planned = json.load(f)

for u in planned['allUpdates']:
    if u['formNumber'] == '182':
        print(u)
