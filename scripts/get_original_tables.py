import json

# Read transcript.jsonl
found_step = None
with open(r'C:\Users\samuk\.gemini\antigravity\brain\2ae06947-8a3f-4b77-9c68-911319c8384c\.system_generated\logs\transcript.jsonl', 'r', encoding='utf-8') as f:
    for line in f:
        obj = json.loads(line)
        content = obj.get('content', '')
        if 'Category 1: Fine' in content and 'Category 2: Gaps' in content:
            found_step = content
            break

if found_step:
    print("Found exact content! Length:", len(found_step))
    with open('scripts/original_markdown_tables.md', 'w', encoding='utf-8') as out:
        out.write(found_step)
    print("Saved to scripts/original_markdown_tables.md")
else:
    print("Not found in transcript.jsonl, trying transcript_full.jsonl")
    with open(r'C:\Users\samuk\.gemini\antigravity\brain\2ae06947-8a3f-4b77-9c68-911319c8384c\.system_generated\logs\transcript_full.jsonl', 'r', encoding='utf-8') as f:
        for line in f:
            obj = json.loads(line)
            content = obj.get('content', '')
            if 'Category 1: Fine' in content and 'Category 2: Gaps' in content:
                found_step = content
                break
    if found_step:
        print("Found exact content in transcript_full! Length:", len(found_step))
        with open('scripts/original_markdown_tables.md', 'w', encoding='utf-8') as out:
            out.write(found_step)
        print("Saved to scripts/original_markdown_tables.md")
