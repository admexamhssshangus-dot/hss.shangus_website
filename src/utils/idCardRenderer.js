/**
 * idCardRenderer.js — Core Design System & Utilities for Student ID Card Suite
 * Govt. Higher Secondary School Shangus
 */
import { createQrSvgDataUri } from './qrSvgGenerator';

// ─── THEME PALETTES ───
export const ID_CARD_THEMES = {
  cobalt: {
    id: 'cobalt',
    name: 'Cobalt Royal Blue',
    dotColor: '#1d4ed8',
    ribbonHex: '#1d4ed8',
    subHeaderHex: '#0f172a',
    cardBorderHex: '#1d4ed8',
    textHex: '#ffffff',
    ribbonBg: 'bg-blue-700',
    ribbonText: 'text-white',
    subHeaderBg: 'bg-blue-950',
    subHeaderText: 'text-blue-100',
    tableBorder: 'border-blue-200',
    cardBorder: 'border-blue-700',
    footerBg: 'bg-amber-300',
    footerText: 'text-red-800',
  },
  navy: {
    id: 'navy',
    name: 'Sapphire Navy',
    dotColor: '#1e3a8a',
    ribbonHex: '#1e3a8a',
    subHeaderHex: '#172554',
    cardBorderHex: '#1e3a8a',
    textHex: '#ffffff',
    ribbonBg: 'bg-blue-800',
    ribbonText: 'text-white',
    subHeaderBg: 'bg-blue-950',
    subHeaderText: 'text-blue-100',
    tableBorder: 'border-blue-200',
    cardBorder: 'border-blue-800',
    footerBg: 'bg-amber-300',
    footerText: 'text-red-800',
  },
  emerald: {
    id: 'emerald',
    name: 'Emerald Green',
    dotColor: '#047857',
    ribbonHex: '#047857',
    subHeaderHex: '#022c22',
    cardBorderHex: '#047857',
    textHex: '#ffffff',
    ribbonBg: 'bg-emerald-700',
    ribbonText: 'text-white',
    subHeaderBg: 'bg-emerald-950',
    subHeaderText: 'text-emerald-100',
    tableBorder: 'border-emerald-200',
    cardBorder: 'border-emerald-700',
    footerBg: 'bg-amber-300',
    footerText: 'text-red-800',
  },
  burgundy: {
    id: 'burgundy',
    name: 'Burgundy Crimson',
    dotColor: '#b91c1c',
    ribbonHex: '#b91c1c',
    subHeaderHex: '#450a0a',
    cardBorderHex: '#b91c1c',
    textHex: '#ffffff',
    ribbonBg: 'bg-red-800',
    ribbonText: 'text-white',
    subHeaderBg: 'bg-rose-950',
    subHeaderText: 'text-rose-100',
    tableBorder: 'border-red-200',
    cardBorder: 'border-red-800',
    footerBg: 'bg-amber-300',
    footerText: 'text-red-800',
  },
  purple: {
    id: 'purple',
    name: 'Royal Amethyst',
    dotColor: '#6b21a8',
    ribbonHex: '#6b21a8',
    subHeaderHex: '#3b0764',
    cardBorderHex: '#6b21a8',
    textHex: '#ffffff',
    ribbonBg: 'bg-purple-800',
    ribbonText: 'text-white',
    subHeaderBg: 'bg-purple-950',
    subHeaderText: 'text-purple-100',
    tableBorder: 'border-purple-200',
    cardBorder: 'border-purple-800',
    footerBg: 'bg-amber-300',
    footerText: 'text-red-800',
  },
  slate: {
    id: 'slate',
    name: 'Titanium Slate',
    dotColor: '#334155',
    ribbonHex: '#334155',
    subHeaderHex: '#0f172a',
    cardBorderHex: '#334155',
    textHex: '#ffffff',
    ribbonBg: 'bg-slate-800',
    ribbonText: 'text-white',
    subHeaderBg: 'bg-slate-950',
    subHeaderText: 'text-slate-200',
    tableBorder: 'border-slate-300',
    cardBorder: 'border-slate-800',
    footerBg: 'bg-amber-300',
    footerText: 'text-red-800',
  },
  amber: {
    id: 'amber',
    name: 'Golden Amber',
    dotColor: '#d97706',
    ribbonHex: '#d97706',
    subHeaderHex: '#451a03',
    cardBorderHex: '#d97706',
    textHex: '#ffffff',
    ribbonBg: 'bg-amber-800',
    ribbonText: 'text-white',
    subHeaderBg: 'bg-amber-950',
    subHeaderText: 'text-amber-100',
    tableBorder: 'border-amber-200',
    cardBorder: 'border-amber-700',
    footerBg: 'bg-amber-300',
    footerText: 'text-red-800',
  },
  teal: {
    id: 'teal',
    name: 'Ocean Teal',
    dotColor: '#0f766e',
    ribbonHex: '#0f766e',
    subHeaderHex: '#042f2e',
    cardBorderHex: '#0f766e',
    textHex: '#ffffff',
    ribbonBg: 'bg-teal-700',
    ribbonText: 'text-white',
    subHeaderBg: 'bg-teal-950',
    subHeaderText: 'text-teal-100',
    tableBorder: 'border-teal-200',
    cardBorder: 'border-teal-700',
    footerBg: 'bg-amber-300',
    footerText: 'text-red-800',
  },
  indigo: {
    id: 'indigo',
    name: 'Deep Indigo',
    dotColor: '#3730a3',
    ribbonHex: '#3730a3',
    subHeaderHex: '#1e1b4b',
    cardBorderHex: '#3730a3',
    textHex: '#ffffff',
    ribbonBg: 'bg-indigo-800',
    ribbonText: 'text-white',
    subHeaderBg: 'bg-indigo-950',
    subHeaderText: 'text-indigo-100',
    tableBorder: 'border-indigo-200',
    cardBorder: 'border-indigo-800',
    footerBg: 'bg-amber-300',
    footerText: 'text-red-800',
  },
  rose: {
    id: 'rose',
    name: 'Crimson Rose',
    dotColor: '#be123c',
    ribbonHex: '#be123c',
    subHeaderHex: '#4c0519',
    cardBorderHex: '#be123c',
    textHex: '#ffffff',
    ribbonBg: 'bg-rose-700',
    ribbonText: 'text-white',
    subHeaderBg: 'bg-rose-950',
    subHeaderText: 'text-rose-100',
    tableBorder: 'border-rose-200',
    cardBorder: 'border-rose-700',
    footerBg: 'bg-amber-300',
    footerText: 'text-red-800',
  },
  cyan: {
    id: 'cyan',
    name: 'Vibrant Cyan',
    dotColor: '#0891b2',
    ribbonHex: '#0891b2',
    subHeaderHex: '#083344',
    cardBorderHex: '#0891b2',
    textHex: '#ffffff',
    ribbonBg: 'bg-cyan-700',
    ribbonText: 'text-white',
    subHeaderBg: 'bg-cyan-950',
    subHeaderText: 'text-cyan-100',
    tableBorder: 'border-cyan-200',
    cardBorder: 'border-cyan-700',
    footerBg: 'bg-amber-300',
    footerText: 'text-red-800',
  },
  bronze: {
    id: 'bronze',
    name: 'Dark Bronze',
    dotColor: '#78350f',
    ribbonHex: '#78350f',
    subHeaderHex: '#1c1917',
    cardBorderHex: '#78350f',
    textHex: '#ffffff',
    ribbonBg: 'bg-stone-800',
    ribbonText: 'text-white',
    subHeaderBg: 'bg-stone-950',
    subHeaderText: 'text-amber-100',
    tableBorder: 'border-stone-300',
    cardBorder: 'border-stone-700',
    footerBg: 'bg-amber-300',
    footerText: 'text-red-800',
  }
};

