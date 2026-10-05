# Changes Since Last Commit

## Commit Message
`fix(practicals): eliminate infinite recursion in scoped masterRegisters query and add safety timeout to loading state`

## Date & Time
- **Timestamp**: 2026-10-05T13:48:00+05:30

## Files Changed
1. `src/services/dbCache.js`:
   - **Resolved Infinite Async Recursion**: Removed the fallback loop in `getMasterRegistersByScope` that triggered infinite recursion when a requested cohort returned 0 documents (e.g. querying `session: '2024-25'` in `masterRegisters`, which only houses historical records up to `2023-24` while `2024-25` is in `admissions`).
   - Any scope returning 0 documents from Firestore now safely caches `[]` into `scopeMemoryCache` and returns immediately (0 extra reads, 0 recursion).
   - Set the default fallback cohort for historical registries in `getMasterRegistersScoped` to `'2023-24'`.

2. `src/portal/admin/AdminPracticals.jsx`:
   - Aligned the historical register query in `loadData` to request `{ session: '2023-24' }` (the latest historical cohort in `masterRegisters`), avoiding empty queries.
   - Fixed destructuring for the 6 promises in `Promise.all` (`dropOverrides` was missing from array destructuring).
   - Added a 7-second safety fallback timer (`safetyTimer`) that automatically clears `loading` to guarantee the portal interface never stays perpetually stuck on "Loading practical records...".

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
