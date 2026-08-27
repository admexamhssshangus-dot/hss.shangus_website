// =================================================================
// HSS SHANGUS — Fast Ranked Intelligent Global Search Engine
// =================================================================
// Provides zero-latency, Google-like multi-aspect search across student records.
// Integrates:
// 1. Kashmiri & South Asian transliteration phonetics (e.g. syed/syad/sayed, mohd/mohammad, etc.)
// 2. Double Metaphone & Soundex phonetic algorithms
// 3. Typo-tolerant Damerau-Levenshtein fuzzy matching
// 4. Multi-token boolean AND matching across all record attributes
// 5. Intelligent Google-style relevance ranking
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

// =================================================================
// 1. KASHMIRI & SOUTH ASIAN PHONETIC & SYNONYM ENGINE
// =================================================================

/**
 * Known common name synonyms and prefix abbreviations in Kashmiri & Indian academic records
 */
const CANONICAL_SYNONYMS = {
  // Mohammad variants
  mohd: 'mohammad',
  mhd: 'mohammad',
  md: 'mohammad',
  muhd: 'mohammad',
  mohamed: 'mohammad',
  muhammad: 'mohammad',
  muhammed: 'mohammad',
  mahmod: 'mohammad',
  mehmood: 'mahmood',
  // Syed variants
  syed: 'syed',
  sayed: 'syed',
  syad: 'syed',
  sayeed: 'syed',
  saiyad: 'syed',
  sayyad: 'syed',
  saied: 'syed',
  seyed: 'syed',
  // Sheikh variants
  shk: 'sheikh',
  shkh: 'sheikh',
  shaikh: 'sheikh',
  shaykh: 'sheikh',
  sheekh: 'sheikh',
  // Parray variants
  parray: 'parray',
  parrey: 'parray',
  parey: 'parray',
  pary: 'parray',
  // Wani variants
  wani: 'wani',
  wain: 'wani',
  vani: 'wani',
  // Dar variants
  dar: 'dar',
  dhar: 'dar',
  // Bhat / Butt variants
  bhat: 'bhat',
  butt: 'bhat',
  bhatt: 'bhat',
  bat: 'bhat',
  // Reshi variants
  reshi: 'reshi',
  reshie: 'reshi',
  rishi: 'reshi',
  // Bano / Begum variants
  bano: 'banoo',
  banoo: 'banoo',
  banu: 'banoo',
  begum: 'begum',
  begam: 'begum',
  // Lone variants
  lone: 'lone',
  loni: 'lone',
  // Common personal names with varied spellings
  mumin: 'mumin',
  momin: 'mumin',
  moumin: 'mumin',
  moomin: 'mumin',
  kousar: 'kousar',
  kowser: 'kousar',
  kousur: 'kousar',
  koushar: 'kousar',
  zahoor: 'zahoor',
  zuhoor: 'zahoor',
  zahoore: 'zahoor',
  gulfam: 'gulfam',
  goolfam: 'gulfam',
  ghulfam: 'gulfam',
  tariq: 'tariq',
  tarik: 'tariq',
  tareeq: 'tariq',
  mushtaq: 'mushtaq',
  mushtak: 'mushtaq',
  iqbal: 'iqbal',
  ikbal: 'iqbal',
  iqra: 'iqra',
  ikra: 'iqra',
  shabir: 'shabir',
  shabeer: 'shabir',
  shabbir: 'shabir',
  rashid: 'rashid',
  rasheed: 'rashid',
  shahid: 'shahid',
  shaheed: 'shahid',
  yousuf: 'yousuf',
  yousef: 'yousuf',
  yusuf: 'yousuf',
  fayaz: 'fayaz',
  faiyaz: 'fayaz',
  fiaz: 'fayaz',
  showkat: 'showkat',
  shoukat: 'showkat',
  shawkat: 'showkat',
  gulzar: 'gulzar',
  goolzar: 'gulzar',
  manzoor: 'manzoor',
  manzor: 'manzoor',
  shafi: 'shafi',
  shafee: 'shafi',
  shafy: 'shafi',
  ashraf: 'ashraf',
  asharaf: 'ashraf',
  javaid: 'javaid',
  javid: 'javaid',
  javed: 'javaid',
  nissar: 'nisar',
  nisar: 'nisar',
  suhail: 'suhail',
  sohail: 'suhail',
  suhayl: 'suhail',
  tanveer: 'tanvir',
  tanvir: 'tanvir',
  mudasir: 'mudasir',
  mudassir: 'mudasir',
  mudaser: 'mudasir',
  aamir: 'amir',
  amir: 'amir',
  aasif: 'asif',
  asif: 'asif',
  aashiq: 'ashiq',
  ashiq: 'ashiq',
  aadil: 'adil',
  adil: 'adil',
  aabid: 'abid',
  abid: 'abid',
  waseem: 'wasim',
  wasim: 'wasim',
  nadeem: 'nadim',
  nadim: 'nadim',
  naeem: 'naim',
  naim: 'naim',
  faheem: 'fahim',
  fahim: 'fahim',
  sameer: 'samir',
  samir: 'samir',
  yasir: 'yasir',
  yaser: 'yasir',
  owais: 'owais',
  uwais: 'owais',
  awais: 'owais',
  shangus: 'shangus',
  shangas: 'shangus',
  chitergul: 'chitergul',
  chhattergul: 'chitergul',
  nowgam: 'nowgam',
  nougam: 'nowgam',
  wangam: 'wangam',
};

