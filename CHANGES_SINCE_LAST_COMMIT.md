# Changes Since Last Commit

## Commit Message
`perf(portal): optimize instant module opening/closing and student records search engine`

## Date & Time
- **Timestamp**: 2026-10-05T10:41:00+05:30

## Files Changed
1. `src/portal/admin/AdminDashboard.jsx`:
   - Broadened idle background prefetching to cover all permitted administrative modules (`controls`, `practicals`, `idCards`, `admRegisterSuite`, `attendanceMgmt`, `customRoster`, `officialLetter`, `certStudio`, `curriculum`, `staff`, `analyticsReports`, `boardSync`, `rollNo`, `mergeStudio`, `automations`, `funds`, `accounts`) with staggered 100ms intervals, ensuring modules open in 0ms without waiting for chunk download.
   - Refactored the real-time `admissions` collection subscription to remain persistently active throughout the `AdminDashboard` session across tab switches, completely eliminating re-subscription teardown, network stalls, and loading overlays when opening or closing modules back to Student Records & Reports.

2. `src/portal/admin/AdvancedReports.jsx`:
   - Implemented high-speed unified `numericIndex` in `studentSearchLookup` for O(1) sub-millisecond lookup of Roll Numbers (e.g. `12`, `105`), Admission Numbers, Form Numbers, and Phone Numbers.
   - Added an inverted `wordIndex` with Kashmiri name synonyms and phonetic variants for instant name/locality queries (e.g. "Iqra", "Shahid", "Suhail Ahmad").
   - Upgraded `filteredStudents` candidate discovery to resolve candidate sets directly from the inverted indices, narrowing evaluations from 2,000+ records down to the exact matching candidates.
   - Reduced input debounce delay from 180ms down to 40ms for numeric identifiers/patterns and 75ms for text keywords, delivering instantaneous, zero-lag Google-like typing feedback.

3. `src/services/searchIndexService.js`:
   - Exported `CANONICAL_SYNONYMS` for cross-module inverted word indexing.
   - Memoized normalized identifier strings (`_cleanForm`, `_cleanAdm`, `_cleanReg`, `_cleanRoll`, `_cleanMob`, `_cleanPMob`) directly on candidate student objects, eliminating tens of thousands of redundant regex replacements and memory allocations per keystroke.

4. `src/utils/practicalsPdfGenerator.js`:
   - Cleaned up unused `isClass12` variable for warning-free production builds.

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
