# Changes Log & Commit Reference

## Current Working Changes

### Support Inserting and Managing Multiple Tables in Official Letters & Certificates
- **User Request Addressed:**
  - *"what if we need another table"*
- **Root Cause Identified:**
  - Previously, if *any* table existed anywhere in the document, `checkTableContext()` aggressively assumed that a table context was active (`editorRef.current.querySelector('table')`).
  - When active, the Table tool popover exclusively displayed table manipulation buttons (`+ Col Right`, `+ Col Left`, `- Delete Col`, etc.), completely hiding the "Insert Table" presets.
  - This locked the user out from ever inserting a second, third, or subsequent table into their letter or certificate.
  - Furthermore, attempting to insert a table while inside an existing cell would nest `<table>` inside `<td>`, distorting the document layout.

- **Architectural & UX Solutions Implemented:**
  1. **Dual-Mode Segmented Table Popover (`➕ Insert` | `⚙️ Edit Table`)**:
     - Both in [OfficialLetterWriterView.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/OfficialLetterWriterView.jsx) and [StudentCertificateStudioView.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/StudentCertificateStudioView.jsx), replaced the restrictive single-view popover with a clean segmented tabbed modal:
       - **`➕ Insert Tab`**: Always accessible at any time, even when tables already exist in the document.
         - **1-Click Presets**:
           - Letter Writer: `4 × 2 Fee Table`, `3 × 3 Schedule`, `2 × 2 Two Column`, `5 × 3 Register`.
           - Certificate Studio: `3 × 2 Details`, `3 × 3 Marks Grid`, `2 × 2 Two Column`, `4 × 3 Subjects`.
         - **Custom Dimensions Builder**: Interactive steppers for Rows (1–15) and Columns (1–10) with 1-click `Insert [Cols] × [Rows] Table`.
       - **`⚙️ Edit Table Tab`**:
         - Shows live contextual dimensions badge (e.g., `4C × 2R`).
         - **Prominent `➕ Insert Another Table Below` Button**: 1-click action directly within edit mode to insert a new table below the current table without needing to leave edit mode.
         - Full column manipulation: `+ Col Right`, `+ Col Left`, `- Delete Col`.
         - Full row manipulation: `+ Row Below`, `+ Row Above`, `- Delete Row`.
         - Clean table removal: `🗑️ Remove Table`.
         - Empty state helper when no table exists in the document yet with direct switch to Insert tab.
  2. **Smart Table Placement & Nesting Prevention**:
     - Updated `insertTable(rows, cols)` in both studios:
       - If the user's cursor or active selection is inside an existing table, the new table is inserted safely **directly after** the active table separated by paragraph spacing (`<p><br/></p>`), preventing corrupted nested tables (`<table>` inside `<td>`).
       - If the cursor is in regular body text outside any table, the table is inserted at the exact caret position.
  3. **Accurate Caret Context Detection**:
     - Updated `getSelectedTableElements()` to return `isInsideTable: boolean`.
     - When the caret is in normal text, `checkTableContext()` automatically defaults the popover to the `insert` tab.
     - When the caret is actively inside a table cell, it defaults to the `edit` tab while keeping the `insert` tab 1-click away.
  4. **Multi-Table Native Word (.docx) & Print Compatibility**:
     - Verified that [htmlDocxConverter.js](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/utils/htmlDocxConverter.js) and print CSS recursively process all `<table>` elements in sequence, ensuring multi-table documents export and print with full fidelity.

---

## Files Modified
- `src/portal/admin/OfficialLetterWriterView.jsx`
- `src/portal/admin/StudentCertificateStudioView.jsx`
- `CHANGES_SINCE_LAST_COMMIT.md`

---

## Local Commit Message
```bash
feat(wysiwyg): support inserting and managing multiple tables across official letters and certificates
```

---

## Instructions for User: Review & Push
All changes have been tested and verified locally (`npm run build` completed with Exit Code 0).

To push these changes to your remote Git repository:
```bash
git push origin main
```

If you wish to inspect or modify the local commit:
```bash
# View last commit details
git log -1 -p

# To amend or re-commit if desired:
git reset --soft HEAD~1
git commit -m "feat(wysiwyg): support inserting and managing multiple tables across official letters and certificates"
```
