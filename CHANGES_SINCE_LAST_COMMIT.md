# Changes Log & Commit Reference

## Current Working Changes

### 1. Allow Full Wrapping of Date of Birth in Words Without Truncation
- **Context & Requirement:**
  - In Part 1 of the Admission Register (`DATE OF BIRTH` -> `WORDS` column, `data-col="dobWords"`), long date-of-birth word strings (e.g. *"Twenty-Fifth of September Two Thousand Six"*, *"Twenty-Second of September Two Thousand Eight"*) were clamped to 2 lines (`line-clamp-2`).
  - This resulted in premature truncation with ellipsis (`...`) at line 2 (e.g. *"September Two Thousan..."*).
  - The user requested:
    > *"wrap dob in words correctly"*
- **Resolutions in [AdmissionRegisterSuite.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/AdmissionRegisterSuite.jsx):**
  - **Screen & Print CSS:**
    - Updated `td[data-col="dobWords"]` to allow up to 3 lines via `-webkit-line-clamp: 3` (`line-clamp-3`).
    - Adjusted font size to `7.2px` (screen/standard print) and `6.8px` (dense print 16+ per page) with tight line height (`line-height: 1.08`).
    - Added `:not([data-col="dobWords"])` exclusion to the general `.line-clamp-2` rule so it does not clamp DOB words to 2 lines.
  - **Table Body JSX:**
    - Updated `td` and inner `div` to `line-clamp-3`, `text-[7.2px]`, `leading-[1.08]`, and added `dob-words-wrap`.
- **Result:**
  - Long multi-word dates of birth now wrap cleanly over up to 3 lines within the row height, showing all words in full without trailing ellipsis (`...`) or cutoff.
- **Build Verification:**
  - Tested with `npm run build` — completed with `Exit Code 0` and zero breaking errors.

---

## Files Modified
- `src/portal/admin/AdmissionRegisterSuite.jsx`
- `CHANGES_SINCE_LAST_COMMIT.md`

---

## Local Commit Message
```bash
style(admission-register): allow 3-line wrap for dob in words to prevent truncation
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
git commit -m "style(admission-register): allow 3-line wrap for dob in words to prevent truncation"
```

### To amend or edit this commit:
```bash
git reset --soft HEAD~1
# Make desired adjustments, then re-commit:
git commit -m "style(admission-register): allow 3-line wrap for dob in words to prevent truncation"
```

### Remote Push (STRICT MANUAL STEP):
- Per repository rules, the AI assistant is strictly prohibited from running `git push`.
- To push to GitHub / remote origin, run:
```bash
git push origin main
```
