# Codebase audit and implementation plan

Reviewed: 9 September 2026. Current code baseline: `20e7a30f`.

This review incorporates the manual updates after `450c4a20` and the supplied “Codebase Audit & Comprehensive Optimization Plan”. It covers the public website, student and teacher portals, the administration module catalog, the new assessments/results tools, shared data services, Netlify endpoints, Firebase functions and rules, and hosting configuration.

**Recommendation: fix authorization, public disclosure, record identity, rollback and result correctness before further cosmetic optimization.** Several modules currently labelled Optimized still depend on unsafe shared authorization or mutation paths. Keep maturity labels tied to demonstrated acceptance criteria.

Application fixes have not been implemented in this audit. Findings describe the current repository, not confirmed incidents in production. No live student records were queried or changed, and no messages, deployments or remote Git pushes were performed. Source references below are relative to `D:/Shk_Gulfam/Projects/hss_shangus` and refer to the reviewed baseline.

## Verification and limits

| Check | Current result |
| --- | --- |
| `npm run build` | Exit 0; production bundle generated with non-breaking ESLint warnings. |
| Build SEO checks | Passed; 10 public HTML pages, metadata, sitemap and routing checks. |
| Jest via `node node_modules/react-scripts/scripts/test.js --watchAll=false --runInBand` | 16 suites / 91 tests passed. |
| `npm run security:check` | Passed. These checks primarily inspect source patterns; they do not prove authorization behavior. |
| `npm run performance:check` | Passed. This is a structural regression check, not a measured speed benchmark. |
| `npm run admission:check` | Passed; 83 fields classified, one-page provisional and two-page full form structure. |
| Admission handler / credential checks | Passed earlier in this review; these files did not change in the manual update. |
| Isolated synthetic checks | Confirmed wrong stream resolution, certificate hash computability, public result division error, and fixed QR placeholder normalization. Earlier mocked checks confirmed incorrect ingestion target selection and unverified-email admission reads; their affected functions remain unchanged. |

The initial npm test launcher encountered sandbox child-process `EPERM`; invoking the same CRA test runner directly with serial execution succeeded. The earlier failures in security/performance checks were fixed by your subsequent updates and are **not outstanding failures**.

Live Firebase rules, App Check enforcement, identity providers, deployed Apps Script code, SMTP delivery, real printer output and authenticated browser journeys were not validated. No new dependency vulnerability scan or real-device performance/visual accessibility audit was completed. Those are explicit release gates below, not assumed passes. The OMR companion backend was inspected as a separate prototype; it is not established that it is deployed.

## Assessment of the attached LLM plan

| Proposal | Assessment and required refinement |
| --- | --- |
| Put Class 8/9/10 stream resolution first | Correct. Still broken at `src/utils/pdfGenerator.js:248`. Synthetic Class 9 with General Science returns Science; Class 10 with an explicit Science value also returns Science. Normalize the class once and apply the secondary-class rule before any stream inference. |
| Expand admission-number aliases | Correct, but “100% extraction accuracy” is not a defensible guarantee. `pdfGenerator.js:423` still uses only four aliases. Share a tested normalizer with reports, preserving legitimate leading zeros, separators and re-admission formats; surface ambiguity rather than guessing. |
| Make public results work by importing catalogs/seed marks | Reject this implementation. The permission-denied diagnosis is correct, but a downloadable student dataset bypasses intended record-level access and is not an authoritative publication source. Implement a bounded server endpoint returning a minimal, published result for one uniquely resolved student/evaluation. |
| Skip server lookup after a local verification match | Redundant requests are real, but local catalog membership cannot prove current approval, issuance or revocation. Remove the local catalog as an authority. Resolve verification through one authoritative endpoint with bounded latency and explicit unavailable states. |
| Lint/import/regex cleanup | Useful follow-up, below security and data integrity. Do not suppress hook dependency warnings merely to obtain green output; test stale-closure behavior. Narrow lint exceptions are reasonable for intentional sanitizer fixtures. Current Jest already passes. |
| Existing checks/build as completion proof | Necessary but insufficient. Add behavioral authorization, cross-session identity, rollback, incomplete-results and failure-recovery tests, plus UI and deployment smoke tests. |

