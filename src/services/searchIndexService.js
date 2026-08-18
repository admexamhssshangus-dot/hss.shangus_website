// =================================================================
// HSS SHANGUS — Fast Ranked Global Search Engine & Index Service
// =================================================================
// Provides zero-latency, fuzzy and prefix-pattern global search across
// admissions and masterRegisters collections with Google-like relevance ranking.
// =================================================================

let memoryIndexCache = null;

/**
 * Normalizes strings for searchable indexing
 */
export function normalizeSearchStr(val) {
  if (val === null || val === undefined) return '';
  return String(val)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ');
}

/**
 * Clean registration number strings
 */
export function cleanSearchReg(val) {
  if (!val) return '';
  const s = String(val).trim().replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  if (/^(n\/a|—|-|null|undefined)$/i.test(s) || s.length < 5) return '';
  return s;
}

/**
 * Clean admission number strings
 */
export function cleanSearchAdm(val) {
  if (!val) return '';
  return String(val).trim().replace(/[^0-9]/g, '');
}

/**
 * Clean phone / mobile number strings
 */
export function cleanSearchMobile(val) {
  if (!val) return '';
  return String(val).trim().replace(/[^0-9]/g, '');
}

/**
 * Create a search index entry from any student document (admissions or masterRegisters)
 */
