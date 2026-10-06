# Changes Since Last Commit

## Commit Message

`fix(auth): resolve serverless firestore credential mismatch and restore direct admin login`

## Summary

- **Resolved Firestore Credential Instance Mismatch**: Exported `cert` and `getApp` from `functions/firebaseAdmin.js` and updated `netlify/functions/staff-command.js` to initialize `businessAdmin` using `(businessAdmin.cert || cert)(...)`. This ensures `credential instanceof ServiceAccountCredential` evaluates successfully inside the Firestore client SDK across distinct `node_modules` installations, fixing the `"Failed to initialize Google Cloud Firestore client with the available credentials"` runtime error.
- **Synchronized Default Admin 2-Step Verification**: Changed `"enableAdmin2StepVerification"` to `false` in `public/slides/settings.json` to match `DEFAULT_SETTINGS` in `settingsLoader.js`. This allows authorized administrators (such as `e.educational.24@gmail.com`) to sign in directly with their verified credentials without being forced into an unconfigured email challenge.
- **Added Regression Verification**: Added a dedicated test in `scripts/staff-command.test.cjs` ensuring `businessAdmin` exports `cert` matching its internal runtime.

## Files Changed

1. `functions/firebaseAdmin.js`
2. `netlify/functions/staff-command.js`
3. `public/slides/settings.json`
4. `scripts/staff-command.test.cjs`
5. `CHANGES_SINCE_LAST_COMMIT.md`

## Verification

- `node scripts/staff-command.test.cjs`: passed (7 tests).
- `npm run test:public`: passed (9 tests).
- `npm run security:check`: passed.
- `npm run admission:check`: passed (83 schema fields classified).
- `npm run performance:check`: passed.
- `npm run build`: completed with exit code 0; production bundle, 11 public HTML pages, and SEO checks passed.
- Verified in Node.js that `businessAdmin.firestore()` initializes with `db: true` without throwing `invalid-credential`.

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
