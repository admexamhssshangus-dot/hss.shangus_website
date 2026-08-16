const xlsx = require('xlsx');
const path = require('path');

const EXCEL_PATH = path.join(__dirname, '../db_30 Jul 2026.xlsx');
const wb = xlsx.readFile(EXCEL_PATH);

const admWs = wb.Sheets['adm_form'];
const admRows = xlsx.utils.sheet_to_json(admWs);
console.log("Keys in adm_form row 0 containing 'mobile', 'contact', 'parent', 'father':");
const keysAdm = Object.keys(admRows[0]).filter(k => /mobile|contact|parent|father/i.test(k));
console.log(keysAdm);
console.log("Values for adm_form row 0:", keysAdm.map(k => `${k}: ${admRows[0][k]}`));

const masterWs = wb.Sheets['source_data'];
const masterRows = xlsx.utils.sheet_to_json(masterWs);
console.log("\nKeys in source_data row 100 containing 'mobile', 'contact', 'parent', 'father':");
const keysMaster = Object.keys(masterRows[100]).filter(k => /mobile|contact|parent|father/i.test(k));
console.log(keysMaster);
console.log("Values for source_data row 100:", keysMaster.map(k => `${k}: ${masterRows[100][k]}`));
