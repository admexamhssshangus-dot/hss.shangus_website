const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'db_30 Jul 2026.xlsx');
const wb = XLSX.readFile(filePath);

console.log('=== EXCEL SHEETS ===');
console.log(wb.SheetNames);

wb.SheetNames.forEach(sheetName => {
  const ws = wb.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(ws, { defval: '' });
  console.log(`\n=== Sheet: ${sheetName} | Rows: ${data.length} ===`);
  if (data.length > 0) {
    console.log('Columns:', Object.keys(data[0]).join(', '));
    // Show first 3 rows as sample
    data.slice(0, 3).forEach((row, i) => {
      console.log(`  Row ${i+1}:`, JSON.stringify(row).substring(0, 200));
    });
  }
});
