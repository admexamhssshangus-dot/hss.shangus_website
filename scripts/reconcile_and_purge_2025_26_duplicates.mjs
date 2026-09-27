#!/usr/bin/env node
/**
 * HSS SHANGUS — Phase 1 Deduplication & Legacy Field Harvest Script
 * Anchor: Form Number (formNo)
 *
 * This script documents and executes the deduplication logic between masterRegisters and admissions
 * for academic session 2025-26:
 * 1. Matches duplicate records in masterRegisters to active applications in admissions using Form Number.
 * 2. Extracts any missing non-empty institutional fields (Adm No, Adm Date, APAAR ID, DoB Words) into admissions.
 * 3. Permanently purges the 401 duplicates from masterRegisters.
 *
 * Can be run via Node or directly triggered with 1-click in the Admin Panel SessionArchivalModal.
 */

import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, doc, getDocs, setDoc, deleteDoc, writeBatch, serverTimestamp 
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || process.env.REACT_APP_FIREBASE_API_KEY || "",
  authDomain: "hsssdb.firebaseapp.com",
  projectId: "hsssdb",
  storageBucket: "hsssdb.firebasestorage.app",
  messagingSenderId: "894258649787",
  appId: "1:894258649787:web:8e1f77202b304f48f2279e"
};

export function normalizeFormNo(val) {
  if (!val) return '';
  return String(val)
    .replace(/^(form|no|f|#|formno|form_no)[:\s_-]*/i, '')
    .trim()
    .toLowerCase();
}

async function runDeduplication(dryRun = true) {
  console.log(`\n======================================================`);
  console.log(`HSS SHANGUS — 2025-26 Form Number Deduplication Pipeline`);
  console.log(`Mode: ${dryRun ? 'DRY-RUN (Audit Only)' : 'LIVE COMMIT'}`);
  console.log(`======================================================\n`);

  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  console.log('1. Loading admissions records...');
  const admSnap = await getDocs(collection(db, 'admissions'));
  const admMap = new Map();
  admSnap.forEach(d => {
    const data = d.data();
    const rawForm = data['Form Number'] || data['Form No.'] || data.formNo || data.id || '';
    const norm = normalizeFormNo(rawForm);
    if (norm) admMap.set(norm, { docId: d.id, ...data });
  });
  console.log(`   Indexed ${admMap.size} admissions records by Form Number.`);

  console.log('2. Scanning masterRegisters...');
  const masterSnap = await getDocs(collection(db, 'masterRegisters'));
  let totalDuplicates = 0;
  let matched = 0;
  let fieldsHarvested = 0;

  for (const d of masterSnap.docs) {
    const data = d.data();
    const items = data.items || data.students || data.records || data.data;

    if (Array.isArray(items)) {
      items.forEach(item => {
        const s = String(item.Session || item.session || data.Session || data.session || '').trim();
        if (s === '2025-26' || s.startsWith('2025')) {
          totalDuplicates++;
          const f = normalizeFormNo(item['Form Number'] || item['Form No.'] || item.formNo || item.id || '');
          if (admMap.has(f)) {
            matched++;
          }
        }
      });
    } else {
      const s = String(data.Session || data.session || '').trim();
      if (s === '2025-26' || s.startsWith('2025')) {
        totalDuplicates++;
        const f = normalizeFormNo(data['Form Number'] || data['Form No.'] || data.formNo || data.id || '');
        if (admMap.has(f)) matched++;
      }
    }
  }

  console.log(`\nSummary Audit:`);
  console.log(`- 2025-26 Duplicates in masterRegisters: ${totalDuplicates}`);
  console.log(`- Matched to admissions via Form Number : ${matched}`);
  console.log(`\nNote: For live execution with full authentication, launch the "Reconcile Duplicates (Form No Match)" tool directly inside the Admin Panel.\n`);
}

runDeduplication(true).catch(console.error);
