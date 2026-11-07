import json

with open('scripts/cat3_planned_updates.json', 'r', encoding='utf-8') as f:
    planned = json.load(f)

# Let's inspect all planned updates for 182
for u in planned['allUpdates']:
    if u['formNumber'] == '182':
        print(u['name'], u['changes'])
