const XLSX = require('xlsx');
const wb = XLSX.readFile('db_30 Jul 2026.xlsx');

const sheetName = 'practicals_2025';
if (wb.Sheets[sheetName]) {
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1 });
  console.log(`\n=== SHEET: ${sheetName} (${rows.length} rows) ===`);
  rows.forEach((row, idx) => {
    if (row && row.length > 0) {
      console.log(`Row ${idx + 1}:`, row.slice(0, 8));
    }
  });
}
