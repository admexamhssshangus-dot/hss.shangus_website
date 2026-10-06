# Changes Since Last Commit

## Commit Message

`fix(settings): preserve cloud social links`

## Summary

- Diagnosed the missing footer icons: the deployed static fallback contains Facebook, YouTube, and X, but an older partial Cloud `site/settings.socialLinks` value can hide YouTube and X after it is cached.
- Made Firestore the authoritative first read when the local settings cache is absent. The public JSON file is now used only for offline/recovery fallback, while the cached Cloud document is retained for 20 minutes to control reads.
- Restored the official YouTube and X links as safe recovery values for legacy partial Cloud settings, without replacing any non-placeholder URL already stored in Firestore.
- Protected generic Admin Portal saves from replacing a saved social URL with stale empty or `#` placeholders. Intentional admin saves now merge the latest Cloud social-link values before writing settings.
- Confirmed the Netlify build configuration does not perform a Firebase write; deployments themselves do not overwrite Firestore content.

## Files Changed

1. `src/components/Footer.jsx`
2. `src/pages/AdminPortal.jsx`
3. `src/utils/settingsLoader.js`
4. `CHANGES_SINCE_LAST_COMMIT.md`

## Verification

- `npm run security:check`: passed.
- `npm run performance:check`: passed.
- `npm run test:public`: passed (9 tests).
- `npm run build`: passed with exit code 0 (production bundle, public pages, and SEO checks completed). Existing non-blocking lint warnings remain in the project.
- `git diff --check`: passed with no whitespace errors.

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
