# Changes Log & Commit Reference

## Current Working Changes

### Practicals — Fix Subject Resolution for Class 12 Attendance

- **Bug Reported:** Subjects column in attendance sheet showed "SAME AS IN CLASS 11TH" for many Class 12 students; subject-specific attendance lists were not being generated correctly.

- **Root Cause:**
  - Class 12 admission records store `Subjects to be taken in Class 12th` as the literal text *"Same as in Class 11th"* (copied from the admission form).
  - The old `getAbbreviatedSubjects()` function picked up this text, ran it through keyword mapping (no subject keywords found), and fell through to return it uppercased → **"SAME AS IN CLASS 11TH"**.
  - The subject filter inside `printAttendanceSheet` had the same broken inline reading, so `stSubs` became `"same as in class 11th"` → no physics/chemistry/etc. keywords matched → subject-specific filtering produced wrong lists.

- **Fix:**
  - Introduced a new internal helper `resolveStudentSubjectsRaw(st, className)` that:
    - Iterates candidate subject fields in priority order.
    - **Detects and skips** any value matching `/same\s+as\s+(in\s+)?class\s*(11|eleventh)/i`.
    - Falls back to stream-based derivation: Science → `EN, PH, CH, BI`; Non-Med → `EN, PH, CH, MA`; Arts → `EN, UR, ED, PS, EC`; Commerce → `EN, AY, BS, EC, MA`.
  - `getAbbreviatedSubjects()` now calls `resolveStudentSubjectsRaw()` — correctly shows actual subject codes for all Class 12 students.
  - `printAttendanceSheet` filter now calls `resolveStudentSubjectsRaw()` — subject-specific attendance lists now correctly include only students enrolled in the selected subject.

---

## Files Added / Modified
- `src/utils/practicalsPdfGenerator.js` — Added `resolveStudentSubjectsRaw()`; fixed `getAbbreviatedSubjects()` and attendance filter to use it.
- `CHANGES_SINCE_LAST_COMMIT.md` — Updated memory log.

---

## Local Commit Message
```bash
fix(practicals): resolve 'Same as in Class 11th' placeholder in subjects display and attendance filter
```

---

## Instructions for User: Review & Push
All changes have been built and verified locally (`npm run build` completed with Exit Code 0), staged, and committed to your local Git repository.

### How to Inspect the Local Commit:
```bash
git log -1 --stat
git show HEAD
```

### How to Amend or Re-commit (if desired):
```bash
git reset --soft HEAD~1
git commit -m "fix(practicals): resolve 'Same as in Class 11th' placeholder in subjects display and attendance filter"
```

### Manual Push (Mandatory Policy):
Per project rules, automatic remote pushes are strictly disabled. When you are ready to publish these changes to remote, please run:
```bash
git push origin main
```
