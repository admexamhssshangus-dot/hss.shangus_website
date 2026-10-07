# Changes Since Last Commit

## Commit Message

`fix(results): update home pass rate to 75%+, standardize science stream and clean mar-apr 10th roster`

## Summary

- **Homepage Statistical Summary Card (`src/pages/Home.jsx`)**:
  - Updated the **`RESULT`** card (`Board Pass Rate`) counter endpoint from `90%+` to **`75%+`** (`end: 75`, `suffix: "%+"`) to accurately reflect overall school board evaluation pass rate.

- **Standardized Science Stream across Results (`src/data/classBoardResults.js` & `src/components/ClassBoardResultsSection.jsx`)**:
  - Replaced stream label `Medical` with **`Science`** across all Class 11th and Class 12th board result toppers and evaluation tables.
  - Added frontend rendering rule in `ClassBoardResultsSection.jsx` ensuring any historical `Medical` stream record displays uniformly as `Science`.

- **Refined Class 10th Regular 2024-25 (Mar-Apr) Results (`src/data/classBoardResults.js` & `src/services/achievementsService.js`)**:
  - Removed 4th topper Muzamil Imtiyaz Bond (Roll `101059004`, 403 marks, Grade A2) from the cohort's `toppers` array, retaining strictly the top 3 toppers (Ahytisham Ishaq Ganie, Muneeb Tariq Allie, Hamid Manzoor Bhat).
  - Removed the incomplete partial candidate roster list (`allCandidates`) from `10th Result Regular 2024-25 (Mar-Apr)`, eliminating the *"View all 5 candidates roster"* expander.
  - Removed `ach_10th_2025_4` from `DEFAULT_ACHIEVEMENTS` in `achievementsService.js` to match the 3-topper standard.

## Files Changed

1. `src/pages/Home.jsx`
2. `src/data/classBoardResults.js`
3. `src/components/ClassBoardResultsSection.jsx`
4. `src/services/achievementsService.js`
5. `CHANGES_SINCE_LAST_COMMIT.md`

## Verification

- `npm run build`: Production build succeeded with Exit Code 0 and generated all 12 public pages with SEO regression validation.
- `npm run test:public`: 10/10 security, public verification, and administrative tests passed.

## Manual Git Push Instructions

1. Inspect the local commit:
   ```bash
   git log -1 --stat
   ```
2. If you wish to amend or re-commit:
   ```bash
   git reset --soft HEAD~1
   git commit -m "fix(results): update home pass rate to 75%+, standardize science stream and clean mar-apr 10th roster"
   ```
3. Push changes to GitHub (strictly manual):
   ```bash
   git push origin main
   ```
