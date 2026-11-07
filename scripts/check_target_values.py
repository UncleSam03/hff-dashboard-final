import json

with open('scripts/cat3_planned_updates.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

target_genders = set()
target_maritals = set()
target_edus = set()

for u in data['allUpdates']:
    for f, c in u['changes'].items():
        if f == 'gender':
            target_genders.add(c['to'])
        elif f == 'marital_status':
            target_maritals.add(c['to'])
        elif f == 'education':
            target_edus.add(c['to'])

print("Target Genders:", target_genders)
print("Target Marital Statuses:", target_maritals)
print("Target Educations:", target_edus)
