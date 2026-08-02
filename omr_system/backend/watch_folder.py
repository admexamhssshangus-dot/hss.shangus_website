import json
import os
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
UPLOAD_FOLDER = Path(os.getenv('OMR_UPLOAD_FOLDER', str(ROOT / 'uploads')))
RESULTS_FOLDER = Path(os.getenv('OMR_RESULTS_FOLDER', str(ROOT / 'results')))
SUPPORTED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.pdf'}

RESULTS_FOLDER.mkdir(parents=True, exist_ok=True)
UPLOAD_FOLDER.mkdir(parents=True, exist_ok=True)

processed = set()

while True:
    for file_path in sorted(UPLOAD_FOLDER.iterdir()):
        if not file_path.is_file():
            continue
        if file_path.suffix.lower() not in SUPPORTED_EXTENSIONS:
            continue
        if file_path in processed:
            continue

        result_path = RESULTS_FOLDER / f'{file_path.stem}.json'
        payload = {
            'fileName': file_path.name,
            'status': 'received',
            'source': 'folder-watch',
            'notes': 'Placeholder OCR pipeline entry. Replace with real OMR parsing logic.'
        }
        result_path.write_text(json.dumps(payload, indent=2), encoding='utf-8')
        processed.add(file_path)
        print(f'Processed {file_path.name} -> {result_path.name}')

    time.sleep(5)