Your updates already normalized missing QR fields before signing/serialization (`qrSvgGenerator.js:14,34,89`). That earlier false-signature regression is resolved. The certificate authenticity problem below remains. The new modal Suspense work also does not remove the changing parent boundary key.

## Confirmed unresolved findings, ordered by impact

P1 means resolve before relying on the affected security or official-record workflow. P2 means a meaningful functional/UI regression that should be corrected before promoting its module. These priorities do not assert that exploitation or data loss has already occurred.

### F01 — P1: certificate verification can validate an unissued document

Evidence: `src/utils/qrSvgGenerator.js:34` computes a public 32-bit hash using a fixed suffix. `src/pages/StudentVerificationPage.jsx:153` accepts several legacy signatures, including one excluding certificate number; `:317` fabricates an Approved record from URL parameters when lookup misses; `:483` displays VALID & ISSUED. No secret is necessary to generate a matching hash. A real student's membership in a local catalog also does not establish that the requested certificate was issued.

Implement authoritative issuance/revocation lookup using the certificate registry, exact student identity and document type. An opaque issuance token or server-signed payload must be bound to the registered document. Remove synthetic/seed fallback as proof of authenticity and replace “HMAC”/authentication claims that the code cannot substantiate. A backend outage must return Unavailable, never Verified.

Acceptance: unknown, altered, revoked and unissued certificate fixtures fail; valid issuance succeeds; lookup outages and catalog-only matches never display issued status. Preserve old QR compatibility only where server records substantiate it.

### F02 — P1: private records are exposed through public data paths

Evidence: `src/pages/AdminPortal.jsx:3305` stores the complete deleted employee object in trash; `:199` writes it to `site/recycle_bin`; `firestore.rules:375` allows anonymous reads. Private employee fields can therefore become public through normal delete-and-save operations. Separately, `StudentVerificationPage.jsx:18` statically imports `verifiedStudentsCatalog.json`: the current file contains 577 rows with names, parent names, registration/form/roll identifiers, sessions and photo URLs. The lazy-loaded seed fallback is also downloadable client data; lazy loading does not make it private.

Move CMS trash to an admin-only collection, migrate/scrub the legacy public document and `site_recycle_bin` browser storage. Remove private catalogs/seed imports from public bundles; serve only the approved projection needed for one authorized lookup. Identify previously published assets for cache retirement as part of the deployment, after confirming their actual exposure.

Acceptance: anonymous/student access to trash fails; admin restore retains private fields; bundle inspection finds no full student roster/marks dataset; a lookup returns only its allowed projection.

### F03 — P1: the administrator extra login step is not enforced

Evidence: `firestore.rules:633` allows unauthenticated approval of a known handshake without verified approver/expiry checks. `src/portal/LoginPage.jsx:281` trusts its status. Password sign-in establishes Firebase authentication before the extra step (`:483`); alternative Teacher/Student entry paths (`:496,547`) can complete administrator login without it. Backend authorization does not require completed second-factor proof.

Use server-enforced MFA or a validated per-login proof, consistently enforced by protected endpoints/rules and all login routes. Disable direct client approval. Bind challenges to UID, session, expiry and one-time consumption.

Acceptance: password-only admin sessions, alternate tabs, anonymous approval, expired challenges and replay cannot access protected operations; completed verification can.

### F04 — P1: module permissions and staff removal do not reliably control backend access

Evidence: `AdminToolsDropdown.jsx:38` filters client tools by `user.perms`, while `firestore.rules:400` allows any admin to manage user records and `functions/index.js:72` permits any admin to assign privileged roles. `src/services/staffAuthService.js:242` creates email and UID profiles; updates (`:340`) and deletion (`:489`) address only the email profile. Rules (`:49,61`) also authorize the surviving UID profile. Provisioning writes profile roles without consistently updating signed claims, so Firestore and Storage/AI/callables can disagree about access.

