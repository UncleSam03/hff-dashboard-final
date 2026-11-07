with open('scripts/original_markdown_tables.md', 'r', encoding='utf-8') as f:
    text = f.read()

import re
print("Length:", len(text))
print("Sections found:")
for line in text.splitlines():
    if line.startswith('#'):
        print(line)
