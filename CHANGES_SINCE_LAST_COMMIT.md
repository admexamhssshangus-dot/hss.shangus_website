# Changes Since Last Commit

## Commit Message

`feat(admin): multi-module official document catalog & despatch register with time range and classification`

## Files Changed

1. **[firestore.rules](file:///d:/Shk_Gulfam/Projects/hss_shangus/firestore.rules)**
   - Updated security rules for `match /generatedDocumentHistory/{documentId}` and `match /documentHistory/{documentId}` to grant full read/write operational authority across all 4 modules (`officialLetter`, `certStudio`, `beneficiaryStudio`, `idCards`, `accounts`, `dispatchRegister`).
   - Automatically deployed rules to Firebase (`npm run deploy:rules` -> Cloud Firestore `hsssdb`).

2. **[src/portal/admin/OfficialDocumentCatalogView.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/OfficialDocumentCatalogView.jsx)** *(New Component)*
   - Built a comprehensive, classified, chronological **Official Document Catalog & Despatch Register View** across all four modules:
     - **Official Institutional Letters** (Official Letterhead Writer)
     - **Student Bonafides & Certificates** (Student Certificate Studio)
     - **Mutual Benefit Fund & Sanction Orders** (Sanction Orders Studio)
     - **Student ID Card Batches** (Student ID Card Studio)
     - Plus Admission Application Forms.
   - **Time Range Selector**:
     - Academic Session 2025–26 (01 Apr 2025 – 31 Mar 2026)
     - Academic Session 2024–25 (01 Apr 2024 – 31 Mar 2025)
     - Calendar Year 2026 (01 Jan 2026 – 31 Dec 2026)
     - Calendar Year 2025 (01 Jan 2025 – 31 Dec 2025)
     - Past 1 Year (365 days rolling)
     - Past 6 Months (180 days rolling)
     - Past 30 Days (30 days rolling)
     - Custom Date Range (interactive Start & End date pickers)
     - All-Time Historical Ledger.
   - **Classification & Sorting**:
     - Chronological sorting toggle (`asc` oldest-to-newest serial vs `desc` newest-to-oldest).
     - View mode toggle: Continuous chronological ledger (`flat`) vs Grouped by module classification (`classified`).
     - Module filters (`All`, `Letters`, `Bonafides/TC`, `Sanctions`, `ID Cards`, `Admissions`).
     - Full-text search across reference numbers, student/recipient names, roll numbers, reg numbers, class, subjects, and titles.
   - **KPI Summary Banner**:
     - Total registered documents, Letters issued, Certificates issued, Sanctions issued with total ₹ financial assistance amount, and ID Cards generated.
   - **Identifying Info Resolution**:
     - Extracts Roll No, Admission No, Reg No, Class, Parentage, and Purpose for Certificates.
     - Extracts Beneficiary count, total sanctioned amount (₹), and Cohort for Sanction Orders.
     - Extracts Card count and Class/Stream cohort for ID Card batches.
     - Extracts cleaned Subject and designated Recipient/Addressee for Letters.
   - **Official Print / PDF Despatch Register**:
     - Formatted A4 landscape institutional letterhead, summary stats table, official register table with serial numbers, statutory record certificate, and 3 signatory spaces (*Dealing Clerk / Despatch Clerk*, *Record Incharge / Section Officer*, *Principal*).
   - **Export to Excel (.xlsx)**:
     - Dual-sheet workbook containing the complete Despatch Register and Summary Statistics table.

3. **[src/portal/admin/DocumentHistoryModal.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/DocumentHistoryModal.jsx)**
   - Added `defaultView` prop (`archive` | `catalog`) and top header segmented switcher between **Archive Cards** and **Despatch Register & Catalog**.
   - Embedded `<OfficialDocumentCatalogView>` within the modal dialog container when in catalog mode with expanded responsive dimensions (`max-w-6xl`).
   - Added category filter tabs for **Sanctions** and **ID Cards** in the cards view toolbar, plus a quick **[Despatch Register]** launcher button.
   - Added visual badges and metadata cards for Sanction Orders (amount ₹ + beneficiary count) and ID Card Batches (cards count + class cohort).
   - Supported re-printing and Word (.docx) export for Sanction Orders, and added specialized snapshot previews for Sanctions and ID Cards in the preview popup.

4. **[src/portal/admin/BeneficiarySanctionOrdersView.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/BeneficiarySanctionOrdersView.jsx)**
   - Categorized Sanction Orders with `docType: 'sanction_order'` and saved rich metadata (`beneficiaryCount`, `totalAmount`, `session`, `classCohort`) to Cloud Document History.
   - Set `defaultFilter="sanction"` on `<DocumentHistoryModal>`.

5. **[src/portal/admin/StudentIdCardManager.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/StudentIdCardManager.jsx)**
   - Added **Register** button in the top action toolbar to open the Despatch Register & Catalog modal.
   - Automatically logs issued ID card batches to Cloud Document History upon generation/printing (`docType: 'id_card'`, batch reference, card count, cohort, session).
   - Mounted `<DocumentHistoryModal isOpen={showCatalogModal} onClose={() => setShowCatalogModal(false)} defaultFilter="idcard" defaultView="catalog" />`.

---

## Instructions for Review & Manual Push

### 1. Inspect the Local Commit
Review git log and diff:
```bash
git log -1 --stat
git diff HEAD~1
```

### 2. Amend / Re-commit (Optional)
If you wish to edit the commit message or modify files before pushing:
```bash
git reset --soft HEAD~1
# Make desired adjustments, then:
git add .
git commit -m "feat(admin): multi-module official document catalog & despatch register with time range and classification"
```

### 3. Push to Remote Repository
When ready, push the verified commit to your remote branch manually:
```bash
git push origin main
```
