# Changes Since Last Commit

## Commit Message

`perf(session-scoping): enforce current academic session 2025-26 default and load historical sessions on-demand`

## Summary

- **Enforced Current Academic Session (`2025-26`) as the Sole Default on Login**:
  - In `src/portal/admin/AdvancedReports.jsx`, updated `getDynamicRecentSessionCohort` to strictly return only `[getCurrentAcademicSession() || '2025-26']` as `defaultRecentCohort`.
  - Configured `isDefaultSession` to return `true` strictly for the current academic session (`2025-26`).
  - In the session filter dropdown, only `2025-26` is checked by default (`CURRENT`). Historical sessions (`2024-25 (Oct-Nov)`, `2024-25 (Mar-Apr)`, `2023-24`, and older cycles) remain unchecked (`ON-DEMAND` / `ARCHIVE`) and are queried only when the administrator explicitly selects them.
  - Updated the dropdown informative banner:
    `⚡ Current session active by default. Checking an archive session will prompt to load data on-demand.`
  - Updated the table header scope pill from `Scope: Recent 3 Cycles` to `Scope: Current Session`.
  - Fixed `isArchiveLoaded` to check `Boolean(window._hssMasterRegistersIsFull)` so the indicator does not prematurely display `✓ Complete 20-Year Archive Loaded` when only current session records are in memory.
- **Protected Admissions Background Sync Against Unscoped Collection Reads**:
  - In `src/services/dbCache.js`, updated `fetchFreshFromFirestore(collectionName)`: when `collectionName === 'admissions'`, it routes directly to `getAdmissionsBySession({ session: getCurrentAcademicSession(), forceRefresh: true })` instead of executing an unscoped `getDocs(collection(db, 'admissions'))`.
  - This prevents cold logins or background revalidations from scanning the entire collection, preventing spikes in Cloud Firestore read operations.

## Files Changed

1. `src/portal/admin/AdvancedReports.jsx`
2. `src/services/dbCache.js`
3. `CHANGES_SINCE_LAST_COMMIT.md`

## Verification

- `npm run test:public`: 10/10 tests passed.
- `npm run security:check`: Security regression checks passed.
- `npm run admission:check`: Admission regression checks passed.
- `npm run build`: Production build completed with `Exit Code 0` and zero breaking errors.

## Instructions for the User

1. Review the local commit:

   ```bash
   git show --stat HEAD
   git log -1 -p
   ```

2. Amend or recreate the commit if you prefer another message:

   ```bash
   git reset --soft HEAD~1
   git commit -m "Your custom commit message"
   ```

3. Manually push changes to remote repository:

   ```bash
   git push origin main
   ```
