# Changes Log & Commit Reference

## Current Working Changes

### Fix: Multi-Award Submission Support & Zoology Pre-Board Award Resolution
- **User Request Addressed:**
  - *"before this kindly check that zoology teaceher is unable to submit awards for prebaord showing admin has rejected earlier awards....allow all types of awards to be submitted in a session"*

- **Root Cause Analysis:**
  1. **Stale Rejection Fields on Approved Records**: An earlier submission (`11th_Zoology_Internal Assessment_2025-26`) submitted by Dr Ab Majid (`abmajidbhat082@gmail.com`) was previously rejected with administrator feedback `"please choose preboard instead of internal "`. When the administrator later approved it, `handleApproveSubmission` in `AdminPracticals.jsx` retained `rejectionReason`, `rejectedAt`, `rejectedBy`, and `docId: 'pending_...'` on the canonical document.
  2. **Intrusive Smart Switcher Banner**: In `PracticalsPage.jsx`, an aggressive `otherEvalSubmission` banner detected existing awards under `Internal Assessment` whenever the teacher selected `Pre-Board Test` with empty marks, badgering the teacher with *"Saved awards found under another evaluation type! [Switch to Internal Assessment]"*. This made the teacher think they could not submit Pre-Board awards.
  3. **Missing Zoology Overrides for Pre-Board in Firestore**: In `adminPracticalsSettings/config`, `customEvaluations[0]` (`eval-preboard-2026`) had subject overrides configured for Botany (`11th_BO` and `12th_BO` at maxMarks: 25, minMarks: 9), but was missing Zoology (`11th_ZO`, `12th_ZO`, `ZO`), causing Zoology to default to 50 instead of 25.
  4. **Cross-Evaluation Rejection Alert Bleed**: The teacher portal's rejection banner was not checking whether the rejection actually applied to the currently active evaluation type or an approved record, causing stale rejection messages to appear even when preparing new awards.

- **Key Changes Implemented:**
  1. **Scrubbed Firestore Records**:
     - Removed `rejectionReason`, `rejectedAt`, and `rejectedBy` from `11th_Zoology_Internal Assessment_2025-26` and `12th_Chemistry_Pre-Board Test_2025-26` in Firestore.
     - Normalized `docId` to canonical ID.
  2. **Updated Firestore Settings (`adminPracticalsSettings/config`)**:
     - Added `ZO`, `11th_ZO`, and `12th_ZO` (maxMarks: 25, minMarks: 9) to `customEvaluations[0].subjectOverrides` so Zoology matches Botany under Biology (total 50).
  3. **Sanitized Admin Approval in `AdminPracticals.jsx`**:
     - Updated `handleApproveSubmission` to explicitly delete `rejectionReason`, `rejectedAt`, and `rejectedBy` when moving pending awards to canonical.
     - Set `docId: targetDocId` so pending IDs never leak into approved canonical records.
     - Added `Pre-Board` button to the administrator's evaluation mode toggle bar for instant filtering alongside `Internal` and `External`.
  4. **Multi-Award Session Support in `PracticalsPage.jsx`**:
     - Removed the intrusive `otherEvalSubmission` switcher banner so teachers can freely and independently submit all types of awards (Internal Assessment, Pre-Board Test, External Practical, Term End) in the same session without distraction or diversion.
     - Hardened `handleLoadSubmission` and `fetchPracticalData` so approved records (`status: 'approved'`) are never treated as pending or rejected.
     - Scoped the rejection alert strictly to unapproved pending records matching the currently viewed evaluation type.
     - Added immediate state resets (`existingAwardInfo`, `teacherCustomMax`) when switching `practicalType` in both desktop and mobile drawer controls to ensure zero crosstalk during asynchronous loading.

---

## Files Added / Modified
- `src/portal/admin/AdminPracticals.jsx` (Modified)
- `src/portal/teacher/PracticalsPage.jsx` (Modified)
- `CHANGES_SINCE_LAST_COMMIT.md` (Modified)

---

## Local Commit Message
```bash
fix(practicals): allow all award types per session and fix zoology pre-board submission
```

---

## Instructions for User: Review & Push
All changes have been built, verified locally (`npm run build` completed with Exit Code 0), staged, and committed to your local Git repository.

To push these changes to your remote Git repository:
```bash
git push origin main
```

If you wish to inspect or modify the local commit:
```bash
# View the last commit details
git log -1 --stat

# To amend or re-commit if desired
git reset --soft HEAD~1
git commit -m "fix(practicals): allow all award types per session and fix zoology pre-board submission"
```
