import re

with open('scripts/original_markdown_tables.md', 'r', encoding='utf-8') as f:
    text = f.read()

sections = text.split('### ')

for sec in sections:
    if not sec.strip(): continue
    lines = sec.splitlines()
    print("Section:", lines[0])
    for l in lines[1:]:
        if l.startswith('|') and not l.startswith('| :---') and not l.startswith('| Form #') and not l.startswith('| Category'):
            print("  Row:", l[:80])
            break
