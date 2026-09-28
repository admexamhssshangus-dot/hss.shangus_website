# Changes Log & Commit Reference

## Current Working Changes

### 1. Register Ledger Font Size Calibration (Legibility in Print & PDF Exports)
- **Problem:**
  - Table cells in the Admission Register (dual spread Part 1 & Part 2) were rendering with minuscule, hard-to-read font sizes (4.4px–5.8px / 3.3pt–4.3pt in print media), resulting in microscopic text in PDF exports (e.g. Foxit PDF Editor at 108% zoom).
- **Resolution:**
  - In [AdmissionRegisterSuite.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/AdmissionRegisterSuite.jsx):
    - Adjusted print and screen CSS to replace 4.4px–5.8px fonts with crisp, legible 7.2px–9.0px typography across all table cells.
    - Updated helper renderers (`renderOnlineSubmCell`, `renderAdmDateCell`, `renderPenCell`, `renderAdmittedVideCell`) to render between 7.5px and 8.0px.
    - Calibrated cell line heights and max-height constraints to fit neatly within the 9.9mm–10.6mm row height budget without vertical overflow or page displacement.

### 2. Relocation of `(RE-ADM)` Label to ADM. NO. Column Below Old Adm No
- **Problem:**
  - The `(RE-ADM)` label was previously rendered inline next to the student's name in the `STUDENT'S NAME` column, cluttering the name field and causing line wraps.
- **Resolution:**
  - Moved the `(RE-ADM)` label completely out of the `STUDENT'S NAME` column and into the `ADM. NO.` column.
  - In the `ADM. NO.` column, the layout is now arranged cleanly in vertical stack:
    1. New / Current Admission Number (e.g. `5906` / `5476`)
    2. Old Admission Number enclosed in single parentheses (e.g. `(4819)` / `(4900)`)
    3. `(RE-ADM)` badge displayed directly underneath in bold, high-contrast purple font.
  - Removed the inline `(Re-Adm)` label from the student name cell while preserving the admin hover configuration button (`⚙ Edit Re-Adm`).
  - Standardized this same display pattern in [AdvancedReports.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/AdvancedReports.jsx) for the main applications ledger.

### 3. Universal Parentheses Formatting for Old Admission Numbers Across Website
- **Problem:**
  - Across certificates, exports, and tables, old admission numbers were occasionally displayed bare without parentheses or with nested/double parentheses (e.g. `((4819))`).
- **Resolution:**
  - In [jkboseResultManager.js](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/utils/jkboseResultManager.js):
    - Stripped any pre-existing parentheses before wrapping in `${resolved} (${cleanOld})`.
  - In [certificateExportUtils.js](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/utils/certificateExportUtils.js):
    - Sanitized `cleanOldAdm` and `cleanMetaOld` across single certificate interpolation, print modal, and batch export flows.
  - In [AdvancedReports.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/AdvancedReports.jsx):
    - Standardized `formatStudentAdmNo` and table cell renderers to ensure `oldAdm` is consistently enclosed in clean single brackets `(...)`.
  - In [AdmissionRegisterSuite.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/AdmissionRegisterSuite.jsx):
    - Cleaned `oldAdmNo` and `displayAdmNo` so parentheses are applied consistently without duplicate brackets.

### 4. Text Word-Wrapping & Column Width Optimization
- **Problem:**
  - Text in the `REMARKS` column was being truncated with ellipses (`...`) after 2 lines, preventing full sentences like `"Gap case, hence, readmitted for class 12th, 2026 (oct-nov session)..."` from being read.
- **Resolution:**
  - Decreased `p2_remarks` default column width from 80px to 70px to free up horizontal space for other columns.
  - Enabled multi-line word wrapping with `break-words`, `overflow-wrap: break-word`, `white-space: normal`, and `line-clamp-3` at 7.2px font size. Full remarks now wrap across up to 3 lines cleanly without cut-off.
  - Adjusted `admDate` column width from 50px to 56px to prevent date truncation (e.g. `03-01-202...`).
  - Adjusted `gender` to 40px, `class` to 44px, and `village` to 62px.
  - Added word wrapping to `name`, `father`, `mother`, `dobWords`, `village`, `p2_subs`, and `p2_prevSchool`.

---

## Files Modified
- `src/portal/admin/AdmissionRegisterSuite.jsx`
- `src/portal/admin/AdvancedReports.jsx`
- `src/utils/certificateExportUtils.js`
- `src/utils/jkboseResultManager.js`
- `CHANGES_SINCE_LAST_COMMIT.md`

---

## Local Commit Message
```bash
git commit -m "fix(register): optimize cell font sizes, relocate (RE-ADM) to adm no column, wrap remarks text, and standardize bracketed old adm no"
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
git commit -m "fix(register): optimize cell font sizes, relocate (RE-ADM) to adm no column, wrap remarks text, and standardize bracketed old adm no"
```

### To amend or edit this commit:
```bash
git reset --soft HEAD~1
# Make desired adjustments, then re-commit:
git commit -m "fix(register): optimize cell font sizes, relocate (RE-ADM) to adm no column, wrap remarks text, and standardize bracketed old adm no"
```

### Remote Push (STRICT MANUAL STEP):
- Per repository rules, the AI assistant is strictly prohibited from running `git push`.
- To push to GitHub / remote origin, run:
```bash
git push origin main
```
