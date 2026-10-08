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
    id: 'ach_zaidan_neet_2026',
    title: 'NEET-UG 2026 — J&K UT Rank 1 & All India Rank (AIR) 124',
    category: 'competitive',
    studentName: 'Zaidan Wani',
    fatherName: 'Bilal Ahmad Wani',
    className: '12th',
    session: '2025-26',
    stream: 'Science',
    boardRegNo: '2201000001160003',
    examRollNo: '301003053',
    examOrEvent: 'National Testing Agency (NTA) NEET-UG 2026',
    scoreOrMarks: '690 / 720 (99.98 Percentile)',
    rankOrPosition: '1st Rank in UT of J&K (AIR 124)',
    isUtPositionHolder: true,
    utPositionOrRank: 'UT Rank 1 — AIR 124',
    institutionOrAward: 'AIIMS / Premier National Medical Institute Selection',
    badge: 'NEET AIR 124 / UT 1',
    description: 'Created institutional history by securing 1st Rank across Jammu & Kashmir UT and All India Rank (AIR) 124 in NEET-UG 2026 with a phenomenal score of 690/720.',
    photoUrl: '',
    featured: true,
    published: true,
    order: 1,
    achievementDate: '2026-06-14'
  },
  {
    id: 'ach_zaidan_jee_2026',
    title: 'Joint Entrance Examination (JEE Main & Advanced) Dual Merit',
    category: 'competitive',
    studentName: 'Zaidan Wani',
    fatherName: 'Bilal Ahmad Wani',
    className: '12th',
    session: '2025-26',
    stream: 'Science',
    boardRegNo: '2201000001160003',
    examRollNo: '301003053',
    examOrEvent: 'NTA JEE Main & IIT JEE Advanced',
    scoreOrMarks: 'Qualified Both JEE Main & Advanced',
    rankOrPosition: 'Dual Engineering Entrance Qualifier',
    isUtPositionHolder: true,
    utPositionOrRank: 'JEE Dual Qualifier',
    institutionOrAward: 'IIT / NIT Eligibility Selection',
    badge: 'JEE Main & Adv',
    description: 'Demonstrated peerless academic versatility by qualifying both the prestigious JEE Main and JEE Advanced entrance examinations alongside top NEET merit.',
    photoUrl: '',
    featured: true,
    published: true,
    order: 2,
    achievementDate: '2026-06-18'
  },
  {
    id: 'ach_tabish_neet',
    title: 'National Eligibility cum Entrance Test (NEET-UG) Distinction',
    category: 'competitive',
    studentName: 'Tabish Rasool Allie',
    fatherName: 'Ghulam Rasool Allie',
    className: '12th',
    session: '2024-25',
    stream: 'Science',
    boardRegNo: '2101000000980041',
    examRollNo: '301046053',
    examOrEvent: 'National Testing Agency (NTA) NEET-UG',
    scoreOrMarks: '597 / 720',
    rankOrPosition: 'Qualified NEET-UG — GMC MBBS Admission',
    isUtPositionHolder: false,
    utPositionOrRank: '',
    institutionOrAward: 'Govt. Medical College — MBBS Selection',
    badge: 'NEET 597/720',
    description: 'Distinguished alumnus of HSS Shangus who cracked NEET-UG with 597/720 marks, earning direct government medical seat admission for MBBS.',
    photoUrl: '',
    featured: true,
    published: true,
    order: 3,
    achievementDate: '2025-06-20'
  },
  {
    id: 'ach_11th_2025_mar_1',
    title: 'JKBOSE Class 11th Science — J&K UT 3rd Position',
    category: 'jkbose',
    studentName: 'Zaidan Wani',
    fatherName: 'Bilal Ahmad Wani',
    className: '11th',
    session: '2024-25',
    stream: 'Science',
    boardRegNo: '2201000001160003',
    examRollNo: '201002066',
    examOrEvent: 'JKBOSE Class 11th Regular 2024-25 (Mar-Apr)',
    scoreOrMarks: '493 / 500 (98.6%)',
    rankOrPosition: '3rd Position in UT of J&K',
    isUtPositionHolder: true,
    utPositionOrRank: '3rd Position in UT of J&K',
    institutionOrAward: 'Govt. Higher Secondary School Shangus',
    badge: 'UT 3rd Position',
    description: 'Secured 3rd Position across Jammu & Kashmir UT in JKBOSE Class 11th Regular 2024-25 (Mar-Apr) Examination with 493/500 marks (98.6%).',
    photoUrl: '',
    featured: true,
    published: true,
    order: 4,
    achievementDate: '2025-05-15'
  },
  {
    id: 'ach_11th_2025_mar_2',
    title: 'JKBOSE Class 11th Science — J&K UT 4th Position',
    category: 'jkbose',
    studentName: 'Hadeeqa Tabasum',
    fatherName: 'Imtiyaz Ahmad Itoo',
    className: '11th',
    session: '2024-25',
    stream: 'Science',
    boardRegNo: '2201010001160068',
    examRollNo: '201002067',
    examOrEvent: 'JKBOSE Class 11th Regular 2024-25 (Mar-Apr)',
    scoreOrMarks: '492 / 500 (98.4%)',
    rankOrPosition: '4th Position in UT of J&K',
    isUtPositionHolder: true,
    utPositionOrRank: '4th Position in UT of J&K',
    institutionOrAward: 'Govt. Higher Secondary School Shangus',
    badge: 'UT 4th Position',
    description: 'Secured 4th Position across Jammu & Kashmir UT in JKBOSE Class 11th Regular 2024-25 (Mar-Apr) Examination with 492/500 marks (98.4%).',
    photoUrl: '',
    featured: true,
    published: true,
    order: 5,
    achievementDate: '2025-05-15'
  },
  {
    id: 'ach_12th_2025_octnov_1',
    title: 'JKBOSE Class 12th Science — J&K UT 8th Position',
    category: 'jkbose',
    studentName: 'Hadeeqa Tabasum',
    fatherName: 'Imtiyaz Ahmad Itoo',
    className: '12th',
    session: '2024-25',
    stream: 'Science',
    boardRegNo: '2201010001160068',
    examRollNo: '301003054',
    examOrEvent: 'JKBOSE Class 12th Regular 2024-25 (Oct-Nov)',
    scoreOrMarks: '493 / 500 (98.6%)',
    rankOrPosition: '8th Position in UT of J&K',
    isUtPositionHolder: true,
    utPositionOrRank: '8th Position in UT of J&K',
    institutionOrAward: 'Govt. Higher Secondary School Shangus',
    badge: 'UT 8th Position',
    description: 'Secured 8th Position across Jammu & Kashmir UT in JKBOSE Class 12th Regular 2024-25 (Oct-Nov) Examination with 493/500 marks (98.6%).',
    photoUrl: '',
    featured: true,
    published: true,
    order: 6,
    achievementDate: '2024-12-25'
  },
  {
    id: 'ach_12th_2025_octnov_2',
    title: 'JKBOSE Class 12th Science — J&K UT 9th Position',
    category: 'jkbose',
    studentName: 'Ajvaa Ibrahim Ganie',
    fatherName: 'Mohammad Ibrahim Ganie',
    className: '12th',
    session: '2024-25',
    stream: 'Science',
    boardRegNo: '2201000000030010',
    examRollNo: '301003037',
    examOrEvent: 'JKBOSE Class 12th Regular 2024-25 (Oct-Nov)',
    scoreOrMarks: '492 / 500 (98.4%)',
    rankOrPosition: '9th Position in UT of J&K',
    isUtPositionHolder: true,
    utPositionOrRank: '9th Position in UT of J&K',
    institutionOrAward: 'Govt. Higher Secondary School Shangus',
    badge: 'UT 9th Position',
    description: 'Secured 9th Position across Jammu & Kashmir UT in JKBOSE Class 12th Regular 2024-25 (Oct-Nov) Examination with 492/500 marks (98.4%).',
    photoUrl: '',
    featured: true,
    published: true,
    order: 7,
    achievementDate: '2024-12-25'
  }
];

