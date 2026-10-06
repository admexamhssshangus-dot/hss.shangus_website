// =================================================================
// HSS SHANGUS — Centralized School Achievements & Hall of Fame Service
// =================================================================
// Provides Firestore synchronization for student & institutional honors
// (JKBOSE Board results, UT top positions, NEET-UG / JEE competitive results,
// sports championships, and extra-curricular accolades).
// =================================================================

import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where
} from 'firebase/firestore';
import { db } from './firebase';
import {
  getAdmissionsBySession,
  getMasterRegistersScoped,
  getCurrentAcademicSession,
  fetchStudentPhotoOnDemand
} from './dbCache';
import { getStudentPhotoUrl, formatPhotoDisplayUrl } from '../utils/imageCompressor';

const ACHIEVEMENTS_COLLECTION = 'siteAchievements';
const BROADCAST_CHANNEL_NAME = 'hss_data_sync';

// In-memory cache for instant public page renders
let publishedAchievementsCache = null;
let lastFetchTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Setup cross-tab sync channel
const syncChannel = typeof window !== 'undefined' && window.BroadcastChannel
  ? new BroadcastChannel(BROADCAST_CHANNEL_NAME)
  : null;

if (syncChannel) {
  syncChannel.onmessage = (event) => {
    if (event.data?.type === 'ACHIEVEMENTS_MUTATION') {
      publishedAchievementsCache = null;
    }
  };
}

function notifySync(action, id) {
  publishedAchievementsCache = null;
  if (syncChannel) {
    try {
      syncChannel.postMessage({
        type: 'ACHIEVEMENTS_MUTATION',
        action,
        id,
        timestamp: Date.now()
      });
    } catch (_) {}
  }
}

/**
 * Standardize text names to Title Case.
 */
