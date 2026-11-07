with open(r'C:\Users\samuk\.gemini\antigravity\brain\2ae06947-8a3f-4b77-9c68-911319c8384c\.system_generated\tasks\task-453.log', 'r', encoding='utf-8', errors='ignore') as f:
    lines = f.readlines()
for l in lines:
    print(l.encode('ascii', 'ignore').decode('ascii').strip())
