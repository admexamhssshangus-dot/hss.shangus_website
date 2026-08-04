const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'db_30 Jul 2026.xlsx');
const wb = XLSX.readFile(filePath);
const srcWs = wb.Sheets['source_data'];
const masterRecords = XLSX.utils.sheet_to_json(srcWs, { defval: '' });

const hamidMaster11 = masterRecords.find(r => String(r["Student's Name"] || '').includes('Hamid Manzoor') && String(r.Class).includes('11'));

console.log('Hamid Class 11 Keys:', Object.keys(hamidMaster11));
console.log('Photo keys present on Hamid Class 11 row:');
Object.keys(hamidMaster11).forEach(k => {
  if (k.toLowerCase().includes('photo')) {
    console.log(`Key: "${k}" -> Value: "${hamidMaster11[k]}"`);
  }
});
