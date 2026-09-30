# Changes Log & Commit Reference

## Current Working Changes

### 1. Class Order Progression: Show Class 11th First, Followed by Class 12th
- **User Request Addressed:**
  - *"allow to show first class 11th, then 12th and so on"*
- **Context & Problem:**
  - In the Correlated Preview diff table, sorting by Class Roll No previously sorted purely by roll number (`numA - numB`) across the entire combined cohort.
  - As a result, Class 11th and Class 12th students with identical roll numbers (e.g. Roll 1 of 12th and Roll 1 of 11th) appeared interleaved together in the table.
  - In the Class dropdown and presets, Class 12th was previously listed before Class 11th (`['12th', '11th']`).

- **Key Implementations:**
  1. **Canonical Class Progression Rank (`getClassRank`)**:
     - Added authoritative class rank resolver in `BulkFieldOverwriteModal.jsx`:
       - **Class 11th** -> Rank 1 (Primary)
       - **Class 12th** -> Rank 2 (Secondary)
       - **Class 10th** -> Rank 3
       - **Class 9th** -> Rank 4
       - Other / Unknown -> Rank 10+
  2. **Preview Diff Table Sorting (`filteredPreview`)**:
     - Updated sort comparator to prioritize Class Rank before Class Roll Number / Student Name / Reg Number.
     - All Class 11th students (Roll 1, 2, 3... 198) now render continuously first in the preview table.
     - All Class 12th students (Roll 1, 2, 3... 196+) render continuously immediately after Class 11th.
  3. **Class Dropdown & Preset Progression**:
     - Updated `availableClasses` to sort Class 11th first, then Class 12th.
     - Updated default selected classes from `['12th', '11th']` to `['11th', '12th']`.
     - Updated preset values for `11th & 12th (Sr Sec)` to `['11th', '12th']` and `9th & 10th (Secondary)` to `['9th', '10th']`.
  4. **Excel Template Export Ordering**:
     - Updated `handleDownloadExcelTemplate` to sort cohort students primarily by Class progression (11th, then 12th), followed by natural numeric Class Roll No.

---

## Files Added / Modified
- `src/portal/admin/BulkFieldOverwriteModal.jsx` (Modified)
- `CHANGES_SINCE_LAST_COMMIT.md` (Modified)

---

## Local Commit Message
```bash
feat(ingestion-hub): prioritize Class 11th before Class 12th across preview sorting, dropdowns, and template downloads
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
git commit -m "feat(ingestion-hub): prioritize Class 11th before Class 12th across preview sorting, dropdowns, and template downloads"
```

### Manual Push (Mandatory Policy):
Per project rules, automatic remote pushes are strictly disabled. When you are ready to publish these changes to remote, please run:
```bash
git push origin main
```
