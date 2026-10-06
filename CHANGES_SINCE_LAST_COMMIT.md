# Changes Since Last Commit

## Commit Message

`fix(auth): align backend requireStaff with authoritative 2SV settings`

## Summary

- **Synchronized Backend `requireStaff` with Authoritative 2SV Settings**: Updated `functions/access.js` to inspect `site/settings` in Firestore for `enableAdmin2StepVerification` before enforcing `adminSessions` session token verification. When 2-Step Verification is disabled, authorized administrators who sign in directly are permitted to execute staff commands without a missing `adminSessions` rejection. When 2-Step Verification is enabled, the server-bound proof is strictly required with zero password-only bypass.
- **Added Comprehensive Unit Tests**: Added unit tests in `scripts/public-records.test.cjs` verifying that `requireStaff` cleanly permits direct administrator commands when 2SV is disabled and strictly enforces `adminSessions` when 2SV is enabled.

## Files Changed

1. `functions/access.js`
2. `scripts/public-records.test.cjs`
3. `CHANGES_SINCE_LAST_COMMIT.md`

## Verification

- `npm run test:public`: passed (10/10 tests, including new `requireStaff` 2SV check).
- `node scripts/staff-command.test.cjs`: passed (7/7 tests).
- `npm run security:check`: passed.
- `npm run admission:check`: passed (83 schema fields classified).
- `npm run performance:check`: passed.
- `npm run build`: completed with exit code 0; production bundle, 11 public HTML pages, and SEO checks passed.

## Instructions for the User

1. Review the local commit:

   ```bash
   git show --stat HEAD
   git log -1 -p
   ```

2. Amend or recreate the commit if you prefer another message:

   ```bash
   git reset --soft HEAD~1
   git commit -m "Your custom commit message"
   ```

3. Push manually when ready. This project workflow deliberately never pushes automatically:

   ```bash
   git push origin main
   ```
