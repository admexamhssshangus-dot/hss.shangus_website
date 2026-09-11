# Audit implementation and release plan — 10 September 2026

The main authorization and data-integrity fixes from the earlier audit have been implemented locally. This report supersedes the implementation status in `CODEBASE_AUDIT_RECHECK_2026-09-10.md`; that file describes the older revision before these fixes. The original attached LLM plan was checked against the actual code in the initial audit, rather than treated as proof that a problem existed or had been fixed.

The review covered authentication, staff administration, public verification/results, admissions, imports, archival/rollback, practicals, attendance, fund distributions, certificates/PDFs, the website CMS, cache behavior and shared dashboard components. Existing teacher mobile changes and the concurrent Political Science/IT classification fix were preserved. Some early changes were included in commit `e8176577` while this implementation was in progress; the final implementation commit contains the remaining work.

**This is not a declaration that every module is fully optimized or that production is already protected.** The application, both backend deployments, account migration and security rules must be released together. No live student data, staff accounts, deployed rules or hosting sites were changed by this work.

## Changes implemented

| Audit area | Current behavior | Main implementation |
| --- | --- | --- |
| F01 Certificate verification | Requires an exact active issuance, registration and document type. Server reads the source record and rejects revocation, missing sources and changed cohorts. Enrollment matches do not imply issuance. Generic certificate exports register an issuance before export. | `netlify/functions/lookup-student.js`, `functions/issuedDocuments.js`, certificate studio |
| F02 Public data | Employee recycle-bin reads require an assigned administrator. Public pages no longer import the student catalog or practicals seed. Public lookup responses project limited identity/result fields. | Firestore rules, public lookup handlers/pages |
| F03 Admin verification | Server-generated inbox proof is single-use and expiring; approval creates a server-owned session bound to the original sign-in's `auth_time`. Neither anonymous callers nor an authenticated administrator can write an approval or mint a session. The legacy CMS entry now requires the shared verified session. | `functions/staffSecurity.js`, shared staff auth, login/portal/CMS guards |
| F04 Staff lifecycle/module access | UID profiles are authoritative. Only Super Admin manages staff accounts; changes revoke prior sessions/tokens and remove legacy email-key profiles. Current module permissions are checked by rules and privileged backend commands. A delayed Auth-create trigger cannot overwrite a provisioned staff profile. | `functions/access.js`, staff management, rules |
| F05 Admission ownership | Unverified email claims no longer grant access to an ownerless legacy application. Explicit UID ownership remains supported. | Admission workflow and rules |
| F06 Public results/grading | One backend endpoint reads current published assessments. Missing expected subjects, duplicate marks and invalid scales produce pending results; a failed subject takes precedence over aggregate division. The admin gazette uses the same grading implementation. Approval follows the existing class-roll invariant on both backends. | `public-result.js`, shared assessment helpers, gazette |
| F07 Bulk identity | A unique match must agree with supplied identifiers and the selected class/session. Writes preserve physical document IDs and nested archive locations. No name-only or other-cohort fallback. | `recordIdentity.js`, bulk overwrite, board importer |
| F08 Rollback | Each successful edit and its before-image commit in the same transaction. Undo restores changed fields and rejects later conflicting edits. Newly created importer records are separately tracked. Legacy batches without before-images refuse destructive automatic undo. | `recordMutationService.js`, CSV batch manager |
| F09 Archival | Reads only the selected session, preserves existing archive documents, and commits each backup with a minimal source pointer atomically. Retries resume stable destinations. Issued certificates can follow one validated master-register pointer; private archival trash cannot be followed publicly. | `sessionArchivalService.js`, public source resolution |
| F10 Admit cards | Awaiting/pending/admit-card imports do not overwrite a final result or its marks/division. Existing students keep their physical source and identity. | `jkboseResultManager.js` |
| F11 Teacher submissions | Server checks current staff access, class/subject assignment, cohort membership, marks components/ranges, submission identity and locks. Attendance saves/backfills report success only after a backend commit. Administrative practicals CSV imports retain their explicit administrator capability. | `academicRecords.js`, teacher pages, rules |
| F12 Shared-browser privacy | Firestore document cache uses memory. Legacy persistent cache cleanup, private photo memory storage, logout cleanup and service-worker cache versioning reduce retained private data. | Firebase initialization, dbCache/sessionManager, service worker |
| F13 Funds | Server calculates amounts from saved rates, validates available enrollment and updates a shared cohort lock inside the allocation transaction. Concurrent allocations cannot both use the same balance. Client retries reuse the request ID. | `fundLedger.js`, fund UI |
| F14 Quick Edit | Reinitializes when opening a student, rejects ambiguous archive rows and saves through the before-image mutation service. | Quick Edit modal, record mutation service |
| F15 Governance/save feedback | Matching and rollback protection are displayed as required protections. Express-entry enablement is checked at save and in rules. Settings and subject changes no longer claim successful cloud persistence after a failure. | Controls, Express entry, rules |
| F16 Dashboard/lookup behavior | Stable module error boundaries retain tab state; a root boundary handles render failures. Public lookups use a bounded request with cancellation instead of catalog/Firestore/endpoint waterfalls. | App/dashboard boundaries, backend endpoint service |
| F17 PDF normalization | Home Science precedes generic Science; placeholder values do not override useful aliases. Existing Political Science and IT fixes are retained. | PDF utilities and regression tests |
| F18 Import template compatibility | Column labels and canonical keys are recognized by the overwrite parser. | Bulk overwrite parser |
| Additional SDK/security fixes | Migrated function initialization to Admin SDK v14 modular services; legacy field names containing periods use literal Firestore FieldPath queries. Hosting CSP permits the configured Firebase callable origin. Compatible dependency security updates and official SheetJS 0.20.3 installed. | Backend initialization, headers, package locks |