/**
 * South Asian & Kashmiri Phonetic Transform:
 * Translates phonetic variations (vowel shifts, consonant clusters, and double letters)
 * into a canonical phonetic fingerprint.
 */
export function kashmiriPhoneticHash(word) {
  if (!word || typeof word !== 'string') return '';
  let str = word.trim().toLowerCase().replace(/[^a-z]/g, '');
  if (!str) return '';

  // Direct synonym resolution first
  if (CANONICAL_SYNONYMS[str]) {
    str = CANONICAL_SYNONYMS[str];
  }

  // 1. Initial multi-character phonetic cluster replacements
  str = str
    .replace(/^mohd|^mhd|^md|^muhd/, 'mohammad')
    .replace(/^shk|^shkh/, 'sheikh')
    .replace(/ph/g, 'f')
    .replace(/kh/g, 'k')
    .replace(/gh/g, 'g')
    .replace(/th/g, 't')
    .replace(/dh/g, 'd')
    .replace(/ch/g, 'c')
    .replace(/ck/g, 'k')
    .replace(/qu|q/g, 'k')
    .replace(/v/g, 'w')
    .replace(/zh/g, 'z')
    .replace(/bh/g, 'b');

  // 2. Vowel & Diphthong canonicalization
  // ee, ea, ie, ei, ey, y, i, ya, ye -> 'i' (e.g. syed, sayed, syad -> sid)
  str = str
    .replace(/sayed|syed|syad|sayeed|saiyad|sayyad|saied|seyed/g, 'sid')
    .replace(/ee|ea|ie|ei|ey/g, 'i')
    .replace(/oo|ou|ow/g, 'u')
    .replace(/aa|ah/g, 'a')
    .replace(/ai|ay/g, 'i')
    .replace(/y/g, 'i');

  // 3. Vowel reduction (reduce common unstressed vowels e/a/i/u/o)
  str = str
    .replace(/e/g, 'i')
    .replace(/o/g, 'u');

  // 4. Collapse consecutive identical letters (e.g. mm -> m, ss -> s, dd -> d, tt -> t, rr -> r)
  str = str.replace(/(.)\1+/g, '$1');

  return str;
}

// =================================================================
// 2. SOUNDEX ALGORITHM
// =================================================================

/**
 * Standard Soundex encoding for phonetic matching
 */
export function soundex(word) {
  if (!word || typeof word !== 'string') return '';
  const a = word.trim().toUpperCase().replace(/[^A-Z]/g, '');
  if (!a) return '';

  const codes = {
    B: 1, F: 1, P: 1, V: 1,
    C: 2, G: 2, J: 2, K: 2, Q: 2, S: 2, X: 2, Z: 2,
    D: 3, T: 3,
    L: 4,
    M: 5, N: 5,
    R: 6
  };

  const firstLetter = a[0];
  let result = firstLetter;
  let prevCode = codes[firstLetter] || 0;

  for (let i = 1; i < a.length && result.length < 4; i++) {
    const char = a[i];
    const code = codes[char] || 0;
    if (code !== 0 && code !== prevCode) {
      result += code;
    }
    prevCode = code;
  }

  return (result + '000').slice(0, 4);
}

// =================================================================
// 3. DOUBLE METAPHONE ALGORITHM
// =================================================================

/**
 * Computes Primary and Secondary Double Metaphone keys for any word.
 */
