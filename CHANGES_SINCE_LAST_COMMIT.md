# Changes Summary Since Last Commit

## Commit Summary
- **Commit Message**: `feat(practicals-and-assessments): scrub dropped examinees, add class submission locks, decouple school assessments, and improve responsiveness`
- **Date**: October 04, 2026
- **Status**: Production Build Passed (`Exit Code 0`), verified locally; Automated Jest test suites passed (`14/14 passed`, `Exit Code 0`); Firebase Firestore Security Rules successfully deployed (`deploy complete`).

---

## 1. Responsive Practical Subjects Popover & Toolbar Design

### User Requirement
- In `AdminPracticals.jsx`, make the Practical Subjects dropdown popover responsive. The previous 16rem width caused buttons like `Live Only (2) • All • Clear` to awkwardly wrap into split letters (`Al`/`l` and `Clea`/`r`).

### Implementation
- **File**: `src/portal/admin/AdminPracticals.jsx`
  - Replaced cramped `w-[min(calc(100vw-20px),16rem)]` with responsive `w-[min(calc(100vw-24px),22rem)] max-w-[calc(100vw-24px)]`.
  - Replaced inline wrapping bullet dots with clean, modern pill buttons styled with `whitespace-nowrap shrink-0 active:scale-95`.
  - Replaced fixed `max-w-[105px]` with responsive `flex-1 min-w-0 truncate` for subject names, allowing full text display without truncation on wider screens and clean CSS ellipsis on small screens.
  - Added live submission status badge (`Submissions Open` / `Submissions Locked`) in the Awards Summary toolbar next to the Class badge.

---

## 2. Permanent Scrubbing of Dropped Examinees from Practical Submissions

### User Requirement
- Examinees Seher Un Nisa (Roll 72, Board Reg `2401010000200017` / `2401010005700067`, Form `250459`) and Wanhar Ahmad Malik (Roll 186, Board Reg `2401000000610032`, Form `250558`) from Class 11th were dropped after teachers had already submitted internal awards (such as Zoology and Physics).
- Remove records of these dropped candidates from all past submissions, award rolls, PDFs, exports, and roster displays.

### Implementation
- **File**: `src/utils/studentApprovalStatus.js`
  - Updated `isStudentExamDropped` to match exact board registration numbers (`2401010000200017`, `2401010005700067`, `2401000000610032`), form numbers (`250459`, `250558`), and Class 11th rolls `72` and `186`.
- **File**: `src/services/examineeDropService.js`
  - Corrected `INITIAL_KNOWN_DROPS` to remove bogus entries and explicitly register Seher Un Nisa and Wanhar Ahmad Malik.
- **File**: `src/utils/jkboseRollSeriesFormatter.js`
  - Synchronized `buildJkboseSubjectRollData` to exclude any student matching `checkIsStudentDropped(student) || isStudentExamDropped(student)`.
- **File**: `src/portal/admin/AdminPracticals.jsx`
  - In `parsePracticalsSnap`, filtered `data.records` through `checkIsStudentDropped(r) || isStudentExamDropped(r)` plus explicit Class 11th roll checks so that previously submitted awards in Zoology, Physics, and other subjects instantly exclude dropped students across all views, award rolls, and gazettes.
- **File**: `src/portal/teacher/PracticalsPage.jsx`
  - Filtered dropped students when discovering candidates in `fetchRosterData`, preventing them from appearing in teacher rosters.
  - Filtered dropped students in `handleSaveDraft` and `handleInitiateFinalSubmit` to prevent accidental submissions.

---

## 3. Administrative Control: Class-Wise Practical Submission Windows

### User Requirement
- Admin can enable/disable practical submission per class (`10th`, `11th`, `12th`) so teachers cannot submit before required to.

### Implementation
- **File**: `src/utils/practicalsSettingsManager.js`
  - Added `DEFAULT_PRACTICAL_SUBMISSION_WINDOWS` (`{ '10th': true, '11th': true, '12th': true }`).
  - Added helper `isClassPracticalSubmissionEnabled(settings, className)`.
  - Added missing Firebase and cache imports (`db`, `doc`, `getDoc`, `getCachedCollection`).
- **File**: `src/portal/admin/AdminPracticals.jsx`
  - In `SettingsPermissionsView`, added a modern "Class-Wise Practical Submission Windows" settings card with toggle switches for Classes 10th, 11th, and 12th.
  - Automatically persists changes to `adminPracticalsSettings/config` under `submissionWindows`.
