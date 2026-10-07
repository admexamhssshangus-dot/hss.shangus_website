# Changes Since Last Commit

## Commit Message

`fix(admin): derive archive range and exclude current session`

## Files Changed

1. `src/portal/admin/AdvancedReports.jsx` — Derives the historical archive range from the available non-current regular sessions, so the button and loaded-state text update automatically as sessions change. The full-history action now excludes current-session records from the displayed historical list, and its confirmation and status text no longer use fixed years.
2. `CHANGES_SINCE_LAST_COMMIT.md` — Recorded this change, its verification, commit message, and manual Git instructions.

## Verification

- `npm run build` completed with exit code 0.
- No Firebase security rules were changed; rules deployment was not needed.

## Review, Amend, and Push Manually

1. Inspect the local commit: `git log -1 --stat` and `git show --check HEAD`.
2. To amend or re-execute the commit if desired: `git reset --soft HEAD~1` followed by `git commit -m "fix(admin): derive archive range and exclude current session"`.
3. Push only when ready: `git push origin main`.
