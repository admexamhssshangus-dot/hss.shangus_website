# Codebase recheck — 10 September 2026

Reviewed application commit: `32e58056` (`fix(codebase): optimize verification, public results, PDF generation, and code hygiene across modules`). Compared with the previous audited application at `20e7a30f` and audit commit `27853120`. The working tree was clean when this recheck began.

**Yes: important issues still persist.** The update improves PDF normalization, removes unused legacy admission code, avoids redundant verification requests and removes the fabricated-student verification fallback. It does not resolve the principal authorization, data-integrity and public-results problems.

This is a code review with local build/tests and synthetic function execution. No live records, deployed rules, accounts or provider services were exercised. No application fixes were made in this recheck. Source paths below are relative to `D:/Shk_Gulfam/Projects/hss_shangus`.

## Improvements verified

| Change | Evidence / result |
| --- | --- |
| Secondary classes resolve to General before stream inference | Local execution of `resolveCleanStream` returned General for Class 9 with General Science subjects and Class 10 with explicit Science. |
| Additional admission-number aliases work | `resolveCleanAdmNo({'Adm. No.': '00123/26'})` returns `00123/26`, preserving leading zeros. |
| No fabricated student after all verification lookups miss | The former Tier 4 URL-to-Approved-record fallback is removed. This closes that specific nonexistent-student route; it does not prove certificate issuance for an existing student. |
| Catalog hits no longer trigger the server lookup waterfall | The new `if (!matched)` guard works. A synthetic catalog hit made zero fetches. Freshness/revocation concerns remain because the catalog becomes the authority. |
| Legacy admission helpers and minor lint issues cleaned up | Unused legacy read/write functions were removed from `appsScriptApi.js`; active admission calls still delegate to `admissionWorkflowApi`. Existing tests pass. |

## Highest-priority remaining issues

### 1. P1 — an existing student can still be used to validate an unissued certificate

`src/pages/StudentVerificationPage.jsx:170` only rejects an invalid signature if a signature was supplied. Catalog matching at `:188` accepts a form number, `:214` copies the certificate number from the URL, and `:218` assigns Approved. The UI at `:455–467` displays the URL-provided certificate/document as VALID & ISSUED. The new server-skip guard at `:227` means a catalog hit never checks the live issuance registry.

Local reproduction executed the current verification function with a synthetic existing catalog student, an arbitrary `UNISSUED-TEST` certificate number and no signature. It returned:

```text
status=Approved
certificate=UNISSUED-TEST
notFound=false
tampered=false
fetchCalls=0
```

This is narrower than the old fabricated-student problem, but still a certificate-authenticity defect. The public hash in `src/utils/qrSvgGenerator.js:34` remains non-secret, and the page still labels it HMAC.

Required fix: verify the exact issued certificate, student identity, document type and revocation status on the server. A student enrollment match must not imply document issuance. Include unknown/revoked certificate tests and a catalog-hit/live-revocation test.

### 2. P1 — public-results fallback still cannot provide current preboard results

`src/pages/PublicResultLookup.jsx:86–118` still attempts restricted collection reads, then downloads local catalogs and seed records after failure. The seed metadata in this repository contains 27 sections / 1,988 subject-record rows, all tagged `2024-25 (Oct-Nov)` and `internal` or `external`. It contains no Pre-Board Test sections or 2025-26 assessment records.

The default 2025-26 Pre-Board Test filters at `:185–193` reject that fallback data. Local execution of the current lookup with denied/empty live reads, a synthetic matching catalog student and a seed-shaped historical internal record returned zero subjects and `hasMarks=false`. The fallback may identify some historical students, but it cannot recover current marks that are absent from the bundled data. Fresh students outside those static files remain unavailable as well.

Required fix: implement a bounded server lookup for one published student/evaluation result. Return explicit unavailable/unpublished/not-found states. Keep student matching scoped by session, class and a unique identity rather than registration/roll/name alone.

