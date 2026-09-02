# Firebase/React Administration Audit

Audit scope: the active Firebase/React application, Netlify functions, Firestore rules, and admin/super-admin modules. The legacy `login/` Apps Script project is intentionally excluded.

## Maturity labels

- **Optimized** — the primary workflow is hardened, regression-checked, and tuned for routine production use.
- **Production** — suitable for routine use with the normal staff verification expected for official records.
- **Beta** — usable with deliberate administrator review while edge cases, scale, destructive actions, or external integrations are still being hardened.

The application displays these labels from the single source of truth in `src/portal/admin/adminModuleCatalog.js`, so the launcher and permission controls cannot drift to different names or statuses.

| Module | Status | Reason |
| --- | --- | --- |
| Student Records & Reports | Optimized | Exact-document mutations, protected bulk actions, recycle recovery, and regression checks are present. |
| Admission Register & Sent-up Suite | Production | Ready for routine register work; official output still requires staff review. |
| Student Rosters & Registers | Optimized | Canonical photo resolution and print/export safeguards are regression-checked. |
| Official Letterhead Writer | Production | Secure server-side AI path and controlled output workflow. |
| Student Bonafides & Certificates | Production | Controlled generation with record verification before issue. |
| Student ID Card Studio | Optimized | Strict cohort filtering, stable selection keys, bounded concurrent photo preparation, upload limits, and page-range printing are regression-checked. |
| Competitive Exams & OMR | Beta | Public registration, lookup, OMR, and quota behavior need broader load testing. |
| Academic Controls & Subjects | Production | Central configuration with admission-time validation. |
| Subject Rules & Streams | Production | Central rules are used by the admission workflow. |
| Practicals & Award Rolls | Production | Suitable for controlled marks entry and award-roll preparation. |
| Student Attendance | Production | Authenticated staff workflow is established. |
| Class Roll Number Manager | Optimized | Exact-record updates and approved-record safeguards are present. |
| Application Merge & Deduplication | Beta | Identity merges are destructive and must remain preview-and-confirm operations. |
| Communications & Automations | Beta | Provider quotas, delivery failures, and retries require monitoring. |
| Funds & Fee Accounts | Optimized | Atomic rate/account saves, live empty-ledger synchronization, rules coverage, and reconciliation validation are in place. |
| Website CMS & Administration | Production | Public/private content separation and controlled publishing are established. |
| Direct Entry & CSV Import | Beta | Input schemas vary, so preview and administrator confirmation remain mandatory. |
| Administrator Access & Permissions | Beta | Custom claims and the current email-link handshake require server-verifiable second-factor hardening. |

## Changes completed in this audit

- Made the authenticated Netlify admission workflow authoritative for load, draft, submit, and withdraw operations; browser/local admission-record fallback is disabled.
- Restricted Firestore admission reads to staff or the owning student and disabled direct student writes.
- Restricted central student photographs to staff reads and administrator writes.
- Made admission-history and server indexes private.
- Removed browser-side Gemini calls and API-key storage; AI requests now require a Firebase ID token and App Check and run through the Netlify function.
- Prevented AI/payment secret fields from being written through public client settings and removed an exposed payment secret from public settings.
- Added Firestore rejection for nested Cashfree/Razorpay secret fields inside otherwise public site settings.
- Removed browser-side Firestore collection scans from student verification and added bounded server-only approved-record lookup with a private, self-refreshing HMAC index.
- Prevented ambiguous public lookups by class roll number alone; roll numbers remain signed document context, while verification uses unique registration, form, or certificate identifiers.
- Reduced eager full-cohort reads in ID-card and fund-distribution workflows.
- Centralized module names, descriptions, categories, permissions, and maturity labels.
- Added subject-wise roster filtering across class, stream, gender, and status with the existing Word, Excel, and print/PDF outputs.
- Closed the missing `fund_config` rules path, made fee configuration writes atomic, and added regression-tested over-distribution validation.
- Added visible maturity labels to every Quick Action so administrators can distinguish optimized workflows from reviewed Beta entry tools.
- Hardened ID-card session/status/stream filters, preserved intentional empty selections, made selection keys stable across filtering, and prepared large photo batches with bounded concurrency and timeouts.

## Remaining essential work

1. **Administrator second factor:** the present Firestore handshake can prove account ownership but cannot cryptographically prove that the email link, rather than an authenticated console write, approved the handshake. Move approval to a server-issued, one-time challenge before promoting this module from Beta.
2. **Bundle and lint debt:** the production build succeeds, but several legacy large components still report hook-dependency and unused-code warnings. Split the largest admin modules and resolve stateful hook warnings module-by-module; avoid risky mechanical cleanup in official-record workflows.
3. **Secret rotation:** rotate any Cashfree credential that previously existed in public source/history. Keep payment and Gemini secrets only in protected Netlify environment variables.
4. **Deployment verification:** deploy and test the reviewed Firestore rules and Netlify functions together. Verify custom claims, App Check enforcement, CORS origins, rate-limit secrets, and AI/payment environment variables in the deployed environment.

## Verification evidence

- `npm run admission:check`: passed (83 schema fields, one-page provisional PDF, two-page full PDF).
- `npm run security:check`: passed.
- `npm audit --omit=dev`: 0 production vulnerabilities.
- `npm run build`: production bundle completed successfully; non-breaking ESLint debt remains as documented above.
