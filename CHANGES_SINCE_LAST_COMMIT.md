# Changes Log & Commit Reference

## Current Working Changes

### Practicals — Subject-Specific Attendance, Fail/Absent List & Exam Roll Display

- **User Requests Addressed:**
  - *"admin shall be able to print subject specific attendance"*
  - *"turn fail list into fail/absent"*
  - *"ensure exam roll no is displayed in web version of award also"*

---

### 1. Subject-Specific Attendance Sheet

**`practicalsPdfGenerator.js` — `printAttendanceSheet()`:**
- Added `subjectCode` and `subjectName` parameters.
- When a `subjectCode` is provided, filters students to only those enrolled in that subject using the same stream/keyword logic used by award rolls (handles EN=all, PH/CH=science, BI/BO/ZO=bio-science, MA=non-med, and keyword match for all others).
- PDF heading and browser `<title>` both include the subject name (e.g. "Internal Practical Attendance Sheet — HSE-I (Class 11th) — Physics (PH)").

**`AdminPracticals.jsx` — Attendance Button:**
- When exactly **one subject** is selected in the Subjects dropdown → button shows **`Attendance (PH)`** (or whichever code) with a tooltip, and prints subject-specific attendance (only students of that subject).
- When **multiple subjects** selected → button shows **`Attendance`** and prints all students as before.

---

### 2. Fail List → Fail / Absent

- Button label changed: `Fail List` → **`Fail / Absent`**
- PDF heading changed: `ABSENTEE / FAIL STUDENTS LIST` → **`FAIL / ABSENT LIST`**
- Print window title updated to: `Fail & Absent List (...)`
- *(The logic was already collecting both fail + absent records — this was purely a label correction.)*

---

### 3. Always Show Exam Roll in Web Awards Table

- Removed the `!isCurrSession` guard that previously suppressed exam roll numbers for 2025–26 session students (on the assumption rolls aren't issued yet).
- Now shows exam roll whenever the field is populated on the student record, regardless of session year.

---

## Files Added / Modified
- `src/utils/practicalsPdfGenerator.js` — Subject-specific attendance filter logic; renamed fail/absent heading.
- `src/portal/admin/AdminPracticals.jsx` — Smart attendance button (single-subject mode); fail/absent label; always-show exam roll.
- `CHANGES_SINCE_LAST_COMMIT.md` — Updated memory log.

---

## Local Commit Message
```bash
feat(practicals): subject-specific attendance print, rename fail to fail/absent, always show exam roll in web awards table
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
# Make any additional changes if needed
git commit -m "feat(practicals): subject-specific attendance print, rename fail to fail/absent, always show exam roll in web awards table"
```

### Manual Push (Mandatory Policy):
Per project rules, automatic remote pushes are strictly disabled. When you are ready to publish these changes to remote, please run:
```bash
git push origin main
```
