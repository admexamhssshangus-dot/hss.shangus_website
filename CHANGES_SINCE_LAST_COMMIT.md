# Changes Since Last Commit

## Commit Message

`docs: archive current session admissions precedence and student roster implementation plan`

## Summary of Changes

1. **Archived Implementation Plan (`docs/archive/CURRENT_SESSION_ADMISSIONS_PRECEDENCE_PLAN.md`)**:
   - **Institutional Context & Duplicity Diagnostic**:
     - Documented the current state where session `2025-26` records exist in both `admissions` (the primary live source holding rich subject choices, streams, parentage, phone numbers, form numbers, and registration details) and `masterRegisters` (permanent archive).
     - Confirmed that this duplicity will be eliminated upon annual session rollover.
   - **Comprehensive Portal Ingestion Audit**:
     - Audited all modules fetching student cohorts: `PracticalsPage.jsx`, `TeacherAssessmentsPage.jsx`, `AttendancePage.jsx`, `AdminPracticals.jsx`, `AdminGkTestManager.jsx`, `AdminDashboard.jsx`, and `studentDataFetcher.js`.
     - Pinpointed why `masterRegisters` currently wins in Teacher Practicals and School Assessments: `masterDocs` was iterated first in candidate arrays and occupied `uniqueMap` slots first, discarding the richer `admissions` entries.
   - **Step-by-Step Implementation Blueprint**:
     - **Phase 1**: Inverting candidate loop precedence in `PracticalsPage.jsx` for active session `2025-26`.
     - **Phase 2**: Inverting candidate loop precedence in `TeacherAssessmentsPage.jsx`.
     - **Phase 3**: Non-destructive field-level merging in `uniqueMap` to preserve historical exam roll numbers or saved marks while using `admissions` as the base authority for subjects, stream, and parentage.
     - **Phase 4**: Rollover automation safety and forward-compatibility for `2026-27+`.
     - **Phase 5**: Complete testing and verification checklist.

## Files Changed

1. `docs/archive/CURRENT_SESSION_ADMISSIONS_PRECEDENCE_PLAN.md`
2. `CHANGES_SINCE_LAST_COMMIT.md`

## Verification

- **Production Build**: Verified with `npm run build` (Exit Code 0, all 12 public HTML pages generated, zero breaking errors, zero SEO regressions).
- **Rule Compliance**: Complies with Practicals & Academic Evaluation Data Boundary Rule (Rule 8) and Manual Git Push Policy (Rule 5).

## Manual Git Push Instructions

1. Inspect the local commit:
   ```bash
   git log -1 --stat
   ```
2. If you wish to amend or re-commit:
   ```bash
   git reset --soft HEAD~1
   git commit -m "docs: archive current session admissions precedence and student roster implementation plan"
   ```
3. Push changes to GitHub (strictly manual):
   ```bash
   git push origin main
   ```
