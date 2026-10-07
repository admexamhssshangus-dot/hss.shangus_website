# Changes Since Last Commit

## Commit Message

`feat(portal): add on-demand historical session loading to custom roster and certificate studio`

## Files Changed

1. `src/portal/admin/CustomRosterDocumentBuilderView.jsx` — Added canonical academic sessions catalog (`CANONICAL_ACADEMIC_SESSIONS`) and dynamic Firestore `academicSessions` discovery. Extended `CohortCheckboxDropdown` to display session options with `(Load)` and spinning loading states. Implemented on-demand asynchronous loader via `fetchHistoricalSessionData` (`getAdmissionsBySession` + `getMasterRegistersScoped`) that dynamically fetches and merges unhydrated session records when selected, while keeping the default mount strictly scoped to the current academic session (`2025-26`). Fixed session auto-adjustment to avoid discarding unhydrated valid sessions.
2. `src/portal/admin/StudentCertificateStudioView.jsx` — Integrated canonical academic sessions and on-demand loader in `StudentCertificateStudioView`. Updated `StudioMultiSelectDropdown` to show loading states and trigger fetches on selection. Merged fetched historical records into `combinedStudentPool` and `unifiedStudentDirectory` with multi-layered deduplication and bidirectional session matching (`2024-25` <-> `2024-25 (Oct-Nov)` / `(Mar-Apr)`). Preserved default auto-loading exclusively for the current academic session (`2025-26`).
3. `CHANGES_SINCE_LAST_COMMIT.md` — Documented changes, verification steps, commit message, and manual push guidance.

## Verification

- `npm run build` executed and completed with Exit Code 0 and all SEO checks passed.
- No Firebase security rules (`firestore.rules` or `storage.rules`) were modified, so rules deployment was not required.

## Review, Amend, and Push Manually

1. Inspect the local commit: `git log -1 --stat` and `git show --check HEAD`.
2. To amend or re-execute the commit if desired: `git reset --soft HEAD~1` followed by `git commit -m "feat(portal): add on-demand historical session loading to custom roster and certificate studio"`.
3. Push only when ready: `git push origin main`.
