const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const EXCEL_PATH = path.join(__dirname, '../db_30 Jul 2026.xlsx');
const PHOTOS_DIR = path.join(__dirname, '../optimized_photos (8 aug 2026)');

function cleanVal(v) {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

function cleanRegNoVal(val) {
  if (val === null || val === undefined) return '';
  let s = String(val).trim();
  if (!s || /^(N\/A|#N\/A|—|-|null|undefined)$/i.test(s)) return '';
  if (/^[+-]?\d+(\.\d+)?[eE][+-]?\d+$/.test(s) || typeof val === 'number') {
    try {
      const num = Number(s);
      if (!isNaN(num) && num > 0) {
        s = BigInt(Math.round(num)).toString();
      }
    } catch (_) { }
  }
  return s.replace(/\.0+$/, '');
}

function normalizeName(str) {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function main() {
  console.log("🔍 Testing Comprehensive Photo Indexing...");

  const files = fs.readdirSync(PHOTOS_DIR);
  console.log(`Total photo files found in optimized_photos: ${files.length}`);

  const photoByReg = new Map();
  const photoByAdm = new Map();
  const photoByName = new Map();
  const photoByRegAndName = new Map();

  let validPhotoFiles = 0;
  for (const file of files) {
    if (!/\.(jpg|jpeg|png)$/i.test(file)) continue;
    validPhotoFiles++;
    const parts = file.replace(/\.(jpg|jpeg|png)$/i, '').split('_');
    if (parts.length < 4) continue;
    const cls = parts[0];
    const sess = parts[1];
    const idKey = cleanRegNoVal(parts[2]);
    const stName = parts.slice(3).join('_').trim();
    const normName = normalizeName(stName);

    const filePath = path.join(PHOTOS_DIR, file);

    if (idKey) {
      photoByReg.set(idKey, filePath);
      photoByAdm.set(idKey, filePath);
      if (normName) {
        photoByRegAndName.set(`${idKey}::${normName}`, filePath);
      }
    }
    if (normName) {
      photoByName.set(normName, filePath);
    }
  }

  console.log(`Indexed ${validPhotoFiles} photo files:`);
  console.log(`  - Unique Reg/Adm keys: ${photoByReg.size}`);
  console.log(`  - Unique Names: ${photoByName.size}`);

  const wb = xlsx.readFile(EXCEL_PATH);
  const masterWs = wb.Sheets['source_data'];
  const masterRows = xlsx.utils.sheet_to_json(masterWs);

  let masterMatched = 0;
  for (const row of masterRows) {
    const regNo = cleanRegNoVal(row['Board Registration Number'] || row['Reg No'] || row['boardRegNo']);
    const admNo = cleanRegNoVal(row['Adm. No.'] || row['admNo']);
    const stName = cleanVal(row["Student's Name (as per school records)"] || row["Student's Name"] || row["Student Name"]);
    const normName = normalizeName(stName);

    let match = null;
    if (regNo && normName && photoByRegAndName.has(`${regNo}::${normName}`)) {
      match = photoByRegAndName.get(`${regNo}::${normName}`);
    } else if (regNo && photoByReg.has(regNo)) {
      match = photoByReg.get(regNo);
    } else if (admNo && photoByAdm.has(admNo)) {
      match = photoByAdm.get(admNo);
    } else if (normName && photoByName.has(normName)) {
      match = photoByName.get(normName);
    }

    if (match) masterMatched++;
  }

  console.log(`🎯 Master Register Rows Matched with Photos: ${masterMatched} / ${masterRows.length} (${((masterMatched / masterRows.length) * 100).toFixed(1)}%)`);

  const admWs = wb.Sheets['adm_form'];
  const admRows = xlsx.utils.sheet_to_json(admWs);

  let admMatched = 0;
  for (const row of admRows) {
    const regNo = cleanRegNoVal(row['Board Registration Number'] || row['Board Registration No. (Class 10th)'] || row['Board Registration No. (Class 11th)']);
    const admNo = cleanRegNoVal(row['Adm. No.'] || row['admNo']);
    const stName = cleanVal(row["Student's Name (as per school records)"] || row["Student's Name"] || row["Student Name"]);
    const normName = normalizeName(stName);

    let match = null;
    if (regNo && normName && photoByRegAndName.has(`${regNo}::${normName}`)) {
      match = photoByRegAndName.get(`${regNo}::${normName}`);
    } else if (regNo && photoByReg.has(regNo)) {
      match = photoByReg.get(regNo);
    } else if (admNo && photoByAdm.has(admNo)) {
      match = photoByAdm.get(admNo);
    } else if (normName && photoByName.has(normName)) {
      match = photoByName.get(normName);
    }

    if (match) admMatched++;
  }

  console.log(`🎯 Online Admissions Forms Matched with Photos: ${admMatched} / ${admRows.length} (${((admMatched / admRows.length) * 100).toFixed(1)}%)`);
}

main().catch(console.error);
