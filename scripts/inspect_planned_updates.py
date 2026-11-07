import json

with open('scripts/cat3_planned_updates.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

print("=== SAMPLE 10 PLANNED UPDATES ===")
for u in data['sampleUpdates'][:10]:
    print(f"Form {u['formNumber']:>5} | {u['name']:<25} | Changes: {u['changes']}")

# Check the Form 183 cleared records
print("\n=== FORM 183 CLEARED RECORDS ===")
for u in data['allUpdates']:
    if u['formNumber'] == '183' and 'marital_status' in u['changes'] and u['changes']['marital_status']['from'] == 'F':
        print(f"Form 183 | {u['name']:<25} | {u['changes']}")

# Check some recovered records from photo notes
print("\n=== SAMPLE RECOVERED FROM PHOTO NOTES ===")
recovered = [u for u in data['allUpdates'] if any(c.get('source') == 'handover_photo' for c in u['changes'].values())]
print(f"Total recovered records: {len(recovered)}")
for u in recovered[:10]:
    print(f"Form {u['formNumber']:>5} | {u['name']:<25} | {u['changes']}")
