# Changes Since Last Commit

## Commit Message

`fix(portal): remove duplicate setup buttons and streamline header controls`

## Files Changed

1. **[src/portal/admin/AdminDashboard.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/AdminDashboard.jsx)**
   - **Eliminated Duplicate Setup Button**: Removed redundant header-level `# Setup` button (`<Sliders /> Setup`) that was conditionally rendered in the subnavigation bar next to the `Modules` dropdown for `officialLetter`, `certStudio`, and `certificate` tabs.
   - **Preserved Native Studio Control**: Both [StudentCertificateStudioView](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/StudentCertificateStudioView.jsx) and [OfficialLetterWriterView](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/OfficialLetterWriterView.jsx) now exclusively control their own configuration drawer via their dedicated toolbar action buttons (`[Setup]`), maintaining a clean single source of truth across both desktop and compact mobile ribbons without dual-button visual clutter.
   - **Code Clean-up**: Removed obsolete `isStudioSetupOpen` local state, unused `Sliders` icon import, and redundant external drawer-sync props from the module mounts.

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
git commit -m "fix(portal): remove duplicate setup buttons and streamline header controls"
```

### 3. How to Push to Remote Repository
In accordance with our strict Git safety rules, the assistant never executes `git push`. When you are ready, please push the commit manually:
```bash
git push origin main
```