/**
 * Normalize class names consistently across diverse field variations
 */
export function normalizeStudentClass(val) {
  if (!val) return '';
  const str = String(val).trim().toLowerCase();
  if (str.includes('12') || str.includes('xii')) return '12th';
  if (str.includes('11') || str.includes('xi')) return '11th';
  if (str.includes('10') || str.includes('x')) return '10th';
  if (str.includes('9') || str.includes('ix')) return '9th';
  return val;
}

/**
 * Global Helper to extract authentic Class Roll No across all database keys
 */
export function getStudentRollVal(st) {
  if (!st) return '';
  const keys = [
    'Class Roll No', 'Class Roll No.', 'classRollNo', 'rollNo', 'currExamRollNo',
    'examRollNo', 'Roll No', 'Roll No.', 'RollNumber', 'Roll_No', 'Roll', 'roll', 'classRoll'
  ];
  for (const k of keys) {
    if (st[k] !== undefined && st[k] !== null) {
      const val = String(st[k]).trim();
      if (val !== '' && val !== '—' && val !== 'null' && val !== 'undefined') {
        return val;
      }
    }
  }
  return '';
}

/**
 * Global Helper to extract authentic Stream across all database keys or infer from subjects
 */
export function getStudentStreamVal(st) {
  if (!st) return '';
  const streamKeys = [
    'Stream for Class 11th', 'Stream for Class 12th', 'Stream', 'stream',
    'Faculty', 'Faculty/Stream', 'Stream Name', 'Subject Group', 'academicStream'
  ];
  for (const k of streamKeys) {
    if (st[k] && String(st[k]).trim() !== '' && String(st[k]).trim() !== 'undefined' && String(st[k]).trim() !== 'null') {
      return String(st[k]).trim();
    }
  }

  // Infer stream from subjects (including st.subs) if stream field is missing
  const subjStr = String(
    st.subs || st['Subjects'] || st.subjects || st['Subject Choice'] || st['Subjects Offered'] || st.subject || ''
  ).toLowerCase();

  if (
    subjStr.includes('ph') || subjStr.includes('phys') || subjStr.includes('ch') || 
    subjStr.includes('chem') || subjStr.includes('bio') || subjStr.includes('biol') || 
    subjStr.includes('ma') || subjStr.includes('math') || subjStr.includes('ite') || 
    subjStr.includes('computer') || subjStr.includes('ip')
  ) {
    return 'Science';
  }
  if (
    subjStr.includes('acc') || subjStr.includes('bus') || subjStr.includes('com') || subjStr.includes('eco')
  ) {
    return 'Commerce';
  }
  if (
    subjStr.includes('ps') || subjStr.includes('pol') || subjStr.includes('ht') || 
    subjStr.includes('hist') || subjStr.includes('soc') || subjStr.includes('ed') || 
    subjStr.includes('urdu') || subjStr.includes('kash') || subjStr.includes('evs')
  ) {
    return 'Humanities';
  }
  return 'Science'; // Default to Science if subjects exist
}