### 3. P1 — failed subjects can still receive Distinction

`src/pages/PublicResultLookup.jsx:255–260` awards divisions by aggregate percentage before checking `hasFail`; this logic did not change. Executing the current calculation with marks 100, 100, 100 and 20 out of 100 per subject produced:

```text
percentage=80.0
division=Distinction (Grade A)
hasFail=true
```

The gazette's incomplete-subject behavior is also unchanged (`src/portal/admin/ConsolidatedGazetteView.jsx:226–275`). The seed sections have no `maxMarks`, while public lookup defaults it to 100; they are therefore not sufficient evidence for accurate historical marks/percentage calculations either.

Required fix: share a validated grading policy, expected enrolled subject set and real maximum marks between teacher, admin, public and export views. Handle missing, absent, withheld and failed subjects before assigning a final division.

### 4. P1 — public disclosure and authorization issues are unchanged

The update did not change `firestore.rules`, `storage.rules`, Firebase functions, Netlify handlers or `staffAuthService.js`.

- `firestore.rules:375` still permits anonymous reads of `site/recycle_bin`; `src/pages/AdminPortal.jsx:199,3305` still saves complete deleted employee objects there.
- `firestore.rules:633` still allows changing a known login handshake to approved without authenticated approver or expiry enforcement. The password-session and alternate-login-route bypasses remain.
- `firestore.rules:400–408` and `functions/index.js:72` still let general administrators manage privileged access without enforcing the configured module restrictions.
- `staffAuthService.js:242,340,489` still has inconsistent UID/email profile creation/update/deletion and does not provide unified account/claim revocation.
- `netlify/functions/admission-workflow.js:403–415` and `firestore.rules:88–95` still allow ownerless admission reads based on an unverified matching email.
- The public catalog and practicals seed remain downloadable. The new results fallback adds another consumer of these datasets; lazy loading does not enforce record-level access.

Required fix: private CMS trash, verified UID ownership, server-enforced administrator verification, a role/action matrix and consistent staff lifecycle. Add direct-request negative authorization tests rather than relying on source-pattern checks.

### 5. P1 — bulk overwrite, rollback and archival remain unsafe

- `BulkFieldOverwriteModal.jsx:633–641` still falls back outside the selected class/session when matching by registration.
- `BulkFieldOverwriteModal.jsx:877–885` still uses historical-marker/parent fields that disagree with the metadata produced by the cache/reports pipeline, risking writes to the wrong collection/document.
- `BulkFieldOverwriteModal.jsx:912–930` still saves applied values rather than before-values. `src/services/csvBatchManager.js:138–152` still implements undo by deleting records. The only change to that service was removal of an unused import.
- `src/utils/jkboseResultManager.js:1493,1591` still allows admit-card placeholders to overwrite results and prefers display IDs over physical document IDs.
- `SessionArchivalModal.jsx:51,162–169,193` still loads all admissions, replaces predictable archive arrays and separately deletes source records. Repeat/resume safety is unchanged.

Required fix: immutable record locators, strict cohort matching, field-specific mutation schemas, durable before-images, conflict detection and resumable/idempotent archival. An overwrite rollback must restore changed fields rather than delete the student.

### 6. P2 — Quick Edit, tab state and governance controls still malfunction

- `MasterRegisterQuickEditModal.jsx:18` initializes form state once while the selected student is null; later opening does not reinitialize it, and `:68` calls `.trim()` on unset fields.
- `AdminDashboard.jsx:611` still changes the parent error-boundary key on every tab switch, remounting the reports/roster subtree and losing state.
- The three governance switches still have no consumers outside `ControlsAndSubjects.jsx`. Its save handler at `:576–589` can still report success after failed persistence.

Required fix: reset edit state by selected record identity, stable module boundaries, actual policy enforcement and truthful save/error states.

### 7. P2 — PDF normalization is improved but incomplete

