import os

prompt_path = r"c:\Users\SHEIKH GULFAM\My Drive (adm.exam.hss.shangus@gmail.com)\Projects\website\developer workflow\Govt-HSS-ERP\frontend\src\utils\user_prompt.txt"

if os.path.exists(prompt_path):
    with open(prompt_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    lines = content.split('\n')
    print("All formulas / lines with '=':")
    for idx, line in enumerate(lines):
        line_s = line.strip()
        if '=' in line_s or 'ROUND' in line_s or 'SLAB' in line_s.upper() or 'REBATE' in line_s.upper() or 'RELIEF' in line_s.upper() or 'CESS' in line_s.upper():
            print(f"L{idx+1}: {line_s}")
else:
    print("User prompt file not found")
