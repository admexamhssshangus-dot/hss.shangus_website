# Changes Log & Commit Reference

## Current Working Changes

### 1. Fix Student Identification and Uniqueness in Bulk Ingestion Hub (`BulkFieldOverwriteModal.jsx`)
- **User Requests Addressed:**
  - *"why still shows 197 instead of 198"* (in the Student Data & Board Ingestion Hub / Bulk Overwrite screen)
  - *"use reg no-session-class to find student uniquely"*
- **Root Cause Identified:**
  - In `src/portal/admin/BulkFieldOverwriteModal.jsx`, `buildUniversalPool` previously indexed examinees using `reg_${cls}_${reg}` (omitting academic session) and also generated a loose name key `name_${cls}_${sess}_${sName}_${fName.slice(0, 8)}`.
  - When candidates shared common patronymic prefixes starting with `"Mohammad"` (e.g., *Mohammad Hussain Bhat* and *Mohmmad Sideeeq Mir* for students named *Mehvish Jan*), or when records were merged across pools, distinct examinees with different assigned Class Roll Numbers were erroneously merged into a single entry, causing the cohort count for Class 11th 2025-26 to drop from 198 to 197 on the Bulk Overwrite and Template Download screens.
- **Fix Implemented:**
  - **Authoritative Uniqueness Keying (`reg no - session - class`)**:
    - Registration numbers are strictly indexed with academic session and class: `reg_${reg}_${sess}_${cls}`.
    - Form numbers are keyed with session and class: `form_${fNo}_${sess}_${cls}`.
    - Admission numbers are keyed with session and class: `adm_${adm}_${sess}_${cls}`.
    - Assigned Class Roll Numbers are keyed with session and class: `roll_${roll}_${sess}_${cls}`.
  - **Class Roll Collision Invariant**:
    - When checking candidate keys in `indexMap`, two records that both have assigned Class Roll Numbers in the same session and class (`roll && exRoll && roll !== exRoll`) are **never merged**. Distinct roll numbers are treated as distinct students.
  - **Spreadsheet Row Matching**:
    - Updated `uniqueStudentMatch` calls in `BulkFieldOverwriteModal.jsx` to pass `targetSession` and `targetClass` rather than `'All', 'All'`, strictly enforcing `reg no - session - class` lookup.
  - **Verification**:
    - Simulated universal pool generation against the full dataset (active admissions, master registers, and verified catalog): verified all 198 approved Class 11th 2025-26 candidates (Rolls 1 to 189 and 201 to 209) are uniquely loaded with zero collisions and zero missing rolls.

---

## Files Added / Modified
- `src/portal/admin/BulkFieldOverwriteModal.jsx` (Modified)
- `CHANGES_SINCE_LAST_COMMIT.md` (Modified)

---

## Local Commit Message
```bash
fix(ingestion-hub): use reg no-session-class to find student uniquely and preserve 198 Class 11th candidates
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
git commit -m "fix(ingestion-hub): use reg no-session-class to find student uniquely and preserve 198 Class 11th candidates"
```

### Manual Push (Mandatory Policy):
Per project rules, automatic remote pushes are strictly disabled. When you are ready to publish these changes to remote, please run:
```bash
git push origin main
```