Create one UID-based server staff lifecycle service for invitation, roles, permissions, demotion and deactivation. Restrict access management to explicitly authorized administrators, prevent self-escalation, reconcile legacy profiles and signed claims, and invalidate removed authority. Handle partial failures truthfully. Document token freshness/revocation behavior and enforce sensitive actions against current authority.

Acceptance: a reports-only admin cannot change roles, funds or CMS by direct SDK/REST/callable calls. Newly provisioned staff have exactly their assigned cross-service abilities. Demoted/deleted staff lose previous privileges using both existing and newly refreshed sessions.

### F05 — P1: unverified email can act as record ownership or staff authority

Evidence: `netlify/functions/admission-workflow.js:403` loads ownerless admissions matching token email without requiring verified mailbox ownership. `firestore.rules:88` has the same legacy ownership fallback; email-profile staff fallbacks (`:56,68`) also lack verification. The admission endpoint's global email-verification requirement is opt-in (`:75`). A mocked unverified token received a private ownerless admission even though the mutation claim guard rejected it.

Require verified email for every email-based fallback and migrate ownership/roles to validated UIDs. Cover bootstrap exceptions in Storage/AI as well. Preserve explicit UID ownership; do not blindly relink historical records solely because email strings match.

Acceptance: an unverified account with a matching legacy/preprovisioned fixture email gains neither admission disclosure nor staff authority; a verified, reviewed migration still works.

### F06 — P1: public results fail for intended users and can calculate misleading grades

Evidence: `src/pages/PublicResultLookup.jsx:88` reads entire restricted admissions/master/practicals collections and turns denied reads into empty arrays. `firestore.rules:418,434,440` disallows this anonymous use. Student matching (`PublicResultLookup.jsx:102`) does not scope by selected session and accepts weak roll/name fallbacks. Division calculation (`:202`) awards by percentage before applying subject failures: a synthetic 100/100/100/20 fixture returned 80%, Distinction, with `hasFail=true`. `ConsolidatedGazetteView.jsx:226` counts only available marks, so missing expected subjects can still produce PASS. Public evaluation selection also defaults to a preboard option when no evaluations are published.

Build a server result-publication service with exact student/cohort/evaluation keys and explicit publication status. Share one versioned grading policy between gazette, public page and exports. Distinguish zero, absent, not entered, withheld and final marks; require the expected enrolled subject set before declaring a complete result. Confirm institutional grading rules rather than inferring them from aggregate percentages.

Acceptance: anonymous approved lookup works without collection scans; unpublished/withdrawn evaluations remain unavailable; same roll in different cohorts never crosses; a failed/absent/missing required subject cannot yield a final pass/distinction contrary to the configured policy. Public/teacher/admin/export totals agree.

### F07 — P1: bulk matching and mutation targets can cross cohorts or write another document

Evidence: `BulkFieldOverwriteModal.jsx:633` falls back from registration+session+class to session+registration and then registration alone (`:641`), weakening the selected scope. Its historical test (`:877`) expects different markers from the `_source`, `_isHistorical`, `_parentDocId` metadata produced by reports/cache. It can write historical rows into admissions. `src/utils/jkboseResultManager.js:695,738` normalizes identity around form numbers and returns a registration match before enforcing cohort; its writer (`:1591`) prefers `id` over `_docId`. Mocked Express data with physical ID `admin_express_*` was written to an admissions document named after its form number instead.

Define a shared immutable record locator: collection, physical document ID, optional parent document/array key/row identity, class and session. Keep display IDs separate. Match only inside the selected cohort; classify zero/multiple matches for manual resolution. Never use same-name matching as write authority. Apply transactions/version checks to parent arrays and record writes.

Acceptance: two years/classes sharing a registration number, same-name students, reused rolls, Express IDs and every archive storage shape update exactly one intended record. Concurrent edits conflict visibly, with no fabricated documents or overwritten unrelated array entries.

