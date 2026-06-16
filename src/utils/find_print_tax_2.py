with open(r"c:\Users\SHEIKH GULFAM\My Drive (adm.exam.hss.shangus@gmail.com)\Projects\website\developer workflow\Govt-HSS-ERP\frontend\src\pages\AdminPortal.jsx", 'r', encoding='utf-8') as f:
    text = f.read()

import re
match = re.search(r"const\s+printTaxSheets\s*=\s*\(", text)
if match:
    start_pos = match.start()
    # Let's print about 200 lines after the first chunk
    body = text[start_pos + 12000:start_pos + 25000]
    out_path = r"c:\Users\SHEIKH GULFAM\My Drive (adm.exam.hss.shangus@gmail.com)\Projects\website\developer workflow\Govt-HSS-ERP\frontend\src\utils\print_tax_body_2.txt"
    with open(out_path, 'w', encoding='utf-8') as out_f:
        out_f.write(body)
    print("Successfully wrote function body part 2 to print_tax_body_2.txt")
else:
    print("printTaxSheets not found")
