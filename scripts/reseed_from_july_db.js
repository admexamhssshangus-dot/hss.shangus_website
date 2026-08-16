const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const xlsx = require('xlsx');

const SA_PATH = path.join(__dirname, 'serviceAccount.json');
const EXCEL_PATH = path.join(__dirname, '../db_30 Jul 2026.xlsx');
const PHOTOS_DIR = 'D:\\Shk_Gulfam\\Projects\\optimized_photos (8 aug 2026)';

if (!fs.existsSync(SA_PATH)) {
  console.error(`❌ Service account key not found at: ${SA_PATH}`);
  process.exit(1);
}
const sa = require(SA_PATH);
const PROJECT_ID = sa.project_id || 'hsssdb';

// Generate OAuth2 access token for Google Firestore REST API
function getAccessToken() {
  return new Promise((resolve, reject) => {
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const claim = Buffer.from(JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/cloud-platform',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now
    })).toString('base64url');

    const signer = crypto.createSign('RSA-SHA256');
    signer.update(header + '.' + claim);
    const sig = signer.sign(sa.private_key, 'base64url');
    const jwt = header + '.' + claim + '.' + sig;
    const postData = 'grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=' + jwt;

    const req = https.request('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          if (json.access_token) {
            resolve(json.access_token);
          } else {
            reject(new Error(`Failed to obtain access token: ${body}`));
          }
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function restRequest(method, endpoint, payload, token) {
  return new Promise((resolve, reject) => {
    const u = new URL(`https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents${endpoint}`);
    const data = payload ? JSON.stringify(payload) : null;

    const options = {
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };
    if (data) {
      options.headers['Content-Length'] = Buffer.byteLength(data);
    }

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${body}`));
          }
        } catch (e) {
          resolve(body);
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

// Convert JavaScript value to Firestore REST Value Object
function toFirestoreValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    if (Number.isInteger(val)) return { integerValue: String(val) };
    return { doubleValue: val };
  }
  if (typeof val === 'string') return { stringValue: val };
  if (Array.isArray(val)) {
    return {
      arrayValue: {
        values: val.map(toFirestoreValue)
      }
    };
  }
  if (typeof val === 'object') {
    const fields = {};
    Object.keys(val).forEach(k => {
      fields[k] = toFirestoreValue(val[k]);
    });
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

// Commit batch writes via REST API
async function commitBatchWrites(writes, token) {
  if (writes.length === 0) return;
  return restRequest('POST', ':commit', { writes }, token);
}

// Wipe all documents in a collection via REST API
async function wipeCollectionRest(colName, token) {
  console.log(`\n🧹 Listing and wiping collection: [${colName}]...`);
  let totalWiped = 0;
  let pageToken = '';

  do {
    const listRes = await restRequest('GET', `/${colName}?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ''}`, null, token).catch(() => ({}));
    const docs = listRes.documents || [];
    pageToken = listRes.nextPageToken || '';

    if (docs.length > 0) {
      const writes = docs.map(d => ({ delete: d.name }));
      await commitBatchWrites(writes, token);
      totalWiped += docs.length;
      console.log(`  - Deleted ${totalWiped} documents from [${colName}]...`);
    }
  } while (pageToken);

  console.log(`✅ [${colName}] successfully wiped (${totalWiped} documents deleted).`);
}

function cleanVal(v) {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

function parseNum(val) {
  if (!val) return 0;
  const s = String(val).replace(/[^0-9.-]+/g, '');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function normalizeClassVal(c) {
  if (!c) return '11th';
  const str = String(c).toLowerCase().trim();
  if (str.includes('9')) return '9th';
  if (str.includes('10')) return '10th';
  if (str.includes('11')) return '11th';
  if (str.includes('12')) return '12th';
  return String(c).trim();
}

function normalizeSessionVal(s) {
  if (!s) return '2025-26';
  return String(s).trim().replace(/\s+/g, ' ');
}

// Index all photos in PHOTOS_DIR
function buildPhotoIndex() {
  if (!fs.existsSync(PHOTOS_DIR)) {
    console.warn(`⚠️ Photo directory not found at: ${PHOTOS_DIR}`);
    return { byKey: {}, filesCount: 0 };
  }

  const files = fs.readdirSync(PHOTOS_DIR).filter(f => /\.(jpe?g|png|webp)$/i.test(f));
  console.log(`📁 Indexing ${files.length} photos from "${PHOTOS_DIR}"...`);

  const byKey = {};

  files.forEach(fileName => {
    const ext = path.extname(fileName);
    const base = path.basename(fileName, ext).trim();
    const parts = base.split('_');

    let cls = '';
    let sess = '';
    let regNo = '';
    let name = '';

    if (parts.length >= 4) {
      cls = parts[0].toLowerCase().trim();
      sess = parts[1].toLowerCase().trim();
      regNo = parts[2].toLowerCase().trim();
      name = parts.slice(3).join(' ').toLowerCase().trim();
    } else if (parts.length === 3) {
      cls = parts[0].toLowerCase().trim();
      regNo = parts[1].toLowerCase().trim();
      name = parts[2].toLowerCase().trim();
    } else if (parts.length === 2) {
      regNo = parts[0].toLowerCase().trim();
      name = parts[1].toLowerCase().trim();
    } else {
      name = base.toLowerCase().trim();
    }

    const filePath = path.join(PHOTOS_DIR, fileName);
    const info = { fileName, filePath, regNo, name, cls, sess };

    if (regNo && regNo.length >= 4) {
      byKey[`reg_${regNo}`] = info;
      if (sess) byKey[`sess_reg_${sess}_${regNo}`] = info;
      if (cls && sess) byKey[`cls_sess_reg_${cls}_${sess}_${regNo}`] = info;
    }
    if (name && name.length >= 3) {
      if (!byKey[`name_${name}`]) byKey[`name_${name}`] = info;
      if (cls && sess) byKey[`cls_sess_name_${cls}_${sess}_${name}`] = info;
    }
  });

  return { byKey, filesCount: files.length };
}

function resolveStudentPhotoDataUrl(student, photoIndex) {
  if (!photoIndex || photoIndex.filesCount === 0) return '';
  const sReg = String(
    student['Board Registration No. (Class 10th)'] ||
    student['Board Registration No. (Class 11th)'] ||
    student['Board Reg. No.'] ||
    student['Board Registration Number'] ||
    student['Board Registration No.'] ||
    student.boardRegNo ||
    student.regNo ||
    ''
  ).toLowerCase().trim();

  const sForm = String(student['Form Number'] || student['Form No'] || student['Form No.'] || student.formNo || '').toLowerCase().trim();
  const sRoll = String(student['Class Roll No'] || student['Class Roll No.'] || student['RL. NO.'] || student.rollNo || '').toLowerCase().trim();
  const sName = String(student["Student's Name (as per school records)"] || student["Student's Name"] || student.studentName || student.name || '').toLowerCase().trim();
  const sClass = normalizeClassVal(student['Admission sought for class'] || student['Class'] || student.class).toLowerCase();
  const sSess = normalizeSessionVal(student['Session'] || student.session).toLowerCase();

  let match = null;
  if (sReg && sReg.length >= 4) {
    match = photoIndex.byKey[`cls_sess_reg_${sClass}_${sSess}_${sReg}`] ||
            photoIndex.byKey[`sess_reg_${sSess}_${sReg}`] ||
            photoIndex.byKey[`reg_${sReg}`];
  }
  if (!match && sName && sName.length >= 3) {
    match = photoIndex.byKey[`cls_sess_name_${sClass}_${sSess}_${sName}`] ||
            photoIndex.byKey[`name_${sName}`];
  }

  if (match && fs.existsSync(match.filePath)) {
    try {
      const buf = fs.readFileSync(match.filePath);
      const ext = path.extname(match.fileName).toLowerCase().replace('.', '') || 'jpeg';
      const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
      return `data:${mime};base64,${buf.toString('base64')}`;
    } catch (_) {}
  }
  return '';
}

async function importAdmissions(sheet, photoIndex, token) {
  console.log(`\n📥 Importing [admissions] with photo matching...`);
  const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });
  console.log(`Found ${rows.length} admissions rows.`);

  const CHUNK_SIZE = 100;
  let imported = 0;
  let photosLinked = 0;

  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    const writes = [];

    chunk.forEach((r, idx) => {
      const globalIdx = i + idx;
      let formNo = cleanVal(r['Form Number'] || r['Form No'] || r['formNo'] || '');
      const docId = formNo ? `adm_${formNo}` : `adm_row_${globalIdx + 1}`;

      const cleanDoc = {};
      Object.keys(r).forEach(k => {
        const cleanKey = k.replace(/[\r\n\t]+/g, ' ').trim();
        cleanDoc[cleanKey] = r[k];
      });

      cleanDoc.formNo = formNo || '—';
      cleanDoc['Form Number'] = formNo || '—';
      cleanDoc.class = normalizeClassVal(cleanDoc['Admission sought for class'] || cleanDoc['Class'] || '11th');
      cleanDoc.session = normalizeSessionVal(cleanDoc['Session'] || '2025-26');
      cleanDoc.status = cleanVal(cleanDoc['Status'] || 'Submitted');
      cleanDoc.updatedAt = cleanDoc['Timestamp'] || cleanDoc['Last Submission At'] || new Date().toISOString();

      // Resolve and attach photo
      const existingPhoto = cleanDoc['Student Photo'] || cleanDoc['photo_id'] || cleanDoc['photoUrl'];
      if (!existingPhoto || String(existingPhoto).trim().length < 50) {
        const photoDataUrl = resolveStudentPhotoDataUrl(cleanDoc, photoIndex);
        if (photoDataUrl) {
          cleanDoc['Student Photo'] = photoDataUrl;
          cleanDoc['photo_id'] = photoDataUrl;
          cleanDoc['photoUrl'] = photoDataUrl;
          photosLinked++;
        }
      } else {
        photosLinked++;
      }

      const docName = `projects/${PROJECT_ID}/databases/(default)/documents/admissions/${docId}`;
      const firestoreFields = {};
      Object.keys(cleanDoc).forEach(k => {
        firestoreFields[k] = toFirestoreValue(cleanDoc[k]);
      });

      writes.push({
        update: {
          name: docName,
          fields: firestoreFields
        }
      });
      imported++;
    });

    await commitBatchWrites(writes, token);
    console.log(`  - Uploaded ${imported} / ${rows.length} admissions (${photosLinked} photos linked)...`);
  }
  console.log(`✅ [admissions] import complete: ${imported} records (${photosLinked} photos linked).`);
}

async function importSourceDataToMasterRegisters(sheet, token) {
  console.log(`\n📥 Importing [source_data] into [masterRegisters] clean chunk documents...`);
  const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });
  console.log(`Found ${rows.length} master register rows.`);

  const ITEMS_PER_CHUNK = 50;
  const totalChunks = Math.ceil(rows.length / ITEMS_PER_CHUNK);
  console.log(`Splitting into ${totalChunks} chunks of ~${ITEMS_PER_CHUNK} items each.`);

  for (let chunkIdx = 0; chunkIdx < totalChunks; chunkIdx++) {
    const start = chunkIdx * ITEMS_PER_CHUNK;
    const end = Math.min(start + ITEMS_PER_CHUNK, rows.length);
    const chunkRows = rows.slice(start, end);

    const chunkItems = chunkRows.map((r, itemIdx) => {
      const cleanItem = {};
      Object.keys(r).forEach(k => {
        const cleanKey = k.replace(/[\r\n\t]+/g, ' ').trim();
        cleanItem[cleanKey] = r[k];
      });
      cleanItem._globalIndex = start + itemIdx;
      cleanItem.class = normalizeClassVal(cleanItem['Class'] || '11th');
      cleanItem.session = normalizeSessionVal(cleanItem['Session'] || '2025-26');
      return cleanItem;
    });

    const chunkDocId = `chunk_${String(chunkIdx + 1).padStart(3, '0')}`;
    const docName = `projects/${PROJECT_ID}/databases/(default)/documents/masterRegisters/${chunkDocId}`;

    const chunkDocData = {
      chunkIndex: chunkIdx + 1,
      itemCount: chunkItems.length,
      rangeStart: start,
      rangeEnd: end - 1,
      updatedAt: new Date().toISOString(),
      items: chunkItems
    };

    const firestoreFields = {};
    Object.keys(chunkDocData).forEach(k => {
      firestoreFields[k] = toFirestoreValue(chunkDocData[k]);
    });

    await commitBatchWrites([{
      update: {
        name: docName,
        fields: firestoreFields
      }
    }], token);

    if ((chunkIdx + 1) % 20 === 0 || chunkIdx + 1 === totalChunks) {
      console.log(`  - Uploaded ${chunkIdx + 1} / ${totalChunks} master register chunks...`);
    }
  }
  console.log(`✅ [masterRegisters] import complete: ${totalChunks} chunks (${rows.length} records).`);
}

async function importPracticalsData(sheet, token) {
  console.log(`\n📥 Importing updated [prac_data] with multi-block header support into [practicalsData]...`);
  const raw = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  const getSubjCode = (name) => {
    const s = String(name || '').toUpperCase();
    if (s.includes('BOTANY') || s.includes('(BO)')) return 'BO';
    if (s.includes('ZOOLOGY') || s.includes('(ZO)')) return 'ZO';
    if (s.includes('BIOLOGY') || s.includes('(BI)')) return 'BI';
    if (s.includes('PHYSICS') || s.includes('(PH)')) return 'PH';
    if (s.includes('CHEMISTRY') || s.includes('(CH)')) return 'CH';
    if (s.includes('GEOGRAPHY') || s.includes('(GG)')) return 'GG';
    if (s.includes('COMPUTER') || s.includes('(CS)')) return 'CS';
    if (s.includes('IP') || s.includes('INFORMATICS')) return 'IP';
    if (s.includes('ENVIRONMENT') || s.includes('(EVS)')) return 'EVS';
    if (s.includes('URDU') || s.includes('(UR)')) return 'UR';
    if (s.includes('HISTORY') || s.includes('(HT)')) return 'HT';
    if (s.includes('POLITICAL') || s.includes('(PS)')) return 'PS';
    if (s.includes('PHYSICAL') || s.includes('(PD)')) return 'PD';
    if (s.includes('ECONOMICS') || s.includes('(EC)')) return 'EC';
    if (s.includes('MATHEMATICS') || s.includes('(MA)')) return 'MA';
    if (s.includes('ENGLISH') || s.includes('(EN)')) return 'EN';
    if (s.includes('EDUCATION') || s.includes('(ED)')) return 'ED';
    return name.slice(0, 3).toUpperCase();
  };

  const submissions = [];

  for (let r = 0; r < raw.length; r++) {
    const row = raw[r];
    if (String(row[0] || '').trim().toLowerCase() === 'timestamp' && String(row[3] || '').trim().toLowerCase() === 'class') {
      const headerRowIdx = r;
      const regRow = headerRowIdx >= 2 ? raw[headerRowIdx - 2] : [];
      const rollRow = headerRowIdx >= 1 ? raw[headerRowIdx - 1] : [];
      const headerRow = raw[headerRowIdx];

      const metaCount = 7;
      const studentHeaders = [];
      for (let c = metaCount; c < headerRow.length; c++) {
        const sName = cleanVal(headerRow[c]);
        const sReg = cleanVal(regRow ? regRow[c] : '');
        const sRoll = cleanVal(rollRow ? rollRow[c] : '');
        if (sName || sReg || sRoll) {
          studentHeaders.push({
            colIdx: c,
            name: sName,
            regNo: sReg,
            rollNo: sRoll
          });
        }
      }

      let nextR = headerRowIdx + 1;
      while (nextR < raw.length) {
        const dataRow = raw[nextR];
        const nextFirstCol = String(dataRow[0] || '').trim().toLowerCase();
        if (nextFirstCol === 'timestamp') break;

        const timestamp = cleanVal(dataRow[0]);
        const email = cleanVal(dataRow[1]);
        const teacherName = cleanVal(dataRow[2]);
        const className = normalizeClassVal(dataRow[3]);
        const subjectName = cleanVal(dataRow[4]);
        const practicalType = cleanVal(dataRow[5]).toLowerCase() || 'internal';
        const session = normalizeSessionVal(dataRow[6]);

        if (subjectName && className && timestamp) {
          const studentRecords = [];
          const flatMarks = {};

          studentHeaders.forEach(sh => {
            const marksVal = cleanVal(dataRow[sh.colIdx]);
            if (marksVal !== '' && marksVal !== '-' && marksVal !== 'null') {
              const rec = {
                regNo: sh.regNo,
                rollNo: sh.rollNo,
                boardRoll: sh.rollNo,
                boardRollNo: sh.rollNo,
                name: sh.name,
                studentName: sh.name,
                practicalMarks: marksVal,
                totalMarks: marksVal,
                vivaMarks: ''
              };
              studentRecords.push(rec);

              if (sh.regNo) flatMarks[sh.regNo] = rec;
              if (sh.rollNo) flatMarks[sh.rollNo] = rec;
              if (sh.name) flatMarks[sh.name.toLowerCase()] = rec;
            }
          });

          const subjCode = getSubjCode(subjectName);
          const docId = `${className}_${subjCode}_${practicalType}_${session.replace(/[\/\s]+/g, '_')}`;

          submissions.push({
            id: docId,
            docId: docId,
            timestamp: timestamp,
            email: email,
            teacherName: teacherName,
            class: className,
            className: className,
            Class: className,
            subject: subjectName,
            subjectName: subjectName,
            Subject: subjectName,
            subjectCode: subjCode,
            practicalType: practicalType,
            PracticalType: practicalType,
            session: session,
            Session: session,
            yearSuffix: session,
            records: studentRecords,
            totalStudentsEvaluated: studentRecords.length,
            updatedAt: new Date().toISOString(),
            ...flatMarks
          });
        }
        nextR++;
      }
    }
  }

  console.log(`Parsed ${submissions.length} total practical submission documents.`);

  const writes = [];
  submissions.forEach(pracDoc => {
    const docName = `projects/${PROJECT_ID}/databases/(default)/documents/practicalsData/${pracDoc.id}`;
    const firestoreFields = {};
    Object.keys(pracDoc).forEach(k => {
      firestoreFields[k] = toFirestoreValue(pracDoc[k]);
    });
    writes.push({ update: { name: docName, fields: firestoreFields } });
  });

  await commitBatchWrites(writes, token);
  console.log(`✅ [practicalsData] import complete: ${submissions.length} submission documents.`);
}

async function importFundRatesAndDistributions(wb, token) {
  console.log(`\n📥 Importing [rate] and [distributions]...`);

  // 1. Rate sheet -> fund_rates
  const rateSheet = wb.Sheets['rate'];
  if (rateSheet) {
    const rateRows = xlsx.utils.sheet_to_json(rateSheet, { defval: '' });
    console.log(`Found ${rateRows.length} rate rows.`);
    const writes = [];

    for (const r of rateRows) {
      const cls = normalizeClassVal(r['Class']);
      const rateDoc = {
        class: cls,
        schoolImprov: parseNum(r['School \r\r\r\nimprov. Fund'] || r['School improv. Fund'] || r['School Improv']),
        gamesFund: parseNum(r['Games Fund']),
        newsFund: parseNum(r['News Fund']),
        poorFund: parseNum(r['Poor Fund']),
        redCrossFund: parseNum(r['Red Cross Fund']),
        admFee: parseNum(r['Adm/Re-adm Fee']),
        printingFund: parseNum(r['Printing Fund']),
        libraryFund: parseNum(r['Library Fund']),
        boardReg: parseNum(r['Board Reg']),
        computerFund: parseNum(r['Computer Fund']),
        magazineFund: parseNum(r['Magazine Fund']),
        scienceFund: parseNum(r['Science Fund']),
        socialActivity: parseNum(r['Social Activity Fund']),
        sweepingFund: parseNum(r['Sweeping Fund']),
        electricityCharges: parseNum(r['Electricity Charges']),
        totalFeeReceived: parseNum(r['Total Fee received']),
        updatedAt: new Date().toISOString()
      };

      const docName = `projects/${PROJECT_ID}/databases/(default)/documents/fund_rates/${cls}`;
      const firestoreFields = {};
      Object.keys(rateDoc).forEach(k => {
        firestoreFields[k] = toFirestoreValue(rateDoc[k]);
      });
      writes.push({ update: { name: docName, fields: firestoreFields } });
    }
    await commitBatchWrites(writes, token);
    console.log(`✅ [fund_rates] import complete: ${rateRows.length} class rate tiers.`);
  }

  // 2. Distributions sheet -> fund_distributions
  const distSheet = wb.Sheets['distributions'];
  if (distSheet) {
    const distRows = xlsx.utils.sheet_to_json(distSheet, { defval: '' });
    console.log(`Found ${distRows.length} historical distributions.`);
    const writes = [];

    for (let idx = 0; idx < distRows.length; idx++) {
      const r = distRows[idx];
      const cls = normalizeClassVal(r['Class']);
      const month = cleanVal(r['Month']);
      const year = cleanVal(r['Year']);
      const docId = `dist_${cls}_${month}_${year}_${idx + 1}`.replace(/[\/\s]+/g, '_');

      const distDoc = {
        id: docId,
        class: cls,
        month: month,
        year: year,
        onRoll: parseNum(r['On roll']),
        scienceStudents: parseNum(r['No. of Science students']),
        paidStudents: parseNum(r['No. Paid']),
        unpaidStudents: cleanVal(r['No. Unpaid']),
        schoolImprov: parseNum(r['School \r\r\r\nimprov. Fund'] || r['School improv. Fund'] || r['School Improv']),
        gamesFund: parseNum(r['Games Fund']),
        newsFund: parseNum(r['News Fund']),
        poorFund: parseNum(r['Poor Fund']),
        redCrossFund: parseNum(r['Red Cross Fund']),
        admFee: parseNum(r['Adm/Re-adm Fee']),
        printingFund: parseNum(r['Printing Fund']),
        libraryFund: parseNum(r['Library Fund']),
        boardReg: parseNum(r['Board Reg']),
        computerFund: parseNum(r['Computer Fund']),
        magazineFund: parseNum(r['Magazine Fund']),
        scienceFund: parseNum(r['Science Fund']),
        socialActivity: parseNum(r['Social Activity Fund']),
        sweepingFund: parseNum(r['Sweeping Fund']),
        electricityCharges: parseNum(r['Electricity Charges']),
        totalAmount: parseNum(r['Total Fee received']),
        generatedDate: `${month} ${year}`,
        timestamp: new Date().toISOString()
      };

      const docName = `projects/${PROJECT_ID}/databases/(default)/documents/fund_distributions/${docId}`;
      const firestoreFields = {};
      Object.keys(distDoc).forEach(k => {
        firestoreFields[k] = toFirestoreValue(distDoc[k]);
      });
      writes.push({ update: { name: docName, fields: firestoreFields } });
    }
    await commitBatchWrites(writes, token);
    console.log(`✅ [fund_distributions] import complete: ${distRows.length} distribution records.`);
  }
}

async function main() {
  console.log("=================================================================");
  console.log("🚀 HSS SHANGUS — FULL DATABASE WIPE & RESEED FROM db_30 Jul 2026.xlsx");
  console.log("=================================================================");

  const token = await getAccessToken();
  console.log("🔑 Authenticated with Google Cloud Firestore via OAuth2.");

  if (!fs.existsSync(EXCEL_PATH)) {
    console.error(`❌ Excel file not found at: ${EXCEL_PATH}`);
    process.exit(1);
  }

  const wb = xlsx.readFile(EXCEL_PATH);
  const photoIndex = buildPhotoIndex();

  // 1. Wipe earlier collections
  await wipeCollectionRest('admissions', token);
  await wipeCollectionRest('masterRegisters', token);
  await wipeCollectionRest('practicalsData', token);
  await wipeCollectionRest('fund_rates', token);
  await wipeCollectionRest('fund_distributions', token);

  // 2. Import fresh sheets
  if (wb.Sheets['admissions']) {
    await importAdmissions(wb.Sheets['admissions'], photoIndex, token);
  }
  if (wb.Sheets['source_data']) {
    await importSourceDataToMasterRegisters(wb.Sheets['source_data'], token);
  }
  if (wb.Sheets['prac_data']) {
    await importPracticalsData(wb.Sheets['prac_data'], token);
  }
  await importFundRatesAndDistributions(wb, token);

  console.log("\n=================================================================");
  console.log("🎉 ALL COLLECTIONS SUCCESSFULLY WIPED AND RE-IMPORTED AFRESH!");
  console.log("=================================================================");
  process.exit(0);
}

main().catch(err => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
