const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'db_30 Jul 2026.xlsx');
const wb = XLSX.readFile(filePath);
const srcWs = wb.Sheets['source_data'];
const admWs = wb.Sheets['adm_form'];

const masterRecords = XLSX.utils.sheet_to_json(srcWs, { defval: '' });
const currentAdmissions = XLSX.utils.sheet_to_json(admWs, { defval: '' });

console.log('=== SEARCH FOR SAHITA BASHIR IN SOURCE_DATA & ADM_FORM ===');
const sahita_src = masterRecords.filter(r => JSON.stringify(r).includes('230101000030018') || JSON.stringify(r).toLowerCase().includes('sahita'));
console.log('Sahita in source_data count:', sahita_src.length);
sahita_src.forEach(r => {
  console.log('src:', {
    fNo: r['Form No.'],
    name: r["Student's Name"],
    father: r["Father's Name"],
    cls: r['Class'],
    sess: r['Session'],
    reg: r['Board Reg. No.'],
    photo: r['photo_id'] || r['Student Photo'] || r['photoUrl']
  });
});

const sahita_adm = currentAdmissions.filter(r => JSON.stringify(r).includes('230101000030018') || JSON.stringify(r).toLowerCase().includes('sahita'));
console.log('Sahita in adm_form count:', sahita_adm.length);
sahita_adm.forEach(r => {
  console.log('adm:', {
    fNo: r['Form Number'] || r['FormNo'],
    name: r["Student's Name (as per school records)"],
    father: r["Father's/Guardian's Name (as per school records)"],
    cls: r['Admission sought for class'],
    sess: r['Session'],
    reg: r['Board Registration No. (Class 11th)'] || r['Board Registration Number'],
    photo: r['Student Photo'] || r['photo_id'] || r['photoUrl']
  });
});
