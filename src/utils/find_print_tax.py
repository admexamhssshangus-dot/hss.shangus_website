import re

file_path = r"c:\Users\SHEIKH GULFAM\My Drive (adm.exam.hss.shangus@gmail.com)\Projects\website\developer workflow\Govt-HSS-ERP\frontend\src\pages\AdminPortal.jsx"
out_path = r"c:\Users\SHEIKH GULFAM\My Drive (adm.exam.hss.shangus@gmail.com)\Projects\website\developer workflow\Govt-HSS-ERP\frontend\src\utils\print_tax_body.txt"

with open(file_path, 'r', encoding='utf-8') as f:
    text = f.read()

match = re.search(r"const\s+printTaxSheets\s*=\s*\(", text)
if match:
    start_pos = match.start()
    body = text[start_pos:start_pos + 12000]
    with open(out_path, 'w', encoding='utf-8') as out_f:
        out_f.write(body)
    print("Successfully wrote function body to print_tax_body.txt")
else:
    print("printTaxSheets not found")
