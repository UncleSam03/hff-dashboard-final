import re

with open('scripts/original_markdown_tables.md', 'r', encoding='utf-8') as f:
    text = f.read()

sections = text.split('### ')

parsed = {}

for sec in sections:
    if not sec.strip():
        continue
    title = sec.splitlines()[0].strip()
    table_lines = [l.strip() for l in sec.splitlines() if l.strip().startswith('|') and not l.strip().startswith('| :---')]
    if table_lines:
        headers = [c.strip() for c in table_lines[0].split('|')[1:-1]]
        rows = []
        for l in table_lines[1:]:
            cells = [c.strip() for c in l.split('|')[1:-1]]
            rows.append(cells)
        parsed[title] = {
            'headers': headers,
            'rows': rows
        }

print("Parsed sections:")
for k, v in parsed.items():
    print(f"  '{k}': {len(v['rows'])} rows, headers={v['headers']}")
