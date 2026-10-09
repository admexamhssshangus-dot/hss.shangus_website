# Changes Since Last Commit

## Commit Message

`fix(portal): resolve cert studio temporal dead zone error and align sanction order controls`

## Files Changed

1. **[src/portal/admin/StudentCertificateStudioView.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/StudentCertificateStudioView.jsx)**
   - **Resolved `isTcDcActive` Initialization ReferenceError**:
     - Moved the `isTcDcActive` `useMemo` declaration above `saveCertificateTitleToCloud` and dependent `useEffect` hooks so it is fully initialized before being referenced in callback and effect dependencies.
     - Fixed runtime crash (`ReferenceError: Cannot access 'isTcDcActive' before initialization`) caught by `ModuleErrorBoundary` on opening the Certificate Studio (`?tab=certStudio`).

2. **[src/portal/admin/BeneficiarySanctionOrdersView.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/BeneficiarySanctionOrdersView.jsx)**
   - **Promoted Document Styling Controls to Top Header**:
     - Moved Table Row Spacing (`Compact`, `Normal`, `Spaced`), Font Size stepper (`A⁻` / `A⁺`) & dropdown (`8pt` to `14pt`), and Font Family selector (`Times New Roman`, `Arial`, `Georgia`, `Calibri`, `Courier New`) directly beside **Orientation** in the top bar above the preview sheet.
   - **Arranged Registration Nos [Bulk] & + Blank Row on the Exact Same Row**:
     - Consolidated `REGISTRATION NOS [BULK]` label (with live token count badge), `[👁 Paste Reg Nos]` toggle button, and `[+ Blank Row]` (non-student / vendor row creator) onto the exact same horizontal flex row in Tab 1, eliminating redundant vertical row height.
     - Structured the collapsible bulk paste input area to cleanly open immediately underneath without disrupting the rest of the student fetcher flow.

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
git commit -m "fix(portal): resolve cert studio temporal dead zone error and align sanction order controls"
```

### 3. How to Push to Remote Repository
In accordance with our strict Git safety rules, the assistant never executes `git push`. When you are ready, please push the commit manually:
```bash
git push origin main
```
