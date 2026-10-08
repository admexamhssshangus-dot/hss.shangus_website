# Changes Since Last Commit

## Commit Message

`perf(cache): unify in-memory student and session caches across admin studios to prevent redundant Firestore reads`

## Files Changed

1. **[src/services/dbCache.js](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/services/dbCache.js)**:
   - **Zero-Read Admissions Cache Check**: Updated `getAdmissionsBySession` to verify whether the target session is already present in `admissionsSessionCache` or in the in-memory sync cache (`getCachedCollectionSync('admissions')`) before issuing any Firestore query. Returns matched student cohorts instantly with 0 reads.
   - **Zero-Read Master Registers Scoped & ForceAll**:
     - Updated `getMasterRegistersScoped` for `opts.forceAll === true` to check `window._hssMasterRegistersCache` and `getCachedCollectionSync('masterRegisters')` before querying Firestore. Reuses the already-downloaded master registers archive with 0 reads.
     - Updated `getMasterRegistersByScope` to check both `window._hssMasterRegistersCache` and `getCachedCollectionSync('masterRegisters')`, deriving requested session/class/stream cohorts purely in memory with 0 reads.
   - **Shared Academic Sessions Cache (`getAcademicSessionsCached`)**: Added and exported a shared helper that fetches `academicSessions` once and caches it in memory and `sessionStorage`. Eliminates repetitive Firestore `getDocs` queries across multiple studio tabs.
   - **Cross-Module Synchronous Student Matcher (`findCachedStudentSync`)**: Added and exported a synchronous helper that scans across all in-memory collections (`admissions`, cached sessions, `masterRegisters`, and scoped queries) by ID, Reg No, or Form Number without consuming any Firestore reads.

2. **[src/services/examineeDropService.js](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/services/examineeDropService.js)**:
   - Added in-memory map check in `fetchExamineeDropOverrides(forceRefresh = false)` to return `inMemoryOverridesMap` immediately when populated. Eliminates repeated `getDoc` calls to `systemSettings/examineeDropOverrides` across studio mounts.

3. **[src/services/studentIndexService.js](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/services/studentIndexService.js)**:
   - Enhanced `lookupStudentByRegSync` to automatically rehydrate `memoryIndexCache` from `sessionStorage` or `localStorage` if not yet loaded in memory, enabling instant synchronous O(1) student identity resolution across all studios with 0 network reads.

4. **[src/portal/admin/BeneficiarySanctionOrdersView.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/BeneficiarySanctionOrdersView.jsx)**:
   - Eliminated all background network fetches on session switches.
   - Built a comprehensive `unifiedStudentsPool` strictly combining `allStudents` (passed down from `AdminDashboard`), `getCachedCollectionSync('admissions')`, and `getCachedCollectionSync('masterRegisters')`.
   - Derived `sessionStudentsPool` in memory via `useMemo` with zero network overhead.
   - Enhanced `findStudentByReg` to resolve candidates through: (1) `sessionStudentsPool`, (2) `unifiedStudentsPool`, (3) `findCachedStudentSync`, and (4) `lookupStudentByRegSync`. All single and bulk Reg No lookups execute 100% in-memory with 0 Firestore reads.
   - Cleaned up unused imports.

5. **[src/portal/admin/StudentCertificateStudioView.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/StudentCertificateStudioView.jsx)**:
   - Replaced repeated `getDocs(collection(db, 'academicSessions'))` with the shared `getAcademicSessionsCached()`, eliminating duplicate reads on mount.
   - Enhanced `fetchStudentAdmissionRecordOnDemand` to check `findCachedStudentSync` before issuing any Firestore read.

6. **[src/portal/admin/CustomRosterDocumentBuilderView.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/CustomRosterDocumentBuilderView.jsx)**:
   - Replaced repeated `getDocs(collection(db, 'academicSessions'))` with the shared `getAcademicSessionsCached()`.
   - Cached cloud fee rules in memory (`inMemoryCloudFeeRules`), eliminating repeated `getDoc(doc(db, 'systemSettings', 'rosterFeeRules'))` on component mount.

7. **[src/portal/admin/AdmissionRegisterSuite.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/AdmissionRegisterSuite.jsx)**:
   - Replaced repeated `getDocs(collection(db, 'academicSessions'))` with `getAcademicSessionsCached()`, sharing cached session metadata.

---

## Verification

- **Build Verification**: `npm run build` executed and passed with **Exit Code 0** and zero breaking errors. All 12 public static pages, sitemaps, and SEO regression checks passed cleanly.
- **Cache Integrity & Read Minimization**:
  - Root dashboard fetches current academic session data once on startup and shares it across all modules via props (`allStudents={identityStudents}`) and `dbCache`.
  - Module switching, tab mounting, session filtering, and bulk registration number queries in the Beneficiary studio and other studios operate purely against in-memory datasets and synchronous indexes with zero repetitive Firestore reads.

---

## Instructions for User: Manual Push & Inspection

1. **Inspect Commit History**:
   ```bash
   git log -n 1 --stat
   ```
2. **If You Want to Amend or Re-commit**:
   ```bash
   git reset --soft HEAD~1
   git commit -m "perf(cache): unify in-memory student and session caches across admin studios to prevent redundant Firestore reads"
   ```
3. **Push Changes Remotely (Manual Execution)**:
   ```bash
   git push origin main
   ```