/**
 * Automatically resolve standard theme based on student's class and stream
 */
export function resolveClassTheme(studentClass, studentStream, customThemeKey = null, studentObj = null) {
  // 1. Direct single theme key (e.g. 'cobalt', 'emerald')
  if (typeof customThemeKey === 'string' && customThemeKey !== 'auto' && customThemeKey !== 'classified' && ID_CARD_THEMES[customThemeKey]) {
    return ID_CARD_THEMES[customThemeKey];
  }

  const cls = normalizeStudentClass(studentClass || (studentObj ? (studentObj['Admission sought for class'] || studentObj['Class'] || studentObj.class) : ''));
  
  let stm = String(studentStream || '').toLowerCase().trim();
  if ((!stm || stm === 'undefined' || stm === 'null' || stm === '') && studentObj) {
    stm = getStudentStreamVal(studentObj).toLowerCase().trim();
  }

  let streamCategory = 'Arts';
  if (stm.includes('sci') || stm.includes('med') || stm.includes('non') || stm.includes('ph') || stm.includes('ch') || stm.includes('bio') || stm.includes('ma') || stm.includes('ite')) {
    streamCategory = 'Science';
  } else if (stm.includes('com') || stm.includes('acc')) {
    streamCategory = 'Commerce';
  }

  // 2. Object containing per-class themes e.g. { '11th_Science': 'cobalt', '12th_Science': 'emerald' }
  if (typeof customThemeKey === 'object' && customThemeKey !== null) {
    const specificKey = `${cls}_${streamCategory}`;
    if (customThemeKey[specificKey] && ID_CARD_THEMES[customThemeKey[specificKey]]) {
      return ID_CARD_THEMES[customThemeKey[specificKey]];
    }
    if (customThemeKey[cls] && ID_CARD_THEMES[customThemeKey[cls]]) {
      return ID_CARD_THEMES[customThemeKey[cls]];
    }
  }

  // 3. Classified Default Assignments
  if (cls === '11th') {
    if (streamCategory === 'Science') return ID_CARD_THEMES.cobalt;
    if (streamCategory === 'Commerce') return ID_CARD_THEMES.amber;
    return ID_CARD_THEMES.navy;
  }
  if (cls === '12th') {
    if (streamCategory === 'Science') return ID_CARD_THEMES.emerald;
    if (streamCategory === 'Commerce') return ID_CARD_THEMES.amber;
    return ID_CARD_THEMES.burgundy;
  }
  if (cls === '10th' || cls === '9th') {
    return ID_CARD_THEMES.purple;
  }
  return ID_CARD_THEMES.emerald;
}