export function createSearchIndexEntry(doc, source = 'admissions') {
  if (!doc || typeof doc !== 'object') return null;

  const id = doc.id || doc['Form Number'] || doc['Form No.'] || doc.formNo || doc['Board Registration Number'] || '';
  const name = (
    doc.studentName ||
    doc["Student's Name (as per school records)"] ||
    doc["Student's Name"] ||
    doc['Student Name'] ||
    doc['Name of Student'] ||
    doc['name'] ||
    ''
  ).trim();

  const father = (
    doc.fatherName ||
    doc["Father's/Guardian's Name (as per school records)"] ||
    doc["Father's Name"] ||
    doc['Father Name'] ||
    ''
  ).trim();

  const mother = (
    doc.motherName ||
    doc["Mother's Name"] ||
    doc['Mother Name'] ||
    ''
  ).trim();

  const formNo = String(
    doc.formNo ||
    doc['Form Number'] ||
    doc['Form No.'] ||
    doc['FormNo'] ||
    doc.formNumber ||
    ''
  ).replace(/^(N\/A|—)$/i, '').trim();

  const boardRegNo = (
    doc.boardRegNo ||
    doc['Board Registration Number'] ||
    doc['Board Registration No.'] ||
    doc['Board Reg. No.'] ||
    doc['Board Reg No'] ||
    doc.regNo ||
    ''
  ).replace(/^(N\/A|—)$/i, '').trim();

  const admNo = String(
    doc.admNo ||
    doc['Admission No.'] ||
    doc['Admission No'] ||
    doc['Admission Number'] ||
    doc['Adm. No.'] ||
    doc['Adm. No'] ||
    doc['AdmNo'] ||
    doc.admissionNo ||
    ''
  ).replace(/^(N\/A|—)$/i, '').trim();

  const classRollNo = String(
    doc.classRollNo ||
    doc['Class Roll No'] ||
    doc['Class Roll No.'] ||
    doc['Roll No'] ||
    doc['Roll No.'] ||
    doc.rollNo ||
    ''
  ).replace(/^(N\/A|—)$/i, '').trim();

  const mobile = String(
    doc.mobile ||
    doc.mobileNumber ||
    doc['Mobile Number'] ||
    doc['Contact Number'] ||
    doc['Phone'] ||
    doc['Mobile No.'] ||
    doc['Mobile'] ||
    ''
  ).replace(/^(N\/A|—)$/i, '').trim();

  const studentClass = (
    doc.class ||
    doc.Class ||
    doc['Admission sought for class'] ||
    doc['Class'] ||
    ''
  ).trim();

  const session = (
    doc.session ||
    doc.Session ||
    doc['Academic Session'] ||
    doc['Session'] ||
    ''
  ).trim();

  const stream = (
    doc.stream ||
    doc.Stream ||
    doc['Stream'] ||
    ''
  ).trim();

  const gender = (
    doc.gender ||
    doc.Gender ||
    doc['Gender'] ||
    ''
  ).trim();

  const category = (
    doc.category ||
    doc.Category ||
    doc['Category'] ||
    ''
  ).trim();

  const village = (
    doc.village ||
    doc.Village ||
    doc['Village'] ||
    doc['Address'] ||
    doc['Permanent Address'] ||
    ''
  ).trim();

  // Search blob combining all text fields for substring matching
  const searchBlob = [
    name,
    father,
    mother,
    formNo,
    boardRegNo,
    admNo,
    classRollNo,
    mobile,
    studentClass,
    session,
    stream,
    gender,
    category,
    village
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return {
    id,
    n: name,
    f: father,
    m: mother,
    fn: formNo,
    r: boardRegNo,
    an: admNo,
    rn: classRollNo,
    mob: mobile,
    c: studentClass,
    s: session,
    st: stream,
    g: gender,
    cat: category,
    v: village,
    src: source,
    _blob: searchBlob,
    _cleanAdm: cleanSearchAdm(admNo),
    _cleanReg: cleanSearchReg(boardRegNo),
    _cleanMob: cleanSearchMobile(mobile),
    _cleanForm: formNo.toLowerCase().replace(/[^a-z0-9]/g, ''),
    _cleanRoll: classRollNo.toLowerCase().replace(/[^a-z0-9]/g, ''),
    _nameLower: name.toLowerCase(),
    _fatherLower: father.toLowerCase(),
    _motherLower: mother.toLowerCase(),
    // Raw record preview for instant popup rendering
    raw: doc
  };
}

/**
 * Builds or refreshes the global search index in memory
 * @param {Array<object>} admissions - Current admissions dataset
 * @param {Array<object>} masterRegisters - Master registers / archives dataset
 */
export function buildLocalSearchIndex(admissions = [], masterRegisters = []) {
  const index = [];
  const seenIds = new Set();

  // Index active admissions first
  if (Array.isArray(admissions)) {
    admissions.forEach(adm => {
      const entry = createSearchIndexEntry(adm, 'admissions');
      if (entry && entry.id && !seenIds.has(`adm_${entry.id}`)) {
        seenIds.add(`adm_${entry.id}`);
        index.push(entry);
      }
    });
  }

  // Index master registers
  if (Array.isArray(masterRegisters)) {
    masterRegisters.forEach(master => {
      const entry = createSearchIndexEntry(master, 'masterRegisters');
      if (entry && entry.id && !seenIds.has(`master_${entry.id}`)) {
        seenIds.add(`master_${entry.id}`);
        index.push(entry);
      }
    });
  }

  memoryIndexCache = index;
  return index;
}

/**
 * Parse special search shortcut patterns:
 * Examples:
 *   - "adm4347", "adm:4347", "adm 4347", "admission:4347" -> target admNo
 *   - "reg23...", "reg:23...", "board:..." -> target boardRegNo
 *   - "form123", "form:123" -> target formNo
 *   - "roll12", "roll:12", "classroll:12" -> target classRollNo
 *   - "mob9906...", "mobile:...", "phone:..." -> target mobile
 */
export function parseSearchQuery(query) {
  const raw = String(query || '').trim();
  if (!raw) return { isPattern: false, patternType: null, patternVal: '', rawTokens: [], raw };

  const qLower = raw.toLowerCase();

  // 1. Admission Number pattern: adm4347, adm:4347, adm#4347, adm 4347
  const admMatch = qLower.match(/^(?:adm|admission|admno|adm_no)[\s:#\-_]*([0-9a-zA-Z\-_/]+)$/);
  if (admMatch) {
    return {
      isPattern: true,
      patternType: 'admNo',
      patternVal: admMatch[1].trim(),
      rawTokens: [admMatch[1].trim()],
      raw
    };
  }

  // 2. Board Reg No pattern: reg23..., reg:23..., board:23...
  const regMatch = qLower.match(/^(?:reg|regno|board|boardreg)[\s:#\-_]*([0-9a-zA-Z\-_/]+)$/);
  if (regMatch) {
    return {
      isPattern: true,
      patternType: 'boardRegNo',
      patternVal: regMatch[1].trim(),
      rawTokens: [regMatch[1].trim()],
      raw
    };
  }

  // 3. Form Number pattern: form123, form:123, form#123
  const formMatch = qLower.match(/^(?:form|formno|fno)[\s:#\-_]*([0-9a-zA-Z\-_/]+)$/);
  if (formMatch) {
    return {
      isPattern: true,
      patternType: 'formNo',
      patternVal: formMatch[1].trim(),
      rawTokens: [formMatch[1].trim()],
      raw
    };
  }

  // 4. Class Roll No pattern: roll12, roll:12, classroll:12
  const rollMatch = qLower.match(/^(?:roll|rollno|classroll)[\s:#\-_]*([0-9a-zA-Z\-_/]+)$/);
  if (rollMatch) {
    return {
      isPattern: true,
      patternType: 'classRollNo',
      patternVal: rollMatch[1].trim(),
      rawTokens: [rollMatch[1].trim()],
      raw
    };
  }

  // 5. Mobile Number pattern: mob99..., phone:99..., mobile:99...
  const mobMatch = qLower.match(/^(?:mob|mobile|phone|contact)[\s:#\-_]*([0-9]+)$/);
  if (mobMatch) {
    return {
      isPattern: true,
      patternType: 'mobile',
      patternVal: mobMatch[1].trim(),
      rawTokens: [mobMatch[1].trim()],
      raw
    };
  }

  // Standard multi-token search
  const rawTokens = qLower.split(/\s+/).filter(Boolean);
  return {
    isPattern: false,
    patternType: null,
    patternVal: '',
    rawTokens,
    raw
  };
}

/**
 * Execute ranked global search against the indexed dataset
 * @param {string} query - The search string (supports plain text and patterns like adm4347)
 * @param {Array<object>} indexDataset - The search index entries (defaults to memory cache)
 * @param {number} limit - Maximum results to return (default: 50)
 * @returns {Array<object>} Ranked search results with score and source badges
 */
export function executeGlobalSearch(query, indexDataset = null, limit = 50) {
  const dataset = indexDataset || memoryIndexCache || [];
  if (!dataset || dataset.length === 0) return [];

  const parsed = parseSearchQuery(query);
  if (!parsed.raw) return [];

  const scoredResults = [];

  // A. Dedicated Pattern Search Mode (Fast O(N) single-field priority match)
  if (parsed.isPattern) {
    const val = parsed.patternVal.toLowerCase();
    const cleanVal = val.replace(/[^a-z0-9]/g, '');

    dataset.forEach(entry => {
      let score = 0;

      if (parsed.patternType === 'admNo') {
        if (entry.an.toLowerCase() === val || entry._cleanAdm === cleanVal) score += 5000;
        else if (entry.an.toLowerCase().includes(val)) score += 2500;
      } else if (parsed.patternType === 'boardRegNo') {
        if (entry.r.toLowerCase() === val || entry._cleanReg === cleanVal) score += 5000;
        else if (entry.r.toLowerCase().includes(val) || entry._cleanReg.includes(cleanVal)) score += 2500;
      } else if (parsed.patternType === 'formNo') {
        if (entry.fn.toLowerCase() === val || entry._cleanForm === cleanVal) score += 5000;
        else if (entry.fn.toLowerCase().includes(val)) score += 2500;
      } else if (parsed.patternType === 'classRollNo') {
        if (entry.rn.toLowerCase() === val || entry._cleanRoll === cleanVal) score += 5000;
        else if (entry.rn.toLowerCase().includes(val)) score += 2500;
      } else if (parsed.patternType === 'mobile') {
        if (entry._cleanMob.includes(cleanVal)) score += 5000;
      }

      if (score > 0) {
        scoredResults.push({
          ...entry,
          score
        });
      }
    });

    scoredResults.sort((a, b) => b.score - a.score);
    return scoredResults.slice(0, limit);
  }

  // B. Multi-Token Google-like Relevance Search Mode
  const tokens = parsed.rawTokens;
  if (tokens.length === 0) return [];

  dataset.forEach(entry => {
    const blob = entry._blob;
    let matchesAllTokens = true;
    let score = 0;

    for (const token of tokens) {
      if (!blob.includes(token)) {
        matchesAllTokens = false;
        break;
      }

      const cleanToken = token.replace(/[^a-z0-9]/g, '');

      // 1. Exact / Prefix Form Number match
      if (entry.fn.toLowerCase() === token || entry._cleanForm === cleanToken) score += 2500;
      else if (entry.fn.toLowerCase().includes(token)) score += 1000;

      // 2. Admission Number match
      if (entry.an.toLowerCase() === token || (cleanToken && entry._cleanAdm === cleanToken)) score += 2200;
      else if (entry.an.toLowerCase().includes(token)) score += 900;

      // 3. Board Registration Number match
      if (entry.r.toLowerCase() === token || (cleanToken.length >= 6 && entry._cleanReg === cleanToken)) score += 2000;
      else if (entry.r.toLowerCase().includes(token)) score += 800;

      // 4. Class Roll Number match
      if (entry.rn.toLowerCase() === token || entry._cleanRoll === cleanToken) score += 1500;
      else if (entry.rn.toLowerCase().includes(token)) score += 600;

      // 5. Mobile Number match
      if (cleanToken.length >= 5 && entry._cleanMob.includes(cleanToken)) score += 1200;

      // 6. Student Name match
      if (entry._nameLower === token) score += 1200;
      else if (entry._nameLower.startsWith(token)) score += 700;
      else if (entry._nameLower.includes(token)) score += 350;

      // 7. Father Name match
      if (entry._fatherLower === token) score += 900;
      else if (entry._fatherLower.startsWith(token)) score += 500;
      else if (entry._fatherLower.includes(token)) score += 250;

      // 8. Mother Name match
      if (entry._motherLower === token) score += 900;
      else if (entry._motherLower.startsWith(token)) score += 500;
      else if (entry._motherLower.includes(token)) score += 250;

      // 9. Village / Stream / Class match
      if (entry.v.toLowerCase().includes(token)) score += 100;
      if (entry.st.toLowerCase().includes(token)) score += 80;
      if (entry.c.toLowerCase().includes(token)) score += 50;
    }

    if (matchesAllTokens && score > 0) {
      scoredResults.push({
        ...entry,
        score
      });
    }
  });

  scoredResults.sort((a, b) => b.score - a.score);
  return scoredResults.slice(0, limit);
}