export function doubleMetaphone(word) {
  if (!word || typeof word !== 'string') return { primary: '', secondary: '' };
  let str = word.trim().toUpperCase().replace(/[^A-Z]/g, '');
  if (!str) return { primary: '', secondary: '' };

  // Handle common initial prefixes
  if (str.startsWith('GN') || str.startsWith('KN') || str.startsWith('PN') || str.startsWith('WR') || str.startsWith('PS')) {
    str = str.slice(1);
  }

  let primary = '';
  let secondary = '';
  let i = 0;
  const len = str.length;

  while (i < len && primary.length < 5) {
    const c = str[i];
    const next = str[i + 1] || '';
    const prev = str[i - 1] || '';

    switch (c) {
      case 'A': case 'E': case 'I': case 'O': case 'U': case 'Y':
        if (i === 0) {
          primary += 'A';
          secondary += 'A';
        }
        i++;
        break;

      case 'B':
        primary += 'P';
        secondary += 'P';
        i += (next === 'B') ? 2 : 1;
        break;

      case 'C':
        if (next === 'H') {
          primary += 'X';
          secondary += 'K';
          i += 2;
        } else if (next === 'S' || next === 'Z' || next === 'I' || next === 'E' || next === 'Y') {
          primary += 'S';
          secondary += 'S';
          i += (next === 'S' || next === 'Z') ? 2 : 1;
        } else if (next === 'K' || next === 'Q') {
          primary += 'K';
          secondary += 'K';
          i += 2;
        } else {
          primary += 'K';
          secondary += 'K';
          i += (next === 'C') ? 2 : 1;
        }
        break;

      case 'D':
        if (next === 'G') {
          primary += 'J';
          secondary += 'J';
          i += 2;
        } else {
          primary += 'T';
          secondary += 'T';
          i += (next === 'D' || next === 'T') ? 2 : 1;
        }
        break;

      case 'F':
        primary += 'F';
        secondary += 'F';
        i += (next === 'F') ? 2 : 1;
        break;

      case 'G':
        if (next === 'H') {
          primary += 'K';
          secondary += 'K';
          i += 2;
        } else if (next === 'N') {
          primary += 'N';
          secondary += 'KN';
          i += 2;
        } else if (next === 'I' || next === 'E' || next === 'Y') {
          primary += 'J';
          secondary += 'K';
          i += 1;
        } else {
          primary += 'K';
          secondary += 'K';
          i += (next === 'G') ? 2 : 1;
        }
        break;

      case 'H':
        if ((i === 0 || 'AEIOU'.includes(prev)) && 'AEIOU'.includes(next)) {
          primary += 'H';
          secondary += 'H';
          i += 2;
        } else {
          i++;
        }
        break;

      case 'J':
        primary += 'J';
        secondary += 'A';
        i += (next === 'J') ? 2 : 1;
        break;

      case 'K':
        primary += 'K';
        secondary += 'K';
        i += (next === 'K') ? 2 : 1;
        break;

      case 'L':
        primary += 'L';
        secondary += 'L';
        i += (next === 'L') ? 2 : 1;
        break;

      case 'M':
        primary += 'M';
        secondary += 'M';
        i += (next === 'M') ? 2 : 1;
        break;

      case 'N':
        primary += 'N';
        secondary += 'N';
        i += (next === 'N') ? 2 : 1;
        break;

      case 'P':
        if (next === 'H') {
          primary += 'F';
          secondary += 'F';
          i += 2;
        } else {
          primary += 'P';
          secondary += 'P';
          i += (next === 'P') ? 2 : 1;
        }
        break;

      case 'Q':
        primary += 'K';
        secondary += 'K';
        i += (next === 'Q') ? 2 : 1;
        break;

      case 'R':
        primary += 'R';
        secondary += 'R';
        i += (next === 'R') ? 2 : 1;
        break;

      case 'S':
        if (next === 'H') {
          primary += 'X';
          secondary += 'X';
          i += 2;
        } else {
          primary += 'S';
          secondary += 'S';
          i += (next === 'S' || next === 'Z') ? 2 : 1;
        }
        break;

      case 'T':
        if (next === 'H') {
          primary += '0'; // Theta sound
          secondary += 'T';
          i += 2;
        } else if (next === 'C' && str[i + 2] === 'H') {
          primary += 'X';
          secondary += 'X';
          i += 3;
        } else {
          primary += 'T';
          secondary += 'T';
          i += (next === 'T' || next === 'D') ? 2 : 1;
        }
        break;

      case 'V':
        primary += 'F';
        secondary += 'F';
        i += (next === 'V') ? 2 : 1;
        break;

      case 'W':
        if ('AEIOU'.includes(next)) {
          primary += 'A';
          secondary += 'F';
        }
        i += (next === 'W') ? 2 : 1;
        break;

      case 'X':
        primary += 'KS';
        secondary += 'KS';
        i += (next === 'X') ? 2 : 1;
        break;

      case 'Z':
        primary += 'S';
        secondary += 'S';
        i += (next === 'Z') ? 2 : 1;
        break;

      default:
        i++;
        break;
    }
  }

  return { primary, secondary };
}

// =================================================================
// 4. DAMERAU-LEVENSHTEIN FUZZY DISTANCE ALGORITHM
// =================================================================

/**
 * Computes Damerau-Levenshtein distance (supports insertion, deletion, substitution, and transposition)
 */
export function damerauLevenshtein(s1, s2) {
  if (s1 === s2) return 0;
  if (!s1) return s2 ? s2.length : 0;
  if (!s2) return s1.length;

  const len1 = s1.length;
  const len2 = s2.length;

  // Swap to ensure smaller array allocation
  let a = s1;
  let b = s2;
  if (len1 > len2) {
    a = s2;
    b = s1;
  }

  const d = [];
  for (let i = 0; i <= a.length; i++) {
    d[i] = [i];
  }
  for (let j = 0; j <= b.length; j++) {
    d[0][j] = j;
  }

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,      // deletion
        d[i][j - 1] + 1,      // insertion
        d[i - 1][j - 1] + cost // substitution
      );

      // Transposition check
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + cost);
      }
    }
  }

  return d[a.length][b.length];
}

