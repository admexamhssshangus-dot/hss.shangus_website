# Changes Since Last Commit

## Commit Message

`feat(studios): add labeled ref no increment steppers to official letter writer and student certificates`

## Files Changed

1. [src/services/certificateRegistryService.js](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/services/certificateRegistryService.js):
   - **Smart Reference Number Parsing & Stepping**:
     - Exported `parseRefParts(refStr)`: Intelligently isolates the exact dispatch/serial number that should be incremented from arbitrary institutional prefixes (e.g. `HSS/SHG/Bonafide/`, `HSS/SHG/2026/`, `HSS/`) and suffixes (e.g. `/2026`, `/26`).
     - Added support for 2-digit year suffixes (`/26`) and automatic synthesis for prefixes ending in slashes (e.g. `HSS/SHG/2026/` -> starts sequential numbering cleanly at `01`).
     - Exported `stepRefNumber(refStr, delta)`: Accurately increments or decrements the serial number (+1 / -1) while strictly preserving leading zero padding, institutional prefixes, and academic year suffixes without truncation.
     - Exported `updateRefSerial(refStr, newSerialVal)`: Directly updates the serial number with custom input while preserving full reference formatting.
     - Updated `parseGeneralRefNo` and `formatGeneralRefNo` to stop stripping `HSS/SHG` into `HSS` and stop truncating 4-digit years like `2026`.

2. [src/portal/admin/StudentCertificateStudioView.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/StudentCertificateStudioView.jsx):
   - **Labeled Reference Number Increment Controls**:
     - Upgraded `currentFigure`, `handleUpdateFigure`, and `handleStepFigure` to utilize `parseRefParts`, `stepRefNumber`, and `updateRefSerial`.
     - **Live Canvas Header (General Ref No)**: Added a labeled, print-hidden badge `Inc Part: [ currentFigure ]` alongside `[-1]` and `[+1]` stepper buttons directly adjacent to the inline Reference Number input.
     - **Live Canvas Header (TC/DC Certificate No)**: Added the labeled `Inc Part: [ currentFigure ]` badge with `[-1]` and `[+1]` buttons beside the Certificate Serial field.
     - **Setup Drawer (`# Setup`)**: Relabeled the figure stepper from ambiguous `Fig:` to explicit `Inc Part:` with informative tooltip.
     - **Reference & Date Modal**: Clarified the counter section as `Serial № (Inc Part)` with explanation: *"The numerical portion of the reference number to be incremented"*.

3. [src/portal/admin/OfficialLetterWriterView.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/OfficialLetterWriterView.jsx):
   - **Reference Number Increment Steppers for Official Letters**:
     - Imported `parseRefParts`, `stepRefNumber`, and `updateRefSerial` from `certificateRegistryService`.
     - Added `letterRefParts`, `letterCurrentFigure`, `handleStepRefNumber(delta)`, and `handleUpdateRefSerial(val)`.
     - **Live A4 Canvas Header**: Added an inline, print-hidden `Inc Part: [ letterCurrentFigure ]` badge with `[-1]` and `[+1]` buttons right beside the `Ref. No.:` editable input.
     - **Setup Drawer (`# Setup`)**: Added a labeled `Inc Part:` manual figure input and sequential steppers (`[-1] [ input ] [+1 Next]`) alongside the Reference No. field.
     - **Mobile Setup Modal**: Added the labeled `Inc Part:` stepper control inside the mobile setup sheet.
     - **Reference & Date Pop-up Modal**: Added the dedicated `Serial № (Inc Part)` stepper card at the top of the reference editor modal.
     - **Header Tools Modal**: Integrated the labeled `Inc Part:` stepper beside Reference No.

---

## Verification

- **Build Verification**: `npm run build` completed with **Exit Code 0** and zero breaking errors. All 12 public static pages, sitemaps, and SEO regression checks passed.
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
   git commit -m "feat(studios): add labeled ref no increment steppers to official letter writer and student certificates"
   ```
3. **Push Changes Remotely (Manual Execution)**:
   ```bash
   git push origin main
   ```