## Verification

- 23 Jest suites / **122 tests passed**, including existing admission, certificate, mobile portal and PDF tests, plus identity, rollback, archival, admit-card protection and client/backend policy parity. The additional results-page error-state suite also passed: **123 unit tests across 24 suites**, counting the full run and final focused run.
- **26 Firestore authorization checks passed** against `demo-hss-security`, including successful legitimate module writes as well as negative authorization cases.
- **9 backend integrity checks passed** against the same local emulator: assigned and unassigned submissions, locks, blank marks, wrong cohorts, unpublished/incomplete results, and concurrent fund allocation with server-calculated totals and idempotent retry.
- **9 public verification/access tests passed**, including unissued/revoked certificates, wrong document type, archival redirects, changed cohorts and expired sign-in proof.
- Security, admin-performance and admission regression scripts passed; admission checks classify 83 schema fields and verify provisional/full PDF page counts.
- All 12 Firebase function exports load successfully with the installed SDK.
- `npm run build` completed with exit code 0, generated ten public pages and passed SEO/routing/privacy checks. Existing lint warnings remain. The final rebuild covering the results-page error-state refinement also completed with exit code 0.
- Firestore and Storage rules compiled successfully in Firebase's dry run; no rules were published. The compiler reports two unused legacy validation helpers.
- In the local production preview, `/admin/portal` redirects unauthenticated visitors to `/portal/login`. The verification page renders an explicit unavailable state at 390 × 844 with no false validity claim. Public results render at that width; a configuration failure now displays its error and disables empty-assessment search.

Tests use synthetic records. Emulator tests exercise backend business functions and rules, but do not exercise production SMTP delivery, real App Check enforcement, live hosting headers, real staff accounts or provider quotas. Authenticated browser acceptance tests remain a release gate.

Useful commands:

```text
npm run build
node node_modules/react-scripts/scripts/test.js --watchAll=false --runInBand
npm run security:check
npm run performance:check
npm run admission:check
npm run test:public
npm run test:integrity
```

The integrity command needs Firebase CLI, Java 21+ and installed dependencies in both backend folders. On this Windows host the emulator needed a short writable socket directory via `JAVA_TOOL_OPTIONS=-Djdk.net.unixdomain.tmpdir=<short local directory>`; that setting was applied only to the test process. A portable Java runtime and test logs are in ignored `.codex-audit/`, not committed.

### Screenshot follow-up — 11 September

