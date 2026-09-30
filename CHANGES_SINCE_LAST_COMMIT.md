# Changes Log & Commit Reference

## Current Working Changes

### 1. Fix Strange Vertical Digit Wrapping on Exam Roll Numbers & JKBOSE Overwrites
- **User Request Addressed:**
  - *"whenever such jkbose update is done, it shall not be strange wrapping"*
  - In Admin Table (`localhost:3000/portal/admin`), candidate exam roll numbers (e.g. `301004029` and `101060026`) were wrapping vertically digit-by-digit:
    ```
    3
    0
    1
    0
    0
    4
    0
    2
    9  [● JKBOSE]
    ```
- **Root Cause:**
  1. In `src/portal/admin/AdvancedReports.jsx`, `currExamRollNo` and `prevExamRollNo` were not included in the table cell `whitespace-nowrap` whitelist, giving their wrapper div `whitespace-normal break-words`.
  2. Because the wrapper had `min-w-0 flex-1 break-words`, when screen/column space became constrained, the browser broke the number at every single character.
  3. Default column width for `currExamRollNo` was previously set to only `90px` in `DEFAULT_1_WIDTHS`, and any saved widths in `localStorage` were also stuck at `90px`.
  4. The `<JkboseFieldBadge>` icon occupied ~48px in the cell, leaving only ~34px for a 9-digit roll number.
- **Fixes Applied in `src/portal/admin/AdvancedReports.jsx`:**
  1. **Strict `whitespace-nowrap` Protection:**
     - Added `currExamRollNo` and `prevExamRollNo` to `isNowrapCol` on line 13899 (`overflow-hidden whitespace-nowrap`).
     - Applied `whitespace-nowrap` to the inner span containing the roll number.
  2. **Integrated Inline Badge Layout:**
     - In `COLUMN_DEFS`, updated the `currExamRollNo` and `prevExamRollNo` render functions to lay out the roll number and the `<JkboseFieldBadge>` in an `inline-flex items-center justify-center gap-1.5 whitespace-nowrap` container.
     - Excluded `currExamRollNo` and `prevExamRollNo` from the outer flex-between badge check so the badge and roll number are permanently anchored together on the same horizontal line.
  3. **Expanded Minimum Column Width:**
     - Increased default width from `90px` to `145px` in `DEFAULT_1_WIDTHS.currExamRollNo` (and `120px` for `prevExamRollNo`).
     - Added hard floor enforcement in table header `<th>` and cell `<td>` via `Math.max(configuredWidth, 145)` (and `120px` for `prevExamRollNo`).
     - In `useState` for `colWidths`, added automatic self-healing logic so any legacy widths stored in the user's `localStorage` below 145px are instantly upgraded.
     - Updated column resize drag limits (`minColWidth = 135` for `currExamRollNo`, `110` for `prevExamRollNo`).

---

## Files Added / Modified
- `src/portal/admin/AdvancedReports.jsx` (Modified)
- `CHANGES_SINCE_LAST_COMMIT.md` (Modified)

---

## Local Commit Message
```bash
fix(reports): eliminate vertical digit wrapping on exam roll numbers with inline jkbose badge layout
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
git commit -m "fix(reports): eliminate vertical digit wrapping on exam roll numbers with inline jkbose badge layout"
```

### Manual Push (Mandatory Policy):
Per project rules, automatic remote pushes are strictly disabled. When you are ready to publish these changes to remote, please run:
```bash
git push origin main
```
