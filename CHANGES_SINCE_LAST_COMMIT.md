# Changes Since Last Commit

## Commit Message

`feat(roster): prioritize admissions data for current session 2025-26 with non-destructive merge`

## Summary of Changes

1. **Teacher Practicals Portal (`src/portal/teacher/PracticalsPage.jsx`)**:
   - **Precedence Inversion for Active Session (`2025-26` / `CURRENT_SESSION`)**:
     - `admDocs` (`admissions` collection) is ingested **first** into `allCandidates`, ensuring students' rich elective subject combinations, streams, parentage, contact info, and form numbers are authoritative.
     - `masterDocs` (`masterRegisters` collection) is ingested **second** for current session, while continuing to serve as the primary archive for historical sessions (`2024-25`, etc.).
   - **Lookup Map Prioritization (`indexRichItem`)**:
     - Lookup indices (`richByReg`, `richByRoll`, `richByForm`, `richByName`) prioritize active admission records.
   - **Non-Destructive Deep Merge in Deduplication (`uniqueMap`)**:
     - **Zero Data Loss Guarantee**: When duplicate records between `admissions` and `masterRegisters` are encountered, the richer `admissions` record forms the base profile, while any existing identifiers from `masterRegisters` (`examRollNo`, `boardRollNo`, `admNo`, or pre-assigned `classRollNo`) and historical practical marks are seamlessly backfilled rather than dropped.

2. **Teacher School-Based Assessment Portal (`src/portal/teacher/TeacherAssessmentsPage.jsx`)**:
   - **Precedence Inversion for Active Session (`2025-26` / `CURRENT_SESSION`)**:
     - In `loadData`, `admDocs` is processed **first** into `allCandidates` and `masterDocs` **second** for active sessions.
   - **Lookup Map Prioritization (`indexRichItem`)**:
     - Ensures multi-key matching gives first preference to live admission documents.
   - **Non-Destructive Deep Merge in Deduplication (`uniqueMap`)**:
     - Merges `admissions` and `masterRegisters` records so complete subject choices, streams, father's names, and form numbers from `admissions` remain intact, while preserving any assigned board roll numbers, registration numbers, and previously saved/draft assessment marks (`marks`, `isAbsent`).

## Files Changed

1. `src/portal/teacher/PracticalsPage.jsx`
2. `src/portal/teacher/TeacherAssessmentsPage.jsx`
3. `CHANGES_SINCE_LAST_COMMIT.md`

## Verification

- **Production Build**: Verified with `npm run build` (Exit Code 0, all 12 public HTML pages generated, zero breaking errors, zero SEO regressions).
- **Academic Evaluation Boundary (Rule 8)**: Confidential practicals data remains strictly segregated from School-Based Assessment (Pre-Board) and accessible exclusively via authenticated teacher/admin accounts.
- **Manual Git Push Policy (Rule 5)**: Never executed automatically.

## Manual Git Push Instructions

1. Inspect the local commit:
   ```bash
   git log -1 --stat
   ```
2. If you wish to amend or re-commit:
   ```bash
   git reset --soft HEAD~1
   git commit -m "feat(roster): prioritize admissions data for current session 2025-26 with non-destructive merge"
   ```
3. Push changes to GitHub (strictly manual):
   ```bash
   git push origin main
   ```