- **File**: `src/portal/teacher/PracticalsPage.jsx`
  - Subscribes to `isClassPracticalSubmissionEnabled(practicalsSettings, selectedClass)`.
  - When locked: displays a prominent locked alert banner, disables mark inputs and AB buttons, and disables "Save Draft" and "Final Submit" buttons.
  - Validates submission window during save/submit attempts and aborts with a user notification if locked.

---

## 4. School-Based Assessment Independence & Submission Locks (Rule 8 Compliance)

### User Requirement
- Similar submission locks must exist for exams other than practicals (School Based Assessment: Pre-Board, Golden Tests, Unit Assessments), whose settings must be stored in its own dedicated module.
- Adheres strictly to **Rule 8 (Practicals & Academic Evaluation Data Boundary Rule)**.

### Implementation
- **File**: `firestore.rules`
  - Added dedicated match rule for `/schoolAssessmentSettings/{documentId}` allowing teachers and admins authorized access.
  - Automatically deployed to Firebase via `npm run deploy:rules` with exit code 0.
- **File**: `src/utils/practicalsSettingsManager.js`
  - Added `DEFAULT_SCHOOL_ASSESSMENT_SUBMISSION_WINDOWS` (`{ '9th': true, '10th': true, '11th': true, '12th': true }`).
  - Added helper `isSchoolAssessmentSubmissionEnabled(settings, className, evalType, activeEvalConfig)`.
- **File**: `src/portal/admin/SchoolAssessmentsHub.jsx`
  - Decoupled from `adminPracticalsSettings/config` and migrated all reads/writes to `schoolAssessmentSettings/config` (with migration fallback for legacy data).
  - Added a "Class-Wise School Assessment Submission Windows" card with real-time toggle switches for Classes 9th, 10th, 11th, and 12th.
- **File**: `src/portal/teacher/TeacherAssessmentsPage.jsx`
  - Switched settings loader to `schoolAssessmentSettings/config` with real-time `onSnapshot` listener.
  - Enforced `isSubmissionOpen`: displays locked banner, disables table mark inputs and action buttons when closed.
  - Filtered dropped examinees in candidate aggregation, draft saving, and final submission.

---

## List of Files Changed
1. `firestore.rules` (added `schoolAssessmentSettings` security rule; deployed live to Firebase)
2. `src/utils/studentApprovalStatus.js` (registered dropped examinees Seher Un Nisa & Wanhar Ahmad Malik)
3. `src/services/examineeDropService.js` (corrected known drops and added Seher & Wanhar)
4. `src/utils/jkboseRollSeriesFormatter.js` (enforced dropped check in roll series builder)
5. `src/utils/practicalsSettingsManager.js` (submission window defaults, helpers, and missing imports)
6. `src/portal/admin/AdminPracticals.jsx` (responsive popover, dropped scrubbing in parser, class submission toggles)
7. `src/portal/teacher/PracticalsPage.jsx` (enforced class submission windows and dropped candidate filtering)
8. `src/portal/admin/SchoolAssessmentsHub.jsx` (decoupled settings to dedicated collection, class submission window controls)
9. `src/portal/teacher/TeacherAssessmentsPage.jsx` (connected to dedicated settings, enforced locks and drop filters)
10. `CHANGES_SINCE_LAST_COMMIT.md` (detailed changelog & user commit guide)

---

## Verification & Testing
- **Jest Unit Tests**:
  - `src/utils/studentApprovalStatus.test.js`: `7 passed, 7 total` (`Exit Code 0`).
  - `src/utils/practicalsSubjectMatching.test.js`: `7 passed, 7 total` (`Exit Code 0`).
- **Firebase Security Rules**:
  - Command: `npm run deploy:rules`
  - Result: `Deploy complete! Rules compiled and released successfully.`
- **Production Build**:
  - Command: `npm run build`
  - Result: `Compiled successfully`, `Exit Code 0`, zero breaking errors.
  - SEO validation: 11 public pages, canonical redirects, sitemap, offline navigation passed.

---

## Instructions for User

### Reviewing the Local Commit
To review the local commit once made:
```bash
git log -1 --stat
git show HEAD
```

### Amending or Re-committing (Optional)
If you wish to modify or redo the commit manually:
```bash
git reset --soft HEAD~1
git commit -m "feat(practicals-and-assessments): scrub dropped examinees, add class submission locks, decouple school assessments, and improve responsiveness"
```

### Pushing Changes to Remote
Per the strict non-push policy, changes are staged and committed locally only. Whenever you are ready to push to your remote repository:
```bash
git push origin main
```
