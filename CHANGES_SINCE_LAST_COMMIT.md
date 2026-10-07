# Changes Since Last Commit

## Commit Message

`fix(admin): correct historical data range in session filter`

## Files Changed

1. `src/portal/admin/AdvancedReports.jsx` — Updated the full-history button label from `2006–2023` to `2006–2024, Oct–Nov` so it includes the 2024-25 (Oct-Nov) archive shown in the session list. The full-history fetch behavior is unchanged.
2. `CHANGES_SINCE_LAST_COMMIT.md` — Recorded this change, its verification, commit message, and manual Git instructions.

## Verification

- `npm run build` completed with exit code 0.
- No Firebase security rules were changed; rules deployment was not needed.

## Review, Amend, and Push Manually

1. Inspect the local commit: `git log -1 --stat` and `git show --check HEAD`.
2. To amend or re-execute the commit if desired: `git reset --soft HEAD~1` followed by `git commit -m "fix(admin): correct historical data range in session filter"`.
3. Push only when ready: `git push origin main`.
