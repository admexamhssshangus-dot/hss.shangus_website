const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'db_30 Jul 2026.xlsx');
const wb = XLSX.readFile(filePath);

wb.SheetNames.forEach(sheetName => {
  const ws = wb.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(ws, { defval: '' });
  
  const matches = data.filter(r => {
    const str = JSON.stringify(r).toLowerCase();
    return str.includes('5282') || str.includes('uzma');
  });
  
  if (matches.length > 0) {
    console.log(`\n=== Sheet: ${sheetName} (Matches: ${matches.length}) ===`);
    matches.forEach(m => {
      console.log({
        formNo: m['Form Number'] || m['FormNo'] || m['Form No.'] || m['Form No'],
        name: m["Student's Name (as per school records)"] || m["Student's Name"] || m['Candidate Name'] || m['Name'],
        father: m["Father's/Guardian's Name (as per school records)"] || m["Father's Name"] || m['Father Name'],
        cls: m['Admission sought for class'] || m['Class'],
        sess: m['Session'],
        admNo: m['Admission Number'] || m['Adm. No.'] || m['Admission No.'] || m['RL. NO.'] || m['admNo'],
        roll: m['Class Roll No'] || m['Class R.No.'] || m['Roll No']
      });
    });
  }
});
