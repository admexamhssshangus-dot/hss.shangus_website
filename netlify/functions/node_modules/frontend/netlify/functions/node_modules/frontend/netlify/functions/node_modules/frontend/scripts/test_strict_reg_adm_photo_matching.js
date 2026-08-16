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

function normCls(cls) {
  if (!cls) return '';
  const s = String(cls).toLowerCase().trim();
  if (s.includes('9')) return '9th';
  if (s.includes('10')) return '10th';
  if (s.includes('11')) return '11th';
  if (s.includes('12')) return '12th';
  return s;
}

function normSess(sess) {
  if (!sess) return '';
  return String(sess).toLowerCase().trim().replace(/[\/\s]+/g, '-');
}

async function main() {
  console.log("🔍 Testing Strict RegNo (Primary) & AdmNo (Secondary) Photo Matching...");

  const files = fs.readdirSync(PHOTOS_DIR);
  console.log(`Total photo files found in optimized_photos (8 aug 2026): ${files.length}`);

  const photoByRegSessClass = new Map();
  const photoByAdmSessClass = new Map();
  const photoByRegSess = new Map();
  const photoByAdmSess = new Map();
  const photoByRegOnly = new Map();
  const photoByAdmOnly = new Map();

  let validPhotoFiles = 0;
  for (const file of files) {
    if (!/\.(jpg|jpeg|png)$/i.test(file)) continue;
    validPhotoFiles++;
    const parts = file.replace(/\.(jpg|jpeg|png)$/i, '').split('_');
    if (parts.length < 3) continue;

    const cls = normCls(parts[0]);
    const sess = normSess(parts[1]);
    const idKey = cleanRegNoVal(parts[2]);

    const filePath = path.join(PHOTOS_DIR, file);

    if (idKey) {
      if (sess && cls) {
        photoByRegSessClass.set(`${idKey}::${sess}::${cls}`, filePath);
        photoByAdmSessClass.set(`${idKey}::${sess}::${cls}`, filePath);
      }
      if (sess) {
        photoByRegSess.set(`${idKey}::${sess}`, filePath);
        photoByAdmSess.set(`${idKey}::${sess}`, filePath);
      }
      photoByRegOnly.set(idKey, filePath);
      photoByAdmOnly.set(idKey, filePath);
    }
  }

  console.log(`Indexed ${validPhotoFiles} photo files using strict RegNo & AdmNo keys (NO NAMES used).`);

  const wb = xlsx.readFile(EXCEL_PATH);
  const masterWs = wb.Sheets['source_data'];
  const masterRows = xlsx.utils.sheet_to_json(masterWs);

  let masterMatchedByRegClassSess = 0;
  let masterMatchedByRegSess = 0;
  let masterMatchedByRegOnly = 0;
  let masterMatchedByAdmClassSess = 0;
  let masterMatchedByAdmSess = 0;
  let masterMatchedByAdmOnly = 0;
  let masterTotalMatched = 0;

  for (const row of masterRows) {
    const regNo = cleanRegNoVal(row['Board Reg. No.'] || row['Board Registration Number'] || row['Board Registration No. (Class 10th)'] || row['Board Registration No. (Class 11th)'] || row['Reg No'] || row['boardRegNo']);
    const admNo = cleanRegNoVal(row['Adm. No.'] || row['admNo']);
    const sess = normSess(row['Session']);
    const cls = normCls(row['Class']);

    let match = null;
    if (regNo && sess && cls && photoByRegSessClass.has(`${regNo}::${sess}::${cls}`)) {
      match = photoByRegSessClass.get(`${regNo}::${sess}::${cls}`);
      masterMatchedByRegClassSess++;
    } else if (regNo && sess && photoByRegSess.has(`${regNo}::${sess}`)) {
      match = photoByRegSess.get(`${regNo}::${sess}`);
      masterMatchedByRegSess++;
    } else if (regNo && photoByRegOnly.has(regNo)) {
      match = photoByRegOnly.get(regNo);
      masterMatchedByRegOnly++;
    } else if (admNo && sess && cls && photoByAdmSessClass.has(`${admNo}::${sess}::${cls}`)) {
      match = photoByAdmSessClass.get(`${admNo}::${sess}::${cls}`);
      masterMatchedByAdmClassSess++;
    } else if (admNo && sess && photoByAdmSess.has(`${admNo}::${sess}`)) {
      match = photoByAdmSess.get(`${admNo}::${sess}`);
      masterMatchedByAdmSess++;
    } else if (admNo && photoByAdmOnly.has(admNo)) {
      match = photoByAdmOnly.get(admNo);
      masterMatchedByAdmOnly++;
    }

    if (match) masterTotalMatched++;
  }

  console.log(`\n🎯 Master Register Rows Matched (Strict RegNo/AdmNo + Session + Class):`);
  console.log(`   - RegNo + Session + Class: ${masterMatchedByRegClassSess}`);
  console.log(`   - RegNo + Session: ${masterMatchedByRegSess}`);
  console.log(`   - RegNo Only: ${masterMatchedByRegOnly}`);
  console.log(`   - AdmNo + Session + Class: ${masterMatchedByAdmClassSess}`);
  console.log(`   - AdmNo + Session: ${masterMatchedByAdmSess}`);
  console.log(`   - AdmNo Only: ${masterMatchedByAdmOnly}`);
  console.log(`   - TOTAL MATCHED: ${masterTotalMatched} / ${masterRows.length} (${((masterTotalMatched / masterRows.length) * 100).toFixed(1)}%)`);

  const admWs = wb.Sheets['adm_form'];
  const admRows = xlsx.utils.sheet_to_json(admWs);

  let admTotalMatched = 0;
  for (const row of admRows) {
    const regNo = cleanRegNoVal(row['Board Registration Number'] || row['Board Registration No. (Class 10th)'] || row['Board Registration No. (Class 11th)']);
    const admNo = cleanRegNoVal(row['Adm. No.'] || row['admNo']);
    const sess = normSess(row['Session'] || row['Academic Session']);
    const cls = normCls(row['Class'] || row['Admission sought for class']);

    let match = null;
    if (regNo && sess && cls && photoByRegSessClass.has(`${regNo}::${sess}::${cls}`)) {
      match = photoByRegSessClass.get(`${regNo}::${sess}::${cls}`);
    } else if (regNo && sess && photoByRegSess.has(`${regNo}::${sess}`)) {
      match = photoByRegSess.get(`${regNo}::${sess}`);
    } else if (regNo && photoByRegOnly.has(regNo)) {
      match = photoByRegOnly.get(regNo);
    } else if (admNo && sess && cls && photoByAdmSessClass.has(`${admNo}::${sess}::${cls}`)) {
      match = photoByAdmSessClass.get(`${admNo}::${sess}::${cls}`);
    } else if (admNo && sess && photoByAdmSess.has(`${admNo}::${sess}`)) {
      match = photoByAdmSess.get(`${admNo}::${sess}`);
    } else if (admNo && photoByAdmOnly.has(admNo)) {
      match = photoByAdmOnly.get(admNo);
    }

    if (match) admTotalMatched++;
  }

  console.log(`\n🎯 Online Admissions Forms Matched (Strict RegNo/AdmNo + Session + Class):`);
  console.log(`   - TOTAL MATCHED: ${admTotalMatched} / ${admRows.length} (${((admTotalMatched / admRows.length) * 100).toFixed(1)}%)`);
}

main().catch(console.error);
