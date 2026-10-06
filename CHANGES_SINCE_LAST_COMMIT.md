# Changes Since Last Commit

## Commit Message

`chore(footer): update developer website link`

## Summary

- Updated both developer attribution links in the public footer from the former Netlify address to the canonical NexLif Technologies website.
- Kept all existing developer branding, contact links, and footer behavior unchanged.
- Confirmed no remaining source references point to the former `nexliftech.netlify.app` address.

## Files Changed

1. `src/components/Footer.jsx`
2. `CHANGES_SINCE_LAST_COMMIT.md`

## Verification

- `npm run build`: passed with exit code 0; the production bundle, generated public pages, and SEO regression checks completed successfully.
- Existing non-blocking lint warnings remain elsewhere in the project; this change introduced no build error.
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
