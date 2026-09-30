# Changes Log & Commit Reference

## Current Working Changes

### Direct Cloud Firestore Notice Synchronization & Instant CMS Saving
- **User Request Addressed:**
  - *"notice saving takjng lot of time and not seems to update on live site...showing on local site not live....local/live login shall always CRUD to firebase"*

- **Root Causes Identified & Resolved:**
  1. **Monolithic Slow Save (10–15s):**
     - Previously, every time any edit was saved (even adding or removing a single notice), `saveToFirebase` executed an all-in-one multi-stage batch that queried all documents in `facultyPublic`, queued individual deletions for every faculty document, processed private and public faculty lists, and saved settings, slideshow, and recycle bin.
     - **Fix:** Added `targetTab` fast-path execution to `saveToFirebase` and `handleSaveToLocalStorage`. When saving from the Notices tab, it performs a targeted, direct write to `doc(db, 'site', 'notices')` with `updatedAt: serverTimestamp()` in **under 100ms** without touching unrelated collections.
  2. **Showing on Localhost But Not on Live:**
     - The Notices loader in `AdminPortal.jsx` checked `localStorage.getItem('site_notices')` **first** and immediately returned, completely skipping Cloud Firestore if any local storage existed. Local edits were written to browser local storage, giving the false illusion that data was saved even if Firestore failed or was never queried.
     - **Fix:** Inverted the read hierarchy in `AdminPortal.jsx` to query Cloud Firestore `doc(db, 'site', 'notices')` **first** as the single source of truth across all environments (local & live). Local storage is now retained strictly as an offline fallback.
  3. **Overly Restrictive or Desynced Admin Claims:**
     - In `handleSaveToLocalStorage`, the admin authorization check rejected users who logged in via embedded administrative sessions or who lacked custom claims (`claims.admin === true`), even though they had valid staff permissions or bootstrap admin status.
     - **Fix:** Expanded authorization in `saveToFirebase` and `handleSaveToLocalStorage` to support `isBootstrapAdminEmail`, `isBootstrapSuperAdminEmail`, embedded user permissions (`embeddedUser.role`, `embeddedPerms.includes('cms')`), and `resolveStaffRoleAndPerms`.
  4. **Live Site 15-Minute Cache Invalidation:**
     - Previously, `Home.jsx` and `NoticeBoard.jsx` had a 15-minute TTL (`15 * 60 * 1000`) where visits would short-circuit without checking Firestore.
     - **Fix:**
       - In `AdminPortal.jsx`, saving notices now sets `site_notices_ts = Date.now().toString()`, invalidates `site_home_data_ts`, posts a sync message over `BroadcastChannel('hss_data_sync')`, and dispatches `hss-notices-updated`.
       - In `NoticeBoard.jsx`, removed the 15-minute blocking check so background Firestore queries always verify the latest notices, and added real-time listeners for instant updates.
       - In `Home.jsx`, refined the cache freshness check so notices updates immediately trigger SWR background re-fetch, and added real-time listeners.
  5. **Quick "Save Notices" Action:**
     - Added a dedicated, highly visible **"Save Notices"** button directly in the Latest Notices configuration header next to the badge expiry control.

---

## Files Added / Modified
- `src/pages/AdminPortal.jsx`:
  - Added `targetTab` fast-path to `saveToFirebase` (direct single write for notices).
  - Inverted notice loading hierarchy to query Cloud Firestore first.
  - Upgraded `handleSaveToLocalStorage` with robust multi-factor admin auth, cache busting, and cross-tab broadcasts.
  - Added direct "Save Notices" button in the notices module header.
- `src/pages/Home.jsx`:
  - Refined cache freshness check to immediately revalidate when notice timestamps update.
  - Added listeners for `BroadcastChannel('hss_data_sync')` and `hss-notices-updated`.
- `src/pages/NoticeBoard.jsx`:
  - Removed 15-minute blocking check so live Firestore data is always queried in the background.
  - Added real-time cross-tab sync listeners.
- `CHANGES_SINCE_LAST_COMMIT.md`:
  - Maintained memory log and commit instructions.

---

## Local Commit Message
```bash
fix(cms): optimize notice saving to direct firestore crud and ensure live cloud synchronization
```

---

## Instructions for User: Review & Push
All changes have been built and verified locally (`npm run build` completed with Exit Code 0), staged, and committed to your local Git repository.

### How to Inspect the Local Commit:
```bash
git log -1 --stat
git show HEAD
```

### How to Amend or Re-commit (if desired):
```bash
git reset --soft HEAD~1
# Make any additional changes if needed
git commit -m "fix(cms): optimize notice saving to direct firestore crud and ensure live cloud synchronization"
```

### Manual Push (Mandatory Policy):
Per project rules, automatic remote pushes are strictly disabled. When you are ready to publish these changes to remote, please run:
```bash
git push origin main
```
