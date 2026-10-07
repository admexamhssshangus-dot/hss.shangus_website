# Changes Since Last Commit

## Commit Message

`fix(security): decouple AnalyticsSuite from masterSeedData and untrack sensitive databases`

## Files Changed & Remediated

1. `src/portal/admin/AnalyticsSuiteModal.jsx`:
   - Decoupled legacy fallback from `src/data/masterSeedData.json`.
   - Connected fallback directly to authenticated `getMasterRegistersScoped({ forceAll: true })` from `src/services/dbCache`.
   - Eliminated the 5.57 MB client bundle chunk (`1193.*.chunk.js`) containing 192,000+ lines of student PII from Webpack production builds.
2. `public/slides/settings.json`:
   - Sanitized test payment gateway identifiers (`cashfree.appId` and `razorpay.keyId`) to clean empty values `""`.
3. `db_30 Jul 2026.xlsx`:
   - Untracked from the Git index. Retained safely on local disk for offline script use, strictly ignored by `.gitignore`.
4. `src/data/masterSeedData.json`:
   - Completely removed from the project tree and Git index.
5. `Git History Purge (All 1,180 Historical Commits Rewritten via git-filter-repo)`:
   - `db_30 Jul 2026.xlsx` permanently expunged across all historical commits.
   - `src/data/masterSeedData.json` permanently expunged across all historical commits.
   - `public/slides/admins.json` (admin credentials) permanently expunged across all historical commits.
   - `public/slides/faculty_roster.csv` & `faculty_roster_custom.csv` (staff PII) permanently expunged across all historical commits.
   - `public/slides/messages.json` (contact inquiries) permanently expunged across all historical commits.
   - Historical node_modules bloat (`netlify/functions/node_modules/`, `functions/node_modules/`) permanently expunged.
   - Plaintext secret key string (`admin@4737`) scrubbed and replaced with `[REDACTED_SECRET]` across all historical commit diffs.

## Verification

- `git log --all -- "db_30 Jul 2026.xlsx"` verified empty (0 commits).
- `git log --all -- "src/data/masterSeedData.json"` verified empty (0 commits).
- `git log --all -- "public/slides/admins.json"` verified empty (0 commits).
- `git log -S "admin@4737"` verified empty (0 commits).
- `npm run build` executed and completed with Exit Code 0 and all 12 public pages and SEO checks verified.
- The 5.57 MB chunk `1193.*.chunk.js` is completely gone from the build output.
- Full safety backup of the original `.git` directory saved at: `C:\Users\SHEIKH GULFAM\.gemini\antigravity-ide\brain\c2f99f6d-ad83-437b-9943-1af9f79cf706\scratch\git_backup`.

## Instructions for User: Manual Remote Force-Push & Secret Rotation

Because Git history has been rewritten to strip sensitive records from past commits, all commit SHAs have changed. A one-time force-push is required to update the remote repository:

1. **Review local Git log**:
   ```bash
   git log -n 5 --stat
   ```
2. **Force push all branches to GitHub** (Run manually whenever you are ready):
   ```bash
   git push origin --force --all
   git push origin --force --tags
   ```
3. **If you ever need to restore the pre-purge state**:
   The safety backup of the original `.git` directory is preserved in the scratch backup folder.
4. **Secret Rotation Recommendation**:
   Following standard NIST/OWASP security practices, rotate the admin password and any API keys that were ever committed in earlier versions of the repository.

