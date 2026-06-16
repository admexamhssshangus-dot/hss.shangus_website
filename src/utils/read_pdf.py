import os
import sys
import pypdf

pdf_path = r"c:\Users\SHEIKH GULFAM\My Drive (adm.exam.hss.shangus@gmail.com)\Projects\website\developer workflow\developer workflow_websites building.pdf"
out_path = r"c:\Users\SHEIKH GULFAM\My Drive (adm.exam.hss.shangus@gmail.com)\Projects\website\developer workflow\Govt-HSS-ERP\frontend\src\utils\pdf_text.txt"

if not os.path.exists(pdf_path):
    print("PDF not found")
    sys.exit(1)

try:
    reader = pypdf.PdfReader(pdf_path)
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write(f"Total pages: {len(reader.pages)}\n\n")
        for i, page in enumerate(reader.pages):
            f.write(f"=== Page {i+1} ===\n")
            text = page.extract_text()
            f.write(text)
            f.write("\n\n")
    print("PDF successfully written to pdf_text.txt")
except Exception as e:
    print("Error:", e)
