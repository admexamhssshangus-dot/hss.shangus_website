const xlsx = require('xlsx');
const path = require('path');

const EXCEL_PATH = path.join(__dirname, '../db_30 Jul 2026.xlsx');
const wb = xlsx.readFile(EXCEL_PATH);
const masterWs = wb.Sheets['source_data'];
const masterRows = xlsx.utils.sheet_to_json(masterWs);

console.log("Sample row from source_data:");
console.log(masterRows[0]);
console.log("Sample row 100:");
console.log(masterRows[100]);