/**
 * Abbreviate subject names cleanly for compact ID card presentation
 */
export function abbreviateSubjectName(subjectStr) {
  if (!subjectStr) return '';
  const map = {
    'general english': 'GE',
    'english': 'ENG',
    'physics': 'PH',
    'chemistry': 'CH',
    'mathematics': 'MA',
    'maths': 'MA',
    'biology': 'BIO',
    'botany': 'BOT',
    'zoology': 'ZOO',
    'information technology': 'ITE',
    'it': 'ITE',
    'computer science': 'CS',
    'environmental science': 'EVS',
    'evs': 'EVS',
    'urdu': 'UR',
    'education': 'ED',
    'history': 'HT',
    'political science': 'PS',
    'sociology': 'SOC',
    'economics': 'EC',
    'geography': 'GG',
    'kashmiri': 'KAS',
    'arabic': 'ARB',
    'persian': 'PER',
    'physical education': 'PHE',
    'business studies': 'BST',
    'accountancy': 'ACC',
    'entrepreneurship': 'EP',
    'health care': 'HTC',
    'healthcare': 'HTC',
    'retail': 'RET',
    'tourism': 'TOU',
    'security': 'SEC',
    'beauty and wellness': 'BNW',
    'agriculture': 'AGR'
  };

  const clean = String(subjectStr).trim();
  const lower = clean.toLowerCase();
  if (map[lower]) return map[lower];

  // If comma separated list
  if (clean.includes(',')) {
    return clean.split(',').map(s => abbreviateSubjectName(s.trim())).join(', ');
  }
  if (clean.includes('/')) {
    return clean.split('/').map(s => abbreviateSubjectName(s.trim())).join('/');
  }

  // Already short uppercase acronym
  if (/^[A-Z]{2,4}$/.test(clean)) return clean;

  const words = clean.split(/\s+/);
  if (words.length === 1) return clean.substring(0, 3).toUpperCase();
  return words.map(w => w[0]).join('').toUpperCase();
}

// In-memory memoization cache for generated student QR SVGs
const qrMemoryCache = new Map();

/**
 * Legacy synchronous signature hook.
/**
 * Generates a deterministic authentication signature for official QR verification URLs.
 */
export function generateVerificationSignature(reg = '', roll = '', fNo = '', cert = '') {
  const clean = `${String(reg).trim()}_${String(roll).trim()}_${String(fNo).trim()}_${String(cert).trim()}_HSS_SHANGUS_SECURE_AUTH`;
  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    const char = clean.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36).toUpperCase();
}

/**
 * Generate an offline standalone verification QR SVG Data URI with 0 network latency (<0.01ms)
 */
export function generateVerificationQrUrl(student, size = 160) {
  if (!student) return '';
  const sName = student["Student's Name (as per school records)"] || student["Student's Name"] || student.studentName || 'Student';
  const reg = student['Board Registration Number'] || student.boardRegNo || student.regNo || '—';
  const roll = getStudentRollVal(student) || '—';
  const fNo = student['Form Number'] || student['Form No.'] || student.formNo || '—';

  const uniqueId = student.id || student['Form Number'] || student.formNo || student['Board Registration Number'] || sName;
  const cacheKey = `${uniqueId}_${roll}_${size}`;
  if (qrMemoryCache.has(cacheKey)) {
    return qrMemoryCache.get(cacheKey);
  }

  const origin = (typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : 'https://admexamhssshangus.web.app';
  const sig = generateVerificationSignature(reg, roll, fNo);
  const verifyUrl = `${origin}/verify-student?reg=${encodeURIComponent(reg)}&roll=${encodeURIComponent(roll)}&fNo=${encodeURIComponent(fNo)}&sig=${encodeURIComponent(sig)}`;

  const uri = createQrSvgDataUri(verifyUrl, size);
  qrMemoryCache.set(cacheKey, uri);
  return uri;
}
