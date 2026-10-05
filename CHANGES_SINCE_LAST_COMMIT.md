# Changes Since Last Commit

## Commit Message
`fix(practicals): secure submissions and defer data reads`

## Date & Time
- **Timestamp**: 2026-10-05T20:54:38+05:30

## Production Safety and Practicals Changes
- Teacher practical and assessment submissions can no longer fall back to direct Firestore writes when the secure staff backend is unavailable. A local draft is kept in the browser before a save attempt, so a failed secure request does not delete entered marks.
- The server-side academic-record workflow now accepts the portal's pending document IDs, stores drafts as drafts and final teacher submissions as `pending_approval`, records the canonical document ID, and validates both global and class-level submission locks.
- A closed global practicals switch rejects teacher writes without deleting existing data. Class-specific submission windows are also enforced server-side.
- Firestore rules now allow only administrators to write practical award documents, practical version bins, recycle-bin records, and practical settings. Teachers keep their confidential read access but must use the verified backend to submit.
- Added a targeted real-time listener to teacher practicals pages so an open browser tab locks immediately when an administrator disables practical submissions.

## Performance and On-Demand Loading Changes
- Teacher Practicals now loads only the selected master-register cohort and its exact canonical/pending award documents. It no longer downloads the entire practicals or admissions collection while opening an award sheet.
- Teacher submission history is queried only after the history drawer is opened, filtered to the current teacher, rather than prefetched on portal mount.
- Admin Practicals suspends its practicals listeners and refresh activity while its keep-alive dashboard tab is hidden, preserving fast tab switching without continued background reads.
- Admin Practicals now uses the individual 2025-26 master-register documents directly instead of the old chunk-array shape or a full admissions download.

## Files Changed
1. `firestore.rules`
2. `functions/academicRecords.js`
3. `scripts/backend-integrity.test.cjs`
4. `scripts/security-behavior.test.cjs`
5. `src/portal/admin/AdminDashboard.jsx`
6. `src/portal/admin/AdminPracticals.jsx`
7. `src/portal/teacher/PracticalsPage.jsx`
8. `src/services/academicRecordService.js`
9. `CHANGES_SINCE_LAST_COMMIT.md`

## Verification and Deployment
- `npm run build`: completed successfully; the generated `build/index.html` was verified.
- `npm run performance:check`: passed.
- `npm run test:public`: 9 tests passed.
- Focused `PracticalsPage` regression test completed without errors.
- `git diff --check`: completed without whitespace errors.
- `node --check functions/academicRecords.js`: passed.
- `npm run test:integrity` could not start its local Firestore emulator because this machine has a JDK older than Firebase's required JDK 21. This does not affect the deployed Firestore service.
- Firestore rules were compiled and released successfully to production project `hsssdb` on 2026-10-05.
- A full Netlify production deployment was not performed because it replaces the entire live site and requires the user's explicit approval. The live rules already prevent direct teacher writes; deploy the verified build and Netlify backend together before reopening practical submissions.

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
3. **Deploy the verified site and Netlify staff backend after explicit approval:**
   ```bash
   netlify deploy --prod --dir=build --message "Secure practicals writes and on-demand data loading"
   ```
4. **Push the Git commit manually when ready:**
   ```bash
   git push origin main
   ```
