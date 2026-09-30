# Changes Log & Commit Reference

## Current Working Changes

### 1. Fix for "Same as in class 11th" Showing as Stream in Master Gazette & Analytics
- **User Request Addressed:**
  - *"why certain show stream wrongly as 'same as in 11th"*
- **Root Cause Analysis:**
  - In Class 12th admission forms (and Google Forms imports), the stream field for 12th students offered or recorded `"Same as in class 11th"`, indicating the candidate continued in their 11th stream.
  - In `ConsolidatedGazetteView.jsx`, `rawStream` was extracted directly from `student['Stream & Subjects for Class 12th']` or `student.stream`. The code previously checked:
    ```javascript
    let resolvedStream = (rawStream && rawStream.toLowerCase() !== 'general' && rawStream !== '-' && rawStream !== '—') ? rawStream : '';
    ```
  - Because `"Same as in class 11th"` is truthy and not `'general'`, it accepted this literal placeholder string as the final stream value.
  - As a result, all fallbacks were skipped:
    1. It never checked `student['Stream opted in Class 11th']` (which had the actual stream, e.g. "Science").
    2. It never checked `catalogMatch.stream`.
    3. It never inferred stream from the candidate's enrolled subjects (e.g. Physics, Chemistry, Botany, Zoology, Health Care).
    4. It never inferred stream from recorded marks in the test.
    5. In the stream filter dropdown (`All`, `Science`, `Arts`, `Commerce`), filtering by `Science` completely excluded these candidates because `"Same as in class 11th"` does not contain `"science"`.
- **Key Changes Implemented:**
  1. **Canonical Stream Resolution in `ConsolidatedGazetteView.jsx`**:
     - Imported and integrated `resolveCertificateStream` and `streamMatches` from `src/utils/certificateStudentResolution.js`.
     - Explicitly checks and rejects any placeholder value matching `/same as/i`, `'—'`, `'-'`, `'null'`, `'undefined'`, or `'n/a'`.
     - Prioritizes explicit stream fields: `Stream opted in Class 11th`, `Stream for Class 12th`, `Stream for Class 11th`, `selectedStream`, etc.
     - Performs fallback matching against verified student catalog and historical records.
     - Infers stream from enrolled subjects (`biolog`, `botany`, `zoology`, `physic`, `chemist`, `math` => `Science`; `political`, `history`, `education`, `sociology`, `urdu`, etc. => `Humanities`).
     - Infers stream from examined subject marks (`PH`, `CH`, `BO`, `ZO`, `MA` => `Science`; `HT`, `PS`, `ED`, `SO`, `UR` => `Humanities`).
     - Upgraded stream filtering in the gazette to use `streamMatches(r.stream, selectedStream)`, enabling seamless multi-stream matching (e.g., "Arts" matches "Humanities").
  2. **Canonical Stream Resolution in `studentDataFetcher.js`**:
     - Updated `STREAM_KEYS` to include `Stream opted in Class 11th`, `Stream for Class 12th`, `Stream for Class 11th`, `Stream Studied in Class 11th`, `Stream & Subjects for Class 12th`, and `faculty`.
     - In `getStudentStream(s)`, ignores any value matching `/same as/i` and infers stream from enrolled subjects.
  3. **Candidate Stream Resolution in `AdminGkTestManager.jsx`**:
     - Imported `getStudentStream` and updated `BulkImportCandidatesModal` candidate stream filtering to use canonical stream resolution instead of naive property access.

---

## Files Added / Modified
- `src/portal/admin/ConsolidatedGazetteView.jsx` (Modified)
- `src/portal/admin/AdminGkTestManager.jsx` (Modified)
- `src/utils/studentDataFetcher.js` (Modified)
- `CHANGES_SINCE_LAST_COMMIT.md` (Modified)

---

## Local Commit Message
```bash
fix(gazette): resolve actual academic stream instead of placeholder 'Same as in class 11th'
```

---

## Instructions for User: Review & Push
All changes have been built and verified locally (`npm run build` completed with Exit Code 0), staged, and committed to your local Git repository.

### How to Inspect the Local Commit:
```bash
git log -1 --stat
```

### How to Amend or Re-commit (if desired):
```bash
git reset --soft HEAD~1
git commit -m "fix(gazette): resolve actual academic stream instead of placeholder 'Same as in class 11th'"
```

### How to Push to Remote (Manual Step):
As per strict workspace policy, remote git push is never performed by the assistant. When you are ready, run:
```bash
git push origin main
```
