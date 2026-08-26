import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

export const DEFAULT_FEEDER_SCHOOLS = [
  'Army Proud Scholars School Khundroo',
  'Badasgam Public School Anantnag',
  'Elite Public School Tailwani',
  'Evergreen Public Instt Kawarigam',
  'Govt High School Cheerpora',
  'Govt Boys High School Nowgam',
  'Govt Boys Hr Sec Akingam',
  'Govt Boys Hr Sec Anantnag',
  'Govt Boys Hr Sec School Achabal',
  'Govt Boys Hr Sec School Anantnag',
  'Govt Boys Hr Sec School B K Pora Chadura',
  'Govt Boys Hr Sec School Natipora',
  'Govt Boys Hr Sec School Salia',
  'Govt Girls High School Brah',
  'Govt Girls High School Shangus',
  'Govt High School Andoo',
  'Govt High School Brariangan',
  'Govt High School Chowgam',
  'Govt High School Issoo',
  'Govt High School Krad',
  'Govt High School Nowgam Kuthar',
  'Govt High School Ranipora',
  'Govt High School Teelwani',
  'Govt Higher Secondary School Dethu',
  'Govt Hr Sec School Chittergul',
  'Govt Hr Sec School Khanabal Anantnag',
  'Govt Hr Sec School Shangus',
  'Govt Hr Sec School Utrasoo',
  'Hanfia High School Mir Mohlla Achabal',
  'Hanfia Memorial Institute Nowgam',
  'Hista Higher Secondary School Anantnag',
  'Iqra Public School',
  'KIE Hr Sec School Lasjan Srinagar',
  'Modern Public School Nowgam Shangus',
  'National Institute of Open Schooling',
  'Oxford Presentation School K P Road Anantnag',
  'PM Shri School Jawahar Navodaya Vidyalaya',
  'Radiant Public School Anantnag',
  'Saint Xians International School Anantnag',
  'Shaheen Public School Ranipora',
  'Sheikhulalam Memorial Institute Shangus',
  'Sidrah Institute of Education K P Road Anantnag',
  'Stpeters International Academy Anantnag',
];

const LOCAL_STORAGE_KEY = 'hss_feeder_schools_v1';

/**
 * Loads the feeder school list synchronously from cache/defaults.
 */
export function getCachedFeederSchools() {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {}
  return DEFAULT_FEEDER_SCHOOLS;
}

/**
 * Loads the feeder schools from Firestore (or localStorage/fallback).
 */
export async function loadFeederSchools() {
  try {
    const snap = await getDoc(doc(db, 'siteSettings', 'feederSchools'));
    if (snap.exists() && Array.isArray(snap.data()?.schools) && snap.data().schools.length > 0) {
      const schools = snap.data().schools;
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(schools));
      } catch (e) {}
      return schools;
    }
  } catch (e) {
    console.warn('Firestore feederSchools fetch note:', e);
  }
  return getCachedFeederSchools();
}

/**
 * Saves feeder schools to Firestore & localStorage.
 */
export async function saveFeederSchools(schoolsList) {
  if (!Array.isArray(schoolsList)) return DEFAULT_FEEDER_SCHOOLS;
  const cleanList = schoolsList
    .map(s => String(s || '').trim())
    .filter(Boolean);

  // Remove duplicates case-insensitively while preserving the casing
  const seen = new Set();
  const deduped = [];
  for (const s of cleanList) {
    const lower = s.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      deduped.push(s);
    }
  }

  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(deduped));
  } catch (e) {}

  try {
    await setDoc(doc(db, 'siteSettings', 'feederSchools'), {
      schools: deduped,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (e) {
    console.warn('Firestore feederSchools save note:', e);
  }

  return deduped;
}