### F08 — P1: overwrite “rollback” invokes deletion without previous values

Evidence: `BulkFieldOverwriteModal.jsx:912` stores applied fields rather than before-values and passes them to `saveCsvImportBatch` (`:930`). `src/services/csvBatchManager.js:138` undoes a batch by calling `deleteStudentDocument`, then removes history even when individual deletions fail. Its metadata does not carry the exact source/scope required by the deletion helper. This cannot restore overwritten values and can target existing records for deletion.

Separate import-created-record undo from field-update rollback. Save durable before/after patches, exact locators, actor, job ID and expected versions before changes are committed. Restore only the affected fields if current values still match the recorded after-state; retain partial failures for retry. Quarantine legacy overwrite undo entries that lack a trustworthy before-image.

Acceptance: update then rollback restores exact prior values without deleting the student. Later edits raise conflicts. Inject failures after each write and during history persistence; successful/failed rows and resumable state remain accurate.

### F09 — P1: session archival is not safe to repeat or resume

Evidence: `src/portal/admin/SessionArchivalModal.jsx:51` loads all admissions. Approved records are retagged with the chosen session, then predictable `part_<session>_<index>` documents replace existing student arrays (`:162`). Admissions are deleted separately (`:193`). Reopening after partial deletion or archiving the same session again can overwrite already archived records; unrelated sessions are not filtered out.

Implement a server archival job with an explicit source cohort, immutable manifest/destination records, completion checkpoints and a lock. Verify destination persistence before source deletion. Preserve original session/identity and prevent replacement of an existing completed archive. Prepare and exercise backup/restore before migration.

Acceptance: mixed-session fixtures leave other cohorts unchanged. Fail after every archival/deletion stage, resume, and execute again; all original students remain recoverable with no loss or duplicates.

### F10 — P1: admit-card ingestion can erase recorded results

Evidence: `src/utils/jkboseResultManager.js:1229` produces admit-card placeholders such as Awaiting Result. The shared writer (`:1493`) unconditionally updates result, marks and division. A mocked admit-card import replaced an existing result with Awaiting Result and wrote subject text into the marks field, even with exam-roll overwrite disabled.

Use distinct payload schemas and field allowlists for admit cards, gazettes and manual result edits. Treat missing source fields as absent, not blank replacement. Require explicit review for a finalized result correction.

Acceptance: admit-card imports change only intended identity/exam fields and preserve existing marks/divisions; result imports touch only selected valid fields; replay is idempotent.

### F11 — P1: teacher access is not scoped to assignments

Evidence: `firestore.rules:434,440` grants every teacher read/write access to attendance and practicals documents, with no immutable teacher/class/subject assignment enforcement. Client filters and locking controls do not protect against direct writes.

Introduce authoritative assignment metadata and enforce assigned class/session/subject, mark bounds and locked-state transitions. Backfill existing documents before tightening the rules so legitimate teaching workflows continue.

Acceptance: Teacher A cannot inspect/change Teacher B's unrelated class or locked marks through direct requests; valid assigned entry and administrator override work and are audited.

### F12 — P1: private Firestore data persists after ordinary logout

Evidence: `src/services/firebase.js:49` enables persistent multi-tab IndexedDB caching globally. `sessionManager.clearSession` and portal logout clear web storage/memory but do not remove the SDK's persisted database. The memory-only collection list in `dbCache.js` does not prevent this separate cache. Firebase documents that web persistence survives sessions and needs consideration for sensitive data on shared devices: [official offline persistence guide](https://firebase.google.com/docs/firestore/manage-data/enable-offline).

Default sensitive/shared-device sessions to memory caching; define an explicit trusted-device policy if offline persistence is necessary. Migrate existing persisted caches and coordinate logout across tabs, including pending requests that might repopulate memory. Do not treat a CSS/keyboard restriction as privacy protection.

Acceptance: after staff logout and browser restart, another user/offline session cannot recover cached private records through the application cache. Test multiple tabs and in-flight fetch completion.

