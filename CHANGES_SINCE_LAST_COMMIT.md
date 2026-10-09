# Changes Since Last Commit

## Commit Message

`fix(cert-studio): fix caret placeholder insertion and isolate discharge cert numbering from general certs`

## Files Changed

1. **[src/portal/admin/StudentCertificateStudioView.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/StudentCertificateStudioView.jsx)**
   - **Fixed Caret Position Placeholder Insertion**:
     - Removed automatic selection capture from `onFocus` on the contentEditable `editorRef`, added `onBlur` capture, and ensured caret position is captured on `onMouseDown` when interacting with the "+ Field" button and dropdown trigger.
     - Upgraded `handleInsertPlaceholder` from legacy `execCommand('insertText')` to direct DOM Range insertion (`deleteContents()`, `insertNode(textNode)`, `nextRange.setStartAfter(textNode)`, selection updating, and gentle focus). Field placeholders and student data attributes now insert precisely where the cursor was positioned instead of jumping to the top of the canvas.
   - **Isolated Discharge / Transfer Certificate Numbering (`ccDcNo`)**:
     - Restricted the institutional **Certificate Number** (`#1368`, sourced from `systemSettings/certificateRegistry` / `ccDcNo`) exclusively to Discharge / Transfer Certificates (`tc_dc_*`).
     - General certificates (Bonafide, Character, DOB, Provisional, Migration NOC, Custom, etc.) now strictly use independent General Certificate Dispatch Reference sequences (e.g. `Ref No: HSS/1454/26`) and never consume, display, or fallback to the student's TC/DC number (`ccDcNo`).
     - Dynamically computes and assigns the appropriate reference identifier (`HSS/...` for general certificates vs serial number for TC/DC) whenever switching templates in `handleSelectTemplate`.
     - In the Details Drawer, dynamically displays `Discharge / TC-DC Certificate No.` with placeholder `e.g. 1368` for TC/DC, and `General Reference No.` with placeholder `e.g. HSS/1454/26` for all other templates, while restricting the Revoke Number action to TC/DC certificates.
   - **Isolated Template Title Banners**:
     - Guarded `loadCertificateBannerFromCloud` and `saveCertificateTitleToCloud` so cloud banner synchronization only applies to TC/DC certificates and never overwrites non-TC/DC template titles (e.g., `BONAFIDE CERTIFICATE`) with `DISCHARGE/TRANSFER CUM CHARACTER CERTIFICATE`.

2. **[src/utils/certificateExportUtils.js](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/utils/certificateExportUtils.js)**
   - **Dynamic Meta Grid Labels in Certificate Exports**:
     - Updated print and Word (.docx) document generation so the metadata header renders `<span class="meta-label">Certificate No.:</span>` for Discharge/Transfer Certificates and `<span class="meta-label">Ref No.:</span>` for all other certificates.

---

## Instructions for the User

### 1. How to Review the Local Commit
You can review the changes and commit log locally:
```bash
git log -1 --stat
git show HEAD
```

### 2. How to Amend or Re-commit (Optional)
If you wish to edit the commit message or make adjustments:
```bash
git reset --soft HEAD~1
# Make desired adjustments...
git add .
git commit -m "fix(cert-studio): fix caret placeholder insertion and isolate discharge cert numbering from general certs"
```

### 3. How to Push to Remote Repository
In accordance with our strict Git safety rules, the assistant never executes `git push`. When you are ready, please push the commit manually:
```bash
git push origin main
```
