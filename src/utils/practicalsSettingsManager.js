import { db } from '../services/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { getCachedCollection } from '../services/dbCache';

export const SUBJECT_CONFIG_DEFS = [
  { code: 'PH', name: 'Physics', stream: 'Science', isLab: true },
  { code: 'CH', name: 'Chemistry', stream: 'Science', isLab: true },
  { code: 'BI', name: 'Biology (Botany & Zoology)', stream: 'Science', isLab: true },
  { code: 'BO', name: 'Botany', stream: 'Science', isLab: true },
  { code: 'ZO', name: 'Zoology', stream: 'Science', isLab: true },
  { code: 'ES', name: 'Environmental Science', stream: 'Science', isLab: true },
  { code: 'PD', name: 'Physical Education', stream: 'All Streams', isLab: true },
  { code: 'ITE', name: 'IT and ITES', stream: 'Vocational', isLab: true },
  { code: 'HTC', name: 'Healthcare', stream: 'Vocational', isLab: true },
  { code: 'CS', name: 'Computer Science', stream: 'Science / Arts', isLab: true },
  { code: 'GG', name: 'Geography', stream: 'Arts', isLab: true },
  { code: 'EN', name: 'General English', stream: 'All Streams', isLab: false },
  { code: 'MA', name: 'Mathematics', stream: 'Science / Arts', isLab: false },
  { code: 'UR', name: 'Urdu', stream: 'Humanities', isLab: false },
  { code: 'ED', name: 'Education', stream: 'Humanities', isLab: false },
  { code: 'HT', name: 'History', stream: 'Humanities', isLab: false },
  { code: 'PS', name: 'Political Science', stream: 'Humanities', isLab: false },
  { code: 'EC', name: 'Economics', stream: 'Humanities / Commerce', isLab: false },
  { code: 'SO', name: 'Sociology', stream: 'Humanities', isLab: false },
  { code: 'PY', name: 'Psychology', stream: 'Humanities', isLab: false },
  { code: 'AY', name: 'Accountancy', stream: 'Commerce', isLab: false },
  { code: 'BS', name: 'Business Studies', stream: 'Commerce', isLab: false },
  { code: 'EP', name: 'Entrepreneurship', stream: 'Commerce', isLab: false },
  { code: 'AR', name: 'Arabic', stream: 'Humanities', isLab: false },
  { code: 'PE', name: 'Persian', stream: 'Humanities', isLab: false }
];

export const DEFAULT_PRACTICAL_MARKS_CONFIG = {
  '11th': {
    internal: {
      PH:  { max: 10, min: 4 },
      CH:  { max: 10, min: 4 },
      BI:  { max: 20, min: 7 },
      BO:  { max: 5,  min: 2 },
      ZO:  { max: 5,  min: 2 },
      ES:  { max: 10, min: 4 },
      PD:  { max: 15, min: 5 },
      ITE: { max: 50, min: 18 },
      HTC: { max: 50, min: 18 },
      CS:  { max: 30, min: 11 },
      GG:  { max: 20, min: 7 },
      EN:  { max: 20, min: 7 },
      MA:  { max: 20, min: 7 },
      UR:  { max: 20, min: 7 },
      ED:  { max: 20, min: 7 },
      HT:  { max: 20, min: 7 },
      PS:  { max: 20, min: 7 },
      EC:  { max: 20, min: 7 },
      SO:  { max: 20, min: 7 },
      PY:  { max: 20, min: 7 },
      AY:  { max: 20, min: 7 },
      BS:  { max: 20, min: 7 },
      EP:  { max: 20, min: 7 },
      AR:  { max: 20, min: 7 },
      PE:  { max: 20, min: 7 }
    },
    external: {
      PH:  { max: 30, min: 11 },
      CH:  { max: 30, min: 11 },
      BI:  { max: 30, min: 11 },
      BO:  { max: 15, min: 5 },
      ZO:  { max: 15, min: 5 },
      ES:  { max: 30, min: 11 },
      PD:  { max: 30, min: 11 },
      ITE: { max: 50, min: 18 },
      HTC: { max: 50, min: 18 },
      CS:  { max: 30, min: 11 },
      GG:  { max: 30, min: 11 },
      EN:  { max: 20, min: 7 },
      MA:  { max: 20, min: 7 },
      UR:  { max: 20, min: 7 },
      ED:  { max: 20, min: 7 },
      HT:  { max: 20, min: 7 },
      PS:  { max: 20, min: 7 },
      EC:  { max: 20, min: 7 },
      SO:  { max: 20, min: 7 },
      PY:  { max: 20, min: 7 },
      AY:  { max: 20, min: 7 },
      BS:  { max: 20, min: 7 },
      EP:  { max: 20, min: 7 },
      AR:  { max: 20, min: 7 },
      PE:  { max: 20, min: 7 }
    }
  },
  '12th': {
    internal: {
      PH:  { max: 10, min: 4 },
      CH:  { max: 10, min: 4 },
      BI:  { max: 20, min: 7 },
      BO:  { max: 5,  min: 2 },
      ZO:  { max: 5,  min: 2 },
      ES:  { max: 10, min: 4 },
      PD:  { max: 15, min: 5 },
      ITE: { max: 50, min: 18 },
      HTC: { max: 50, min: 18 },
      CS:  { max: 30, min: 11 },
      GG:  { max: 20, min: 7 },
      EN:  { max: 20, min: 7 },
      MA:  { max: 20, min: 7 },
      UR:  { max: 20, min: 7 },
      ED:  { max: 20, min: 7 },
      HT:  { max: 20, min: 7 },
      PS:  { max: 20, min: 7 },
      EC:  { max: 20, min: 7 },
      SO:  { max: 20, min: 7 },
      PY:  { max: 20, min: 7 },
      AY:  { max: 20, min: 7 },
      BS:  { max: 20, min: 7 },
      EP:  { max: 20, min: 7 },
      AR:  { max: 20, min: 7 },
      PE:  { max: 20, min: 7 }
    },
    external: {
      PH:  { max: 30, min: 11 },
      CH:  { max: 30, min: 11 },
      BI:  { max: 30, min: 11 },
      BO:  { max: 15, min: 5 },
      ZO:  { max: 15, min: 5 },
      ES:  { max: 30, min: 11 },
      PD:  { max: 30, min: 11 },
      ITE: { max: 50, min: 18 },
      HTC: { max: 50, min: 18 },
      CS:  { max: 30, min: 11 },
      GG:  { max: 30, min: 11 },
      EN:  { max: 20, min: 7 },
      MA:  { max: 20, min: 7 },
      UR:  { max: 20, min: 7 },
      ED:  { max: 20, min: 7 },
      HT:  { max: 20, min: 7 },
      PS:  { max: 20, min: 7 },
      EC:  { max: 20, min: 7 },
      SO:  { max: 20, min: 7 },
      PY:  { max: 20, min: 7 },
      AY:  { max: 20, min: 7 },
      BS:  { max: 20, min: 7 },
      EP:  { max: 20, min: 7 },
      AR:  { max: 20, min: 7 },
      PE:  { max: 20, min: 7 }
    }
  }
};