The supplied screenshot shows `beginAdminVerification` failing its CORS preflight from `http://localhost:3000`. A read-only OPTIONS check against `https://us-central1-hsssdb.cloudfunctions.net/beginAdminVerification` returned **HTTP 404 with no Access-Control-Allow-Origin header**. The callable is unavailable at the configured endpoint; this is not solved by weakening browser CORS or bypassing administrator verification. The popup `window.closed`/COOP warnings are separate from that missing backend response.

After configuring the Firebase function environment and verifying the project/region, publish the new callable functions with `firebase deploy --only functions --project hsssdb`, then complete the coordinated rules/client/backend rollout described below. This deployment was not performed by the audit task. Until then administrator sign-in using the new verification flow cannot complete against that live endpoint.

## Dependency assessment

### Login configuration follow-up — 11 September

- Gmail SMTP authentication passed without sending an email. The custom function's mail settings are stored in ignored `functions/.env`; Firebase Authentication's SMTP console configuration is separate.
- Enabled the previously disabled Firebase App Check API in `hsssdb`. Registered the project's existing score-based Enterprise key for the configured web app and corrected the ignored local site-key configuration. The separately supplied key was not found in this project's key list.
- Registered a private workstation debug token and stored it only in ignored `.env.development.local`. It must not be placed in `.env.local`: existing whole-environment references can embed otherwise unused values in production bundles. Development builds can opt into this registered token; production builds do not enable debug mode. A real debug-token exchange returned HTTP 200 and issued an App Check token. Restart the development server to load these settings.
- Deployment of only `beginAdminVerification`, `approveAdminVerification`, and `cancelAdminVerification` was attempted after SMTP validation and renewed user authorization. Google rejected the required Artifact Registry API activation because the project's billing account is not open. No login functions were deployed. The earlier approval-review rejection is no longer the current blocker.
- The user must link an active billing account/enable the appropriate Firebase plan before retrying Cloud Functions deployment. Billing was not changed. Live Netlify environment settings and deployment also remain pending; the current Enterprise key allows `hssshangus.netlify.app`. Other live domains need explicit key configuration before rollout.
- Successful App Check attestation is not an end-to-end login test. Administrator inbox approval and the remaining release gates still require the deployed backend and matching live client/rules.

The final production-only audit reports **zero known vulnerabilities** for the frontend; compatible updates also cleared all reported advisories in both backend dependency trees. This is an advisory snapshot, not proof that dependencies contain no defects.

