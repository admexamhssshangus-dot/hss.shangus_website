const XLSX = require('xlsx');

const wb = XLSX.readFile('db_30 Jul 2026.xlsx');
const sheet = wb.Sheets['practical_data'];
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

console.log('Total rows:', rows.length);

let currentHeaders = [];

rows.forEach((r, i) => {
  if (!r || r.length === 0) return;
  const colA = String(r[0] || '').trim();
  const colD = String(r[3] || '').trim();
  const colE = String(r[4] || '').trim();

  if (colA.toLowerCase().includes('timestamp') || (r[8] && String(r[8]).includes('/'))) {
    currentHeaders = r;
    console.log(`\n📋 Header Row ${i + 1}: ${currentHeaders.length} cols | Col I = ${currentHeaders[8]}`);
    return;
  }

  if (colD.includes('11') || colD.includes('12')) {
    const colI_val = r[8];
    const header_colI = currentHeaders[8];
    console.log(`Row ${i + 1} (${colD} ${colE}): Header[8]=${header_colI} | Val[8]=${colI_val}`);
  }
});
