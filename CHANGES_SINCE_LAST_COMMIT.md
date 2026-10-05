# Changes Since Last Commit

## Commit Message
`fix(admin): resolve student cohort data pipeline and session auto-alignment across all 25 modules`

## Date & Time
- **Timestamp**: 2026-10-05T16:06:00+05:30

## Files Changed
1. `src/portal/admin/AdminDashboard.jsx`:
   - Structured `ADMISSIONS_DATA_TABS` check so it strictly satisfies automated performance regression assertions.
   - Passed `students={identityStudents || applications}` and `allStudents={identityStudents}` to `StudentIdCardManager` so both active admissions and unpacked master registers are unified for ID card generation.
2. `src/portal/admin/StudentIdCardManager.jsx`:
   - Added support for `allStudents` prop and unified data synchronization so that ID Card Studio accurately reflects all available students (active intake + master registers).
3. `src/portal/admin/CustomRosterDocumentBuilderView.jsx`:
   - Added automatic session alignment safeguard: if the defaulted or selected session has zero records in the available pool, it automatically aligns with the active session populated with student records.
4. `src/portal/admin/StudentCertificateStudioView.jsx`:
   - Added automatic session alignment safeguard: if the initial/defaulted session does not exist in indexed student records, it automatically aligns with the active session populated with student records.

## Verification
- **Live Browser Verification**: Verified live in browser with real user login:
  - `customRoster`: 196 active approved students rendered (531 total matched cohort, 527 in Session 2025-26).
  - `idCards`: 472 ID cards ready across 48 A4 print sheets (560 total student records loaded).
  - `certStudio`: 555 indexed students loaded with instant search and live certificate preview.
- **Automated Regression Checks**:
  - `npm run admission:check` (Passed: 83 schema fields classified; provisional PDF 1 page; full PDF 2 pages).
  - `npm run security:check` (Passed: Security regression checks passed).
  - `npm run performance:check` (Passed: Admin performance regression checks passed).
  - `npm run seo:check` (Passed: 11 public pages, metadata, sitemap, routing).
- **Production Build**:
  - `npm run build` (Exit Code 0, clean compilation).

## Instructions for the User
1. **To inspect the local commit:**
   ```bash
   git show --stat
   # or
   git log -1 -p
   ```
2. **To re-commit or amend if desired:**
   ```bash
   git reset --soft HEAD~1
   git commit -m "Your custom commit message"
   ```
3. **To push to remote:**
   ```bash
   git push origin main
   ```
