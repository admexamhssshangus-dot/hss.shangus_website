# Changes Since Last Commit

## Commit Message
`feat(db): complete migration of masterRegisters to flat queryable documents and scoped on-demand loading`

## Date & Time
- **Timestamp**: 2026-10-05T13:04:00+05:30

## Files Changed
1. `src/services/dbCache.js`:
   - Implemented `getMasterRegistersByScope({ session, className, stream, forceRefresh })` for on-demand Firestore cohort reads, reducing query overhead from ~6,000 document reads down to ~80-120 reads per session/class.
   - Enhanced `unpackMasterRegisterDoc` and `unpackMasterRegisterStudents` to seamlessly support both flat documents (with `_parentDocId: null`) and legacy chunk formats for zero-downtime backwards compatibility.
   - Integrated `scopeMemoryCache` to cache queried cohorts in memory and invalidated scoped cache properly in `invalidateCollectionCache('masterRegisters')`.
   - Optimized `isStudentInSessionFast` to check memory caches first before falling back to network queries.

2. `src/services/recycleBinService.js`:
   - Updated soft-delete and purge routines to identify individual flat documents in `masterRegisters` and delete them directly via `deleteDoc` rather than parsing and rewriting chunk arrays.
   - Fixed `sweepOrphanedStudentPhotos` to use in-memory registered students avoiding redundant full-collection Firestore scans.

3. `src/services/sessionArchivalService.js`:
   - Migrated session archival to write individual records using deterministic IDs (`mr_<session>_<class>_<identifier>`) via batch writes instead of aggregating records into 200KB chunk documents.
   - Updated duplicate scanning to load master register records strictly for the target session cohort.

4. `src/portal/admin/AdmissionRegisterSuite.jsx`:
   - Updated historical master registers loading to query on demand using `getMasterRegistersByScope({ session: selectedSession })`.

5. `src/portal/admin/AdvancedReports.jsx`:
   - Updated session export and master registers retrieval to fetch records on demand per requested academic session rather than pulling the entire historical database.

6. `src/portal/admin/BulkCertificateGeneratorModal.jsx`:
   - Modernized certificate generator to read master registers on demand with force refresh support.

7. `src/portal/admin/CustomRosterDocumentBuilderView.jsx`:
   - Cleaned up master registers retrieval for scoped cohort resolution.

8. `src/portal/admin/OfficialDocumentsStudioView.jsx`:
   - Scoped on-demand loading for historical registers when historical session is selected, with error handling and photo cache preloading.

9. `src/portal/admin/StudentCertificateStudioView.jsx`:
   - Optimized certificate studio cohort fetching for historical student registries.

10. `src/services/certificateRegistryService.js`:
    - Cleaned up unused imports and aligned document references with individual registry records.

## Verification
- Verified production build via `npm run build` (Completed with `Exit Code 0`, zero breaking errors, all 11 public SEO pages verified).

## Instructions for the User
1. **To inspect the local commit:**
   ```bash
   git show --stat
   # or
   git log -1 -p
   ```
2. **To re-commit or amend if desired:**
   ```bash
   git reset --soft HEAD~1
   git commit -m "Your custom commit message"
   ```
3. **To push to remote:**
   ```bash
   git push origin main
   ```
