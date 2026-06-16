import os

prompt_path = r"c:\Users\SHEIKH GULFAM\My Drive (adm.exam.hss.shangus@gmail.com)\Projects\website\developer workflow\Govt-HSS-ERP\frontend\src\utils\user_prompt.txt"

if os.path.exists(prompt_path):
    with open(prompt_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # split lines and filter
    lines = content.split('\n')
    filtered_lines = [line.strip() for line in lines if line.strip()]
    
    print(f"Total non-empty lines: {len(filtered_lines)}")
    for line in filtered_lines[:100]:
        print(line)
else:
    print("User prompt file not found")
