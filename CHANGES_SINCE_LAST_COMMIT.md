# Changes Log & Commit Reference

## Current Working Changes

### Refactored Clerk Letterhead Studio to High-Density 3-Column Layout & Removed Duplicate Clerk Labels
- **User Request Addressed:**
  - *"looks messy ...clerk label duplicate...show template on left ...preview on centre and basic formatting tools and other print,save,docx, add particular placeholder into letter on right"*

- **Implementation Details:**
  1. **Removed Redundant "Clerk" Labels ([SchoolAccountsManager.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/SchoolAccountsManager.jsx), [ClerkStaffDocumentsWorkspace.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/ClerkStaffDocumentsWorkspace.jsx)):**
     - Removed the duplicate amber `Clerk` badge from the `Official Letterhead & Staff Rosters` tab button (since the main page header already bears `Accounts & Staff Tax (ACCOUNTS CLERK)`).
     - Removed the redundant sub-bar banner (`Accounts Clerk Workspace • Scoped Dispatch`) and renamed the history tab to `Dispatch History`.

  2. **High-Density 3-Column Studio Architecture ([StaffLetterheadWriterView.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/StaffLetterheadWriterView.jsx)):**
     - **LEFT COLUMN (Template & Target Staff Picker):**
       - **Template & Ref Details:** Template dropdown with automatic dispatch reference number and date fields.
       - **Target Staff Selection:** Search bar, Category filters (`All`, `Teaching`, `Non-Teaching`), `Select All` / `Clear`, and scrollable staff list with checkboxes, designations, and CPIS codes.
       - **Signatories:** Configurable Clerk and Principal signatory titles.
     - **CENTRE COLUMN (Live A4 Preview & In-Place Document Editor):**
       - **Live Preview Switcher:** Dropdown to switch live preview across all selected staff members (`1 / X staff`).
       - **Dual Canvas Mode:** Instant toggle between `Live Preview` (interpolates real employee values) and `Edit Letter Text` (direct in-place WYSIWYG editing).
       - **Realistic A4 Paper Sheet:** Soft ice-blue official header banner with school crest (`/logo192.png`), official letterhead typography, reference bar, rendered letter body, signatory blocks, and institutional footer.
     - **RIGHT COLUMN (Actions, Formatting Tools & Placeholders):**
       - **Print & Export Actions:**
         - 🖨️ **Print Merged Letters (X)** (Bold primary button with automatic CSS page breaks between staff members).
         - 📥 **Export Word (.docx)** (Direct DOCX file export).
         - 💾 **Save Draft / Cloud History**.
         - 🕒 **View Dispatch History link**.
       - **Formatting Ribbon:** Bold, Italic, Underline, Alignments (Left, Center, Right, Justify), Bullet List, Numbered List, and Remove Formatting.
       - **Insert Placeholders:** Grouped, categorized chips (`Employee Identity`, `Salary & Bank`, `Department & Service`, `Dispatch Meta`) that insert the token (`{{name}}`, `{{cpis}}`, `{{gross_salary}}`, etc.) directly at the editor cursor on click.

  3. **Word (.docx) Export Integration ([staffLetterMergeUtils.js](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/utils/staffLetterMergeUtils.js)):**
     - Added `generateStaffLetterDocx` integrating with `generateOfficialLetterDocx` to generate native Word files from the interpolated letterhead content.

---

## Files Modified
- `src/portal/admin/SchoolAccountsManager.jsx`
- `src/portal/admin/ClerkStaffDocumentsWorkspace.jsx`
- `src/portal/admin/StaffLetterheadWriterView.jsx`
- `src/utils/staffLetterMergeUtils.js`
- `CHANGES_SINCE_LAST_COMMIT.md`

---

## Local Commit Message
```bash
refactor(portal): redesign clerk letterhead studio into 3-column layout and remove duplicate clerk labels
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
git commit -m "refactor(portal): redesign clerk letterhead studio into 3-column layout and remove duplicate clerk labels"
```

### To amend or edit this commit:
```bash
git reset --soft HEAD~1
# Make desired adjustments, then re-commit:
git commit -m "refactor(portal): redesign clerk letterhead studio into 3-column layout and remove duplicate clerk labels"
```

### Remote Push (STRICT MANUAL STEP):
- Per repository rules, the AI assistant is strictly prohibited from running `git push`.
- To push to GitHub / remote origin, run:
```bash
git push origin main
```
