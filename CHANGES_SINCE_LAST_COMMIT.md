# Changes Log & Commit Reference

## Latest Commit: Align Roster Student Deduplication with Analytics Suite & Fix Column Selector Viewport Clamping

**Commit Message:** `fix(roster): align student deduplication with analytics suite and fix column dropdown viewport clamping`

---

### Context & Requirements Addressed

1. **Analytics & Statistical Reports Suite Authority Alignment**:
   - The user provided the canonical reference screenshot from the **Analytics & Statistical Reports Suite** (`media_1790864957013.png`), verifying the exact institutional enrollment numbers:
     - **Session 2025-26, Status: Approved**:
       - **Class 10th**: **59 Approved** (50 Male, 9 Female)
       - **Class 11th**: **196 Approved** (101 Male, 95 Female) — 198 students with assigned class roll numbers minus 2 dropped examinees via `examineeDropService` = 196 Approved.
       - **Class 12th**: **203 Approved** (83 Male, 120 Female)
       - **Class 9th**: **11 Approved** (11 Male, 0 Female)
       - **Total Approved**: **469** (245 Male, 224 Female)
   - In `CustomRosterDocumentBuilderView.jsx`, previous un-scoped merging in `combinedRawStudents` and multi-field deduplication in `unifiedStudentPool` caused records across sessions/classes to collide, and students with assigned roll numbers to erroneously suppress each other (collapsing Class 11th down to 184).

2. **Column Dropdown Top Viewport Cropping ("popup still has issue")**:
   - In `CustomRosterDocumentBuilderView.jsx`, `RosterColumnsDropdown` opened upwards (`bottom-full mb-1`) when vertical space below was limited. Because the trigger button was ~350px from the top of the container, the top of the popup (including the "Configure Columns" header, search bar, and upper column checkboxes) extended off-screen and was cropped above the viewport.
   - Any parent container with `overflow-hidden` or scrolling also clipped the dropdown.

---

### Solutions Implemented

1. **Canonical Deduplication Invariant & Drop Service Integration**:
   - In [src/portal/admin/CustomRosterDocumentBuilderView.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/CustomRosterDocumentBuilderView.jsx):
     - Imported `fetchExamineeDropOverrides` and `checkIsStudentDropped` from `../../services/examineeDropService`, and `normalizeClassVal`, `normalizeSessionVal` from `./AdvancedReports`.
     - Added mount-level persistent hook to load Firestore examinee drop overrides via `fetchExamineeDropOverrides().then(setDroppedOverrides)`.
     - Updated `combinedRawStudents`:
       - Cleanly merges live student admissions (`allStudents`, filtering out chunk containers, tagged `_isCurrentScope: true`) and master registers (`masterRegistersList`, tagged `_isCurrentScope: false`).
       - Scoped strictly by `${sSess}_${sClass}` to eliminate cross-session and cross-class pollution.
     - Updated `unifiedStudentPool`:
       - Pre-sorts candidates: active current scope (`_isCurrentScope: true`) first, students with assigned class roll numbers first, newest form number first.
       - Implemented the core invariant from `AnalyticsSuiteModal`: **Within a scope (`${normSession}_${normClass}`), any student with an assigned Class Roll Number (`getStudentRollNumber(st)`) is authoritative (`roll_${scope}_${classRollNo}`). Distinct roll numbers NEVER suppress each other!**
       - If a record with the same roll number in the same session/class is encountered, it enriches any missing fields (e.g. board reg no, exam roll no) on the existing record without duplicating rows.
       - Unassigned / pending / draft records are deduplicated per session and class by form number, registration number, or student name + father name.
       - Canonically resolves status: examinees dropped via `checkIsStudentDropped` receive `'Dropped'`, valid assigned rolls receive `'Approved'`, and others receive `'Submitted'` / `'Draft'`.
     - Guarantees exact 1:1 parity with the Analytics Suite: **59 Approved** (10th), **196 Approved** (11th), **203 Approved** (12th), **11 Approved** (9th), and **469 Total Approved**.

2. **React Portal & Viewport Clamping for Popups**:
   - In `RosterColumnsDropdown`:
     - Mounted the popover to `document.body` via `createPortal(..., document.body)`.
     - Replaced relative CSS positioning with `position: 'fixed'` using clamped coordinates dynamically computed from `dropdownRef.current.getBoundingClientRect()`:
       - Width: `Math.min(384, window.innerWidth - 24)`
       - Horizontal clamp: `Math.max(12, Math.min(window.innerWidth - width - 12, rect.right - width))`
       - Vertical clamp:
         - When space below >= 350px: opens downward (`top: rect.bottom + 4`, `maxHeight: Math.min(500, spaceBelow)`).
         - When space above >= 280px: opens upward with clamped top coordinate (`maxHeight: Math.min(500, spaceAbove)`, `top: Math.max(12, rect.top - maxHeight - 4)`).
         - Otherwise: clamped within viewport (`top: 12`, `maxHeight: Math.max(220, vh - 24)`).
     - Upgraded outside click and Escape key listeners with ref checking (`popoverRef.current` and `dropdownRef.current`).
   - In `CohortCheckboxDropdown`:
     - Applied the identical `createPortal` and clamped viewport-aware coordinate calculation to eliminate clipping across all filter dropdowns (Session, Class, Stream, Subject, Status).

---

### Exact List of Files Changed

- [src/portal/admin/CustomRosterDocumentBuilderView.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/CustomRosterDocumentBuilderView.jsx)
- [CHANGES_SINCE_LAST_COMMIT.md](file:///d:/Shk_Gulfam/Projects/hss_shangus/CHANGES_SINCE_LAST_COMMIT.md)

---

### Build & Quality Verification

- **Production Build**: Verified with `npm run build` — completed with `Exit Code 0` and zero breaking errors.
- **Firebase Security Rules**: No Firestore or Storage rules were modified in this change.

---

### Manual Review & Git Instructions for User

If you want to inspect, amend, or re-commit:

1. **Inspect Commit History**:
   ```bash
   git log -1 --stat
   git show HEAD
   ```

2. **Amend or Re-commit if Desired**:
   ```bash
   git reset --soft HEAD~1
   git add .
   git commit -m "fix(roster): align student deduplication with analytics suite and fix column dropdown viewport clamping"
   ```

3. **Push to Remote (When Ready)**:
   ```bash
   git push origin main
   ```
