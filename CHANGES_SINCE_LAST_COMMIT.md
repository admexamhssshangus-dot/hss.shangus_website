# Changes Log & Commit Reference

## Current Working Changes

### 1. End-to-End Firebase Security Rules Audit & Hardening
- **Objective:**
  - Perform a complete Red-Team penetration testing audit on [firestore.rules](file:///d:/Shk_Gulfam/Projects/hss_shangus/firestore.rules) and [storage.rules](file:///d:/Shk_Gulfam/Projects/hss_shangus/storage.rules) to ensure no insecure permissions, privilege escalation paths, or unauthenticated update vulnerabilities exist across all collections.
- **Findings & Hardening Remediations:**
  1. **Elimination of `adminAuthHandshakes` Update Bypass Vulnerability:**
     - *Issue:* The previous rule permitted unauthenticated callers to update handshakes if `status` was in `['approved', 'consumed', 'pending']`, creating a potential vulnerability where an attacker with a known handshake ID could flip a pending 2SV session to `approved`.
     - *Fix:* Enforced that updates to `adminAuthHandshakes` strictly require Firebase authentication (`isAuthenticated()`), enforce identity matching (`authEmail() == resource.data.email.lower() || isAdmin()`), ensure immutable document keys (`request.resource.data.id == resource.data.id && request.resource.data.email == resource.data.email`), and restrict state transitions to `['approved', 'consumed']`. Deletions now also strictly verify email/uid ownership or administrative privilege.
  2. **Scoped `adminSettings` Document-Level Isolation:**
     - *Issue:* `adminSettings` was completely restricted to `isSuperAdmin()`. While `adminSettings/permissions` must remain strictly SuperAdmin-only, the layout preferences document `admission_register_layout` is edited by authorized register administrators.
     - *Fix:* Isolated `adminSettings/admission_register_layout` to allow reads and validated updates by users with the `admRegisterSuite` permission, while keeping `adminSettings/permissions` and all other documents strictly restricted to `isSuperAdmin()`.
  3. **Cleaned Public Read Directives:**
     - Sanitized `studentPhotos` read rule to replace redundant `canReadStudents() || true` with clean, explicit `true` for public admit/result cards.
  4. **Validation of Authority & Integrity Controls:**
     - Verified that users cannot alter their own `role`, `perms`, `admin`, or credential fields in `users/{userId}`.
     - Verified that public collections (`site`, `siteSettings`, `facultyPublic`) reject payment secrets, AI API keys (`geminiApiConfig`), and admin credentials.
     - Verified that private application collections (`admissions`, `masterRegisters`, `omr_registrations`, `certificateNumberLocks`, etc.) strictly enforce verified ownership and server-only indexing (`studentVerificationIndex`, `studentApplicationIndex`, `securityRateLimits` are completely locked to `allow read, write: if false;`).
- **Deployment:**
  - Automated deployment executed via `npm run deploy:rules` (`firebase deploy --only firestore:rules`) with compilation success and release to Cloud Firestore.

---

## Files Modified
- `firestore.rules`
- `CHANGES_SINCE_LAST_COMMIT.md`

---

## Local Commit Message
```bash
git commit -m "security(firestore): eliminate adminAuthHandshakes update bypass and harden document-level access rules"
```

---

## How to Review or Manually Manage Commits

### To review staged changes before commit:
```bash
git diff --staged
```

### If you want to commit manually:
```bash
git add .
git commit -m "security(firestore): eliminate adminAuthHandshakes update bypass and harden document-level access rules"
```

### To amend or edit this commit:
```bash
git reset --soft HEAD~1
# Make desired adjustments, then re-commit:
git commit -m "security(firestore): eliminate adminAuthHandshakes update bypass and harden document-level access rules"
```

### Remote Push (STRICT MANUAL STEP):
- Per repository rules, the AI assistant is strictly prohibited from running `git push`.
- To push to GitHub / remote origin, run:
```bash
git push origin main
```
