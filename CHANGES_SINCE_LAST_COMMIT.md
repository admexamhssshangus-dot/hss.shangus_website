# Changes Since Last Commit

## Commit Message

`feat(history): restrict standard admins to own document history and allow superadmin reassignment`

## Files Changed

1. **[src/services/staffAuthService.js](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/services/staffAuthService.js)**
   - Added and exported `fetchAdminAccountsList()`: dynamically pulls verified administrative accounts combining foundational profiles (`FALLBACK_STAFF_PROFILES`) and Firestore `adminSettings/permissions`, categorizing accounts into SuperAdmin and Standard Admin with names, emails, and role badges.

2. **[src/services/docHistoryService.js](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/services/docHistoryService.js)**
   - **Strict Ownership Predicate (`isRecordOwnedBy`)**: Robustly verifies document ownership across `userEmail`, `createdBy`, `author`, `extraData.userEmail`, `extraData.author`, `submittedByEmail`, and email prefix.
   - **Generation & Saving (`saveGeneratedDocToHistory`)**: Ensures `userEmail`, `author`, and `cleanExtraData` are recorded with creator metadata upon generation.
   - **Scoped Cloud & Cache Fetching (`fetchGeneratedDocHistory`)**: Added `{ userEmail, isSuperAdmin }` support. When a Standard Admin requests history, only their owned/assigned records are returned. Super Admin receives the complete unified global audit register.
   - **Single Document Reassignment (`reassignGeneratedDocOwner`)**: Allows Super Admin to move any document into another admin's history. Atomically updates Firestore (`generatedDocumentHistory`) and local storage cache, and dispatches `hss-doc-history-updated`.
   - **Batch Document Reassignment (`reassignMultipleGeneratedDocsOwner`)**: Uses Firestore `writeBatch` to reassign multiple selected documents in bulk.

3. **[src/portal/admin/ReassignDocOwnerModal.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/ReassignDocOwnerModal.jsx)** *(New File)*
   - Dedicated Super Admin modal for single or bulk document reallocation.
   - Displays document snapshot / count, currently assigned admin, dropdown of registered school administrative accounts with SuperAdmin/Admin badges, custom email option, and confirmation actions.

4. **[src/portal/admin/OfficialDocumentCatalogView.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/OfficialDocumentCatalogView.jsx)**
   - **Standard Admin Strict Scoping (`scopedBaseRecords`)**: Restricts documents to records owned by the logged-in Standard Admin (`isRecordOwnedBy`).
   - **Super Admin Unrestricted Scope & Account Filter**: Super Admin retains global view across all staff and can filter by any specific administrative account.
   - **Standard Admin Account Badge**: In Row 1 toolbar, Standard Admins see locked `My Account ({account})` badge, ensuring transparency and isolation.
   - **Row-Level Reassignment**: Added "Move to Admin" action button (`UserCheck`) on each table row for Super Admin.
   - **Bulk Selection Reassignment**: Added `Move to Admin ({selectedCount})` bulk action button in Row 4 for Super Admin.
   - Self-contained modal integration with `ReassignDocOwnerModal`.

5. **[src/portal/admin/DocumentHistoryModal.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/DocumentHistoryModal.jsx)**
   - **Role & Auth Resolution**: Resolves `effectiveEmail` and `effectiveIsSuperAdmin` from `currentUser` prop or `auth.currentUser`.
   - **Strict Archive Scoping (`scopedRecords`)**: Restricts Standard Admins strictly to their own documents across Letters, Bonafides, Discharge/TC, Sanctions, and ID Cards.
   - **Header Role Badges**: Added visual indicators: `Super Admin (All Records)` vs `My History ({email prefix})`.
   - **Card-Level Owner Badge**: In Super Admin mode, each archive card displays the currently assigned admin owner.
   - **Single Card Reassign**: Added `Move` button (`ArrowRightLeft`) on archive cards for Super Admin.
   - **Bulk Reassign**: Added `Move to Admin ({count})` in the bulk selection bar for Super Admin.
   - **Full Preview Popup Reassign**: Added `Move to Admin` button directly in the document full preview modal for Super Admin.
   - Mounted `ReassignDocOwnerModal` for self-contained document reallocation.

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
git commit -m "feat(history): restrict standard admins to own document history and allow superadmin reassignment"
```

### 3. How to Push to Remote Repository
In accordance with our strict Git safety rules, the assistant does not push automatically. When you are ready, please push the commit manually:
```bash
git push origin main
```
