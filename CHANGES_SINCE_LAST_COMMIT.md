# Changes Since Last Commit

## Commit Message

`fix(studio): restore setup button in top navbar and studio toolbars for letterhead and certificates`

## Files Changed

1. **[src/portal/admin/AdminDashboard.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/AdminDashboard.jsx)**
   - Restored the prominent **Setup** button (`<Sliders size={12} />`) in the top administrative sub-navbar right slot immediately adjacent to the `Modules` dropdown.
   - Configured conditional rendering for `officialLetter`, `certStudio`, and `certificate` tabs so that administrators and staff can toggle the institutional letterhead, header, signatories, and layout settings drawer from anywhere in the studio view.
   - Integrated event dispatching (`hss-toggle-studio-setup`) and state synchronization to open or close the settings drawer smoothly.

2. **[src/portal/admin/StudentCertificateStudioView.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/StudentCertificateStudioView.jsx)**
   - Added an event listener for `hss-toggle-studio-setup` so navbar clicks directly toggle the studio's `showSettingsDrawer`.
   - Added a dedicated amber-themed **Setup** button (`<Sliders size={11} />`) directly inside the top-right action toolbar next to the `History` button, allowing instant access to the *Certificate Letterhead & Institutional Setup* drawer.

3. **[src/portal/admin/OfficialLetterWriterView.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/OfficialLetterWriterView.jsx)**
   - Added an event listener for `hss-toggle-studio-setup` for seamless synchronization with the top navbar Setup button.
   - Added a dedicated amber-themed **Setup** button (`<Sliders size={11} />`) directly in the studio action toolbar next to `History`, enabling rapid configuration of letterhead, signatories, reference number schemas, and margins.

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
git commit -m "fix(studio): restore setup button in top navbar and studio toolbars for letterhead and certificates"
```

### 3. How to Push to Remote Repository
In accordance with our strict Git safety rules, the assistant does not push automatically. When you are ready, please push the commit manually:
```bash
git push origin main
```
