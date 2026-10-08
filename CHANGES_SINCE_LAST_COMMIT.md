# Changes Since Last Commit

## Commit Message

`feat(beneficiary): add Beneficiary Lists & Sanction Orders Studio with bulk reg no fetch, custom columns and bank debit advice`

## Files Changed

1. **[src/portal/admin/BeneficiarySanctionOrdersView.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/BeneficiarySanctionOrdersView.jsx)** *(New)*:
   - Built a dedicated institutional module for composing, customizing, and printing student beneficiary rolls, mutual benefit funds, bank debit orders, and disbursement statements.
   - **Multi-Class Bulk & Single Reg No Fetcher**:
     - Fast ingestion interface supporting single or bulk Registration Numbers (comma, space, tab, or newline-separated).
     - Cross-class and cross-session database resolution (searching active session admissions, master registers, and pre-computed student indexes).
     - Automatically pulls candidate data (`studentName`, `parentage` / `fatherName`, `className`, `bankAccount`, `ifsc`, etc.).
     - Quick fuzzy autocomplete search bar to look up students by Name, Roll No, or Reg No and add with 1 click.
     - Support for adding manual / non-student vendor and shop rows with editable names, accounts, amounts, and remarks.
   - **Column Customization Matrix & DB Integration**:
     - Keeps all standard database columns available (`Core Identity`, `Academic Details`, `Contact & IDs`).
     - Interactive custom column builder (Currency / Amount with automatic total calculation, Editable Plain Text, Blank for pen signature, Remarks).
     - Column reordering, visibility controls, header renaming, alignment, and width configuration.
   - **Dynamic Total Calculation & Distribution Helpers**:
     - Auto-calculating `Total ₹` row at table bottom that dynamically sums all currency columns in real-time.
     - Quick Amount Filler modal supporting uniform amounts (e.g. ₹600 or ₹800) or tiered distribution (e.g. ₹800 for Orphan/PWD and ₹600 for others).
   - **Directives, Preamble & Certification Block**:
     - Optional Bank Debit Directive paragraph with automatic `{totalAmount}`, `{accountNumber}`, and `{session}` placeholders.
     - Optional Committee Certification paragraph with full Mutual Benefit Fund text matching official institutional records.
   - **Signatory Blocks**:
     - 1 to 5 numbered Committee Member signature lines across the bottom width.
     - Designated Signatory (Principal) alignment.
     - Combined mode supporting both committee members and Principal.
   - **1-Click Exports & Print Engine**:
     - High-fidelity landscape / portrait A4 WYSIWYG paper canvas matching the official circular red-bordered letterhead.
     - Excel (`.xlsx`) export with formatted headers, student table, and total row.
     - Word (`.docx`) export with full tables, shaded headers, and signature lines.
     - Print / PDF preview with clean `@media print` styling.
     - Document History integration with `saveGeneratedDocToHistory`.

2. **[src/portal/admin/adminModuleCatalog.js](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/adminModuleCatalog.js)**:
   - Registered `beneficiaryStudio` in `ADMIN_MODULE_CATALOG` under the `Records & Registers` category with launcher `true`, maturity `optimized`, aliases (`beneficiaryStudio`, `beneficiaryOrders`, `sanctionOrders`, `beneficiaries`, `beneficiaryList`), and comprehensive search keywords.
   - Updated `ROLE_PRESETS`:
     - Incremented `full_admin` count to 27 modules.
     - Added `beneficiaryStudio` to `records_incharge`.
     - Added `beneficiaryStudio` to `accounts_clerk`.

3. **[src/portal/admin/AdminToolsDropdown.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/AdminToolsDropdown.jsx)**:
   - Added `CreditCard` icon mappings for `beneficiaryStudio` and `beneficiaryOrders` in `MODULE_ICONS`.
   - Enabled search indexing and launcher navigation from the Administrative Tools dropdown menu.

4. **[src/portal/admin/AdminDashboard.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/AdminDashboard.jsx)**:
   - Added lazy chunk loader for `BeneficiarySanctionOrdersView`.
   - Added `beneficiaryStudio` and aliases to `MODULE_LOADERS`.
   - Added `beneficiaryStudio` to `priorityModules` for idle background chunk prefetching.
   - Mounted `BeneficiarySanctionOrdersView` tab container with keep-alive DOM architecture and `identityStudents` prop binding.

5. **[src/portal/admin/CustomRosterDocumentBuilderView.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/CustomRosterDocumentBuilderView.jsx)**:
   - Exported `DB_COLUMN_GROUPS` so external studios can cleanly reuse canonical database column groupings.

---

## Verification

- **Build Verification**: `npm run build` executed and passed with **Exit Code 0** and zero breaking errors. All 12 public static pages, sitemaps, and SEO regression checks passed cleanly.
- **Security & Authorization Rules**: Standard Firestore security rules remain active.

---

## Instructions for User: Manual Push & Inspection

1. **Inspect Commit History**:
   ```bash
   git log -n 1 --stat
   ```
2. **If You Want to Amend or Re-commit**:
   ```bash
   git reset --soft HEAD~1
   git commit -m "feat(beneficiary): add Beneficiary Lists & Sanction Orders Studio with bulk reg no fetch, custom columns and bank debit advice"
   ```
3. **Push Changes Remotely (Manual Execution)**:
   ```bash
   git push origin main
   ```
