# Production remediation and rollout plan

Updated: 2026-08-24

This repository is connected to a live production site. The changes in this commit are intentionally not deployed automatically.

## Implemented in this commit

- Removed public copies of administrator credentials, contact messages and faculty roster exports.
- Replaced `public/slides/faculty.json` with a generated five-field public projection: name, designation, subject, department and approved photo URL.
- Split Firestore faculty data into admin-only `systemSettings/facultyPrivate`, public `facultyPublic/{memberId}`, and public `site/facultySummary`.
- Made legacy `site/faculty` administrator-only in Firestore rules.
- Moved Gemini calls behind an authenticated, App Check-protected, rate-limited Netlify function with server-only keys and sanitized HTML output.
- Changed admission recovery drafts from persistent local storage to a 30-minute tab session and removed production direct-Firestore fallbacks.
- Added logout cleanup for student/teacher/private browser caches.
- Prevented service-worker caching of API, JSON, CSV and text data.
- Added tombstone routes and no-store headers for retired sensitive URLs.
- Lazy-loaded the large GK test route and improved mobile touch targets, footer semantics and safe-area behavior.
- Removed tracked dependency directories and Windows metadata files from Git while keeping local dependencies installed.

## Required production rollout (manual and ordered)

1. Create a Firestore export/backup and verify a rollback point.
2. In Netlify environment variables, configure `GEMINI_API_KEYS`, `GEMINI_MODEL`, `GEMINI_ALLOWED_MODELS`, `FIREBASE_SERVICE_ACCOUNT_JSON`, `ALLOWED_ORIGINS`, and `REQUIRE_APP_CHECK=true`.
3. Configure `REACT_APP_RECAPTCHA_ENTERPRISE_SITE_KEY` for the production build. Monitor valid App Check traffic before enabling product-level enforcement in the Firebase console.
4. Copy any still-valid Gemini key from `systemSettings/geminiApiConfig` into Netlify, rotate the key, then delete that Firestore document using the Firebase console/Admin SDK. The new rules intentionally deny browser access to it.
5. Deploy the reviewed Firestore rules. Confirm unauthenticated reads of `site/faculty` and `systemSettings/facultyPrivate` fail, while `facultyPublic` reads succeed.
6. Publish the site through the normal Netlify/Git workflow. Confirm the retired URLs return the privacy tombstone/404 with `Cache-Control: no-store`.
7. Sign in as an administrator, open CMS Faculty, verify the recovered legacy records, and use Apply & Save once. This creates `facultyPrivate`, `facultyPublic`, and `facultySummary` and scrubs the legacy `site/faculty` payload.
8. Purge the Netlify CDN cache for the retired files. Treat any administrator password/hash and Gemini key ever committed or served publicly as compromised and rotate it.
9. Remove the sensitive files from public Git history with a coordinated history rewrite (for example, `git filter-repo`) only after all collaborators have been notified and a repository backup exists. A normal deletion commit does not erase old public history.
10. Re-run the smoke/regression checklist below against production before closing the incident.

## Production smoke/regression checklist

- `/slides/admins.json`, `/slides/messages.json`, and both roster CSV URLs expose no prior content.
- Public `faculty.json` and `facultyPublic` contain exactly the five allowed keys.
- Home and Academics fall back cleanly if Firestore is unavailable.
- Admin Faculty Apply & Save retains private fields in the admin editor but never writes them to public JSON/localStorage.
- AI drafting works for an authenticated admin; an unauthenticated call and a call without a valid App Check token fail.
- Student admission draft resume works within the same tab for 30 minutes; logout clears the draft.
- Home, Academics, Admissions, student dashboard/form, teacher attendance and teacher practicals have no horizontal overflow at 360, 390 and 430 CSS pixels.

## Staged follow-up work

### P0 — immediately after rollout

- Rotate exposed credentials/keys and complete public Git-history cleanup.
- Enable Firestore deletion protection and point-in-time recovery after confirming the project retention/cost policy.
- Add automated Firestore Rules unit tests once JDK 21 is available; the current machine cannot start the latest Firebase emulator.

### P1 — teacher data isolation

Current attendance and practical documents do not consistently contain immutable ownership/assignment metadata. Add `teacherUid`, class and subject assignment fields to every writer; backfill existing documents; then restrict teacher reads/writes to assigned class/subject records. Do not tighten this rule before migration because it would lock teachers out of current production records.

### P1 — performance and CI quality gate

- Establish an ESLint baseline and reduce the existing warning backlog until `CI=true npm run build` passes without disabling linting.
- Split the remaining large admin document/report chunks and load export libraries only when their tools open.
- Re-run Lighthouse on representative mobile hardware after deployment and target LCP below 2.5 seconds and TBT below 200 ms.

### P2 — dependency and repository hygiene

- Replace the unmaintained `xlsx` package or isolate spreadsheet parsing server-side; the root audit currently reports high-severity transitive issues.
- Resolve moderate Firebase Admin transitive advisories when upstream-compatible releases are available; avoid a forced downgrade.
- Review and remove generated seed artifacts such as `src/data/cleanPracticalsSeedData.js` only after confirming the migration scripts no longer need them.