/**
 * Returns a normalized similarity score between 0.0 and 1.0
 */
export function levenshteinSimilarity(s1, s2) {
  if (s1 === s2) return 1.0;
  if (!s1 || !s2) return 0.0;
  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1.0;
  const dist = damerauLevenshtein(s1, s2);
  return Math.max(0, 1 - (dist / maxLen));
}

// =================================================================
// 5. SEARCH INDEX ENTRY CREATION & PRE-COMPUTATION
// =================================================================

/**
 * Extract tokens and phonetic hashes from a string of words
 */
function extractWordTokens(text) {
  if (!text || typeof text !== 'string') return [];
  const words = text.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 0);
  return words.map(w => {
    const kHash = kashmiriPhoneticHash(w);
    const dm = doubleMetaphone(w);
    const sndx = soundex(w);
    return {
      word: w,
      kHash,
      dmPrimary: dm.primary,
      dmSecondary: dm.secondary,
      soundex: sndx,
      cleanNum: w.replace(/[^0-9]/g, '')
    };
  });
}

const safeStr = (val) => (val !== null && val !== undefined ? String(val).trim() : '');

/**
 * Create a search index entry from any student document (admissions or masterRegisters)
 */
export function createSearchIndexEntry(doc, source = 'admissions') {
  if (!doc || typeof doc !== 'object') return null;

  const id = safeStr(doc.id || doc['Form Number'] || doc['Form No.'] || doc.formNo || doc['Board Registration Number']);
  const name = safeStr(
    doc.studentName ||
    doc["Student's Name (as per school records)"] ||
    doc["Student's Name"] ||
    doc['Student Name'] ||
    doc['Name of Student'] ||
    doc['name']
  );

  const father = safeStr(
    doc.fatherName ||
    doc["Father's/Guardian's Name (as per school records)"] ||
    doc["Father's Name"] ||
    doc['Father Name']
  );

  const mother = safeStr(
    doc.motherName ||
    doc["Mother's Name"] ||
    doc['Mother Name']
  );

  const formNo = safeStr(
    doc.formNo ||
    doc['Form Number'] ||
    doc['Form No.'] ||
    doc['FormNo'] ||
    doc.formNumber
  ).replace(/^(N\/A|—)$/i, '').trim();

  const boardRegNo = safeStr(
    doc.boardRegNo ||
    doc['Board Registration Number'] ||
    doc['Board Registration No.'] ||
    doc['Board Reg. No.'] ||
    doc['Board Reg No'] ||
    doc.regNo
  ).replace(/^(N\/A|—)$/i, '').trim();

  const admNo = safeStr(
    doc.admNo ||
    doc['Admission No.'] ||
    doc['Admission No'] ||
    doc['Admission Number'] ||
    doc['Adm. No.'] ||
    doc['Adm. No'] ||
    doc['AdmNo'] ||
    doc.admissionNo
  ).replace(/^(N\/A|—)$/i, '').trim();

  const classRollNo = safeStr(
    doc.classRollNo ||
    doc['Class Roll No'] ||
    doc['Class Roll No.'] ||
    doc['Roll No'] ||
    doc['Roll No.'] ||
    doc.rollNo
  ).replace(/^(N\/A|—)$/i, '').trim();

  const mobile = safeStr(
    doc.mobile ||
    doc.mobileNumber ||
    doc['Mobile Number'] ||
    doc['Contact Number'] ||
    doc['Phone'] ||
    doc['Mobile No.'] ||
    doc['Mobile']
  ).replace(/^(N\/A|—)$/i, '').trim();

  const parentContact = safeStr(
    doc.parentContact ||
    doc["Parent's Contact"] ||
    doc["Parent's Mobile No. (must be working)"] ||
    doc["Parent's Mobile No."] ||
    doc["Father's Mobile No."]
  ).replace(/^(N\/A|—)$/i, '').trim();

  const studentClass = safeStr(
    doc.class ||
    doc.Class ||
    doc['Admission sought for class'] ||
    doc['Class']
  );

  const session = safeStr(
    doc.session ||
    doc.Session ||
    doc['Academic Session'] ||
    doc['Session']
  );

  const stream = safeStr(
    doc.stream ||
    doc.Stream ||
    doc['Stream']
  );

  const gender = safeStr(
    doc.gender ||
    doc.Gender ||
    doc['Gender']
  );

  const category = safeStr(
    doc.category ||
    doc.Category ||
    doc['Category']
  );

  const village = safeStr(
    doc.village ||
    doc.Village ||
    doc['Village'] ||
    doc['Address'] ||
    doc['Permanent Address'] ||
    doc['Name of your village'] ||
    doc['Village/Town']
  );

  const subjects = safeStr(
    doc.subs ||
    doc.Subjects ||
    doc.subjects ||
    doc['Subjects to be taken in Class 11th'] ||
    doc['Subjects to be taken in Class 12th']
  );

  const aadhar = safeStr(doc.aadhar || doc['Aadhar No.'] || doc['Aadhaar No.']);
  const penNo = safeStr(doc.penNo || doc['PEN No.']);
  const apaarId = safeStr(doc.apaarId || doc['APAAR ID']);

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
    parentContact,
    studentClass,
    session,
    stream,
    gender,
    category,
    village,
    subjects,
    aadhar,
    penNo,
    apaarId
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  // Pre-tokenized word maps for phonetic and fuzzy searches
  const nameTokens = extractWordTokens(name);
  const fatherTokens = extractWordTokens(father);
  const motherTokens = extractWordTokens(mother);
  const villageTokens = extractWordTokens(village);
  const subjectTokens = extractWordTokens(subjects);

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
    pmob: parentContact,
    c: studentClass,
    s: session,
    st: stream,
    g: gender,
    cat: category,
    v: village,
    subs: subjects,
    aadhar,
    pen: penNo,
    apaar: apaarId,
    src: source,
    _blob: searchBlob,
    _cleanAdm: cleanSearchAdm(admNo),
    _cleanReg: cleanSearchReg(boardRegNo),
    _cleanMob: cleanSearchMobile(mobile),
    _cleanPMob: cleanSearchMobile(parentContact),
    _cleanForm: formNo.toLowerCase().replace(/[^a-z0-9]/g, ''),
    _cleanRoll: classRollNo.toLowerCase().replace(/[^a-z0-9]/g, ''),
    _nameLower: name.toLowerCase(),
    _fatherLower: father.toLowerCase(),
    _motherLower: mother.toLowerCase(),
    _nameTokens: nameTokens,
    _fatherTokens: fatherTokens,
    _motherTokens: motherTokens,
    _villageTokens: villageTokens,
    _subjectTokens: subjectTokens,
    raw: doc
  };
}

