# Changes Summary Since Last Commit

## Commit Summary
- **Commit Message**: `fix(practicals): immediately purge deleted awards across Firestore and exclude deleted subjects from print matrix`
- **Date**: October 02, 2026
- **Status**: Production Build Passed (`Exit Code 0`), verified locally.

---

## Architectural Purpose & Issues Resolved

### 1. Instant Deletion Reactivity & Comprehensive Firestore Document Purge
- **Problem**:
  - When an administrator deleted an award submission (e.g., Mathematics 10th award submitted by Mushtaq Sir), the award would be moved to the recycle bin, but its trace or empty slot would continue to show in the Consolidated Award Roll printout as columns of dashes (`-`), and the forwarding cover letter would still certify student awards for that subject.
  - Furthermore, `moveSubmissionToRecycleBin` previously only targeted `submissionDoc.id`. If a submission had a pending variant (`pending_...`) or canonical variant (`..._clean`), or matching slot record in Firestore `practicalsData`, the lingering record could cause state desynchronization.
  - In `AdminPracticals.jsx`, `handleDeleteSubmission` only filtered local state with a simple ID match (`s.id !== subId`) without invalidating caches or triggering an authoritative reload from Firestore.
- **Resolution**:
  - **Comprehensive Multi-Variant Deletion (`practicalsBinService.js`)**:
    - `moveSubmissionToRecycleBin` now extracts all identifier variants (`cleanId`, `pendingId`, `targetDocId`, `canonicalDocId`) and deletes each variant from Firestore `practicalsData`.
    - Automatically queries `practicalsData` for any matching active documents sharing the same `session`, `className`, `evaluationType`, and `subjectCode`/`subject`, deleting them as well to prevent orphan records.
  - **Authoritative Cache Invalidation & Reload (`AdminPracticals.jsx`)**:
    - `handleDeleteSubmission` immediately closes the modal (`setSelSub(null)`).
    - Comprehensively cleanses local React state (`submissions` and `pendingApprovals`) by removing matching IDs, aliases, and matching class/subject/session tuples.
    - Invalidates all localStorage and sessionStorage caches (`practicals_submissions_cache`, `practicals_submissions_cache_meta`, `practicals_meta_v1`).
    - Executes `await loadData(true)` to pull the fresh ground-truth state directly from Cloud Firestore.

### 2. Consolidated Print & Export Ghost Subject Filtering
- **Problem**:
  - The Consolidated Award Roll print engine (`printConsolidatedAwardRoll`), Excel export (`exportConsolidatedAwardsToExcel`), and Word export (`exportConsolidatedAwardsToDocx`) previously populated the subject matrix columns using all enrolled board curriculum subjects (`PRACTICAL_SUBJECT_DEFS` or `defaultSubDefs`).
  - When an award was deleted or not yet submitted, the table rendered empty columns filled with dashes (`-`), and the Page 1 Forwarding Cover Letter gist table falsely declared certified student award counts for subjects with no active marks.
- **Resolution**:
  - **Submission Verification Utility (`hasSubjectPracticalSubmission`)**:
    - Created and exported `hasSubjectPracticalSubmission(subCode, submissions, className, evaluationType, isExternal)` in `practicalsPdfGenerator.js`.
    - Checks whether a subject actually has active approved submissions with non-empty, non-dash marks for the target class and evaluation type.
  - **Smart Active Subjects Filtering**:
    - In `printConsolidatedAwardRoll`, `exportConsolidatedAwardsToExcel`, and `exportConsolidatedAwardsToDocx`, when multiple subjects are displayed, `activeSubs` is filtered to only include subjects with live submitted marks (`subsWithMarks`). If only a single subject is explicitly selected by the administrator, that specific subject remains targeted.
    - The Page 1 Forwarding Cover Letter gist table now includes only live submitted subjects with genuine examinee counts, ensuring accurate institutional certification.

### 3. UI Indicators & "Live Only" Quick Selection
- In `AdminPracticals.jsx` (`AwardsSummaryView`):
  - Added `subjectsWithSubmissions` memo to identify subjects with active marks in the current class and evaluation type.
  - Added a **"Live Only"** quick-select button in the Subjects checklist dropdown alongside "Select All" and "Clear All".
  - Added green **"Live"** and muted **"Empty"** indicator badges for each subject in the dropdown checklist.
  - Added status dots (`●` for live awards, `(No Award)` for unsubmitted/deleted subjects) in the Target Subject dropdown.
  - Consolidated print and export launcher actions (`printConsolidatedAwardRoll`, `exportConsolidatedAwardsToExcel`, `exportConsolidatedAwardsToWord`, `printAllIndividualAwardRolls`) now automatically pass live submitted subjects when "All Subjects (Consolidated)" is chosen.

---

## Files Changed

1. `src/services/practicalsBinService.js`:
   - Enhanced `moveSubmissionToRecycleBin` to purge all ID variants (`targetDocId`, `canonicalDocId`, `pendingId`) and matching class/subject/session documents from Firestore `practicalsData`.
2. `src/portal/admin/AdminPracticals.jsx`:
   - Enhanced `handleDeleteSubmission` with modal auto-close, comprehensive state filtering, cache invalidation, and `loadData(true)` reload.
   - Added `subjectsWithSubmissions` memo, "Live Only" quick-select, badge indicators, and filtered print/export invocation.
3. `src/utils/practicalsPdfGenerator.js`:
   - Implemented and exported `hasSubjectPracticalSubmission`.
   - Filtered `activeSubs` in `printConsolidatedAwardRoll` to omit deleted or unsubmitted subjects from matrix columns and cover letter counts.
4. `src/utils/practicalsCsvManager.js`:
   - Integrated `hasSubjectPracticalSubmission` into `exportConsolidatedAwardsToExcel` and `exportConsolidatedAwardsToDocx` to eliminate ghost columns and ensure correct gist counts.

---

## Verification & Build Details
- **Production Build**:
  - `npm run build` -> `Exit Code 0` (Zero breaking errors).
- **SEO & Static Checks**:
  - 11 static pages generated, canonical redirects, routing, and sitemap verified.

---

## Instructions for User

### Reviewing the Local Commit
To inspect the changes made in this commit:
```bash
git log -n 1 --stat
git show HEAD
```

### Amending or Re-committing (Optional)
If you wish to make additional adjustments before pushing:
```bash
git reset --soft HEAD~1
# Make desired adjustments
git add .
git commit -m "fix(practicals): immediately purge deleted awards across Firestore and exclude deleted subjects from print matrix"
```

### Pushing Changes
Whenever you are ready to update the remote repository, run:
```bash
git push origin main
```
*(As per repository safety guidelines, remote git pushes are performed exclusively by the user.)*