The full frontend dependency audit still reports **30 development-tool advisories: 14 high, 7 moderate and 9 low**, largely in the old Create React App/Jest/Webpack toolchain. Do not use `npm audit fix --force`: its proposed downgrade/removal of `react-scripts` is not a safe repair. Migrate the build tooling as a separate tested change. The spreadsheet parser is a runtime dependency and was upgraded using the [official SheetJS distribution](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/). The function startup change follows the [Admin SDK release notes](https://firebase.google.com/support/release-notes/admin/node).

## Release requirements, in order

1. **Reconcile staff accounts before rollout.** Identify email-key profiles and missing Auth users; approve intended roles/module permissions and migrate to `users/{Firebase Auth UID}`. Assign each teacher's subject and classes or explicit practicals permissions. Do not automatically promote accounts based on old unsigned browser/email-directory data. Use the protected Super Admin lifecycle command for changes. New staff setup sends password and email-verification links.
2. **Configure backend services.** Firebase functions need `SMTP_USER`, `SMTP_PASS` and the canonical HTTPS `STAFF_PORTAL_ORIGIN`. Keep App Check enabled and verify its configured web key/domains. Netlify needs its service account and a random `LOOKUP_RATE_SECRET` of at least 32 characters; preserve existing admission/AI provider secrets. Configure `REACT_APP_BACKEND_ORIGIN` if using a host other than the known deployment origins. The default Firebase callable region is `us-central1`; update CSP if the project/region changes.
3. **Prepare authoritative data.** Publish only intended assessments with correct session/classes and marks schemes. Repair duplicate/missing student identifiers. Save fund accounts and rates before generating distributions. Historical records with only an `Approved` flag but no valid class roll remain unapproved under the project's existing invariant. Review them instead of silently counting them.
4. **Deploy both backends, then the matching client/rules/headers in a coordinated window.** This commit does not perform deployments. Standalone client or rules deployment can leave login, teacher submissions, generic certificates or public results unavailable until the required callable/Netlify functions exist. Previously issued generic certificates need a verified issuance backfill; do not fabricate issuance from student enrollment alone.
5. **Run live acceptance with approved test accounts/data.** Check administrator password/Google sign-in and inbox approval; teacher assignment and locked marks; save/reload attendance; admission ownership and submission; issue/revoke a test certificate; public published/unpublished results; fund create/edit/delete; interrupted imports and rollback; selected-session archival and subsequent QR verification; mobile keyboard/print/PDF flows. Check actual hosting CSP/App Check and email delivery. Delete only explicitly created test data through the supported workflow.
6. **Verify old public artifacts are removed from the deployed sites/CDNs.** The new build stops shipping the student catalog/seed to public pages, but it cannot retract copies already downloaded. Confirm removed URLs, old JavaScript bundles/source maps and service-worker caches on both hosts. Close old portal tabs when upgrading shared computers so legacy IndexedDB cleanup can finish.

## Remaining implementation plan

| Priority | Work | Acceptance condition |
| --- | --- | --- |
| P1 — release gate | Staff UID reconciliation, backend environment and coordinated deployment | Real accounts authenticate through the new proof flow; no role recovery relies on client state; all authorized modules survive reload. |
| P1 — least privilege | Replace broad student-document reads with purpose-specific teacher/finance projections; move remaining administrative imports, roll allocation and certificate/master-register writes behind field-specific server commands | Direct SDK attempts cannot read unrelated banking/identity fields or change fields outside the assigned module, while all current admin workflows remain supported. Current rules still deliberately trust authorized record-editing modules with broad record access. |
| P1 — historical data | Review duplicate/malformed identities and backfill proven historical certificate issuance | Unique lookups work for approved historical data; revoked/unproven documents remain unverifiable. Public results currently target live admissions; an explicit archive-results policy is needed before adding historical result lookup. |
| P2 — archival concurrency | Move full session rollover orchestration to a server job with a session-wide submission lock | Admissions cannot arrive in the old session between the final scan and active-session change. Current code detects additions before rollover, but that last scan/change interval is not globally locked; schedule archival in a closed-admissions window. |
| P2 — administrative input | Add server uniqueness reservations to every manual/Express import and validated batch ingestion for administrator practicals uploads | Concurrent manual entries cannot duplicate form/registration identities; malformed administrator uploads fail before partially changing a cohort. |
| P2 — UI completion | Add a first-class generic-certificate revoke/history control, resumable import-job UI and explicit partial-batch summaries | Users can review/revoke generic issuances and resume failed batches from the UI. The callable supports revocation; legacy TC/DC revocation remains in its registry workflow. |
| P2 — build/security maintenance | Replace the old CRA toolchain and introduce import file/row limits plus isolated parser work | Clean supported build dependencies, responsive imports on representative large files and no unintended regression in PDFs or SEO output. |
| P2 — performance | Index/paginate public result, cohort, staff-directory and ledger queries; remove remaining collection-wide admin reads | Measured first load and p95 interactive times on representative data; no silent truncation or bound-triggered service errors at larger cohorts. Current endpoints fail explicitly at query bounds. |
| P2 — shared-device privacy | Finish reducing bespoke browser drafts/history/log caches to the minimum needed and verify account switching with open tabs | No previous student's/staff user's data is visible after logout/account switching, including late in-flight reads and old tabs. |
| P3 — design/accessibility | Screen-reader, keyboard and mobile audits across authenticated modules; consistent empty/error/loading states | WCAG-oriented manual checks and browser journeys pass on real desktop/mobile widths, with no save action showing success after failure. |

The rules review is in `FIREBASE_RULES_ASSESSMENT_2026-09-10.json`. Under the Firebase skill's terminology these are prototype Security Rules: they use verified UID authority, expiring admin sessions, default denial and server commands for critical writes. They still require the release review and acceptance checks above before broadly sharing the updated app.