/**
 * Builds or refreshes the global search index in memory
 */
export function buildLocalSearchIndex(admissions = [], masterRegisters = []) {
  const index = [];
  const seenIds = new Set();

  if (Array.isArray(admissions)) {
    admissions.forEach(adm => {
      const entry = createSearchIndexEntry(adm, 'admissions');
      if (entry && entry.id && !seenIds.has(`adm_${entry.id}`)) {
        seenIds.add(`adm_${entry.id}`);
        index.push(entry);
      }
    });
  }

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

// =================================================================
// 6. QUERY PARSER & MULTI-TOKEN EXTRACTION
// =================================================================

/**
 * Parse special search shortcut patterns or plain multi-token strings:
 * Examples:
 *   - "adm4347", "adm:4347", "adm 4347" -> target admNo
 *   - "reg23...", "reg:23...", "board:..." -> target boardRegNo
 *   - "form123", "form:123" -> target formNo
 *   - "roll12", "roll:12" -> target classRollNo
 *   - "mob9906...", "mobile:..." -> target mobile
 */
export function parseSearchQuery(query) {
  const raw = String(query || '').trim();
  if (!raw) return { isPattern: false, patternType: null, patternVal: '', rawTokens: [], raw, tokenMeta: [] };

  const qLower = raw.toLowerCase();

  // 1. Admission Number pattern
  const admMatch = qLower.match(/^(?:adm|admission|admno|adm_no)[\s:#\-_]*([0-9a-zA-Z\-_/]+)$/);
  if (admMatch) {
    return {
      isPattern: true,
      patternType: 'admNo',
      patternVal: admMatch[1].trim(),
      rawTokens: [admMatch[1].trim()],
      raw,
      tokenMeta: []
    };
  }

  // 2. Board Reg No pattern
  const regMatch = qLower.match(/^(?:reg|regno|board|boardreg)[\s:#\-_]*([0-9a-zA-Z\-_/]+)$/);
  if (regMatch) {
    return {
      isPattern: true,
      patternType: 'boardRegNo',
      patternVal: regMatch[1].trim(),
      rawTokens: [regMatch[1].trim()],
      raw,
      tokenMeta: []
    };
  }

  // 3. Form Number pattern
  const formMatch = qLower.match(/^(?:form|formno|fno)[\s:#\-_]*([0-9a-zA-Z\-_/]+)$/);
  if (formMatch) {
    return {
      isPattern: true,
      patternType: 'formNo',
      patternVal: formMatch[1].trim(),
      rawTokens: [formMatch[1].trim()],
      raw,
      tokenMeta: []
    };
  }

  // 4. Class Roll No pattern
  const rollMatch = qLower.match(/^(?:roll|rollno|classroll)[\s:#\-_]*([0-9a-zA-Z\-_/]+)$/);
  if (rollMatch) {
    return {
      isPattern: true,
      patternType: 'classRollNo',
      patternVal: rollMatch[1].trim(),
      rawTokens: [rollMatch[1].trim()],
      raw,
      tokenMeta: []
    };
  }

  // 5. Mobile Number pattern
  const mobMatch = qLower.match(/^(?:mob|mobile|phone|contact)[\s:#\-_]*([0-9]+)$/);
  if (mobMatch) {
    return {
      isPattern: true,
      patternType: 'mobile',
      patternVal: mobMatch[1].trim(),
      rawTokens: [mobMatch[1].trim()],
      raw,
      tokenMeta: []
    };
  }

  // Standard multi-token search with phonetic & typo metadata pre-computed for every token
  const rawTokens = qLower.split(/\s+/).filter(Boolean);
  const tokenMeta = rawTokens.map(token => {
    const cleanAlpha = token.replace(/[^a-z]/g, '');
    const cleanNum = token.replace(/[^0-9]/g, '');
    const kHash = kashmiriPhoneticHash(cleanAlpha);
    const dm = doubleMetaphone(cleanAlpha);
    const sndx = soundex(cleanAlpha);

    return {
      raw: token,
      cleanAlpha,
      cleanNum,
      isNumeric: /^\d+$/.test(token),
      kHash,
      dmPrimary: dm.primary,
      dmSecondary: dm.secondary,
      soundex: sndx,
      len: token.length
    };
  });

  return {
    isPattern: false,
    patternType: null,
    patternVal: '',
    rawTokens,
    raw,
    tokenMeta
  };
}

// =================================================================
// 7. CORE INTELLIGENT STUDENT RECORD SEARCH EVALUATOR
// =================================================================

/**
 * Matches a single query token against a candidate word item
 */
function matchTokenToWord(tokenMeta, wordItem, maxDistance = 1) {
  if (!tokenMeta || !wordItem) return { matches: false, score: 0, matchType: null };

  const qRaw = tokenMeta.raw;
  const targetWord = wordItem.word;

  // 1. Exact string match
  if (targetWord === qRaw) {
    return { matches: true, score: 2000, matchType: 'exact' };
  }

  // 2. Prefix match (e.g. "mum" matches "mumin")
  if (tokenMeta.len >= 2 && targetWord.startsWith(qRaw)) {
    return { matches: true, score: 1500, matchType: 'prefix' };
  }

  // 3. Substring match
  if (tokenMeta.len >= 3 && targetWord.includes(qRaw)) {
    return { matches: true, score: 1100, matchType: 'substring' };
  }

  // 4. Kashmiri & South Asian Phonetic Hash Match (e.g. "syad" <-> "syed" <-> "sayed")
  if (tokenMeta.kHash && wordItem.kHash) {
    if (tokenMeta.kHash === wordItem.kHash) {
      return { matches: true, score: 1700, matchType: 'kashmiri_phonetic' };
    }
    // Prefix phonetic match
    if (tokenMeta.kHash.length >= 3 && wordItem.kHash.startsWith(tokenMeta.kHash)) {
      return { matches: true, score: 1300, matchType: 'kashmiri_phonetic_prefix' };
    }
  }

  // 5. Double Metaphone Match
  if (tokenMeta.dmPrimary && wordItem.dmPrimary) {
    if (tokenMeta.dmPrimary === wordItem.dmPrimary || (tokenMeta.dmSecondary && tokenMeta.dmSecondary === wordItem.dmPrimary)) {
      return { matches: true, score: 1400, matchType: 'double_metaphone' };
    }
  }

  // 6. Soundex Match (for words >= 4 characters)
  if (tokenMeta.len >= 4 && tokenMeta.soundex && wordItem.soundex && tokenMeta.soundex === wordItem.soundex) {
    return { matches: true, score: 1200, matchType: 'soundex' };
  }

  // 7. Typo-tolerant Damerau-Levenshtein Fuzzy Match
  if (tokenMeta.len >= 3 && targetWord.length >= 3) {
    const dist = damerauLevenshtein(qRaw, targetWord);
    const maxAllowedDist = tokenMeta.len >= 7 ? 2 : (tokenMeta.len >= 4 ? 1 : 1);

    if (dist <= maxAllowedDist) {
      const sim = 1 - (dist / Math.max(tokenMeta.len, targetWord.length));
      if (sim >= 0.65) {
        return { matches: true, score: Math.round(900 * sim), matchType: 'fuzzy' };
      }
    }
  }

  return { matches: false, score: 0, matchType: null };
}

/**
 * Evaluates whether a student document matches the parsed Google-like query,
 * computing a rich relevance score across all aspects (phonetic, fuzzy, exact).
 *
 * @param {object} s - The student document or search index entry
 * @param {object} parsed - The parsed query from parseSearchQuery()
 * @returns {{ matches: boolean, score: number, details: object }}
 */
export function evaluateStudentRecord(s, parsed) {
  if (!s || !parsed || !parsed.raw) {
    return { matches: true, score: 0 };
  }

  // A. Dedicated Pattern Search Mode (Fast O(1) single-field priority match)
  if (parsed.isPattern) {
    const val = parsed.patternVal.toLowerCase();
    const cleanVal = val.replace(/[^a-z0-9]/g, '');

    if (parsed.patternType === 'admNo') {
      const sAdm = String(s.an || s.admNo || '').toLowerCase();
      const sRawAdm = cleanSearchAdm(sAdm);
      if (sAdm === val || (cleanVal && sRawAdm === cleanVal)) return { matches: true, score: 5000 };
      if (sAdm.includes(val) || (cleanVal && sRawAdm.includes(cleanVal))) return { matches: true, score: 2500 };
      return { matches: false, score: 0 };
    }

    if (parsed.patternType === 'boardRegNo') {
      const sReg = cleanSearchReg(s.r || s.boardRegNo);
      const targetReg = cleanSearchReg(val);
      if (sReg && sReg === targetReg) return { matches: true, score: 5000 };
      if (sReg && targetReg && sReg.includes(targetReg)) return { matches: true, score: 2500 };
      return { matches: false, score: 0 };
    }

    if (parsed.patternType === 'formNo') {
      const sFNo = String(s.fn || s.formNo || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (sFNo === cleanVal) return { matches: true, score: 5000 };
      if (sFNo.includes(cleanVal)) return { matches: true, score: 2500 };
      return { matches: false, score: 0 };
    }

    if (parsed.patternType === 'classRollNo') {
      const sRoll = String(s.rn || s.classRollNo || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (sRoll === cleanVal) return { matches: true, score: 5000 };
      if (sRoll.includes(cleanVal)) return { matches: true, score: 2500 };
      return { matches: false, score: 0 };
    }

    if (parsed.patternType === 'mobile') {
      const sMob = cleanSearchMobile(s.mob || s.mobile || s.parentContact || s.pmob);
      if (sMob.includes(cleanVal)) return { matches: true, score: 5000 };
      return { matches: false, score: 0 };
    }
  }

  // B. Multi-Token Google-like Relevance Search Mode
  const tokenMetas = parsed.tokenMeta;
  if (!tokenMetas || tokenMetas.length === 0) return { matches: true, score: 0 };

  // Prepare normalized field strings & token arrays
  const sName = s.n || s.studentName || s["Student's Name (as per school records)"] || s["Student's Name"] || '';
  const sFather = s.f || s.fatherName || s["Father's/Guardian's Name (as per school records)"] || s["Father's Name"] || '';
  const sMother = s.m || s.motherName || s["Mother's Name (as per school records)"] || s["Mother's Name"] || '';
  const sVillage = s.v || s.village || s['Name of your village'] || s['Village/Town'] || '';
  const sSubs = s.subs || s.Subjects || s['Subjects to be taken in Class 11th'] || s['Subjects to be taken in Class 12th'] || '';
  const sClass = s.c || s.class || s.Class || '';
  const sSession = s.s || s.session || s.Session || '';
  const sStream = s.st || s.stream || s.Stream || '';

  const sFormNo = String(s.fn || s.formNo || s['Form Number'] || s['Form No.'] || '').trim();
  const sAdmNo = String(s.an || s.admNo || s['Adm. No.'] || s['Admission No.'] || '').trim();
  const sBoardRegNo = String(s.r || s.boardRegNo || s['Board Registration Number'] || s['Board Reg. No.'] || '').trim();
  const sRollNo = String(s.rn || s.classRollNo || s['Class Roll No'] || s.rollNo || '').trim();
  const sMob = String(s.mob || s.mobile || s['Mobile No. (with working WhatsApp)'] || '').trim();
  const sPMob = String(s.pmob || s.parentContact || s["Parent's Contact"] || s["Parent's Mobile No."] || '').trim();

  const cleanForm = sFormNo.toLowerCase().replace(/[^a-z0-9]/g, '');
  const cleanAdm = cleanSearchAdm(sAdmNo);
  const cleanReg = cleanSearchReg(sBoardRegNo);
  const cleanRoll = sRollNo.toLowerCase().replace(/[^a-z0-9]/g, '');
  const cleanMob = cleanSearchMobile(sMob);
  const cleanPMob = cleanSearchMobile(sPMob);

  // Extract or use precomputed token arrays
  const nameTokens = s._nameTokens || extractWordTokens(sName);
  const fatherTokens = s._fatherTokens || extractWordTokens(sFather);
  const motherTokens = s._motherTokens || extractWordTokens(sMother);
  const villageTokens = s._villageTokens || extractWordTokens(sVillage);
  const subjectTokens = s._subjectTokens || extractWordTokens(sSubs);

  let totalScore = 0;

  // ALL tokens in query must find at least one match in this record (AND logic)
  for (let i = 0; i < tokenMetas.length; i++) {
    const t = tokenMetas[i];
    let tokenMatched = false;
    let maxTokenScore = 0;

    // 1. Direct Numeric / Identifier Matches
    if (t.isNumeric || t.cleanNum) {
      const qNum = t.cleanNum || t.raw;

      if (cleanForm && (cleanForm === qNum || cleanForm.endsWith(qNum))) {
        tokenMatched = true;
        maxTokenScore = Math.max(maxTokenScore, cleanForm === qNum ? 5000 : 2500);
      }
      if (cleanAdm && (cleanAdm === qNum || cleanAdm.endsWith(qNum))) {
        tokenMatched = true;
        maxTokenScore = Math.max(maxTokenScore, cleanAdm === qNum ? 4500 : 2200);
      }
      if (cleanReg && (cleanReg === qNum || cleanReg.includes(qNum))) {
        tokenMatched = true;
        maxTokenScore = Math.max(maxTokenScore, cleanReg === qNum ? 4200 : 2000);
      }
      if (cleanRoll && (cleanRoll === qNum || cleanRoll === t.raw)) {
        tokenMatched = true;
        maxTokenScore = Math.max(maxTokenScore, cleanRoll === qNum ? 3500 : 1800);
      }
      if (qNum.length >= 4 && (cleanMob.includes(qNum) || cleanPMob.includes(qNum))) {
        tokenMatched = true;
        maxTokenScore = Math.max(maxTokenScore, (cleanMob === qNum || cleanPMob === qNum) ? 3800 : 1600);
      }
    }

    // 2. Student Name Word Match (Exact, Phonetic, Soundex, Fuzzy)
    for (const wt of nameTokens) {
      const res = matchTokenToWord(t, wt);
      if (res.matches) {
        tokenMatched = true;
        // Priority multiplier 2.2x for student name
        maxTokenScore = Math.max(maxTokenScore, Math.round(res.score * 2.2));
      }
    }

    // 3. Father Name Word Match
    for (const wt of fatherTokens) {
      const res = matchTokenToWord(t, wt);
      if (res.matches) {
        tokenMatched = true;
        // Priority multiplier 1.6x for father name
        maxTokenScore = Math.max(maxTokenScore, Math.round(res.score * 1.6));
      }
    }

    // 4. Mother Name Word Match
    for (const wt of motherTokens) {
      const res = matchTokenToWord(t, wt);
      if (res.matches) {
        tokenMatched = true;
        // Priority multiplier 1.5x for mother name
        maxTokenScore = Math.max(maxTokenScore, Math.round(res.score * 1.5));
      }
    }

    // 5. Village / Town Match
    for (const wt of villageTokens) {
      const res = matchTokenToWord(t, wt);
      if (res.matches) {
        tokenMatched = true;
        maxTokenScore = Math.max(maxTokenScore, Math.round(res.score * 1.2));
      }
    }

    // 6. Subjects / Stream / Class Match
    for (const wt of subjectTokens) {
      const res = matchTokenToWord(t, wt);
      if (res.matches) {
        tokenMatched = true;
        maxTokenScore = Math.max(maxTokenScore, Math.round(res.score * 1.0));
      }
    }

    const clsLower = sClass.toLowerCase();
    if (clsLower.includes(t.raw) || (t.raw.includes('10') && clsLower.includes('10')) || (t.raw.includes('11') && clsLower.includes('11')) || (t.raw.includes('12') && clsLower.includes('12')) || (t.raw.includes('9') && clsLower.includes('9'))) {
      tokenMatched = true;
      maxTokenScore = Math.max(maxTokenScore, 600);
    }

    const streamLower = sStream.toLowerCase();
    if (streamLower && (streamLower.includes(t.raw) || (t.raw.startsWith('sci') && streamLower.includes('sci')) || (t.raw.startsWith('hum') && streamLower.includes('hum')) || (t.raw.startsWith('art') && streamLower.includes('hum')) || (t.raw.startsWith('med') && streamLower.includes('sci')))) {
      tokenMatched = true;
      maxTokenScore = Math.max(maxTokenScore, 500);
    }

    const sessionLower = sSession.toLowerCase();
    if (sessionLower && sessionLower.includes(t.raw)) {
      tokenMatched = true;
      maxTokenScore = Math.max(maxTokenScore, 400);
    }

    // Fallback: Check full blob substring
    const fullBlob = s._blob || `${sName} ${sFather} ${sMother} ${sVillage} ${sFormNo} ${sBoardRegNo} ${sAdmNo} ${sRollNo} ${sMob} ${sPMob} ${sClass} ${sSession} ${sStream} ${sSubs}`.toLowerCase();
    if (fullBlob.includes(t.raw)) {
      tokenMatched = true;
      maxTokenScore = Math.max(maxTokenScore, 300);
    }

    // If ANY token in multi-token query fails to match anything, the record is rejected (AND logic)
    if (!tokenMatched) {
      return { matches: false, score: 0 };
    }

    totalScore += maxTokenScore;
  }

  return { matches: true, score: totalScore };
}

// =================================================================
// 8. GLOBAL SEARCH EXECUTOR
// =================================================================

/**
 * Execute ranked global search against the indexed dataset
 * @param {string} query - The search string
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

  for (let i = 0; i < dataset.length; i++) {
    const entry = dataset[i];
    const evaluation = evaluateStudentRecord(entry, parsed);
    if (evaluation.matches && evaluation.score > 0) {
      scoredResults.push({
        ...entry,
        score: evaluation.score
      });
    }
  }

  scoredResults.sort((a, b) => b.score - a.score);
  return scoredResults.slice(0, limit);
}
