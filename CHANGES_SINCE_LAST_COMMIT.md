# Changes Log & Commit Reference

## Latest Commit: Move IT & ITES Awards from Internal to Pre-Board Test & Clear Internal Slots

**Commit Message:** `data(practicals): migrate IT and ITES evaluation awards from Internal Assessment to Pre-Board Test for 10th, 11th and 12th`

---

### Summary of Changes

1. **Migrated IT & ITES Evaluation Awards from Internal to Pre-Board Test**:
   - **Context**: The IT & ITES teacher (Aafaq Ishfaq, `jaz.s416@gmail.com`) accidentally submitted evaluation awards under `Internal Assessment` instead of `Pre-Board Test` for Classes 10th, 11th, and 12th.
   - **Migration Operations Completed**:
     - **Class 10th**:
       - Source: `10th_IT and ITES_Internal Assessment_2025-26` (60 candidates).
       - Target: `10th_IT and ITES_Pre-Board Test_2025-26` (60 candidates, `maxMarks: 50`, `minMarks: 18`, status: `approved`).
     - **Class 11th**:
       - Source: `11th_IT and ITES_Internal Assessment_2025-26` (51 candidates).
       - Target: `11th_IT and ITES_Pre-Board Test_2025-26` (51 candidates, `maxMarks: 50`, `minMarks: 18`, status: `approved`).
     - **Class 12th**:
       - Source: `12th_IT and ITES_Internal Assessment_2025-26` (39 candidates).
       - Target: `12th_IT and ITES_Pre-Board Test_2025-26` (39 candidates, `maxMarks: 50`, `minMarks: 18`, status: `approved`).

2. **Backed Up and Cleared Internal Assessment Slots**:
   - Backed up all original documents to `practicalsBin` in Firestore and wrote a local snapshot to `scripts/backups/it_internal_awards_backup_*.json`.
   - Safely deleted the 3 old `Internal Assessment` documents from `practicalsData` so the slot is completely vacant and ready for the upcoming internal assessments to be conducted in a few days.
   - Recorded administrator audit entry in `activityLogs`.

3. **Retained Migration Utility**:
   - Documented and archived `scripts/migrate_it_awards_to_preboard.mjs` for reproducibility.

---

### Files Modified / Created

- `scripts/migrate_it_awards_to_preboard.mjs` — Automated database migration utility.
- `CHANGES_SINCE_LAST_COMMIT.md` — Updated with complete documentation of this operation.

---

### Verification Results

- Database state verified in Firestore:
  - `10th_IT and ITES_Pre-Board Test_2025-26`: **ACTIVE (60 records, maxMarks: 50)**
  - `11th_IT and ITES_Pre-Board Test_2025-26`: **ACTIVE (51 records, maxMarks: 50)**
  - `12th_IT and ITES_Pre-Board Test_2025-26`: **ACTIVE (39 records, maxMarks: 50)**
  - All 3 old `Internal Assessment` documents: **DELETED / VACANT FOR UPCOMING INTERNAL**
- `npm run build`: **Exit Code 0**, all checks passed.

---

### Instructions for User Review & Push

To inspect or review the commit:
```bash
git log -1 -p
```

If you wish to amend or re-commit:
```bash
git reset --soft HEAD~1
git commit -m "data(practicals): migrate IT and ITES evaluation awards from Internal Assessment to Pre-Board Test for 10th, 11th and 12th"
```

To push to the remote repository (Mandatory Manual Rule):
```bash
git push origin main
```
