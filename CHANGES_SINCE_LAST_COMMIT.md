# Changes Since Last Commit

## Commit Message

`fix(history): deduplicate history by ref no and date and retain active ref when loading drafts`

## Files Changed

1. [src/services/docHistoryService.js](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/services/docHistoryService.js):
   - **Print History Deduplication by Ref No & Date**:
     - Updated `saveGeneratedDocToHistory`: When saving or printing a document where `refNo` and `dateStr` are identical to an existing record, the service no longer creates a new document ID or duplicate copy in print history.
     - Performs multi-tier deduplication checks (first in local storage cache across all time, then via Cloud Firestore query by `refNo`).
     - Updates the existing document in-place with the latest HTML snapshot, action type, and updated timestamp while preserving original creation date (`createdAt`).
     - Added `deduplicateSameRefAndDate(list)` in `fetchGeneratedDocHistory`: Merges and sanitizes history so that existing duplicates sharing the exact same reference number and issue date are consolidated into a single clean entry.

2. [src/portal/admin/OfficialLetterWriterView.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/OfficialLetterWriterView.jsx):
   - **Retain Working Ref No When Loading Drafts**:
     - In `handleLoadDraftFromHistory`, removed copying of `rec.refNo`. Loading an archived letter draft now preserves the current active sequential Reference Number in the editor.
     - Updated confirmation toast: *"Official letter draft loaded from history archive (retained current Ref No)."*

3. [src/portal/admin/StudentCertificateStudioView.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/StudentCertificateStudioView.jsx):
   - **Retain Working Ref No When Loading Drafts**:
     - In `handleLoadDraftFromHistory`, removed copying of `rec.refNo` and `rec.extraData.metaDetails.certificateNo`. Loading an archived certificate draft preserves the current sequential Reference Number in the studio.
     - Updated confirmation toast: *"Certificate draft loaded from history archive (retained current Ref No)."*

4. [src/portal/admin/DocumentHistoryModal.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/DocumentHistoryModal.jsx):
   - **Preview Modal Draft Action**:
     - Added an inline `Load as Draft` button in the document preview modal header, allowing administrators to load any previewed letter or certificate directly into the studio as a new draft while keeping their current reference number.

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
   git commit -m "fix(history): deduplicate history by ref no and date and retain active ref when loading drafts"
   ```
3. **Push Changes Remotely (Manual Execution)**:
   ```bash
   git push origin main
   ```
