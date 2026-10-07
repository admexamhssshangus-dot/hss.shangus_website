# Changes Since Last Commit

## Commit Message

`fix(practicals): preserve web table column sort order in print generators`

## Files Changed

1. `src/utils/practicalsPdfGenerator.js` — Updated `printMarksRecordAwardRoll`, `printAttendanceSheet`, `printAllIndividualAwardRolls`, `printFailList`, and `printIndividualAwardRoll` to support `preserveOrder` defaulting to `true`. Avoids overriding the caller's student order with mandatory exam roll re-sorting, ensuring printed award sheets preserve the exact sequence shown on the web interface.
2. `src/portal/admin/AdminPracticals.jsx` — Explicitly passed `preserveOrder: true` across Evaluation & Attendance print triggers (`printMarksRecordAwardRoll`, `printAttendanceSheet`, `printAllIndividualAwardRolls`, `printFailList`). Refined `examRoll` column sorting with natural numeric comparison and proper fallback to class roll number.
3. `src/portal/teacher/PracticalsPage.jsx` — Updated print handlers (`handlePrintFilledAwardRoll`, `handlePrintBlankMarksRecord`, `handlePrintBlankAwardRoll`, `handlePrintAttendanceSheet`) to pass `sortedStudents` with `preserveOrder: true` so the Teacher workspace table sorting is faithfully mirrored in printouts.
4. `CHANGES_SINCE_LAST_COMMIT.md` — Documented the changes, verification steps, commit message, and manual Git push instructions.

## Verification

- `npm run build` executed and completed with Exit Code 0 and all SEO checks passed.
- No Firebase security rules (`firestore.rules` or `storage.rules`) were modified, so rules deployment was not required.

## Review, Amend, and Push Manually

1. Inspect the local commit: `git log -1 --stat` and `git show --check HEAD`.
2. To amend or re-execute the commit if desired: `git reset --soft HEAD~1` followed by `git commit -m "fix(practicals): preserve web table column sort order in print generators"`.
3. Push only when ready: `git push origin main`.
