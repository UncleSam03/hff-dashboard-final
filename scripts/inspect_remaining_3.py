import json

with open('scripts/cat3_planned_updates.json', 'r', encoding='utf-8') as f:
    planned = json.load(f)

for f_num in ['59', '123', '182']:
    print(f"\n================ Form {f_num} ================")
    updates_for_form = [u for u in planned['allUpdates'] if u['formNumber'] == f_num]
    print(f"Updates planned for Form {f_num}: {len(updates_for_form)}")
    for u in updates_for_form[:5]:
        print(f"  {u['name']}: {u['changes']}")
