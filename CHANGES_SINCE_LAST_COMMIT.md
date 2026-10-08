# Changes Since Last Commit

## Commit Message

`refactor(admin): remove duplicate elements across modules and indent content inside relative to header`

## Files Changed

1. **[src/portal/admin/BeneficiarySanctionOrdersView.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/BeneficiarySanctionOrdersView.jsx)**
   - Removed redundant inner header (`<header>` with `ArrowLeft` back button, duplicate title, and `CreditCard` icon) that duplicated `AdminDashboard`'s persistent top navigation bar.
   - Removed `h-screen` viewport constraint on root container to prevent double vertical scrollbars and layout clipping when embedded inside the dashboard.
   - Removed obsolete, disabled "Reg No(s)" textarea and disabled "Fetch & Add (Merged Below)" button (which were already merged into Quick Student Finder).
   - Replaced with a streamlined, responsive action toolbar holding preset selection, orientation toggles, history, cloud save, exports (Excel, Word, Print/PDF), and sidebar controls toggle.
   - Positioned the manual `+ Blank Row` button cleanly next to the student fetcher.

2. **[src/portal/admin/StudentIdCardManager.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/StudentIdCardManager.jsx)**
   - Removed redundant red `Close` button inside the ID Suite toolbar which duplicated the persistent `< Records` return button in `AdminDashboard`'s top navigation bar.

3. **[src/portal/admin/AdminDashboard.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/AdminDashboard.jsx)**
   - Removed duplicate comment `{/* Workspace Card */}`.
   - Removed hardcoded duplicate `Setup` button in the persistent header toolbar for `officialLetter` and `certStudio` (both modules already provide dedicated setup controls inside their own native toolbars).
   - Cleaned up legacy unused props (`onSwitchToRoster` and `onSwitchToLetter`) passed to `OfficialLetterWriterView` and `StudentCertificateStudioView`.
   - Implemented global content indentation across all admin pages: added `px-1.5 sm:px-2.5 md:px-3.5 pt-1 sm:pt-1.5 pb-2.5` to the tab content wrapper when `activeTab !== 'reports'`, ensuring page content indents slightly inside on all sides relative to the persistent header toolbar.

4. **[src/portal/admin/OfficialLetterWriterView.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/OfficialLetterWriterView.jsx)**
   - Cleaned up unused legacy prop `onSwitchToRoster` from the component parameter signature.

5. **[src/portal/admin/StudentCertificateStudioView.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/StudentCertificateStudioView.jsx)**
   - Cleaned up unused legacy props `onSwitchToRoster` and `onSwitchToLetter` from the component parameter signature.

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
git commit -m "refactor(admin): remove duplicate elements across modules and indent content inside relative to header"
```

### 3. Push to Remote Repository
When ready, push the verified commit to your remote branch manually:
```bash
git push origin main
```
