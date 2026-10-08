# Changes Since Last Commit

## Commit Message

`feat(studios): add interactive font size controls to student certificates and custom registers`

## Files Changed

1. [src/portal/admin/StudentCertificateStudioView.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/StudentCertificateStudioView.jsx):
   - **Interactive Font Size Steppers & Selectors**:
     - Added `baseFontSize` state (defaulting to `'12.5px'`) with persistent caching via `localStorage.getItem('hss_cert_base_font_size')`.
     - Declared `FONT_SIZES` range (`'10px'`, `'11px'`, `'12px'`, `'12.5px'`, `'13px'`, `'13.5px'`, `'14px'`, `'15px'`, `'16px'`, `'18px'`, `'20px'`).
     - Implemented `handleSetFontSize(size)` and `handleAdjustFontSize(delta)`:
       - **Selection-Aware Formatting**: When text within the certificate body is highlighted, wraps the selection in an inline `<span style="font-size: ...">` or updates existing font size tags with undo/redo snapshot tracking.
       - **Document-Wide Base Scaling**: When no text is selected, smoothly scales the certificate body font size across the entire document.
     - Added a dedicated Font Size Stepper (`[ A⁻ | 12.5px ▾ | A⁺ ]`) to:
       - **Desktop Toolbar Row 2**: Placed right between heading blocks (¶, H1, H2) and inline text styles (Bold, Italic, Underline).
       - **Mobile Format Dropdown**: Positioned seamlessly under Headings & Paragraphs.
       - **Setup Drawer (`# Setup`)**: Integrated into the features & options configuration bar.
     - Updated live WYSIWYG canvas styling with injected dynamic CSS `.doc-studio-wysiwyg-body { font-size: ${baseFontSize} !important; }` and inline `fontSize: baseFontSize` on `editorRef.current`.
     - Integrated `baseFontSize` into draft auto-saves, template storage, history archives, and print triggers.

2. [src/utils/certificateExportUtils.js](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/utils/certificateExportUtils.js):
   - **Print & PDF Preview Engines**:
     - Added `baseFontSize = '12.5px'` parameter to both single (`printStudentCertificate`) and batch (`printBatchStudentCertificates`) print utilities.
     - Updated `.body-text-col` print CSS to use `font-size: ${baseFontSize || '10.5pt'};`, ensuring printouts and PDF exports mirror the custom font size selected on-screen.

3. [src/portal/admin/CustomRosterDocumentBuilderView.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/CustomRosterDocumentBuilderView.jsx):
   - **Roster & Register Table Font Scaling**:
     - Added `tableFontSize` state (defaulting to `'10px'`) with `localStorage.getItem('hss_roster_table_font_size')` persistence.
     - Defined `ROSTER_FONT_SIZES` scale (`'8px'`, `'8.5px'`, `'9px'`, `'9.5px'`, `'10px'`, `'10.5px'`, `'11px'`, `'11.5px'`, `'12px'`, `'13px'`).
     - Implemented `handleSetTableFontSize(size)` and `handleAdjustTableFontSize(delta)`.
     - **Page & Table Setup Control**: Added a clean `Font [ A⁻ | 10px ▾ | A⁺ ]` stepper right beside the Row Height preset dropdown in the right-side configuration panel.
     - **Direct On-Canvas Quick Stepper**: Placed a compact `Font: [ A⁻ | 10px ▾ | A⁺ ]` stepper directly inside the slim info bar above the table preview, enabling administrative staff to adjust table font density in real-time without leaving the preview.
     - Applied `fontSize: tableFontSize` to all preview `<td>` data cells, dynamic `th` header cells (`calc(${tableFontSize} - 0.5px)`), and 2-column attendance tables.
     - Passed `tableFontSize` into `printCustomRosterTable`.

4. [src/utils/customRosterExportUtils.js](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/utils/customRosterExportUtils.js):
   - **Custom Roster Print Engine**:
     - Added `tableFontSize = '9px'` parameter to `printCustomRosterTable` and `buildTwoColumnAttendanceHtml`.
     - Updated print CSS for `th` and `td` to dynamically reflect `tableFontSize` (e.g. `th { font-size: calc(${tableFontSize} - 0.5px); }` and `td { font-size: ${tableFontSize}; }`), ensuring high-density registers or wide examination sheets fit cleanly on A4 pages.

---

## Verification

- **Build Verification**: `npm run build` executed and passed with **Exit Code 0** and zero breaking errors. All 12 public static pages, sitemaps, and SEO regression checks passed.
- **Firebase Security Rules**: Security rules remain active and verified in Cloud Firestore.

---

## Instructions for User: Manual Push & Inspection

1. **Inspect Commit History**:
   ```bash
   git log -n 1 --stat
   ```
2. **If You Want to Amend or Re-commit**:
   ```bash
   git reset --soft HEAD~1
   git commit -m "feat(studios): add interactive font size controls to student certificates and custom registers"
   ```
3. **Push to Remote Repository** *(Strict Manual Policy)*:
   ```bash
   git push origin main
   ```
