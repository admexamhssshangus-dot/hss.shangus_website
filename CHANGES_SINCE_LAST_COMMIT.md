# Changes Since Last Commit

## Commit Message

`feat(reports): prioritize active admissions student and parent names with direct edit history support in AdvancedReports`

## Summary of Changes

1. **Advanced Reports & Registers Suite (`src/portal/admin/AdvancedReports.jsx`)**:
   - **Active Admissions Name Precedence**:
     - Synchronized student, father, and mother name resolution in active session records to prioritize data from active admissions applications over historical `masterRegisters`, preventing stale names from overriding official active 2025–26 records.
     - Preserves non-destructive fallback to `masterRegisters` when admissions name fields are missing or empty.
   - **Direct Edit History Support**:
     - Upgraded `getStudentName`, `getFatherName`, and `getMotherName` to inspect `directEditHistory` and `fieldEditHistory` for real-time reflection of inline administrative corrections.
   - **Multi-Field Cell Sync**:
     - Hardened inline quick-cell editing in table views so that editing a student's name, father's name, or mother's name automatically syncs all canonical and legacy alias fields (`studentName`, `Student's Name`, `Student's Name (as per school records)`, `name`, `fatherName`, `Father's Name`, `Father's/Guardian's Name (as per school records)`, `motherName`, `Mother's Name`, `Mother's Name (as per school records)`), ensuring uniform display across all exports, gazettes, and tabulation registers.
   - **Historical Records Harmonization**:
     - Standardized historical master register records to use the unified `getStudentName`, `getFatherName`, and `getMotherName` resolution functions.

## Files Changed

1. `src/portal/admin/AdvancedReports.jsx`
2. `CHANGES_SINCE_LAST_COMMIT.md`

## Verification

- **Regression Checks**:
  - `npm run admission:check` passed (`Exit Code 0`, 83 schema fields classified, provisional PDF 1 page, full PDF 2 pages).
  - `npm run security:check` passed (`Exit Code 0`).
  - `npm run performance:check` passed (`Exit Code 0`).
  - `npm run seo:check` passed (`Exit Code 0`, 12 static landing pages verified).
- **Production Build**: Verified locally with `npm run build` (`Exit Code 0`, clean compilation, zero breaking errors).
- **Practicals Data Boundary (Rule 8)**: Academic evaluation boundary intact.
- **Manual Git Push Policy (Rule 5)**: Never executed automatically.

## Manual Git Push Instructions

1. Inspect the local commit:
   ```bash
   git log -1 --stat
   ```
2. If you wish to inspect or re-execute the commit:
   ```bash
   git reset --soft HEAD~1
   git commit -m "feat(reports): prioritize active admissions student and parent names with direct edit history support in AdvancedReports"
   ```
3. Push changes to GitHub (strictly manual):
   ```bash
   git push origin main
   ```
