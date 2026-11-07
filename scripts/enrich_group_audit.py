import json
import re

with open('scripts/group_audit_results.json', 'r', encoding='utf-8') as f:
    groups = json.load(f)

missing = []
for g in groups:
    is_fac_missing = 'Unassigned' in g['facilitatorName']
    is_phone_missing = g['contact'] == 'Not provided'
    is_place_missing = g['meetingPlace'] == 'Not provided'
    is_time_missing = g['meetingTime'] == 'Not specified'
    if is_fac_missing or is_phone_missing or is_place_missing or is_time_missing:
        missing.append(g)

print(f"Groups with some missing facilitator metadata: {len(missing)}")
for g in missing[:20]:
    print(f"Form {g['formNumber']}: Fac='{g['facilitatorName']}', Phone='{g['contact']}', Place='{g['meetingPlace']}', Time='{g['meetingTime']}'")
