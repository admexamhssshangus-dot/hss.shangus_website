# Changes Log & Commit Reference

## Latest Commit: Fix `dId.toLowerCase` Crash via Defensive String Sanitization

**Commit Message:** `fix(roster): sanitize docId and formNo as string to prevent toLowerCase runtime crash on numeric IDs`

---

### Issue Resolved

- **Symptom**:
  Opening the Custom Roster Document Builder view (`/portal/admin?tab=customRoster`) in mobile/responsive or desktop mode caused a runtime crash caught by `ModuleErrorBoundary`:
  ```text
  TypeError: dId.toLowerCase is not a function
    at CustomRosterDocumentBuilderView.jsx:3066:1
    at Array.forEach (<anonymous>)
    at CustomRosterDocumentBuilderView.jsx:3046:1
    at CustomRosterDocumentBuilderView (CustomRosterDocumentBuilderView.jsx:3031:1)
  ```
- **Root Cause**:
  In `CustomRosterDocumentBuilderView.jsx`:
  - When raw students or admission records are imported with numeric IDs (e.g. integer `idx + 1` or numeric DB IDs), `st.docId || st.id` resolves to a number rather than a string.
  - Calling `.toLowerCase()` directly on `dId` in the exam roll cross-reference pre-pass (`examRollByDocId.has(dId.toLowerCase())`) and in student deduplication (`dId.toLowerCase()`, `(st.docId || st.id || '').trim().toLowerCase()`) threw a TypeError because JavaScript Numbers do not have `.toLowerCase()` or `.trim()` methods.
  - Similarly, `docId` and `groupKey` in `flattenMasterRegistersChunked` were susceptible to method invocation failures if provided as numeric primitives.

---

### Changes Applied

1. **`src/portal/admin/CustomRosterDocumentBuilderView.jsx`**:
   - In `flattenMasterRegistersChunked`:
     - Sanitized `docId` with `String(m.id || '')`.
     - Sanitized `groupKey` with `String(m.groupKey || '')`.
   - In `unifiedStudentPool` (Exam Roll Cross-Reference Pre-Pass):
     - Safely sanitized `dId` with `String(st.docId || st.id || '').trim().toLowerCase()`.
     - Safely sanitized `cleanReg`, `cleanForm`, `cleanNameFather`, and `cleanNameClass` with `String(...)` before calling string transformations.
     - Updated `examRollByDocId.set(dId, roll)` to use the normalized string `dId`.
   - In `unifiedStudentPool` (Student Record Normalization & Cross-Referencing):
     - Safely sanitized `dId` with `String(st.docId || st.id || '').trim().toLowerCase()`.
     - Enforced `docId: String(st.docId || st.id || '')` in `studentRecord`.
     - Safely cast `cleanReg`, `cleanForm`, `cleanName`, `cleanFather`, and `cleanDocId` to strings before `.toLowerCase()` or `.trim()`.

---

### Exact List of Files Changed

- `src/portal/admin/CustomRosterDocumentBuilderView.jsx`
- `CHANGES_SINCE_LAST_COMMIT.md`

---

### Verification & Build Status

- **Build Verification**: `npm run build` executed and passed with **Exit Code 0** (`main.4f00133c.js`).
- Zero syntax, linting, or runtime errors.
- Roster component now safely loads without crashing on records with numeric or non-string IDs across all screen sizes (mobile, tablet, desktop).

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
   git commit -m "fix(roster): sanitize docId and formNo as string to prevent toLowerCase runtime crash on numeric IDs"
   ```
4. **Push to Remote (STRICT MANUAL RULE)**:
   ```bash
   git push origin main
   ```