/**
 * Seeds or re-populates the default template achievements directly into Cloud Firestore.
 */
export async function seedDefaultAchievements(force = false) {
  try {
    const existingSnap = await getDocs(collection(db, ACHIEVEMENTS_COLLECTION));
    if (!force && !existingSnap.empty) {
      return existingSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    }

    const now = new Date().toISOString();
    const seeded = [];

    for (const item of DEFAULT_ACHIEVEMENTS) {
      const docRef = doc(db, ACHIEVEMENTS_COLLECTION, item.id);
      const record = {
        ...item,
        createdAt: now,
        updatedAt: now,
        createdByName: 'system_template_seed'
      };
      await setDoc(docRef, record, { merge: true });
      seeded.push(record);
    }

    notifySync('SEED', 'all');
    return seeded;
  } catch (err) {
    console.error('[achievementsService] seedDefaultAchievements error:', err);
    throw err;
  }
}

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
    let items = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // If Firestore has no documents yet, auto-seed defaults so website and portal stay synced
    if (items.length === 0) {
      try {
        const seeded = await seedDefaultAchievements(false);
        items = seeded.filter(x => x.published !== false);
      } catch (_) {
        items = DEFAULT_ACHIEVEMENTS;
      }
    }

    // Deduplicate any duplicate documents by ID
    const seenIds = new Set();
    items = items.filter(item => {
      if (!item?.id || seenIds.has(item.id)) return false;
      seenIds.add(item.id);
      return true;
    });

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

    publishedAchievementsCache = items;
    lastFetchTimestamp = now;
    return items;
  } catch (err) {
    console.warn('[achievementsService] fetchPublishedAchievements fallback:', err.message || err);
    return publishedAchievementsCache || DEFAULT_ACHIEVEMENTS;
  }
}

