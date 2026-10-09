# Changes Since Last Commit

## Commit Message

`fix(verification): canonicalize certificate qr code origin to hssshangus.in and auto-forward legacy domains`

## Files Changed

1. **[src/utils/qrSvgGenerator.js](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/utils/qrSvgGenerator.js)**
   - **Canonical QR Origin Resolution**: Updated `getPublicVerificationOrigin()` to return the official live institutional domain `https://hssshangus.in` (or `process.env.REACT_APP_VERIFICATION_ORIGIN` if explicitly provided) instead of falling back to the legacy Firebase hosting URL `https://admexamhssshangus.web.app`.
   - **Eliminated Stale QR Target Generation**: Ensures all newly generated or previewed certificates (Bonafide, Transfer/Discharge, Character, Provisional, etc.), student ID cards, and admission forms generate QR codes pointing exclusively to `https://hssshangus.in/verify-student?...`, preventing mobile scans from landing on outdated deployments.

2. **[src/pages/StudentVerificationPage.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/pages/StudentVerificationPage.jsx)**
   - **Automatic Legacy Domain Redirection**: Added an immediate `useEffect` hook that detects if the verification page is accessed via legacy Firebase domains (`admexamhssshangus.web.app`, `admexamhssshangus.firebaseapp.com`, `hsssdb.web.app`, `hsssdb.firebaseapp.com`) and automatically redirects to `https://hssshangus.in` while preserving all search parameters (`reg`, `roll`, `cert`, `sig`, etc.).
   - **Smart `NavHomeLink` Navigation**: Replaced `<Link to="/">` with `NavHomeLink` for all return buttons ("School Home", "Return to School Portal", "Back to Homepage", and "Portal Home"). If loaded on legacy or third-party domains, it renders a direct link to `https://hssshangus.in/` so the user is never trapped in a stale deployment; when on `hssshangus.in` or local development, it preserves seamless client-side SPA routing.

3. **[public/index.html](file:///d:/Shk_Gulfam/Projects/hss_shangus/public/index.html)**
   - **Zero-Latency Head Redirection**: Added an inline canonical enforcer script in `<head>` that instantly forwards legacy Firebase hosting domains to `https://hssshangus.in` before bundle loading, ensuring users scanning older, physically printed certificates are immediately forwarded to the live site.

4. **[functions/staffSecurity.js](file:///d:/Shk_Gulfam/Projects/hss_shangus/functions/staffSecurity.js)**
   - **Updated Staff Portal Fallback**: Changed default fallback origin for `STAFF_PORTAL_ORIGIN` from `https://admexamhssshangus.web.app` to `https://hssshangus.in`.

---

## Instructions for the User

### 1. How to Review the Local Commit
You can review the changes and commit log locally:
```bash
git log -1 --stat
git show HEAD
```

### 2. How to Amend or Re-commit (Optional)
If you wish to edit the commit message or make adjustments:
```bash
git reset --soft HEAD~1
# Make desired adjustments...
git add .
git commit -m "fix(verification): canonicalize certificate qr code origin to hssshangus.in and auto-forward legacy domains"
```

### 3. How to Push to Remote Repository
In accordance with our strict Git safety rules, the assistant never executes `git push`. When you are ready, please push the commit manually:
```bash
git push origin main
```
