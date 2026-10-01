# Changes Log & Commit Reference

## Latest Commit: Fix Gazette & Scorecard Result Resolution for Absent Subjects Across All Classes

**Commit Message:** `fix(gazette): prevent pass for absent subjects and distinguish poor performance vs absent across all classes`

---

### Root Cause Analysis

In `src/portal/admin/ConsolidatedGazetteView.jsx`:
1. When evaluating subject marks, absent subjects (`AB`) incremented `absentSubjectsCount`, but did not increment `failedSubjectsCount`.
2. When evaluating the overall pass condition (`hasMarks && !isAllAbsent && !hasFail`), candidates who appeared in and passed at least one subject while being absent in all others (such as candidate **Abroo Jan** with English `19/50` and absent in `PH`, `CH`, `BO`, and `PD`) had `hasFail === false` and `isAllAbsent === false`. Consequently, the algorithm incorrectly marked the student as **`PASS`** with **`Third Division`** (7.6%).
3. When candidates had both numeric failures and absent subjects (such as candidate **Malika Tariq** and **Sahita Bashir**), the absent subjects were grouped into `reappearSubjects` and labeled indiscriminately as `Poor Performance in (PH, CH, PD)`, incorrectly mislabeling absent subjects as poor performance.

---

### Summary of Changes

1. **Strict Multi-Class Result Resolution (`ConsolidatedGazetteView.jsx`)**:
   - Enforced across all classes (**10th, 11th, and 12th**):
     - **Absent in all subjects**: Result is `ABSENT`, Grade is `Absent`.
     - **Passed all enrolled subjects** (0 fails, 0 absents): Result is `PASS`, Grade awarded by percentage (`Distinction`, `First Division`, `Second Division`, `Third Division`).
     - **Failed subjects only** (0 absents): Result is `Poor Performance in (<failed_subjects>)`, Grade is `—`.
     - **Absent in some subjects only** (0 fails): Result is `Absent in (<absent_subjects>)`, Grade is `—`. Student cannot pass.
     - **Both failed and absent subjects**: Result is `Poor in (<failed_subjects>), Absent in (<absent_subjects>)`, Grade is `—`.
   - Tooltip details on hover: Lists full breakdown of `Passed: ... • Poor: ... • Absent: ...`.
   - Result Filter: Selecting `Absent` now filters both fully absent candidates and partially absent candidates.
   - Passed cohort statistics: Only students who have passed 100% of their enrolled subjects are counted towards `Passed` and `Pass Rate`.

2. **Admin Modal Alignment (`AdminGazetteRecordEditModal.jsx`)**:
   - Cleanly separated `failedCodes` and `absentCodes` in the live assessment preview engine.
   - Result badge dynamically updates to `PASS`, `ABSENT`, `Poor in (...), Absent in (...)`, `Poor Performance in (...)`, or `Absent in (...)`.

3. **Public Result Lookup & Scorecard Alignment (`PublicResultLookup.jsx`)**:
   - Updated overall status evaluation so any candidate with non-passed subjects (`!s.isPass`, including absent) cannot be marked `SATISFACTORY` or given a division.
   - Added automated test cases in `PublicResultLookup.test.jsx` verifying that partial absent candidates receive `NEEDS IMPROVEMENT` / `Scope for Improvement` and never `PASS` or a passing division.

---

### Files Modified

- `src/portal/admin/ConsolidatedGazetteView.jsx` — Core gazette calculation, result badges, filter handling, and tooltip descriptors.
- `src/portal/admin/AdminGazetteRecordEditModal.jsx` — Administrative edit modal live metrics and result badge calculation.
- `src/pages/PublicResultLookup.jsx` — Public student result lookup and scorecard overall descriptor logic.
- `src/pages/PublicResultLookup.test.jsx` — Test suite verifying absent subject handling and overall descriptors.
- `CHANGES_SINCE_LAST_COMMIT.md` — Updated log and manual commit instructions.

---

### Verification Results

- `cmd /c "set CI=true && npm test -- src/pages/PublicResultLookup.test.jsx --watchAll=false"`: **21/21 tests passed (Exit Code 0)**.
- `npm run build`: **Exit Code 0** (production build created, 11 static pages generated, SEO regression check passed).

---

### Instructions for User Review & Push

To inspect or review the commit:
```bash
git log -1 -p
```

If you wish to amend or re-commit:
```bash
git reset --soft HEAD~1
git commit -m "fix(gazette): prevent pass for absent subjects and distinguish poor performance vs absent across all classes"
```

To push to the remote repository (**Mandatory Manual Rule**):
```bash
git push origin main
```
