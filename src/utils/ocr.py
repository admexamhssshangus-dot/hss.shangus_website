import pytesseract
from PIL import Image
import os

screenshot1 = r"c:\Users\SHEIKH GULFAM\My Drive (adm.exam.hss.shangus@gmail.com)\Projects\website\developer workflow\versions\src0\Screenshot 2026-04-23 175536.png"
screenshot2 = r"c:\Users\SHEIKH GULFAM\My Drive (adm.exam.hss.shangus@gmail.com)\Projects\website\developer workflow\versions\src0\Screenshot 2026-04-23 175642.png"

paths_to_check = [
    r"C:\Program Files\Tesseract-OCR\tesseract.exe",
    r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
    os.path.expanduser(r"~\AppData\Local\Programs\Tesseract-OCR\tesseract.exe"),
    os.path.expanduser(r"~\AppData\Local\Tesseract-OCR\tesseract.exe"),
]

tess_path = None
for p in paths_to_check:
    if os.path.exists(p):
        tess_path = p
        break

if tess_path:
    print(f"Found Tesseract at {tess_path}")
    pytesseract.pytesseract.tesseract_cmd = tess_path
else:
    print("Tesseract not found in common paths. Searching drive...")
    # Let's search C:\ for tesseract.exe
    import glob
    found = glob.glob("C:/Program Files**/Tesseract-OCR/tesseract.exe", recursive=True)
    if found:
        tess_path = found[0]
        print(f"Found via glob: {tess_path}")
        pytesseract.pytesseract.tesseract_cmd = tess_path
    else:
        print("Tesseract really not found. Let's try importing easyocr if installed.")

if tess_path:
    for path in [screenshot1, screenshot2]:
        if os.path.exists(path):
            print(f"\n--- Processing {os.path.basename(path)} ---")
            try:
                img = Image.open(path)
                text = pytesseract.image_to_string(img)
                print(text)
            except Exception as e:
                print("Error:", e)
        else:
            print(f"File not found: {path}")
else:
    try:
        import easyocr
        print("easyocr is available, using easyocr...")
        reader = easyocr.Reader(['en'])
        for path in [screenshot1, screenshot2]:
            if os.path.exists(path):
                print(f"\n--- Processing {os.path.basename(path)} ---")
                results = reader.readtext(path, detail=0)
                print("\n".join(results))
    except ImportError:
        print("easyocr is not available.")
