# Changes Log & Commit Reference

## Current Working Changes

### 1. Student Certificates Studio: Setup Controls for Left Signatory & Institute Subtext
- **User Request Addressed:**
  - *"allow this too to control in setup of Student Bonafides & Certificates"* (referencing the Incharge Admissions & Exam signature block).
- **Implementation Details ([StudentCertificateStudioView.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/StudentCertificateStudioView.jsx)):**
  1. **Show/Hide Toggle for Left Signatory (`Incharge Admissions & Exam`):**
     - Added a direct toggle switch on the `Signatory 1 (Left)` field in the Setup Drawer (`Shown / Hidden`). When hidden, the text field is disabled and dimmed.
     - Added an `Incharge Signatory (Left)` checkbox toggle in the Setup Drawer's top `Options` bar alongside `Seal Watermark`, `Photo Box`, and `Mr. / Mrs. Titles`.
     - When unchecked, the entire left signature block (rule line, title, and institute subtext) is completely removed from the certificate preview canvas, and the Principal's signature on the right smoothly aligns to the right (`ml-auto`).
  2. **Configurable Signatory Institute Subtext:**
     - Added a new `Signatory Subtext / Institute` field in the Setup Drawer (defaulting to `'Govt. HSS Shangus'`), replacing the previously hardcoded institution string beneath all signatures.
  3. **State Persistence & Template Integration:**
     - Persisted `showLeftSignatory` and `signatorySubtext` in `localStorage` (`hss_certificate_show_left_signatory` and `hss_certificate_signatory_subtext`).
     - Integrated `showLeftSignatory` and `signatorySubtext` into custom template saving (`handleSaveAsTemplate`), overwriting (`handleQuickUpdateTemplate`), and template selection (`handleSelectTemplate`).
  4. **Bulk Generation Synchronization:**
     - Passed dynamic `signatories` directly to `BulkCertificateGeneratorModal` so bulk certificate jobs respect the configured signatory count.

---

### 2. Export Synchronization: PDF Print & Word (.docx) Export
- **Implementation Details ([certificateExportUtils.js](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/utils/certificateExportUtils.js)):**
  1. **Print PDF Engine (`printStudentCertificate` & `printTcDcCertificate`):**
     - Accepted dynamic `signatorySubtext`.
     - When `signatories.length === 1` (left signatory disabled), the signature renders cleanly right-aligned (`margin-left: auto; width: 36%`) with the Principal title and dynamic institute subtext.
  2. **Word Processor Export (`generateStudentCertificateDocx`):**
     - Handled `signatories.length === 1` with a blank 50% left cell and right-aligned 50% Principal signature cell.
     - Replaced hardcoded text with `signatorySubtext || institutionName || 'Govt. HSS Shangus'`.

---

## Files Modified
- `src/portal/admin/StudentCertificateStudioView.jsx`: Added Left Signatory toggle, Signatory Subtext field in Setup Drawer, live canvas preview responsiveness, and template persistence.
- `src/utils/certificateExportUtils.js`: Added `signatorySubtext` support and single-signatory right-aligned layout in HTML print and Word export.
- `CHANGES_SINCE_LAST_COMMIT.md`: Documented changes, commit message, and manual push instructions.

---

## Local Commit Message
```bash
feat(cert-studio): add setup controls for incharge left signatory toggle and institute subtext
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
git commit -m "feat(cert-studio): add setup controls for incharge left signatory toggle and institute subtext"
```
