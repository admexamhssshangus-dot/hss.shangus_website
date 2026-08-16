const fs = require('fs');
const xlsx = require('xlsx');

const paths = [
  "I:\\My Drive\\Projects\\admission form\\2026 onwards\\db_30 Jul 2026.xlsx",
  "G:\\My Drive\\Projects\\admission form\\2026 onwards\\db_30 Jul 2026.xlsx",
  "C:\\Users\\SHEIKH GULFAM\\AppData\\Local\\Google\\DriveFS\\113333246736466981898\\content_cache\\r44\\d662\\394017"
];

for (const p of paths) {
  try {
    if (fs.existsSync(p)) {
      console.log(`Found file at: "${p}"`);
      const wb = xlsx.readFile(p);
      console.log(`Sheets in workbook:`, wb.SheetNames);
      const ws = wb.Sheets['source_data'];
      const rows = xlsx.utils.sheet_to_json(ws);
      console.log(`source_data total rows: ${rows.length}`);
      break;
    }
  } catch (e) {
    console.error(`Error reading ${p}:`, e.message);
  }
}
