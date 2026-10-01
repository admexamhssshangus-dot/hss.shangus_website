# Changes Log & Commit Reference

## Latest Commit: Fix Duplicate Student Entries & Isolate Class Row Selections in Custom Roster Builder

**Commit Message:** `fix(roster): resolve duplicate student entries and isolate class row selections`

---

### Root Cause Analysis

1. **Brittle Mutually-Exclusive Key in `unifiedStudentPool`**:
   - `unifiedStudentPool` previously created deduplication keys using a chained ternary:
     `regKey ? reg_... : (fNoKey ? form_... : (nameKey ? name_... : doc_...))`
   - In institutional workflows, a student often exists in two databases simultaneously:
     - **Board / Master Register**: Has an official JKBOSE Board Registration Number (`regKey`).
     - **Online Admissions (Google Form Intake)**: Does not have a Board Registration Number yet (`regKey` is blank, falls back to `formKey` or `nameKey`).
   - Because `reg_...` and `form_...` are distinct string keys, the `poolMap.has()` check always returned `false`. Both records were inserted into the pool, causing duplicate rows for the same candidate (e.g. **Arif Maqbool** appearing at both S.No. 72 and S.No. 73 with Class Roll No. 72).

2. **Incomplete Field Extraction in `combinedRawStudents`**:
   - When building `seenMap` for initial deduplication, `s.studentName` was read directly instead of invoking `extractStudentName(s)`.
   - In online admission intake forms, student names are stored under `"Student's Name (as per school records)"`. Consequently, `name` and `father` resolved to empty strings, causing name/father match lookups to fail.
   - Form numbers also retained the `adm_` prefix (e.g. `adm_250054` vs `250054`), preventing form number reconciliation between admissions and master registers.
   - Raw chunk documents with `.data` arrays were not filtered out of `allStudents`.

3. **Unscoped Row Identifiers & Cross-Class Selection Bleed**:
   - `getRosterRowId` returned `reg_${row.boardRegNo}` or `form_${row.formNo}` without scoping to `session` or `className`.
   - If an administrator unchecked a student in Class 11th, the exclusion key stored in `deselectedRowKeys` could bleed into Class 12th if the student had historical records in both classes.

---

### Summary of Changes

1. **Multi-Index Unified Pool Deduplication (`src/portal/admin/CustomRosterDocumentBuilderView.jsx`)**:
   - Replaced the single-key `poolMap` with an index registry (`indexByReg`, `indexByForm`, `indexByDoc`, `indexByNameFather`, and `indexByNameRoll`).
   - When a student record is processed, it checks for an existing record across all 5 indices.
   - If an existing record matches on *any* valid identifier (same registration number, same form number, same docId, or same student name + father name / roll number in that session and class), the records are seamlessly merged, enriching photos, registration numbers, and roll numbers into a single candidate row.
   - All 5 index keys are subsequently linked to the merged record to guarantee bidirectional deduplication regardless of record ingestion order.

2. **Enhanced Extractors & Form Cleaning (`src/portal/admin/CustomRosterDocumentBuilderView.jsx`)**:
   - Updated `combinedRawStudents` to use `extractStudentName`, `extractFatherName`, `extractFormNo`, `extractBoardRegNo`, and `getStudentRollNumber`.
   - Stripped `adm_` prefixes from form numbers to guarantee matching between `adm_250054` and `250054`.
   - Added `!Array.isArray(s.data)` to chunk filtering.

3. **Session- and Class-Scoped Row IDs (`src/portal/admin/CustomRosterDocumentBuilderView.jsx`)**:
   - Updated `getRosterRowId` to return `${sess}_${cls}_${baseId}`.
   - Guarantees that unchecking a student in Class 11th strictly affects Class 11th and never bleeds into Class 12th.
   - Updated table row `key` and photo cell `key` to `rowId` and `photo-${rowId}` for guaranteed key uniqueness.

---

### Exact List of Files Changed

- `src/portal/admin/CustomRosterDocumentBuilderView.jsx`
- `CHANGES_SINCE_LAST_COMMIT.md`

---

### Verification & Build Status

- **Build Verification**: `npm run build` completed with **Exit Code 0** and zero breaking errors.
- **Deduplication Verification**: Verified that duplicate candidate rows merge into a single row with unified exam rolls, photos, and class rolls.

---

### Instructions for User: Manual Review, Amend & Push

1. **Inspect Commit History**:
   ```bash
   git log -n 1 --stat
   ```
2. **Review Code Diff**:
   ```bash
   git diff HEAD~1
   ```
3. **Amend Commit Message (if desired)**:
   ```bash
   git reset --soft HEAD~1
   git commit -m "fix(roster): resolve duplicate student entries and isolate class row selections"
   ```
4. **Push to Remote (STRICT MANUAL RULE)**:
   ```bash
   git push origin main
   ```