/**
 * Fetch all achievement documents (published and drafts) for Admin CMS management.
 * Auto-initializes Firestore with default documents if empty so admin can immediately perform CRUD.
 */
export async function fetchAllAchievementsAdmin() {
  try {
    const snap = await getDocs(collection(db, ACHIEVEMENTS_COLLECTION));
    let items = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Auto-seed default achievements into Firestore so admin has full CRUD capability immediately
    if (items.length === 0) {
      try {
        items = await seedDefaultAchievements(false);
      } catch (seedErr) {
        console.warn('[achievementsService] Auto-seed failed, falling back to in-memory templates:', seedErr);
        items = DEFAULT_ACHIEVEMENTS;
      }
    }

    // Deduplicate any duplicate documents by ID
    const seenIds = new Set();
    items = items.filter(item => {
      if (!item?.id || seenIds.has(item.id)) return false;
      seenIds.add(item.id);
      return true;
    });

    items.sort((a, b) => {
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      if (Boolean(a.isUtPositionHolder) !== Boolean(b.isUtPositionHolder)) return a.isUtPositionHolder ? -1 : 1;
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
  if (payload.boardRegNo !== undefined) payload.boardRegNo = String(payload.boardRegNo).trim();

  await setDoc(doc(db, ACHIEVEMENTS_COLLECTION, id), payload, { merge: true });
  notifySync('UPDATE', id);
  return { id, ...payload };
}

/**
 * Quick toggle published status of an achievement.
 */
export async function toggleAchievementPublished(id, currentPublished, userEmail = 'admin') {
  return updateAchievement(id, { published: !currentPublished }, userEmail);
}

/**
 * Quick toggle featured status of an achievement.
 */
export async function toggleAchievementFeatured(id, currentFeatured, userEmail = 'admin') {
  return updateAchievement(id, { featured: !currentFeatured }, userEmail);
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
 * Searches admissions cohorts, master registers, and verified student registries
 * for a given session, class, and Board Registration Number (or Name / Roll No).
 * Automatically resolves and returns official Student Photo, Reg No, and demographics.
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
    throw new Error('Please enter a Board Registration Number, Roll Number, or Student Name to lookup');
  }

  // 1. Fetch scoped cohort from admissions and master registers
  const sessionsToTry = Array.from(new Set([targetSession, currentSession, '2024-25', '2025-26', '2023-24']));
  let pool = [];

  for (const sName of sessionsToTry) {
    try {
      const adm = await getAdmissionsBySession({ session: sName });
      if (Array.isArray(adm) && adm.length > 0) {
        pool.push(...adm.map(x => ({ ...x, _detectedSession: sName })));
      }
    } catch (_) {}

    try {
      const reg = await getMasterRegistersScoped(sName);
      if (Array.isArray(reg) && reg.length > 0) {
        pool.push(...reg.map(x => ({ ...x, _detectedSession: sName })));
      }
    } catch (_) {}
  }

  // 2. Locate matching student record
  let match = null;

  // Search by Board Registration Number
  if (cleanTargetReg) {
    match = pool.find(s => {
      const regRaw = s.boardRegNo || s.regNo || s.regKey || s['Board Registration Number'] ||
        s['Board Registration No.'] || s['Registration Number'] || s['DIET Registration No.'] ||
        s['studentRegNo'] || s['admNo'] || '';
      const normReg = normalizeRegKey(regRaw);
      return normReg && (normReg === cleanTargetReg || normReg.includes(cleanTargetReg) || cleanTargetReg.includes(normReg));
    });
  }

  // Search by Roll Number
  if (!match && cleanRoll) {
    match = pool.find(s => {
      const r = String(s.examRollNo || s.classRollNo || s.rollNo || s['Class Roll No'] || s['Roll No'] || '').trim().toLowerCase();
      const c = String(s.className || s.class || s['Class'] || '').toLowerCase();
      const classMatches = !className || className === 'all' || c.includes(className.toLowerCase());
      return r === cleanRoll && classMatches;
    });
  }

  // Search by Name
  if (!match && cleanName) {
    match = pool.find(s => {
      const n = String(s.studentName || s.name || s["Student's Name"] || s['Full Name'] || '').trim().toLowerCase();
      const c = String(s.className || s.class || s['Class'] || '').toLowerCase();
      const classMatches = !className || className === 'all' || c.includes(className.toLowerCase());
      return n.includes(cleanName) && classMatches;
    });
  }

  // 3. Fallback search into practical seed cohorts if not in admissions/master registers
  if (!match) {
    try {
      const { CLEAN_PRACTICALS_SEED_DATA } = await import('../data/cleanPracticalsSeedData.js');
      if (Array.isArray(CLEAN_PRACTICALS_SEED_DATA)) {
        for (const cohort of CLEAN_PRACTICALS_SEED_DATA) {
          const cohortStudents = cohort.students || [];
          for (const s of cohortStudents) {
            const regNorm = normalizeRegKey(s.boardRegNo || s.regNo || '');
            const rNorm = String(s.examRollNo || s.classRollNo || s.rollNo || '').trim().toLowerCase();
            const nNorm = String(s.name || s.studentName || '').trim().toLowerCase();

            const isRegMatch = cleanTargetReg && regNorm && (regNorm === cleanTargetReg || regNorm.includes(cleanTargetReg) || cleanTargetReg.includes(regNorm));
            const isRollMatch = cleanRoll && rNorm === cleanRoll;
            const isNameMatch = cleanName && nNorm.includes(cleanName);

            if (isRegMatch || isRollMatch || isNameMatch) {
              match = {
                studentName: s.name,
                fatherName: s.parentName,
                className: cohort.class || '12th',
                session: cohort.session || targetSession,
                stream: s.stream || cohort.stream || 'Science',
                boardRegNo: s.boardRegNo || boardRegNo,
                examRollNo: s.examRollNo || s.classRollNo || '',
                _detectedSession: cohort.session || targetSession
              };
              break;
            }
          }
          if (match) break;
        }
      }
    } catch (_) {}
  }

  if (!match) {
    return {
      found: false,
      message: `No record matching "${boardRegNo || rollNo || studentName}" was found in the student database. You can enter details manually.`
    };
  }

  // 4. Resolve Demographics & Normalized Fields
  const sName = match.studentName || match.name || match["Student's Name"] || match['Full Name'] || '';
  const fName = match.fatherName || match.parentName || match.father || match["Father's Name"] || match["Father's/Guardian's Name"] || '';
  const rawClass = match.className || match.class || match['Class'] || className || '12th';
  const cleanClass = rawClass.includes('11') ? '11th' : rawClass.includes('10') ? '10th' : '12th';
  const sStream = match.stream || match['Stream'] || match['Stream for Class 11th'] || 'Science';
  const sReg = match.boardRegNo || match.regNo || match['Board Registration Number'] || boardRegNo || '';
  const sRoll = match.examRollNo || match.classRollNo || match.rollNo || match['Class Roll No'] || '';
  const matchedSession = match._detectedSession || match.session || match.Session || targetSession;

  // 5. Resolve Student Photograph
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
      className: cleanClass,
      session: matchedSession,
      stream: sStream,
      boardRegNo: String(sReg).trim(),
      examRollNo: String(sRoll).trim(),
      photoUrl: resolvedPhotoUrl
    }
  };
}