`src/utils/pdfGenerator.js:286` still matches generic Science before Home Science (`:287`). A synthetic Class 11 `Stream: 'Home Science'` returns Science.

The new admission-number helper at `:351–365` does not reject all placeholders before choosing the first candidate. Both of these fixtures still ignore a valid later alias:

```text
{ admNo: '-',   'Admission No.': '00123/26' } -> '-'
{ admNo: 'n/a', 'Admission No.': '00123/26' } -> 'n/a'
```

Required fix: recognize specific stream names before broad substring matches and normalize placeholder checks case-insensitively before selecting an admission number. Add behavior tests for these cases rather than only structural PDF checks.

## Status of the previous 18 finding groups

The detailed remedies and module acceptance criteria remain in the [9 September implementation plan](CODEBASE_AUDIT_AND_OPTIMIZATION_PLAN_2026-09-09.md). “Persists” means the relevant unsafe path remains; it does not claim a confirmed production incident.

| Prior ID | Current status |
| --- | --- |
| F01 Certificate authenticity | Partly fixed: fabricated student fallback removed; arbitrary issuance for existing catalog students remains. |
| F02 Public data disclosure | Persists; private trash unchanged and public dataset consumers expanded. |
| F03 Administrator extra login step | Persists; authorization/rules untouched. |
| F04 Module permissions / staff lifecycle | Persists; authoritative role and revocation paths untouched. |
| F05 Unverified email ownership | Persists; server/rules fallback untouched. |
| F06 Public results / grades | Persists; static fallback is not current published results, and failure/division logic remains wrong. |
| F07 Matching / physical record identity | Persists; bulk/result writers untouched. |
| F08 Overwrite rollback | Persists; undo still deletes, with no before-image restoration. |
| F09 Archival repeat/resume safety | Persists; archive/delete pipeline untouched. |
| F10 Admit-card result destruction | Persists; shared result writer untouched. |
| F11 Assigned-teacher access | Persists; attendance/practicals rules unchanged. |
| F12 Private cache after logout | Persists; SDK persistent cache and logout policy unchanged. |
| F13 Concurrent fee allocations | Persists; client validation plus independent ledger writes unchanged. |
| F14 Historical Quick Edit | Persists; state initialization and fallback matching unchanged. |
| F15 Governance / save confirmation | Persists; settings have no enforcement consumers and failures can appear successful. |
| F16 State / recovery / verification speed | Partly fixed: redundant catalog-hit requests removed; remount/recovery and non-catalog timeout issues remain. |
| F17 PDF normalization | Partly fixed: Classes 8–10 and extra aliases improved; Home Science and placeholder precedence remain. |
| F18 Excel template round-trip | Persists; exported labels/import aliases unchanged. |

## Validation completed

| Check | Result |
| --- | --- |
| `npm run build` | Exit 0, compiled with remaining non-breaking ESLint warnings. |
| Build SEO regression | Passed; 10 public pages generated and checked. |
| CRA Jest runner, serial/no-watch | 16 suites / 91 tests passed. |
| `npm run security:check` | Passed. |
| `npm run performance:check` | Passed. |
| `npm run admission:check` | Passed; 83 fields and existing PDF structure checks. |
| Current-function synthetic checks | Reproduced unissued certificate approval, empty default results fallback, failed-subject Distinction, Home Science misclassification and placeholder precedence; confirmed secondary-class and added-alias fixes. |

The passing suite still has 91 tests; changes to existing test files in this commit concern import arrangement. No new behavioral coverage was added for the major authorization, rollback, public-results or normalization cases above. Hook warning suppressions also do not establish correct stale-state behavior.

Recommended next order: (1) certificate/public privacy and access control, (2) bulk/rollback/archive integrity, (3) authoritative results and grading, (4) Quick Edit/settings/tab state, (5) remaining normalization and module optimization. Avoid treating build/lint success as evidence that these workflows are safe end to end.
