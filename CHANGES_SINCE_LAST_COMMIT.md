# Changes Log & Commit Reference

## Current Working Changes (Ready for Commit)

### 1. Security Fortification (`.gitignore`)
- **Global Environment Variables Protection:** Added `**/.env*` with strict exception for template `!**/.env.example`. Prevents accidental commits of environment configurations across all subfolders (root, `functions/`, `omr_system/`, etc.).
- **Private Keys, Certificates & Service Accounts:** Explicitly blocked `**/*serviceAccount*.json`, `**/*service-account*.json`, `**/*credentials*.json`, `**/serviceAccountKey.json`, `**/client_secret*.json`, `*.pem`, `*.key`, `*.p12`, `*.pfx`, and `*.keystore`.
- **Temporary Artifacts & Backups:** Added patterns for `*.bak`, `*.orig`, `*.tmp`, `*.swp`, `*.swo`, `*~`, and `**/scratch/`.

### 2. Code Cleanup & Redundancy Removal
- **[`src/portal/teacher/TeacherDashboard.jsx`](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/teacher/TeacherDashboard.jsx):** Removed unused imports `db`, `collection`, and `getDocs` left over after migrating to `getCachedCollection`.
- **[`src/services/csvBatchManager.js`](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/services/csvBatchManager.js):** Removed unused imports (`deleteDoc`, `invalidateCache`, `logAdminActivity`) and eliminated dead local variables (`liteToStore`, `existing`, `updated`).

### 3. Agent Workflow Rules Update (`AGENTS.md` & `.agents/AGENTS.md`)
- Added Section 6 establishing the permanent protocol: maintain `CHANGES_SINCE_LAST_COMMIT.md` on every cycle, output a detailed summary with proposed commit messages, and provide clear manual review/amend instructions so the user retains full manual Git control.

---

## Suggested Commit Message
```bash
git commit -m "Fortify .gitignore security against credential leaks, purge dead imports, and document commit memory workflow"
```

---

## How to Review or Manually Manage Commits

### To review staged changes before commit:
```bash
git diff --staged
```

### If you want to commit manually:
```bash
git add .
git commit -m "Fortify .gitignore security against credential leaks, purge dead imports, and document commit memory workflow"
```

### If you want to undo/re-commit the latest local commit manually:
```bash
# Keeps all file changes intact in your working tree, un-committing the last commit:
git reset --soft HEAD~1

# You can then review, make adjustments, and manually commit:
git commit -m "Your custom commit message"
```

### To push your verified commits to remote (Manual Push Policy):
```bash
git push origin main
```

---

## Previous Commit Reference (`7577cea8`)
- **Summary:** Firebase SWR caching, read optimization, and on-demand retrievals across public pages and admin/teacher portals.
- **Key Files Modified:**
  - `src/services/staffAuthService.js` (eliminated write-on-read anti-pattern)
  - `src/portal/layout/PortalLayout.jsx` (switched session restore to cached mode)
  - `src/utils/settingsLoader.js` (20-min SWR TTL)
  - `src/components/Navbar.jsx` (30-min SWR TTL for dynamic pages)
  - `src/pages/Home.jsx` (replaced 3 continuous `onSnapshot` streaming listeners with SWR `getDoc`)
  - `src/pages/NoticeBoard.jsx`, `About.jsx`, `Academics.jsx`, `Admissions.jsx`, `DynamicPage.jsx` (instant 0ms local storage render + 15–30 min SWR revalidation)
  - `src/pages/PublicResultLookup.jsx` (removed full collection listener on `practicalsData`; scoped queries by class)
  - `src/pages/GkTestRegistration.jsx` (switched sequential full collection scans to cached/scoped lookups)
  - `src/portal/teacher/PracticalsPage.jsx` (eliminated forced zero-TTL reload; added targeted single-doc fetches)
  - `src/portal/teacher/TeacherDashboard.jsx` (routed through 15-min SWR cache)
  - `src/portal/admin/StaffPermissionsManager.jsx` (scoped user query to `isStaff == true`)
  - `src/services/staffDirectoryService.js` (added 15-min in-memory cache)
  - `src/services/dbCache.js` (routed `masterRegisters` through `getMasterRegistersScoped`)
  - `src/portal/admin/SessionArchivalModal.jsx`, `ResultIngestionModal.jsx`, `OfficialDocumentsStudioView.jsx`, `BulkFieldOverwriteModal.jsx` (switched from raw full Firestore scans to cached/scoped registers)
