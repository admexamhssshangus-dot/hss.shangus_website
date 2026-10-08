// =================================================================
// HSS SHANGUS — Centralized JKBOSE Board Examination Results Service
// =================================================================
// Provides Firestore synchronization for institutional board examination
// results (Classes 10th, 11th, and 12th gazettes, indicators, pass percentages,
// and school toppers ledgers).
// =================================================================

import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  writeBatch
} from 'firebase/firestore';
import { db } from './firebase';
import {
  ALL_BOARD_RESULTS
} from '../data/classBoardResults';

const BOARD_RESULTS_COLLECTION = 'siteBoardResults';
const BROADCAST_CHANNEL_NAME = 'hss_data_sync';

// In-memory cache for instant public page renders
let boardResultsCache = null;
let lastFetchTimestamp = 0;
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes

// Cross-tab broadcast channel
const syncChannel = typeof window !== 'undefined' && window.BroadcastChannel
  ? new BroadcastChannel(BROADCAST_CHANNEL_NAME)
  : null;

if (syncChannel) {
  syncChannel.onmessage = (event) => {
    if (event.data?.type === 'BOARD_RESULTS_MUTATION') {
      boardResultsCache = null;
    }
  };
}

function notifySync(action, id) {
  boardResultsCache = null;
  if (syncChannel) {
    try {
      syncChannel.postMessage({
        type: 'BOARD_RESULTS_MUTATION',
        action,
        id,
        timestamp: Date.now()
      });
    } catch (_) {}
  }
}

/**
 * Helper to build the 8 standard gazette indicators from summary statistics.
 */
export function buildIndicatorsFromStats(stats, originalIndicators = []) {
  const appeared = String(stats?.appeared ?? 0);
  const passed = String(stats?.passed ?? 0);
  const failed = String(stats?.failed ?? 0);
  const distinction = String(stats?.distinction ?? 0);
  const firstDiv = String(stats?.firstDiv ?? 0);
  const secondDiv = String(stats?.secondDiv ?? 0);
  const thirdDiv = String(stats?.thirdDiv ?? 0);
  const overallPercent = stats?.overallPercent || (
    Number(stats?.appeared) > 0
      ? `${((Number(stats.passed) / Number(stats.appeared)) * 100).toFixed(2)}%`
      : '0.00%'
  );

  return [
    { label: 'total appeared', count: appeared },
    { label: 'total failed/reappear', count: failed },
    { label: 'total passed', count: passed },
    { label: 'total Distinc', count: distinction },
    { label: 'total 1st Div', count: firstDiv },
    { label: 'total 2nd Div', count: secondDiv },
    { label: 'total 3rd Div', count: thirdDiv },
    { label: 'Total pass percentage', count: overallPercent, highlight: true }
  ];
}

/**
 * Fetch all board result cohorts from Firestore.
 * Automatically seeds default cohorts if Firestore is empty so the admin can immediately edit.
 */
export async function fetchAllBoardResults(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && boardResultsCache && (now - lastFetchTimestamp < CACHE_TTL_MS)) {
    return boardResultsCache;
  }

  try {
    const snap = await getDocs(collection(db, BOARD_RESULTS_COLLECTION));
    let items = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Auto-seed default cohorts if Firestore is empty
    if (items.length === 0) {
      try {
        items = await seedDefaultBoardResults(false);
      } catch (seedErr) {
        console.warn('[boardResultsService] Auto-seed failed, falling back to static defaults:', seedErr);
        items = ALL_BOARD_RESULTS;
      }
    }

    // Sort cohorts: Class order (12th, 11th, 10th), then session/order descending
    const classWeight = { '12th': 3, '11th': 2, '10th': 1 };
    items.sort((a, b) => {
      const weightA = classWeight[a.class] || 0;
      const weightB = classWeight[b.class] || 0;
      if (weightA !== weightB) return weightB - weightA;
      return (b.session || '').localeCompare(a.session || '') || (a.order || 0) - (b.order || 0);
    });

    boardResultsCache = items;
    lastFetchTimestamp = now;
    return items;
  } catch (err) {
    console.error('[boardResultsService] fetchAllBoardResults error:', err);
    // Graceful fallback to static data
    return ALL_BOARD_RESULTS;
  }
}

/**
 * Save (create or update) a board result cohort in Firestore.
 */