### F13 — P1: concurrent fee distributions can exceed remaining totals

Evidence: `src/portal/admin/FundDistribution.jsx:854` validates against locally loaded remaining totals, then writes a timestamp-named new distribution (`:883,904`). The atomic batch for fee configuration is useful, but distribution creation is not a transaction against a shared balance/version. Two administrators can each pass the same remaining-count check and both commit.

Persist distributions through a transaction or server ledger command with a cohort balance/version and idempotency key. Apply the same checks to edits/deletes. Keep accounting calculations in integer minor units where applicable.

Acceptance: simultaneous requests whose combined allocations exceed availability cannot both succeed; retries create one entry; editing an existing distribution recalculates the available balance consistently.

### F14 — P2: historical Quick Edit initializes empty and has unsafe fallback matching

Evidence: `MasterRegisterQuickEditModal.jsx:18` initializes state only once. Its parent mounts it with no student (`AdvancedReports.jsx:11847`), so opening it later leaves `{}` and `.trim()` calls (`:67`) fail on untouched fields. Its archive search (`:129`) uses form OR registration OR name across cached chunks and can patch multiple matches.

Initialize/reset the form on the selected immutable record identity/open transition, reset acknowledgements/errors and preserve explicit cancel behavior. Use the F07 locator service instead of searching by name; clear obsolete subject slots when the subject count shrinks.

Acceptance: closed/null mount → open A → edit/save → open B displays correct independent values; unchanged optional fields do not throw; duplicate-name/year fixtures cannot modify each other.

### F15 — P1/P2: governance switches are inert and settings can falsely report success

Evidence: the new `strict3PointMatching`, `allowExpressZeroRestrictions`, `enable30DayRollback` values appear only in `ControlsAndSubjects.jsx` (state/load/save and UI, including `:566`). No ingestion/backend consumer applies them. The save handler (`:576`) catches authoritative Firestore failure, ignores the fallback result and displays success; its outer catch also reports local success.

Implement a versioned settings schema and one authoritative store. Enforce access-sensitive policies at execution, with matching preview behavior. Display Saved only after acknowledged persistence; retain unsaved edits and actionable failures. Advertise rollback only when actual recoverable snapshots exist.

Acceptance: toggles change/reject the relevant operation after reload in another session. Network/permission/fallback failures never show successful closure or policy enforcement.

### F16 — P2: tab state and recovery still regress; verification can stall

