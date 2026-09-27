# Changes Log & Commit Reference

## Current Working Changes

### 1. Default to Approved-Only in Universal Re-admission Student Finder (`AdmissionRegisterSuite.jsx`)
- **Issue Addressed:** Unapproved draft form submissions (such as stray entry `Life sciences` with Form 250001) were appearing at the top of the candidate selection list.
- **Solution:**
  - Added `candidateOnlyApproved` state (defaulting to `true`).
  - Added `isApproved` identification across current admissions, historical registers, and verified student catalog based on assigned class roll number or `status === 'Approved'`.
  - Added an interactive **`[✓ Approved Only]`** toggle button in the modal filter bar with an emerald indicator dot, allowing administrators to easily toggle between approved students and all database records.

### 2. Multi-Token Phonetic & Transliteration Search (`AdmissionRegisterSuite.jsx`)
- **Issue Diagnosed ("why certain students are not showing search here like sarwat?"):**
  - In the database and official records, the student's registered name is **`Sarvat Abbas`** (spelled with a `v`, S/o Peer Mohammad Abbas, Form `250188`, Class 12th Roll `50`).
  - The previous search only performed strict literal matching (`includes('sarwat')`). Because `v !== w`, typing `sarwat` yielded 0 results.
- **Solution:**
  - Upgraded candidate search with a multi-token transliteration and phonetic normalizer tailored for Kashmiri/Urdu names:
    - `w` $\leftrightarrow$ `v` (e.g. `sarwat` $\leftrightarrow$ `Sarvat Abbas`, `gowher` $\leftrightarrow$ `Gowher`, `parveez` $\leftrightarrow$ `Parvaiz`)
    - `mohd` / `md` $\leftrightarrow$ `moham` (e.g. `peer mohd` $\leftrightarrow$ `Peer Mohammad Abbas`)
    - `shk` $\leftrightarrow$ `sheikh`
    - `ee` $\leftrightarrow$ `i` (e.g. `mehwish` $\leftrightarrow$ `Mehvish Iqbal`, `sabreena` $\leftrightarrow$ `Sabrina`)
    - `oo` / `ou` $\leftrightarrow$ `u` (e.g. `abru` $\leftrightarrow$ `Abroo Ashraf`, `durdana` $\leftrightarrow$ `Doordana Bilal`, `mumin` $\leftrightarrow$ `Moomin Rashid Reshi`)
    - Diphthongs `aie`, `aye`, `ie`, `ei`, `ai`, `ay`, `ey` $\leftrightarrow$ `i` (e.g. `shaista` $\leftrightarrow$ `Shaiesta Parveez`)
    - `q` $\leftrightarrow$ `k` (e.g. `mukeet` $\leftrightarrow$ `Muqeet Ahmad`)
    - `ph` $\leftrightarrow$ `f` (e.g. `phaizan` $\leftrightarrow$ `Faizan`)
    - Collapsed consecutive duplicate characters (e.g. `abbas` $\leftrightarrow$ `abas`).
  - Tokenized query matching: multi-word searches (e.g. `sarwat abbas`, `sarwat 50`, `peer mohd`, `sarwat 12th`) match across student name, father name, roll number, admission number, old admission number, board registration, and class.

### 3. Automatic Historical Fallback for Old Admission Number in Brackets
- Added an automatic fallback ladder in `AdmissionRegisterSuite.jsx`:
  - When `s.oldAdmNo` is empty on the live form document, the register retrieves the historical admission number using `historicalAdmissionLookup.json` by Board Registration No, Form No, or Name + Father.
  - Correctly renders old admission numbers in brackets for re-admission candidates:
    - *Sartaj Ahmad Mir*: `5482 (4904)`
    - *Sarvat Abbas*: `5480 (4887)`
    - *Faizan Bilal Najar*: `5498 (5195)`
    - *Kifayat Jabbar Kutay*: `5503 (4809)`

---

## Files Modified
- `src/portal/admin/AdmissionRegisterSuite.jsx`
- `CHANGES_SINCE_LAST_COMMIT.md`

---

## Local Commit Message
```bash
git commit -m "feat(re-admission): filter approved students by default and add transliteration phonetic search"
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
git commit -m "feat(re-admission): filter approved students by default and add transliteration phonetic search"
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
