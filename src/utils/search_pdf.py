import os

text_path = r"c:\Users\SHEIKH GULFAM\My Drive (adm.exam.hss.shangus@gmail.com)\Projects\website\developer workflow\Govt-HSS-ERP\frontend\src\utils\pdf_text.txt"

if os.path.exists(text_path):
    with open(text_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    pages = content.split('=== Page ')
    print(f"Total pages: {len(pages)}")
    for i, page in enumerate(pages):
        lines = [l.strip() for l in page.split('\n') if l.strip()]
        header = " | ".join(lines[:2])
        print(f"Page {i}: {header}")
else:
    print("pdf_text.txt not found")
