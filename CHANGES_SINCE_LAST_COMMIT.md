# Changes Since Last Commit

## Commit Message

`feat(admin): unify Controls sidebar toggle button across all four studio modules`

## Files Changed

1. **[src/portal/admin/BeneficiarySanctionOrdersView.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/BeneficiarySanctionOrdersView.jsx)**
   - Added event listener for `hss-toggle-studio-setup` so that `showControlsPanel` toggles in real time when toggled from the dashboard top navigation bar.
   - Retained the native `Controls` action button (`PanelRightClose` / `PanelRightOpen`, text label "Controls", tooltip "Hide Controls Sidebar" / "Show Controls Sidebar", teal border and background active state).

2. **[src/portal/admin/OfficialLetterWriterView.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/OfficialLetterWriterView.jsx)**
   - Replaced the old `Setup` toolbar button with the identical `Controls` button featuring `PanelRightClose` / `PanelRightOpen` icons, label "Controls", tooltip "Hide Controls Sidebar" / "Show Controls Sidebar", and matching teal active styles (`border-teal-500 bg-teal-50 text-teal-700`).
   - Retained dual-way synchronization with `showSettingsDrawer` and `onToggleSettingsDrawer`.

3. **[src/portal/admin/StudentCertificateStudioView.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/StudentCertificateStudioView.jsx)**
   - Replaced the old `Setup` toolbar button with the identical `Controls` button featuring `PanelRightClose` / `PanelRightOpen` icons, label "Controls", tooltip "Hide Controls Sidebar" / "Show Controls Sidebar", and matching teal active styles (`border-teal-500 bg-teal-50 text-teal-700`).
   - Retained dual-way synchronization with `showSettingsDrawer` and `onToggleSettingsDrawer`.

4. **[src/portal/admin/StudentIdCardManager.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/StudentIdCardManager.jsx)**
   - Replaced the old `Filters` toolbar button with the identical `Controls` button featuring `PanelRightClose` / `PanelRightOpen` icons, label "Controls", tooltip "Hide Controls Sidebar" / "Show Controls Sidebar", and matching teal active styles (`border-teal-500 bg-teal-50 text-teal-700`).
   - Added listener for `hss-toggle-studio-setup` to synchronize `showFiltersPanel` (the expandable layout, card sizes, margins, and session/class filter controls) with the top navigation bar.

5. **[src/portal/admin/AdminDashboard.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/AdminDashboard.jsx)**
   - Added the uniform `Controls` button in the persistent top navigation bar next to the Administrative Tools dropdown whenever any of the 4 studio modules (`officialLetter`, `certStudio`, `idCards`, `beneficiaryStudio`) is active.
   - Dispatches `hss-toggle-studio-setup` to ensure the sidebar/drawer toggles synchronously from either the top header or the internal module toolbar.

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
git commit -m "feat(admin): unify Controls sidebar toggle button across all four studio modules"
```

### 3. Push to Remote Repository
When ready, push the verified commit to your remote branch manually:
```bash
git push origin main
```
