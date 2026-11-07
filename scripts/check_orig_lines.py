with open('scripts/original_markdown_tables.md', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for l in lines[20:35]:
    print(repr(l))