Evidence: `AdminDashboard.jsx:611` keys the entire module error boundary by active tab, remounting the supposedly preserved reports/roster subtree. This resets selections/layout and repeats initialization. `src/App.js` wraps routes in Suspense without a root error boundary for exhausted route import failures. `StudentVerificationPage.jsx:226` executes up to four candidates against two endpoints sequentially, with 4.5-second timeouts, even after a local match: worst-case waiting approaches 36 seconds. A changing component key resets child state, and rejected lazy imports require an error boundary: [React state identity](https://react.dev/learn/preserving-and-resetting-state), [React lazy](https://react.dev/reference/react/lazy).

Give persistent modules stable independent boundaries and add route-level recovery. Reset only the failed module. Replace verification's candidate waterfall with one authoritative request, abort old requests on navigation and show loading/unavailable states immediately. Remove global copy/context-menu/shortcut blocking from verification; it impedes normal use without securing downloaded data.

Acceptance: report filters/selection and roster layout survive tab switches; a failed chunk shows a recoverable page; lookup cancellation cannot show a previous student's result; keyboard and screen-reader flows work.

### F17 — P2: PDF normalization still produces incorrect institutional fields

Evidence: `pdfGenerator.js:248,301` reaches stream inference before the secondary-class rule. The explicit Home Science branch is also shadowed by the generic Science check. Synthetic fixtures returned Science for Class 9 General Science, Class 10 explicit Science, and Class 11 Home Science. Admission number resolution (`:423`) misses variants already accepted elsewhere.

Centralize class, stream, admission number and examination-year resolution with clear precedence and ambiguity handling. Apply it to forms, provisional forms, certificates, registers and exports; avoid a new independent list of aliases per screen.

Acceptance: Classes 8–10 consistently use General; Home Science remains distinct where supported; valid institutional number formats survive; missing/ambiguous fields are visibly flagged; printed/exported values agree with the reviewed record.

### F18 — P2: Excel template headers do not reliably round-trip

Evidence: `BulkFieldOverwriteModal.jsx:507` exports human-readable `f.label` keys while import (`:662`) searches only `f.excelKeys`. Labels such as Date of Birth (DoB) are not automatically valid aliases. Earlier isolated metadata inspection found 16 of 47 field labels outside their import alias lists; this producer/consumer mismatch remains in the updated code.

Generate template and parser mappings from the same schema using stable field keys, normalized labels and declared aliases. Keep identifiers as text and distinguish an explicit clear from an absent value.

Acceptance: export a template, populate every supported field, import and preview it, and compare all values. Include leading zeros, quoted/multiline text, blank cells, duplicate headers and pasted grids.

## Coverage and path to Optimized for every module

“Current label” describes the UI catalog, not a certification. “Gate” is work still needed; it does not mean every possible defect in that module was exhaustively tested. Shared F01–F18 blockers apply even to modules whose local tests pass.

| Module / journey | Current label | Work and acceptance gate before Optimized |
| --- | --- | --- |
| Public home, notices, academics, admissions/contact pages | Not catalogued | Verify all navigation and hero links, mobile overflow, keyboard focus, content errors and CMS publication. Retain passing SEO checks; measure cold/warm mobile loading. |
| Public results / preboard results | New | F06; publication/unpublication, exact identity, incomplete marks and print slip tested end to end. |
| Public student/certificate verification | Not catalogued | F01/F02/F16; issued/revoked/unavailable states, no bulk roster download, bounded lookup and QR scans from real printed samples. |
| Login, recovery, registration, student dashboard/admission | Not catalogued | F03/F05/F12; account recovery, verified ownership, draft/submit/withdraw/upgrade, closed windows, duplicate submit and network recovery. Existing admission tests are a useful baseline. |
| Student Records & Reports | Optimized | F07/F08/F14/F16; exact edit/delete/restore, scoped search/filter, concurrent updates and large-cohort navigation. Revalidate the label after these pass. |
| Admission Register & Sent-up Suite | Production | F07/F17; stable identity/serials, admission dates, missing metadata, layout persistence and official PDF/Excel cross-check. |
| Student Rosters & Registers | Optimized | F16; selection survives filtering/tab switches; subject/class/session isolation; large roster exports and page breaks. |
| Official Letterhead Writer | Production | Authorized AI request, clean HTML, timeout/quota recovery, draft retention, long-letter pagination, fonts/logo offline and document history. Keep explicit staff review before issue. |
| Student Bonafides & Certificates | Production | F01/F17; unique issuance, reprint/revoke, student/document linkage, single/batch printing and QR round-trip. |
| Student ID Card Studio | Optimized | Retain passing identity/selection/concurrency tests; close F01/F12, verify photos by cohort, export cancellation, print range and real card scan. |
| Competitive Exams & OMR | Beta | Identity and quotas, duplicate registration, unique exam numbers, persisted submissions, authenticated upload/scoring, absent/multiple responses and replay tests. `omr_system/backend/server.js:11` uses in-memory mock data and unauthenticated write endpoints; treat that companion as a prototype until replaced, not production evidence. |
| Academic Controls & Subjects | Production | F09/F15; reliable closure/settings publication, explicit rollover migration and versioned policy enforcement. |
| Subject Rules & Streams | Production | F17; a shared canonical subject/stream schema, exact elective constraints, all classes/streams, legacy alias migration and administrator validation. |
| Practicals & Award Rolls / Teacher practicals | Production | F06/F11; assigned-subject access, locking, valid marks bounds, missing/absent distinction, tokenized subject matching across all subject fixtures, award print and retry. |
| School Assessments Hub | New | F06/F11/F15; evaluation create/edit/publish/unpublish, roster enrollment status, concurrency and current settings visible to teacher/public views. |
| Consolidated Gazette | New | F06/F07; expected subjects, cross-stream roll collisions, exact cohort identity, totals/division and exported gazette match the public policy. |
| Student Attendance / Teacher attendance | Production | F11/F12; assigned class only, date/holiday/session boundaries, multi-device edit conflicts, offline behavior and persisted-state confirmation. |
| Class Roll Number Manager | Optimized | Unique roll scope enforced across simultaneous operations, exact physical IDs, locked/approved-record safeguards, preview cancel and partial-batch retry. |
| Application Merge & Deduplication | Beta | Retain exact-ID preview/recycle safeguards; make canonical update + secondary removal resumable and conflict-aware; test failure after each step and restoration. |
| Communications & Automations | Beta | Verify actual Apps Script provider contract; refresh authentication, server deduplication/outbox, partial delivery and truthful status. `appsScriptApi.js:83` retries mutations, so ambiguous send failures need an idempotency key. Use a test sink; do not send real email as a test. |
| Funds & Fee Accounts | Optimized | F04/F13; concurrent ledger reconciliation, idempotent distribution, rate/account versions, edits/deletes and numerical correctness. |
| Website CMS / Hero Buttons | Production / New | F02/F04; private/public projection including trash, safe link schemes, edit/publish failure, keyboard reorder and home rendering. |
| Direct Entry & CSV Import | Beta | F07/F08/F10/F18; schema round-trip, strict cohort, duplicate prevention, type validation and honest partial-success preview. |
| Board Data Sync & Overwriter | Production | F07/F08/F15/F18; actual before-image rollback, policy enforcement, immutable locators and conflict handling. Current “30-day rollback” claim is not sufficient. |
| Administrator Access & Permissions | Beta | F03–F05; complete role/action matrix across Firestore/Storage/callables/Netlify, invitation/claim refresh, demotion/deletion and recovery. |
| Shared data, search, photos, document history, recycle tools | Cross-module | F07/F08/F12; scoped caches/indexes, exact photo identity, consistent invalidation, cancellation, no hidden failures or resurrected deleted records. |

## Implementation sequence

### Phase A — containment and behavioral test fixtures

1. Create synthetic cohorts, staff roles and certificate fixtures; establish emulator tests for the unsafe read/write paths. Record expected failures before fixes.
2. Close public trash disclosure and unverified email authority. Replace verification's fabricated success with an unavailable/unverified state until authoritative issuance is connected.
3. Prevent execution of unsafe overwrite rollback and repeat archival paths until their replacement can restore exact records. Preserve existing job history for investigation/migration.
4. Record current rules/functions/hosting versions and a backup/restore point before any production data migration. Confirm which Firebase database/project and hosting origins are authoritative before implementing infrastructure changes.

Deliverable: reviewed containment change with negative authorization tests and no regressions in legitimate admission reads.

### Phase B — identity, permissions and session lifecycle

1. Specify role/action/assignment matrix and UID ownership migration.
2. Implement unified staff provisioning/revocation, real second-step enforcement and assigned-teacher rules.
3. Replace email-only fallbacks and align Storage, Netlify and callable checks.
4. Implement sensitive-cache/trusted-device policy and multi-tab logout handling.

Deliverable: direct-request authorization tests pass for anonymous, unverified student, verified student, assigned/unassigned teacher, restricted admin, full admin and deactivated users.

### Phase C — one safe mutation foundation

1. Add canonical record locators/normalizers and scoped unique matching shared by reports, quick edit, results and exports.
2. Implement update/import jobs with version checks, before-images, operation IDs, accurate partial progress and durable recovery.
3. Migrate bulk sync, Express, gazette/admit parsing, merge/recycle, rollover and fund-distribution writes onto the appropriate transactional/resumable services.
4. Repair Quick Edit state and template round-trip behavior. Connect governance settings to actual execution.

Deliverable: duplicate-identity, retry, concurrent-edit, rollback and archival fault-injection tests pass without lost or cross-cohort records.

### Phase D — results, certificates and public endpoint contracts

1. Build minimal published-result and issued-certificate APIs with bounded queries, rate controls and clear unavailable/not-found/revoked states.
2. Remove student catalogs/marks seeds from public bundles, and reconcile any required old issuance records on the server.
3. Share grading/publication policy across assessments, practicals, gazette, public results and exports.
4. Centralize endpoint configuration. Both Firebase Hosting targets currently lack function rewrites while admissions/AI clients use relative Netlify function paths; add supported routing or a configured backend with exact CORS/App Check origins. Verify each supported hostname independently.
5. Fix canonical document fields and inspect rendered forms, cards and certificates, including missing metadata, long names and real QR scans.

Deliverable: student/parent and staff journeys work against staging with accurate current official data and no private dataset downloads.

### Phase E — module UI, speed and recovery

1. Fix stable module boundaries, draft/state retention, route recovery and cancel behavior.
2. Measure initial load, tab switches, search, photo preparation and exports against realistic synthetic cohort sizes. Move expensive parsing/export work to deferred modules or workers where measurements justify it; replace repeated full scans with scoped queries/pagination.
3. Unify loading, empty, error, saving and saved states; avoid success messages for failed writes. Add accessible focus handling, keyboard operation, labels and live status announcements.
4. Inspect public/student/teacher/admin layouts at 360, 390, 768 and 1440 CSS pixels, both themes and zoom. Check modal focus/scroll, sticky elements, tables, touch targets and print layouts.
5. Resolve actionable hook/lint warnings, then remove ordinary unused code/regex noise. Refresh dependency audits across root, Netlify, Firebase and OMR packages, including browser-bundled dev dependencies such as spreadsheet parsers.

Deliverable: measured UI/performance report and module-specific regression coverage, not blanket warning suppressions.

### Phase F — staged release and maturity promotion

For each module, require: no unresolved P1 in its paths; completed role/negative tests; primary and failure/retry journeys; record and export correctness; mobile/keyboard/print QA where relevant; observed performance budgets; and documented recovery/rollback. New assessment/hero modules should be catalogued and assessed too.

Suggested initial targets, to confirm on representative hardware: public LCP <=2.5 seconds, INP <=200 ms and CLS <=0.1; warm admin navigation under 300 ms when it does not require a network fetch; visible feedback within 100 ms for long operations; no unbounded collection scans in public lookup. These are proposed goals, not measured results or guarantees.

Deploy migrations/rules/functions/UI in a compatible order to staging, run smoke tests on every supported origin, then use a reviewed production rollout with post-release checks. Update `adminModuleCatalog.js` maturity only with links to that module's evidence. Existing “Optimized” labels should be reviewed against the same standard.

Rough planning allowance: containment 1–2 engineering days; authorization/identity 3–5; mutation/recovery 4–7; public results/certificates 3–5; broad UI/performance/release validation 4–7. Some independent work can overlap. Migration quality, provider configuration and available test accounts can change these estimates; this is not a fixed delivery promise.

## Completion checklist

- Build, Jest, admission/security/performance/SEO checks pass on the final implementation, with new behavioral tests covering the findings.
- Emulator/direct-request tests demonstrate authorization, assignment, publication and revocation behavior.
- No private rosters, marks catalogs or CMS trash are served as public assets/documents.
- Bulk correction, rollback, merge, archive and ledger changes survive retry/concurrency/failure without loss.
- Results, certificate status, document fields and exports agree with authoritative records.
- Supported Netlify/Firebase origins complete admission, result, AI and verification flows.
- Every module has recorded UI, performance and end-to-end evidence before an Optimized label is applied.
- Follow repository workflow: build, stage verified files and commit locally. Never push automatically; the user controls the remote push and production release.