export async function saveBoardResultCohort(cohortData, userEmail = 'admin') {
  if (!cohortData || typeof cohortData !== 'object') {
    throw new Error('Cohort data payload is required');
  }

  const rawId = cohortData.id || `${cohortData.class || '12th'}-${(cohortData.session || '2024-25').toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now().toString(36)}`;
  const id = String(rawId).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  const now = new Date().toISOString();

  // Normalize stats
  const summaryStats = {
    appeared: Number(cohortData.summaryStats?.appeared ?? cohortData.appeared ?? 0),
    totalEnrolled: Number(cohortData.summaryStats?.totalEnrolled ?? cohortData.appeared ?? 0),
    passed: Number(cohortData.summaryStats?.passed ?? cohortData.passed ?? 0),
    failed: Number(cohortData.summaryStats?.failed ?? cohortData.failed ?? 0),
    distinction: Number(cohortData.summaryStats?.distinction ?? cohortData.distinction ?? 0),
    firstDiv: Number(cohortData.summaryStats?.firstDiv ?? cohortData.firstDiv ?? 0),
    secondDiv: Number(cohortData.summaryStats?.secondDiv ?? cohortData.secondDiv ?? 0),
    thirdDiv: Number(cohortData.summaryStats?.thirdDiv ?? cohortData.thirdDiv ?? 0),
    overallPercent: cohortData.summaryStats?.overallPercent || cohortData.overallPercent || '0.00%'
  };

  // Re-generate indicators from stats to keep them 100% in sync
  const indicators = buildIndicatorsFromStats(summaryStats, cohortData.indicators);

  const payload = {
    id,
    class: String(cohortData.class || '12th').trim(),
    session: String(cohortData.session || '2024-25').trim(),
    examPeriod: String(cohortData.examPeriod || cohortData.session || '').trim(),
    title: String(cohortData.title || `${cohortData.class} Regular Result ${cohortData.session}`).trim(),
    category: String(cohortData.category || 'Regular').trim(),
    schoolName: String(cohortData.schoolName || 'Govt. Higher Secondary School Shangus').trim(),
    summaryStats,
    indicators,
    toppers: Array.isArray(cohortData.toppers) ? cohortData.toppers.map((t, idx) => ({
      rollNo: String(t.rollNo || '').trim(),
      name: String(t.name || '').trim(),
      studentName: String(t.studentName || t.name || '').trim(),
      parentage: String(t.parentage || '').trim(),
      result: String(t.result || 'Distinc').trim(),
      marksObt: Number(t.marksObt) || 0,
      maxMarks: Number(t.maxMarks) || 500,
      percentage: t.percentage ? String(t.percentage).trim() : `${(((Number(t.marksObt) || 0) / (Number(t.maxMarks) || 500)) * 100).toFixed(1)}%`,
      resultMarksDisplay: String(t.resultMarksDisplay || `${t.result || 'Distinc'} / ${t.marksObt || 0}`).trim(),
      stream: String(t.stream || 'Science').trim(),
      grade: String(t.grade || (Number(t.marksObt) >= 450 ? 'A1' : 'A2')).trim(),
      order: idx + 1
    })) : [],
    allCandidates: Array.isArray(cohortData.allCandidates) ? cohortData.allCandidates : [],
    updatedAt: now,
    updatedBy: userEmail || 'admin'
  };

  await setDoc(doc(db, BOARD_RESULTS_COLLECTION, id), payload, { merge: true });
  notifySync('SAVE', id);
  return payload;
}

/**
 * Delete a cohort document from Firestore.
 */
export async function deleteBoardResultCohort(id) {
  if (!id) throw new Error('Cohort ID is required for deletion');
  await deleteDoc(doc(db, BOARD_RESULTS_COLLECTION, id));
  notifySync('DELETE', id);
  return true;
}

/**
 * Seed or restore default official JKBOSE cohorts into Cloud Firestore.
 */
export async function seedDefaultBoardResults(forceOverwrite = false) {
  const batch = writeBatch(db);
  const seeded = [];
  const now = new Date().toISOString();

  for (const cohort of ALL_BOARD_RESULTS) {
    const docRef = doc(db, BOARD_RESULTS_COLLECTION, cohort.id);
    const data = {
      ...cohort,
      updatedAt: now,
      isDefaultSeed: true
    };
    batch.set(docRef, data, { merge: !forceOverwrite });
    seeded.push(data);
  }

  await batch.commit();
  notifySync('SEED', 'all');
  return seeded;
}
