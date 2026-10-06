# Changes Since Last Commit

## Commit Message

`fix(security): delegate staff access safely`

## Summary

- Standard Admins assigned the **Staff** module can now create, edit, deactivate, and reset Teacher or Standard Admin accounts. They can assign only modules that are already assigned to their own account; only the Super Admin can create, alter, or target Super Admin accounts or grant the wildcard permission.
- Replaced browser-side staff account provisioning and direct permission writes with the authoritative server-side `manageStaffAccount` workflow. This prevents a browser from elevating a role or permission by changing client data.
- Made the module catalog, launcher, and staff-permissions interface reflect the same delegated-access boundaries as the backend. A Standard Admin can use every module explicitly assigned to them, with the same end-to-end capability as Super Admin for that module.
- Tightened Firestore access controls: staff permissions are server-managed, photos and practical configuration are no longer public, session documents have an allowlisted schema, and login-handshake records are backend-only.
- Bound administrator sign-in verification to a server-created, expiry-checked session. All Admin and Super Admin login routes now use that same verification path when two-step verification is enabled.
- Removed the public-result page's embedded student/practical fallback data and restricted the public endpoint to approved school-based assessment result types. Practical/internal/external awards are not returned publicly.
- Added regression assertions for the staff delegation limits, private practical/photo paths, backend-only handshakes, and public result filtering.

## Files Changed

1. `firestore.rules`
2. `functions/staffDirectory.js`
3. `functions/staffSecurity.js`
4. `netlify/functions/public-result.js`
5. `scripts/security-behavior.test.cjs`
6. `scripts/security-regression-check.js`
7. `src/pages/PublicResultLookup.jsx`
8. `src/portal/LoginPage.jsx`
9. `src/portal/admin/AdminToolsDropdown.jsx`
10. `src/portal/admin/StaffPermissionsManager.jsx`
11. `src/portal/admin/adminModuleCatalog.js`
12. `src/services/staffAuthService.js`
13. `CHANGES_SINCE_LAST_COMMIT.md`

## Verification

- `npm run security:check`: passed.
- `node --check functions/staffSecurity.js`, `node --check functions/staffDirectory.js`, and `node --check netlify/functions/public-result.js`: passed.
- `npm run test:public`: passed (9 tests).
- `npm run build`: passed with exit code 0 (production bundle, public pages, and SEO checks completed). Existing non-blocking lint warnings remain in the project.
- `npm run deploy:rules`: passed; the Firestore rules were compiled and released to the `hsssdb` production project.
- `node scripts/security-behavior.test.cjs`: requires a running local Firestore emulator on port 8089 and could not connect because no emulator was running.
- `npm run test:integrity`: could not start locally because the Firebase emulator now requires Java JDK 21 and this workstation has an older Java runtime. No emulator security result was produced; install/configure JDK 21 before rerunning that suite.
- `git diff --check`: passed with no whitespace errors.

## Instructions for the User

1. Review the local commit:

   ```bash
   git show --stat HEAD
   git log -1 -p
   ```

2. Amend or recreate the commit if you prefer another message:

   ```bash
   git reset --soft HEAD~1
   git commit -m "Your custom commit message"
   ```

3. Push manually when ready. This project workflow deliberately never pushes automatically:

   ```bash
   git push origin main
   ```
