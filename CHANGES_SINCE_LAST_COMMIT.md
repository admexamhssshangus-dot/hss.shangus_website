# Changes Log & Commit Reference

## Current Working Changes

### 1. Admission Register Part 1: Increased Column Data Font Size by 3 Points
- **Objective:**
  - Increase the font size by 3 points (+3pt / +3px) for data cells across the columns requested:
    1. `BOARD REG. NO.` (`st_boardReg` / `boardReg`)
    2. `STUDENT'S NAME` (`name`)
    3. `PARENTAGE`:
       - `FATHER'S NAME` (`father`)
       - `MOTHER'S NAME` (`mother`)
- **Key Enhancements in [AdmissionRegisterSuite.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/AdmissionRegisterSuite.jsx):**
  - **Screen JSX Markup:**
    - `BOARD REG. NO.` cell: Increased base font size from `text-[8px]` to `text-[11px]` (`+3px`).
    - `STUDENT'S NAME` cell: Increased name label font size from `text-[8.5px]` to `text-[11.5px]` (`+3px`).
    - `FATHER'S NAME` cell: Increased font size from `text-[8px]` to `text-[11px]` (`+3px`).
    - `MOTHER'S NAME` cell: Increased font size from `text-[8px]` to `text-[11px]` (`+3px`).
  - **Print Media Queries (`@media print`):**
    - Board Registration split/single line: Adjusted from `7.5px / 8.0px` to `10.5px / 11.0px` (`+3.0px`).
    - Candidate Name in print: Adjusted from `8.0px / 8.5px` to `11.0px / 11.5px` (`+3.0px`).
    - Father Name & Mother Name in print: Adjusted from `7.4px / 7.8px` to `10.4px / 10.8px` (`+3.0px`).
  - **Screen Media Queries (`@media screen`):**
    - Added explicit CSS rules for `td[data-col="boardReg"]`, `td[data-col="name"] > div`, `td[data-col="father"]`, and `td[data-col="mother"]` guaranteeing exact 11px and 11.5px presentation while protecting interactive buttons (such as the re-admission badge/toggle).
- **Build Verification:**
  - Verified with `npm run build` completing with `Exit Code 0` and zero breaking errors.

---

## Files Modified
- `src/portal/admin/AdmissionRegisterSuite.jsx`
- `CHANGES_SINCE_LAST_COMMIT.md`

---

## Local Commit Message
```bash
git commit -m "style(admission-register): increase font size by 3 points for board reg, student name, and parentage columns"
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
git commit -m "style(admission-register): increase font size by 3 points for board reg, student name, and parentage columns"
```

### To amend or edit this commit:
```bash
git reset --soft HEAD~1
# Make desired adjustments, then re-commit:
git commit -m "style(admission-register): increase font size by 3 points for board reg, student name, and parentage columns"
```

### Remote Push (STRICT MANUAL STEP):
- Per repository rules, the AI assistant is strictly prohibited from running `git push`.
- To push to GitHub / remote origin, run:
```bash
git push origin main
```
