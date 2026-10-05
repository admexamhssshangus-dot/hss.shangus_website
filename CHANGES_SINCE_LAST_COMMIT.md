# Changes Since Last Commit

## Commit Message
`fix(master-register): complete individual-document migration`

## Date & Time
- **Timestamp**: 2026-10-05T20:19:46+05:30

## Migration Summary
- Completed the transition from chunked `masterRegisters` documents to one Firestore document per application/student record across client data access, server fallbacks, and administrative workflows.
- `getMasterRegistersScoped({ forceAll: true })` now genuinely reads the complete `masterRegisters` collection and marks the cache as fully hydrated. Normal master-register reads no longer attempt to unpack `items`, `students`, `records`, or `data` arrays.
- Certificate issuing/revoking, examinee dropping, recycling, and result editing now update or delete the exact physical source document in `masterRegisters` rather than writing to an admissions fallback or mutating a legacy chunk.
- Bulk certificates, field overwrite, result ingestion, session archival, roster/document builders, GK registration, and advanced reports now consume individual master-register documents and force a complete dataset where their workflow requires one.
- Server-side admission/public-record and academic-cohort fallbacks now query and return flat master-register documents by their exact IDs.
- Updated user-facing archival language to describe individual permanent master-register documents.

## Files Changed
1. `functions/academicData.js`
2. `netlify/functions/admission-workflow.js`
3. `netlify/functions/lib/publicRecords.js`
4. `src/pages/GkTestRegistration.jsx`
5. `src/portal/admin/AdvancedReports.jsx`
6. `src/portal/admin/BulkCertificateGeneratorModal.jsx`
7. `src/portal/admin/BulkFieldOverwriteModal.jsx`
8. `src/portal/admin/CustomRosterDocumentBuilderView.jsx`
9. `src/portal/admin/OfficialDocumentsStudioView.jsx`
10. `src/portal/admin/ResultIngestionModal.jsx`
11. `src/portal/admin/SessionArchivalModal.jsx`
12. `src/portal/admin/StudentResultEditorModal.jsx`
13. `src/services/certificateRegistryService.js`
14. `src/services/certificateRegistryService.test.js`
15. `src/services/dbCache.js`
16. `src/services/examineeDropService.js`
17. `src/services/recycleBinService.js`
18. `src/services/sessionArchivalService.test.js`
19. `CHANGES_SINCE_LAST_COMMIT.md`

## Verification
- `npm run build`: completed successfully with exit code 0.
- `npm test -- --watchAll=false src/services/certificateRegistryService.test.js src/services/sessionArchivalService.test.js`: 2 suites passed; 25 tests passed.
- `npm run test:public`: 9 tests passed.
- `git diff --check`: completed without whitespace errors.
- Verified the configured Firestore database is Native mode, Standard edition. No Firestore or Storage security rules were changed, so no rules deployment was required.

## Instructions for the User
1. **Review the local commit:**
   ```bash
   git show --stat HEAD
   git log -1 -p
   ```
2. **Amend or re-commit it if desired:**
   ```bash
   git reset --soft HEAD~1
   git commit -m "Your custom commit message"
   ```
3. **Push manually when ready:**
   ```bash
   git push origin main
   ```
