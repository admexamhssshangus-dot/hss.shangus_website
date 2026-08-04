const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'db_30 Jul 2026.xlsx');
const wb = XLSX.readFile(filePath);

console.log('Sheet names:', wb.SheetNames);

wb.SheetNames.forEach(sheetName => {
  const ws = wb.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(ws, { defval: '' });
  
  console.log(`\n--- Sheet: ${sheetName} (Total rows: ${data.length}) ---`);
  
  // Search for 250218
  const f250218 = data.filter(r => JSON.stringify(r).includes('250218'));
  console.log(`Form 250218 matches in ${sheetName}: ${f250218.length}`);
  if (f250218.length > 0) {
    console.log('Form 250218 details:', JSON.stringify(f250218, null, 2));
  }

  // Search for Uzma
  const uzma = data.filter(r => JSON.stringify(r).toLowerCase().includes('uzma'));
  console.log(`Uzma matches in ${sheetName}: ${uzma.length}`);
  if (uzma.length > 0) {
    uzma.forEach(r => {
      console.log('Uzma record:', {
        formNo: r['Form Number'] || r['FormNo'] || r['Form No.'] || r['Form No'],
        name: r["Student's Name (as per school records)"] || r["Student's Name"] || r['Candidate Name'] || r['Name'],
        father: r["Father's/Guardian's Name (as per school records)"] || r["Father's Name"] || r['Father Name'],
        cls: r['Admission sought for class'] || r['Class'],
        sess: r['Session'],
        roll: r['Class Roll No'] || r['Class R.No.'] || r['Roll No']
      });
    });
  }
});
