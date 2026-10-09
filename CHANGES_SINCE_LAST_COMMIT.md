# Changes Since Last Commit

## Commit Message

`feat(bulk-tc-hub): add historical session loading, cohort deduplication, and class-level certificate linking`

## Files Changed

1. **[src/portal/admin/CustomRosterDocumentBuilderView.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/CustomRosterDocumentBuilderView.jsx)**
   - **Canonical Sessions Expanded**:
     - Added `'2026 APR/BIAN'` and `'2025 APR/BIAN'` to `CANONICAL_ACADEMIC_SESSIONS` so active examination cycles are first-class canonical sessions across all administrative studios, document builders, and certificate views.

2. **[src/portal/admin/BulkCertificateGeneratorModal.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/BulkCertificateGeneratorModal.jsx)**
   - **Historical Session Loading Engine**:
     - Preloads contemporary examination cycles (`2026 APR/BIAN` and `2025 APR/BIAN`) automatically on modal open so the latest board results and issued certificates are immediately hydrated in memory.
     - Implemented on-demand session loader (`handleSessionChange`) with an inline loading spinner in the Session dropdown when the admin selects an unhydrated historical session.
     - Added `Load Earlier Sessions` header action button (`handleLoadAllHistoricalSessions`) allowing administrators to query and load all archived master registers (2024-25, 2023-24, etc.) on demand from Firestore without overwhelming client boot performance.
     - Updated `availableSessions` to merge loaded sessions with canonical academic years, showing student counts for loaded sessions and `📥 (Click to load)` indicators for unhydrated sessions.
   - **Cohort Deduplication & Multi-Session Association**:
     - Grouped records in `combinedStudentPool` by `(Registration Key + Class)` (and normalized `name|father + Class`) so provisional admission documents (e.g. `adm_250275` under 2025-26) merge with authoritative examination records (e.g. `mr_2026APRBIAN_...` under 2026 APR/BIAN).
     - Merged record retains `associatedSessions = ['2025-26', '2026 APR/BIAN']` so the student properly appears across both contemporary and admission filters.
   - **Class-Level Certificate & Verified Result Harmonization (e.g., Hamim Rashid)**:
     - Implemented class-tier fallback in `normalizedStudents`: if a student possesses an issued certificate or verified board result in Class 12th across any examination cycle, it is linked to their Class 12th record.
     - Harmonized students like Hamim Rashid: now accurately shows Certificate #1400 (Locked in emerald), Passed status (342/500, 1st Div), Roll No. 301001297, and is excluded from unissued counts and sequential prospective numbers.

---

## Instructions for the User

### 1. How to Review the Local Commit
You can review the changes and commit log locally:
```bash
git log -1 --stat
git show HEAD
```

### 2. How to Amend or Re-commit (Optional)
If you wish to edit the commit message or make adjustments:
```bash
git reset --soft HEAD~1
# Make desired adjustments...
git add .
git commit -m "feat(bulk-tc-hub): add historical session loading, cohort deduplication, and class-level certificate linking"
```

### 3. How to Push to Remote Repository
In accordance with our strict Git safety rules, the assistant never executes `git push`. When you are ready, please push the commit manually:
```bash
git push origin main
```
