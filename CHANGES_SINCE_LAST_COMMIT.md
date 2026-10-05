# Changes Since Last Commit

## Commit Message
`feat(portal): scope masterRegisters queries in teacher attendance, practicals, and public lookup, and retire legacy chunk containers`

## Date & Time
- **Timestamp**: 2026-10-05T13:35:00+05:30

## Files Changed
1. `src/portal/admin/AdminPracticals.jsx`:
   - Scoped `masterRegisters` query to academic cohort `2024-25` via `getMasterRegistersScoped({ session: '2024-25', forceRefresh: force })` instead of loading the unconstrained historical collection.
   - Enhanced student name detection for flat master register documents (`StudentName`, `Student's Name`, `Student's Name (as per school records)`, `studentName`, `name`).

2. `src/portal/teacher/AttendancePage.jsx`:
   - Replaced unconstrained `getCachedCollection('masterRegisters')` calls with scoped queries:
     - Active session student lookup: `getMasterRegistersScoped({ session: '2025-26', className: selectedClass })`
     - Historical session student lookup: `getMasterRegistersScoped({ session: selectedSession, className: selectedClass })`
     - Report fallback resolution: `getMasterRegistersScoped({ session: reportSession, className: reportClass })`
   - Drastically eliminates redundant Firestore read overhead when loading class attendance rosters.

3. `src/pages/PublicResultLookup.jsx`:
   - Scoped staff fallback candidate search using `getMasterRegistersScoped({ session: selectedSession, className: targetClsKey })` rather than fetching all master registers across all 20 historical sessions.

4. Firestore Migration & Legacy Chunk Container Retirement:
   - Backed up all 123 legacy `chunk_...` documents safely to `masterRegisters_legacy_chunks` in batches of 5 to respect Firestore commit payload limits.
   - Deleted all 123 legacy chunk documents and 4 legacy partial documents from `masterRegisters`.
   - Verified live in Firestore that `masterRegisters` now strictly contains all 6,020 flat individual student records (`mr_<session>_<class>_<identifier>`) with zero legacy chunk containers remaining.

## Verification
- Verified production build via `npm run build` (Completed with `Exit Code 0`, zero breaking errors, all 11 public SEO pages verified).
- Verified Firestore collection state live via Google Cloud Datastore / Firestore REST API.

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