/**
 * Resolves configured Max Marks and Min / Pass Marks for any subject, class, and evaluation type.
 */
export function getSubjectMarksConfig(settings, cls = '11th', evalType = 'internal', subCode = 'PH') {
  const normClass = String(cls).includes('12') ? '12th' : '11th';
  const normType = String(evalType || '').toLowerCase().includes('ext') ? 'external' : 'internal';
  const code = String(subCode || '').toUpperCase().trim();

  // 1. Check evaluationMarksConfig or evaluationSettings in settings object
  const customConfig =
    settings?.evaluationMarksConfig?.[normClass]?.[normType]?.[code] ||
    settings?.evaluationSettings?.[normClass]?.[normType]?.[code] ||
    settings?.marksConfig?.[normClass]?.[normType]?.[code];

  if (customConfig) {
    const rawMax = customConfig.max ?? customConfig.maxMarks;
    const rawMin = customConfig.min ?? customConfig.minMarks;
    const max = parseInt(rawMax, 10);
    const min = parseInt(rawMin, 10);
    if (!isNaN(max) && max > 0) {
      return {
        max,
        min: !isNaN(min) && min >= 0 ? min : Math.ceil(0.36 * max)
      };
    }
  }

  // 2. Check flat legacy keys (e.g. maxMarks11, maxMarks12)
  if (normType === 'internal') {
    const flatMap = normClass === '12th' ? settings?.maxMarks12 : settings?.maxMarks11;
    if (flatMap && flatMap[code]) {
      const max = parseInt(flatMap[code], 10);
      if (!isNaN(max) && max > 0) {
        return { max, min: Math.ceil(0.36 * max) };
      }
    }
  }

  // 3. Fallback to default practical marks configuration
  const def = DEFAULT_PRACTICAL_MARKS_CONFIG[normClass]?.[normType]?.[code];
  if (def) {
    return { max: def.max, min: def.min };
  }

  // 4. Default fallback
  const fallbackMax = normType === 'external' ? 30 : 20;
  return { max: fallbackMax, min: Math.ceil(0.36 * fallbackMax) };
}

/**
 * Fetches practical settings from cache / Firestore
 */
export async function getAdminPracticalsSettings() {
  try {
    const cachedDocs = await getCachedCollection('adminPracticalsSettings', false, 10 * 60 * 1000).catch(() => []);
    if (Array.isArray(cachedDocs)) {
      const configDoc = cachedDocs.find(d => d.id === 'config');
      if (configDoc) return configDoc;
    }
    const snap = await getDoc(doc(db, 'adminPracticalsSettings', 'config')).catch(() => null);
    if (snap && snap.exists()) {
      return snap.data();
    }
  } catch (e) {
    console.warn('Failed to load practical settings:', e);
  }
  return null;
}
