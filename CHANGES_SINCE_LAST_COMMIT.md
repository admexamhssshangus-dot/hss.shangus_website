# Changes Log & Commit Reference

## Current Working Changes

### Official Letterhead & Mail Merge Studio: Compact 2-Column Layout, Template Overwrite & Duplication

- **User Request Addressed:**
  - *"make comapct overall....arrange all controls of left and right to left in a compact manner avoiding repetition and making desing minimal..... and preview to right...allow to overwrite template and generated new after duplicating earlier adn modifying it"*

- **Detailed Changes Implemented:**
  1. **High-Density 2-Column Minimal Studio Layout ([StaffLetterheadWriterView.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/StaffLetterheadWriterView.jsx)):**
     - Replaced the previous 3-column scattered layout with a streamlined 2-column architecture:
       - **Left Panel (5 Columns)**: Consolidates all interactive controls in a compact, minimal hierarchy avoiding visual repetition.
       - **Right Panel (7 Columns)**: Dedicated, generous A4 official letterhead live canvas with comfortable margins and clear visibility.
  2. **Consolidated Left-Side Controls (Minimal & Compact):**
     - **Template Management Bar**: Template selector dropdown categorized into official and custom saved templates, accompanied by Overwrite, Duplicate, Delete, and Reset buttons.
     - **Dispatch Details**: Side-by-side Ref No & Dispatch Date inputs with a collapsible/compact signatories toggle (`Clerk / Dealing Asst` & `Principal / DDO`).
     - **Unified Actions & Formatting Ribbon**:
       - Full-width 1-click **Print Merged Letters (X Staff)** button.
       - Secondary quick actions for **Word (.docx)** and **Save Draft** archive.
       - Ultra-compact inline rich-text toolbar (Bold, Italic, Underline, Left, Center, Right, Justify, Lists, Clear).
     - **Insert Variables at Cursor**: Compact categorized variable chips (`Identity`, `Salary`, `Service`, `Dispatch Meta`) that insert directly into the editor at cursor position.
     - **Target Staff Picker**: Responsive staff search, category pills (`All | Teach | MTS`), selection counter, and compact scrollable staff list with checkboxes and CPIS.
  3. **Template Overwriting ([StaffLetterheadWriterView.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/StaffLetterheadWriterView.jsx)):**
     - Added `handleOverwriteTemplate` to save modified template body, ref pattern, and formatting into persistent `localStorage` (`hss_clerk_staff_letter_templates`).
     - Includes status indicator badges (`Edited` for customized standard templates, `Custom` for newly created templates).
     - Built-in templates can be reverted back to school official defaults anytime via "Reset".
  4. **Template Duplication & Custom Creation ([StaffLetterheadWriterView.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/StaffLetterheadWriterView.jsx)):**
     - Added "Duplicate" button opening a modal to name and clone the current letter's layout and variables.
     - Instantly creates a new custom template that is selected and ready for modifications.
     - Custom templates can be renamed, modified, overwritten, or deleted.
  5. **Enhanced Right-Side A4 Canvas:**
     - Added quick employee pagination arrows (`<` and `>`) to easily cycle through selected staff letters without reopening the dropdown.
     - Toggle between **Live Preview** (interpolated values) and **Tokens ({{vars}})**.
     - Direct in-place editing on the letterhead canvas in both modes.

---

## Files Modified
- `src/portal/admin/StaffLetterheadWriterView.jsx` (2-column layout, template overwrite & duplicate system, left-side consolidated controls)
- `CHANGES_SINCE_LAST_COMMIT.md`

---

## Local Commit Message
```bash
feat(letterhead): compact 2-column studio with left controls, right preview, template overwrite and duplication
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
git commit -m "feat(letterhead): compact 2-column studio with left controls, right preview, template overwrite and duplication"
```

### To amend or edit this commit:
```bash
git reset --soft HEAD~1
# Make desired adjustments, then re-commit:
git commit -m "feat(letterhead): compact 2-column studio with left controls, right preview, template overwrite and duplication"
```

### Remote Push (STRICT MANUAL STEP):
- Per repository rules, the AI assistant is strictly prohibited from running `git push`.
- To push to GitHub / remote origin, run:
```bash
git push origin main
```
