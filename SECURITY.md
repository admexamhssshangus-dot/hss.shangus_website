# Security operations

The application now uses Firebase Authentication custom claims as its sole
authorization source. Firestore profile fields, selected portal tabs, and
browser storage do not grant privileges.

## Required production activation

1. Rotate any payment, SMTP, GitHub, Apps Script, or verification secrets that
   were ever present in a frontend build or repository history.
2. Configure Firebase App Check with a reCAPTCHA Enterprise site key through
   `REACT_APP_RECAPTCHA_ENTERPRISE_SITE_KEY`. Monitor valid traffic, then enable
   enforcement for Firestore, Storage, Authentication (where available), and
   callable Functions. Set `REQUIRE_APP_CHECK=true` for Functions.
3. Store `SMTP_USER`, `SMTP_PASS`, and a random 32+ byte
   `VERIFICATION_SIGNING_SECRET` only in the Functions secret/environment
   service. Never use `REACT_APP_*` for secrets.
4. Deploy Functions after upgrading the Firebase project to Blaze. The current
   Spark project cannot enable Cloud Functions/Artifact Registry. Until then,
   the Netlify admission service accepts a verified `users/{email}` profile
   only for the lowest-privilege Student role; staff/admin authorization still
   requires signed claims. For an existing bootstrap administrator, assign claims
   once using Application Default Credentials:

   ```powershell
   node scripts/set_firebase_role.js --email=adm.exam.hss.shangus@gmail.com --role=SuperAdmin --confirm=SET-SECURE-CLAIMS
   ```

5. Configure the Netlify lookup function with a least-privilege Firebase
   service account, `FIREBASE_SERVICE_ACCOUNT_JSON`, comma-separated
   `ALLOWED_ORIGINS`, and independent random 32+ byte `LOOKUP_INDEX_SECRET` and
   `LOOKUP_RATE_SECRET` values.
   The admission workflow uses the same service-account variable and
   `ALLOWED_ORIGINS`. Set `REQUIRE_VERIFIED_STUDENT_EMAIL=true`. After App Check
   metrics show legitimate production traffic, set `REQUIRE_APP_CHECK=true`.
6. Populate `studentVerificationIndex` from a trusted server/administrative
   migration. Document IDs must be
   `HMAC-SHA256(LOOKUP_INDEX_SECRET, "regNo:<normalized-value>")` and/or
   `HMAC-SHA256(LOOKUP_INDEX_SECRET, "formNo:<normalized-value>")`. Store only
   the minimum fields returned by `lookup-student.js`; never copy Aadhaar,
   address, phone, email, credentials, or full admission records.
7. Migrate legacy admission documents to include the authenticated Firebase
   `ownerUid`. Until migrated, students cannot read another identity's record;
   staff with claims retain the intended operational access.
8. Run and review before every deployment:

   ```powershell
   npm run security:check
   npm run build
   npx -y firebase-tools@latest deploy --only firestore:rules,storage --dry-run --project hsssdb
   ```

## Operational controls

- Require phishing-resistant MFA for administrators in Google/Firebase Identity
  Platform and protect the bootstrap account with hardware security keys.
- Use separate Firebase projects for development, staging, and production.
- Restrict the Firebase web API key by allowed web origins and required APIs.
- Enable Cloud Audit Logs, budget alerts, Firestore/Storage usage alerts, and
  alerting on changes to IAM, Security Rules, custom claims, and secrets.
- Review `securityAuditLogs`, failed App Check metrics, Auth anomalies, email
  volume, lookup rate-limit events, and Storage usage.
- Back up Firestore and test restoration. Keep backups in a separate project or
  account with retention lock and limited restore permissions.
- Enable Firestore point-in-time recovery and delete protection; both were
  disabled when the admission workflow was hardened.
- Never re-enable `netlify/functions/save-config.js`; repository writes belong
  in authenticated CI or a dedicated audited backend.

No security control can guarantee a universal benchmark by itself. These rules
and guardrails require deployment configuration, credential rotation, ongoing
monitoring, penetration testing, and periodic review.