function toTitleCase(str) {
  if (!str) return '';
  return String(str)
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Normalize Board Registration Number for reliable lookups.
 */
function normalizeRegKey(val) {
  if (!val) return '';
  return String(val).toLowerCase().replace(/[^a-z0-9]/g, '');
}

export const DEFAULT_ACHIEVEMENTS = [
  {
    id: 'ach_demo_1',
    title: 'JKBOSE Higher Secondary Part-II (12th) Board Topper',
    category: 'jkbose',
    studentName: 'Zahid Ahmad Rather',
    fatherName: 'Mohammad Abdullah Rather',
    className: '12th',
    session: '2024-25',
    stream: 'Medical',
    boardRegNo: '21N-620401-0021',
    examRollNo: '24601129',
    examOrEvent: 'JKBOSE Class 12th Annual Regular Examination',
    scoreOrMarks: '494 / 500 (98.8%)',
    rankOrPosition: '3rd Position in UT of J&K',
    isUtPositionHolder: true,
    utPositionOrRank: '3rd Position in UT of J&K (Science)',
    institutionOrAward: 'Govt Medical College Srinagar (MBBS Selection)',
    badge: 'UT 3rd Position',
    description: 'Secured historic 3rd position across Jammu & Kashmir UT in JKBOSE Class 12th Annual Regular Examination with 494 marks and A1 grades in all five core subjects.',
    photoUrl: '',
    featured: true,
    published: true,
    order: 1,
    achievementDate: '2024-06-15'
  },
  {
    id: 'ach_demo_2',
    title: 'National Eligibility cum Entrance Test (NEET-UG) Distinction',
    category: 'competitive',
    studentName: 'Umar Farooq Shah',
    fatherName: 'Farooq Ahmad Shah',
    className: '12th',
    session: '2024-25',
    stream: 'Medical',
    boardRegNo: '21N-620401-0089',
    examRollNo: '24601185',
    examOrEvent: 'National Testing Agency (NTA) NEET-UG',
    scoreOrMarks: '652 / 720 (99.4 Percentile)',
    rankOrPosition: 'J&K UT Rank 94 (AIR 3,420)',
    isUtPositionHolder: true,
    utPositionOrRank: 'UT State Rank 94',
    institutionOrAward: 'GMC Anantnag — MBBS Admission',
    badge: 'NEET 652/720',
    description: 'Qualified NEET-UG with 652 marks and 99.4 percentile, earning direct government medical seat admission at Govt. Medical College Anantnag through open merit.',
    photoUrl: '',
    featured: true,
    published: true,
    order: 2,
    achievementDate: '2024-07-20'
  },
  {
    id: 'ach_demo_3',
    title: 'JKBOSE Secondary School Examination (10th) Division Merit',
    category: 'jkbose',
    studentName: 'Mehak Jan',
    fatherName: 'Ghulam Hassan Bhat',
    className: '10th',
    session: '2024-25',
    stream: 'General',
    boardRegNo: '22N-620401-0105',
    examRollNo: '11602341',
    examOrEvent: 'JKBOSE Class 10th Annual Regular Examination',
    scoreOrMarks: '491 / 500 (98.2%)',
    rankOrPosition: 'Top 10 in Kashmir Division',
    isUtPositionHolder: true,
    utPositionOrRank: 'Top 10 Kashmir Division Merit',
    institutionOrAward: 'State Merit Scholarship Recipient',
    badge: '10th Board 98.2%',
    description: 'Outstanding scholastic performance in matriculation board examination securing 491/500 marks with 100/100 in Mathematics and Science.',
    photoUrl: '',
    featured: false,
    published: true,
    order: 3,
    achievementDate: '2024-06-28'
  },
  {
    id: 'ach_demo_4',
    title: 'Gold Medal in 1500m Track & Field — J&K UT School Games',
    category: 'sports',
    studentName: 'Irfan Mushtaq Rather',
    fatherName: 'Mushtaq Ahmad Rather',
    className: '11th',
    session: '2025-26',
    stream: 'Humanities',
    boardRegNo: '23N-620401-0044',
    examRollNo: '31604102',
    examOrEvent: 'Department of Youth Services & Sports UT Athletics Championship',
    scoreOrMarks: 'Gold Medal (Time: 4m 02s)',
    rankOrPosition: 'UT Champion (1st Place)',
    isUtPositionHolder: true,
    utPositionOrRank: 'Gold Medal — 1st Place in J&K UT',
    institutionOrAward: 'Selected for 68th National School Games of India',
    badge: 'UT Athletics Gold',
    description: 'Clinched the Gold Medal representing District Anantnag in the 1500m track event at the J&K UT Inter-District School Athletics Meet held at Srinagar.',
    photoUrl: '',
    featured: true,
    published: true,
    order: 4,
    achievementDate: '2025-09-12'
  },
  {
    id: 'ach_demo_5',
    title: 'Joint Entrance Examination (JEE Main) Engineering Merit',
    category: 'competitive',
    studentName: 'Basit Bilal Malik',
    fatherName: 'Bilal Ahmad Malik',
    className: '12th',
    session: '2024-25',
    stream: 'Non-Medical',
    boardRegNo: '21N-620401-0012',
    examRollNo: '24601110',
    examOrEvent: 'NTA JEE Main 2024 (Session 2)',
    scoreOrMarks: '98.15 Percentile',
    rankOrPosition: 'UT Rank 142',
    isUtPositionHolder: false,
    utPositionOrRank: '',
    institutionOrAward: 'NIT Srinagar — Computer Science & Engineering',
    badge: 'JEE 98.15%ile',
    description: 'Secured 98.15 percentile in JEE Main with perfect score in Physics, gaining admission to National Institute of Technology (NIT) Srinagar.',
    photoUrl: '',
    featured: false,
    published: true,
    order: 5,
    achievementDate: '2024-05-18'
  },
  {
    id: 'ach_demo_6',
    title: 'National Children Science Congress (NCSC) State Finalist',
    category: 'cocurricular',
    studentName: 'Amina Rashid',
    fatherName: 'Abdul Rashid Wani',
    className: '11th',
    session: '2025-26',
    stream: 'Medical',
    boardRegNo: '23N-620401-0078',
    examRollNo: '31604144',
    examOrEvent: '31st National Children Science Congress — J&K State Level',
    scoreOrMarks: 'Grade A+ (State Best Project)',
    rankOrPosition: 'State Level Winner',
    isUtPositionHolder: true,
    utPositionOrRank: 'UT State Winner (Environmental Science)',
    institutionOrAward: 'Dept. of Science & Technology, Govt. of India',
    badge: 'NCSC State Winner',
    description: 'Presented an innovative investigative project on Indigenous Water Harvesting and Spring Restoration in South Kashmir, winning first prize at UT level.',
    photoUrl: '',
    featured: false,
    published: true,
    order: 6,
    achievementDate: '2025-11-04'
  }
];

/**
 * Fetch all published achievements for the public website Hall of Fame.
 * Automatically sorts featured items and J&K UT Position Holders first.
 */
export async function fetchPublishedAchievements(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && publishedAchievementsCache && (now - lastFetchTimestamp < CACHE_TTL_MS)) {
    return publishedAchievementsCache;
  }

  try {
    const q = query(
      collection(db, ACHIEVEMENTS_COLLECTION),
      where('published', '==', true)
    );
    const snap = await getDocs(q);
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Priority Sorting:
    // 1. Featured items first
    // 2. UT Position Holders next (J&K UT Toppers & Rankers)
    // 3. Custom display order (if specified)
    // 4. Achievement date / creation date descending
    items.sort((a, b) => {
      if (a.featured !== b.featured) {
        return a.featured ? -1 : 1;
      }
      if (Boolean(a.isUtPositionHolder) !== Boolean(b.isUtPositionHolder)) {
        return a.isUtPositionHolder ? -1 : 1;
      }
      if (typeof a.order === 'number' && typeof b.order === 'number' && a.order !== b.order) {
        return a.order - b.order;
      }
      const dateA = a.achievementDate || a.createdAt || '';
      const dateB = b.achievementDate || b.createdAt || '';
      return dateB.localeCompare(dateA);
    });

    const result = items.length > 0 ? items : DEFAULT_ACHIEVEMENTS;
    publishedAchievementsCache = result;
    lastFetchTimestamp = now;
    return result;
  } catch (err) {
    console.warn('[achievementsService] fetchPublishedAchievements fallback:', err.message || err);
    return publishedAchievementsCache || DEFAULT_ACHIEVEMENTS;
  }
}

