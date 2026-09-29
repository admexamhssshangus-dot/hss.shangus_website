# Changes Log & Commit Reference

## Current Working Changes

### Student Rosters & Registers: Full Customization of Header, Title, Banner, Metadata Labels & Signatures
- **User Request Addressed:**
  - *"allow to customise everything in header/title of Student Rosters & Registers"*
- **Reference Screenshot Elements Controlled:**
  1. Top institutional banner: `Govt. Higher Secondary School Shangus, Anantnag` (previously hardcoded in gray box).
  2. Centered sheet title: `DAILY ATTENDANCE SHEET` (underlined, font-black).
  3. Dotted metadata grid: `Name of the Examination`, `Year`, `Class`, `Date`, `Subject`, `Paper`.
  4. Centre No. / Venue metadata.
  5. Superintendent signatures: `Sig. of the Asstt. Supdt.` & `Sig. of the Centre Supdt.`.
  6. Standard multi-column register letterhead: `GOVERNMENT HIGHER SECONDARY SCHOOL SHANGUS`, location/U-DISE line, register title, subtitle, and cohort badges.

---

### Implementation Breakdown

1. **Enhanced Quick Examination Attendance Setup Toolbar ([CustomRosterDocumentBuilderView.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/CustomRosterDocumentBuilderView.jsx)):**
   - Added instant controls directly inside the Quick Setup Toolbar located directly above the preview sheet:
     - **Institution Banner Text input** + **Shown / Hidden toggle button** (`showAttendanceInstBanner`).
     - **Sheet Title input** (`docTitle`) + **Underlined / Plain toggle button** (`attendanceTitleUnderline`).
     - **Centre No. / Venue input** (`attendanceCentre`, placeholder `e.g. 6112 or Centre A`).
     - **⚡ Labels, Themes & Supdt. expandable drawer** (`showAttendanceAdvanced`):
       - Editable field labels for `Exam Name`, `Year`, `Class`, `Date`, `Subject`, `Paper`, and `Centre No.`
       - Banner theme selector: Classic Slate (`#cbd5e1`), Clean White, Warm Amber (`#fef3c7`), Soft Indigo (`#e0e7ff`).
       - Editable signature titles for both Assistant and Centre Superintendents.
       - One-click **Reset Defaults** button.

2. **Dedicated Collapsible Setup Drawer ([CustomRosterDocumentBuilderView.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/CustomRosterDocumentBuilderView.jsx)):**
   - Added `# Setup` buttons in the top toolbar (visible on desktop and mobile) and connected the external sub-nav trigger via `OfficialDocumentsStudioView.jsx`.
   - Adaptive drawer UI:
     - **2-Column Attendance Mode**: Complete controls for Banner text, visibility toggle, theme selector, Sheet title, underline toggle, and superintendent signature titles.
     - **Standard Roster Mode**: Complete controls for Institution Name, visibility toggle, Subtitle/Address, Document Title, Subtitle, Cohort Badges toggle, and Signatories (Signatory 1 & 2 titles with visibility toggle).
   - Saved and synchronized across browser sessions via `localStorage`.

3. **Live Canvas Preview Synchronization ([CustomRosterDocumentBuilderView.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/CustomRosterDocumentBuilderView.jsx)):**
   - **2-Column Attendance Sheet**:
     - Dynamic banner box with selected color theme, respecting `showAttendanceInstBanner`.
     - Dynamic title with conditional underline.
     - Dotted metadata grid with custom labels and optional Centre No.
     - Superintendent signature blocks with custom titles.
   - **Standard Roster Sheet**:
     - Dynamic letterhead header respecting `showHeader`.
     - Dynamic institution name, subtitle, document title, subtitle, and badges.
     - Dynamic bottom signatories respecting `showSignatories` (cleanly right-aligned when only 1 signatory is enabled).

4. **HTML Print Engine & Spreadsheet Export ([customRosterExportUtils.js](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/utils/customRosterExportUtils.js)):**
   - `buildTwoColumnAttendanceHtml`: dynamically renders custom banner text, theme background colors, title underline, custom field labels, centre number, and superintendent signature titles.
   - `printCustomRosterTable`: dynamically renders custom institution header, subtitles, and badges for standard roster mode.
   - `exportCustomRosterExcel`: exports dynamic banner and custom labels in 2-column mode.

5. **Word (.docx) Export Engine ([customRosterDocxGenerator.js](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/utils/customRosterDocxGenerator.js)):**
   - `generateTwoColumnAttendanceDocx`: generates Word document with custom banner text, XML cell shading matching banner theme, custom title underline, custom field labels, centre number, and superintendent signatures.
   - Standard mode: renders custom institution letterhead and document titles in Word tables.

6. **Parent Sub-Nav Forwarding ([OfficialDocumentsStudioView.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/OfficialDocumentsStudioView.jsx)):**
   - Forwarded `showSettingsDrawerProp` and `onToggleSettingsDrawer` to `CustomRosterDocumentBuilderView` so the top sub-nav bar `# Setup` toggle triggers the drawer seamlessly.

---

## Files Modified
- `src/portal/admin/CustomRosterDocumentBuilderView.jsx`
- `src/portal/admin/OfficialDocumentsStudioView.jsx`
- `src/utils/customRosterExportUtils.js`
- `src/utils/customRosterDocxGenerator.js`
- `CHANGES_SINCE_LAST_COMMIT.md`

---

## Local Commit Message
```bash
feat(roster-studio): allow full customization of header, title, banner, and labels in student rosters and attendance sheets
```

---

## Instructions for User: Review & Push
All changes have been built and verified locally (`npm run build` completed with Exit Code 0).

To push these changes to remote GitHub:
```bash
git push origin main
```

If you wish to inspect or modify the commit before pushing:
```bash
# View last commit details
git log -1 -p

# To amend or re-commit if desired:
git reset --soft HEAD~1
git commit -m "feat(roster-studio): allow full customization of header, title, banner, and labels in student rosters and attendance sheets"
```
