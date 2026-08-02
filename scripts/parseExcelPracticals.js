const XLSX = require('xlsx');
const wb = XLSX.readFile('db_30 Jul 2026.xlsx');

console.log('Available Sheets:', wb.SheetNames);

['practical_data', 'practicals_2025'].forEach(sheetName => {
  if (!wb.Sheets[sheetName]) return;
  console.log(`\n=== SHEET: ${sheetName} ===`);
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  console.log(`Total rows in ${sheetName}:`, rows.length);

  rows.forEach((row, idx) => {
    if (row && row.length >= 5) {
      const colA = String(row[0] || '');
      const colD = String(row[3] || '');
      const colE = String(row[4] || '');
      const colF = String(row[5] || '');
      const colG = String(row[6] || '');
      const colH = String(row[7] || '');
      if (colD.includes('11') || colD.includes('12') || colE.includes('Botany') || colE.includes('Physics') || colE.includes('Chemistry')) {
        console.log(`Row ${idx + 1}: Class=${colD} | Subj=${colE} | Type=${colF} | Yr=${colG} | Session=${colH} | Cols=${row.length}`);
      }
    }
  });
});
