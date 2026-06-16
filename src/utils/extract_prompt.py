import json
import os

log_path = r"C:\Users\SHEIKH GULFAM\.gemini\antigravity-ide\brain\2e1a28e8-e6bd-4d40-8700-7a810a2a4312\.system_generated\logs\transcript.jsonl"

if os.path.exists(log_path):
    with open(log_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    print(f"Total lines in log: {len(lines)}")
    # The last line should contain the latest user request
    for line in reversed(lines):
        try:
            data = json.loads(line)
            if data.get("type") == "USER_INPUT":
                print("--- Found User Input ---")
                content = data.get("content", "")
                print(f"Content length: {len(content)}")
                # Write to a file for viewing
                out_path = r"c:\Users\SHEIKH GULFAM\My Drive (adm.exam.hss.shangus@gmail.com)\Projects\website\developer workflow\Govt-HSS-ERP\frontend\src\utils\user_prompt.txt"
                with open(out_path, 'w', encoding='utf-8') as out_f:
                    out_f.write(content)
                print(f"Saved prompt content to {out_path}")
                break
        except Exception as e:
            print("Error parsing line:", e)
else:
    print("Log path does not exist:", log_path)
