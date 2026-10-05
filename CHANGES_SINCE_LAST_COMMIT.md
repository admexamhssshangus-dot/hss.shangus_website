# Changes Since Last Commit

## Commit Message
`fix(practicals): make marks record award rolls 100% blank for manual teacher scoring and add print dropdown to teacher workspace`

## Date & Time
- **Timestamp**: 2026-10-05T10:30:00+05:30

## Files Changed
1. `src/utils/practicalsPdfGenerator.js`:
   - Updated `printMarksRecordAwardRoll` to remove automatic marks injection from previous database submissions.
   - Enforced 100% blank, spacious cells for `Pract Copy / Assignment`, `Viva Voce`, and `Total` columns so subject teachers can write marks manually with pen during practicals/viva evaluation.
   - Enhanced student ordering using `sortRecordsForAwardRoll` to ensure clean sequential sorting by Exam Roll No. / Class Roll No.
   - Dynamically injected configured subject `Max Marks` into the official document header.
   - Removed unused `clsTarget` variable to ensure zero build warnings.

2. `src/portal/admin/AdminPracticals.jsx`:
   - Clarified print menu labels and descriptions:
     - Item 1: `Print Blank Marks Record Sheets (All N Subs)` / `Print Blank Marks Record — [Subject]` with description `100% Blank Pract Copy, Viva Voce & Total for manual teacher evaluation`.
     - Item 5: `Print Consolidated Cover Letter & Awards Matrix` with description `Official forwarding letter + awards submitted online by teachers`.

3. `src/portal/teacher/PracticalsPage.jsx`:
   - Added `showPrintMenu` state and dropdown in the evaluation toolbar.
   - Imported and wired `printMarksRecordAwardRoll` via `handlePrintBlankMarksRecord` with real-time settings passing.
   - Allowed teachers to choose between:
     1. **Print Blank Marks Record**: 100% blank for manual scoring during practical exams and institutional paper archiving.
     2. **Print Official Award Roll (JKBOSE)**: 2-column layout (Figures & Words) showing the marks as submitted online.

## Verification
- Verified production build via `npm run build` (Completed with `Exit Code 0`, all 11 public SEO pages verified, zero breaking errors).

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
