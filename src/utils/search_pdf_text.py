import os

text_path = r"c:\Users\SHEIKH GULFAM\My Drive (adm.exam.hss.shangus@gmail.com)\Projects\website\developer workflow\Govt-HSS-ERP\frontend\src\utils\pdf_text.txt"
out_path = r"c:\Users\SHEIKH GULFAM\My Drive (adm.exam.hss.shangus@gmail.com)\Projects\website\developer workflow\Govt-HSS-ERP\frontend\src\utils\search_results.txt"

if os.path.exists(text_path):
    with open(text_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    pages = content.split('=== Page ')
    results = []
    
    keywords = ['tax', 'income', 'rebate', 'marginal', 'slab', 'salary', 'gpf', 'sli', 'cess']
    
    for i, page in enumerate(pages):
        found = False
        for kw in keywords:
            if kw in page.lower():
                found = True
                break
        if found:
            results.append(f"=== MATCHING PAGE {i} ===\n" + page.strip() + "\n\n")
            
    with open(out_path, 'w', encoding='utf-8') as out_f:
        out_f.writelines(results)
    print(f"Search results saved to {out_path}. Total matching pages: {len(results)}")
else:
    print("pdf_text.txt not found")
