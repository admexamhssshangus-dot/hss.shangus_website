# Changes Summary Since Last Commit

## Commit Summary

- **Commit Message**: `feat(database): migrate masterRegisters from chunked documents to individual flat documents with scoped queries`
- **Date**: October 05, 2026
- **Status**: Production build verified (Exit Code 0), Firestore live migration completed (6,020 individual documents created, 123 chunks archived to `masterRegisters_legacy_chunks`, legacy containers purged).

---

## Detailed Summary of Changes

### 1. Database Architecture: Flat, Queryable Documents in `masterRegisters`
- **Background & Motivation**:
  - Previously, historical student records in `masterRegisters` were stored across 123 chunk containers (`chunk_001` through `chunk_123`), each holding up to 50 students in an `items: [...]` array.
  - While chunking historically bypassed Firestore document limits, it created major operational bottlenecks: updates required rewriting 50-student arrays, concurrent edits risked race conditions, and querying any single student required downloading all 123 chunks (~2,500–6,000+ records).
- **Resolution & Live Migration**:
  - Implemented and executed `scripts/migrate_master_registers_to_flat_docs.mjs` with live `--commit`:
    - **6,020 Individual Student Documents**: Extracted from all 123 chunks and written to `masterRegisters` as top-level queryable documents.
    - **Deterministic ID Scheme**: `mr_${session}_${classKey}_(reg|form|adm|roll|sno)_${id}` ensures absolute idempotency, zero collision data loss, and seamless lookup.
    - **Zero Data Loss Archive**: All 123 original chunk documents were backed up to a dedicated `masterRegisters_legacy_chunks` collection prior to deletion.
    - **Container Cleanup**: All 123 chunk containers and 5 legacy partial documents were cleanly purged from `masterRegisters`.
    - **Transient Resilience**: Automated retry with exponential backoff for `ECONNRESET` and HTTP `429` rate limiting handled the entire live migration end-to-end.

### 2. Zero-Downtime Universal Dual-Compatibility & Scoped Queries (`src/services/dbCache.js`)
- **Dual-Format Unpacking**:
  - Enhanced `unpackMasterRegisterDoc(doc)` to transparently unpack both flat documents (`_parentDocId: null`) and legacy chunk documents (`items: [...]`), ensuring seamless zero-downtime execution.
- **On-Demand Scoped Queries (`getMasterRegistersByScope`)**:
  - Added `getMasterRegistersByScope({ session, className, stream, forceRefresh })` executing indexed queries (`where('canonicalSession', '==', session)` and `where('canonicalClass', '==', className)`).
  - Maintains `scopeMemoryCache` to prevent redundant network fetches while cutting read operations by over 95% on cohorts (~80-120 reads vs 2,500-6,000).
- **Fast Session Membership Check (`isStudentInSessionFast`)**:
  - Allows fast verification of whether a student exists in a given academic session without triggering full register downloads.
- **Cache Synchronization**:
  - `invalidateCollectionCache('masterRegisters')` and `updateCachedItem` automatically bust and update scoped caches alongside the global cache.

### 3. Direct Single-Document Mutations Across Services
- **`src/services/examineeDropService.js`**:
  - Fixed mutation path (lines 358–368) so modifications targeting flat documents in `masterRegisters` execute direct `setDoc(doc(db, 'masterRegisters', targetDocId), ...)` rather than assuming `admissions`.
- **`src/services/sessionArchivalService.js`**:
  - Exported `generateMasterRegisterDocId`.
  - Updated `archiveSessionRecords` to write individual historical documents directly using Firestore batches instead of aggregating records into array chunks.
- **`src/services/recycleBinService.js`**:
  - Added direct flat-doc fast path deletion for individual documents.
  - Added missing `getDoc` import from `firebase/firestore`.
- **`src/utils/studentDataFetcher.js`**:
  - Updated historical session fallback to pass `{ session: cleanSession }` to `getMasterRegistersScoped`.
- **Teacher Portals On-Demand Loading**:
  - `src/portal/teacher/TeacherAssessmentsPage.jsx`: Scoped to `{ session: selectedSession, className: selectedClass }`.
  - `src/portal/teacher/PracticalsPage.jsx`: Scoped to `{ session: yearSuffix, className: selectedClass }`.

---

## Files Changed

1. `scripts/migrate_master_registers_to_flat_docs.mjs` (New migration script with dry-run and live commit modes)
2. `src/services/dbCache.js` (Dual-format unpacking, `getMasterRegistersByScope`, scoped memory cache, `isStudentInSessionFast`)
3. `src/services/examineeDropService.js` (Direct `setDoc` for flat `masterRegisters` records)
4. `src/services/sessionArchivalService.js` (Exported ID generator and batched individual document archival)
5. `src/services/recycleBinService.js` (Direct flat document deletion and `getDoc` import fix)
6. `src/utils/studentDataFetcher.js` (Scoped session fallback queries)
7. `src/portal/teacher/TeacherAssessmentsPage.jsx` (Cohort-scoped master register loading)
8. `src/portal/teacher/PracticalsPage.jsx` (Cohort-scoped master register loading)
9. `CHANGES_SINCE_LAST_COMMIT.md` (Updated summary and manual commit instructions)

---

## Verification

- **Database Live Migration**:
  - `6,020` individual documents successfully committed to `masterRegisters`.
  - `123` chunk containers backed up to `masterRegisters_legacy_chunks`.
  - `128` obsolete chunk and temporary container documents purged from `masterRegisters`.
- **Production Build**:
  - `npm run build` executed with **Exit Code 0** (clean Webpack build, 11 SEO public HTML pages, sitemap, canonical routes verified).

---

## Instructions for the User

### Reviewing the Commit
To inspect the changes made in this commit:
```bash
git status
git log -1 --stat
```

### Amending or Re-committing (Optional)
If you wish to edit the commit message or modify staged files before pushing:
```bash
git reset --soft HEAD~1
# Make any additional adjustments or re-stage
git add .
git commit -m "feat(database): migrate masterRegisters from chunked documents to individual flat documents with scoped queries"
```

### Manual Push (Mandatory Policy)
As per project safety policy, AI assistants are **strictly prohibited** from running `git push`.
Please review and push your changes manually when ready:
```bash
git push origin main
```
