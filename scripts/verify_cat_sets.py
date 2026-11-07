import json

cat1_forms = ['40', '44', '85', '103', '121', '130', '137 B', '159', '161', '183 A', '216', '230']
cat2_forms = ['1', '3', '6', '17', '22', '23', '25', '26', '27', '28', '30', '31', '32', '33', '34', '36', '38', '39', '41', '42', '43', '45', '49', '53', '58', '60', '63', '80', '87', '104', '107', '108', '123', '128', '129', '132', '141', '171', '172', '174 A']
cat3_forms = ['54', '57', '59', '61', '65', '68', '72', '73', '75', '78', '92', '98', '100', '101', '106', '110', '114 A', '116', '125', '134', '136', '137 A', '138', '143', '151', '153', '157', '164', '168', '174 B', '175', '179', '182', '183', '185', '188', '189', '190', '196', '197', '198', '200', '201', '202', '203', '205', '208', '210', '217', '220', '220 B', '221', '222', '223', '224', '225', '227', '231', '232', '238', '248']

print(f"Cat 1 count: {len(cat1_forms)}")
print(f"Cat 2 count: {len(cat2_forms)}")
print(f"Cat 3 count: {len(cat3_forms)}")
print(f"Total: {len(cat1_forms) + len(cat2_forms) + len(cat3_forms)}")

with open('scripts/group_audit_enriched.json', 'r', encoding='utf-8') as f:
    groups = json.load(f)

all_form_keys = {g['formNumber'].upper() for g in groups}
set1 = {f.upper() for f in cat1_forms}
set2 = {f.upper() for f in cat2_forms}
set3 = {f.upper() for f in cat3_forms}

union_set = set1 | set2 | set3
print(f"Union count: {len(union_set)}")
print(f"All form keys count: {len(all_form_keys)}")
print(f"Difference: {all_form_keys ^ union_set}")