/**
 * Fetch all achievement documents (published and drafts) for Admin CMS management.
 */
export async function fetchAllAchievementsAdmin() {
  try {
    const snap = await getDocs(collection(db, ACHIEVEMENTS_COLLECTION));
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    items.sort((a, b) => {
      const dateA = a.achievementDate || a.createdAt || '';
      const dateB = b.achievementDate || b.createdAt || '';
      return dateB.localeCompare(dateA);
    });

    return items;
  } catch (err) {
    console.error('[achievementsService] fetchAllAchievementsAdmin error:', err);
    throw err;
  }
}

/**
 * Create a new achievement entry in Cloud Firestore.
 */
export async function createAchievement(data, userEmail = 'admin') {
  if (!data || typeof data !== 'object') {
    throw new Error('Achievement data payload is required');
  }

  const id = data.id || `ach_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const record = {
    ...data,
    id,
    title: String(data.title || '').trim(),
    category: data.category || 'jkbose',
    studentName: toTitleCase(data.studentName || ''),
    fatherName: toTitleCase(data.fatherName || ''),
    className: String(data.className || '').trim(),
    session: String(data.session || getCurrentAcademicSession() || '2025-26').trim(),
    stream: String(data.stream || '').trim(),
    boardRegNo: String(data.boardRegNo || '').trim(),
    examRollNo: String(data.examRollNo || '').trim(),
    examOrEvent: String(data.examOrEvent || '').trim(),
    scoreOrMarks: String(data.scoreOrMarks || '').trim(),
    rankOrPosition: String(data.rankOrPosition || '').trim(),
    isUtPositionHolder: Boolean(data.isUtPositionHolder),
    utPositionOrRank: String(data.utPositionOrRank || '').trim(),
    institutionOrAward: String(data.institutionOrAward || '').trim(),
    badge: String(data.badge || '').trim(),
    description: String(data.description || '').trim(),
    photoUrl: String(data.photoUrl || '').trim(),
    featured: Boolean(data.featured),
    published: data.published !== false,
    order: Number(data.order) || 0,
    achievementDate: data.achievementDate || now.split('T')[0],
    createdAt: now,
    updatedAt: now,
    createdByName: userEmail || 'admin'
  };

  await setDoc(doc(db, ACHIEVEMENTS_COLLECTION, id), record);
  notifySync('CREATE', id);
  return record;
}

/**
 * Update an existing achievement entry in Cloud Firestore.
 */
export async function updateAchievement(id, updates, userEmail = 'admin') {
  if (!id) throw new Error('Achievement ID is required for update');

  const now = new Date().toISOString();
  const payload = {
    ...updates,
    updatedAt: now,
    lastEditedBy: userEmail || 'admin'
  };

  if (payload.studentName) payload.studentName = toTitleCase(payload.studentName);
  if (payload.fatherName) payload.fatherName = toTitleCase(payload.fatherName);

  await setDoc(doc(db, ACHIEVEMENTS_COLLECTION, id), payload, { merge: true });
  notifySync('UPDATE', id);
  return { id, ...payload };
}

/**
 * Delete an achievement entry.
 */
export async function deleteAchievement(id, userEmail = 'admin') {
  if (!id) throw new Error('Achievement ID is required for deletion');

  await deleteDoc(doc(db, ACHIEVEMENTS_COLLECTION, id));
  notifySync('DELETE', id);
  return { success: true, id };
}

/**
 * Automated Student Fast-Lookup Engine:
 * Searches admissions and master register cohorts for a given session, class,
 * and Board Registration Number (or Name / Roll No).
 * Automatically resolves and returns official Student Photo and demographics.
 */
export async function lookupStudentForAchievement({
  session = '',
  className = '',
  boardRegNo = '',
  rollNo = '',
  studentName = ''
} = {}) {
  const currentSession = getCurrentAcademicSession() || '2025-26';
  const targetSession = session && session !== 'all' ? session : currentSession;
  const cleanTargetReg = normalizeRegKey(boardRegNo);
  const cleanRoll = String(rollNo || '').trim().toLowerCase();
  const cleanName = String(studentName || '').trim().toLowerCase();

  if (!cleanTargetReg && !cleanRoll && cleanName.length < 3) {
    throw new Error('Please provide a Board Registration Number, Roll Number, or Student Name to lookup');
  }

  // 1. Fetch scoped cohort from memory / Firestore
  let students = [];
  try {
    students = await getAdmissionsBySession({ session: targetSession });
  } catch (_) {
    students = [];
  }

  // Fallback to historical master registers on-demand if not found in admissions
  if ((!students || students.length === 0) && targetSession !== currentSession) {
    try {
      students = await getMasterRegistersScoped(targetSession);
    } catch (_) {
      students = [];
    }
  }

  // 2. Locate matching student record
  let match = null;

  if (cleanTargetReg) {
    match = students.find(s => {
      const reg = normalizeRegKey(
        s.boardRegNo || s.regNo || s['Board Registration Number'] ||
        s['Board Registration No.'] || s['DIET Registration No.'] || ''
      );
      return reg && (reg === cleanTargetReg || reg.includes(cleanTargetReg) || cleanTargetReg.includes(reg));
    });
  }

  if (!match && cleanRoll) {
    match = students.find(s => {
      const r = String(s.classRollNo || s.rollNo || s['Class Roll No'] || '').trim().toLowerCase();
      const c = String(s.className || s.class || '').toLowerCase();
      const classMatches = !className || c.includes(className.toLowerCase());
      return r === cleanRoll && classMatches;
    });
  }

  if (!match && cleanName) {
    match = students.find(s => {
      const n = String(s.studentName || s.name || s["Student's Name"] || '').trim().toLowerCase();
      const c = String(s.className || s.class || '').toLowerCase();
      const classMatches = !className || c.includes(className.toLowerCase());
      return n.includes(cleanName) && classMatches;
    });
  }

  if (!match) {
    return {
      found: false,
      message: `No matching student record found for Session "${targetSession}". You can still fill demographics manually.`
    };
  }

  // 3. Resolve Demographics
  const sName = match.studentName || match.name || match["Student's Name"] || match['Full Name'] || '';
  const fName = match.fatherName || match.father || match["Father's Name"] || match["Father's/Guardian's Name"] || '';
  const sClass = match.className || match.class || match['Class'] || className || '';
  const sStream = match.stream || match['Stream'] || match['Stream for Class 11th'] || '';
  const sReg = match.boardRegNo || match.regNo || match['Board Registration Number'] || boardRegNo || '';
  const sRoll = match.classRollNo || match.rollNo || match['Class Roll No'] || '';
  const sForm = match.formNo || match['Form Number'] || match['Form No.'] || '';

  // 4. Resolve Student Photograph
  let resolvedPhotoUrl = '';
  try {
    resolvedPhotoUrl = await fetchStudentPhotoOnDemand(match);
  } catch (_) {}

  if (!resolvedPhotoUrl || resolvedPhotoUrl === '/logo.png') {
    resolvedPhotoUrl = formatPhotoDisplayUrl(getStudentPhotoUrl(match)) || '';
  }

  return {
    found: true,
    student: {
      studentName: toTitleCase(sName),
      fatherName: toTitleCase(fName),
      className: sClass,
      session: match.session || match.Session || targetSession,
      stream: sStream,
      boardRegNo: sReg,
      classRollNo: sRoll,
      formNo: sForm,
      photoUrl: resolvedPhotoUrl
    }
  };
}
