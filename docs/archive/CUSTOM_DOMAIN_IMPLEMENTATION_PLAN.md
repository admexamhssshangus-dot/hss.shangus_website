# Custom Domain Migration & Setup Plan: `hssshangus.in`

**Archived on:** 2026-09-18  
**Domain:** `hssshangus.in`  
**Registrar:** Spaceship.com  
**Hosting Target:** Netlify (Frontend & Serverless Functions) + Firebase (Auth, Firestore, Storage)

This implementation plan outlines the exact step-by-step process to purchase, connect, configure, and code-update the website for the custom domain **`hssshangus.in`**.

---

## 1. Domain Registration (Spaceship.com)

1. **Complete Registrant Information**:
   - In the Spaceship cart, click **Edit** under **Domain Contacts** to fill in your contact information (name, address, email, phone number).
   - Ensure the email address provided is accessible (ICANN sends a verification email).
2. **Review Add-ons**:
   - Spaceship includes free domain privacy (WHOIS protection).
   - The Spacemail Pro trial is optional. You can skip it unless you want custom mailboxes (like `admin@hssshangus.in`) right away.
3. **Checkout**:
   - Complete payment (approx. ₹1,143.22 for 2 years).
   - Check your email inbox to verify domain contact details if requested by the registry.

---

## 2. DNS & Hosting Connection

The site is built with React and deployed to **Netlify** (with Netlify Functions for admission workflows, staff commands, etc.) while leveraging **Firebase** for Firestore, Auth, and Storage.

Connecting the custom domain directly to Netlify ensures frontend and backend functions continue to work without CORS or proxy friction.

### DNS Setup (Spaceship DNS Management)
In **Spaceship Dashboard → Domain List → `hssshangus.in` → Advanced DNS / Records**:

| Type | Name / Host | Value / Target | TTL | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **A** | `@` (or blank) | `75.2.60.5` | Automatic / 300 | Points apex domain `hssshangus.in` to Netlify Load Balancer |
| **CNAME** | `www` | `hssshangus.netlify.app` | Automatic / 300 | Points `www.hssshangus.in` to your Netlify app |

*(Alternative: You can assign Netlify's Nameservers directly in Spaceship if you want Netlify to manage all DNS automatically).*

### Netlify Custom Domain Configuration
1. Open **Netlify Dashboard → Your Site (`hssshangus`) → Site Configuration → Domain Management**.
2. Click **Add a domain** → Enter `hssshangus.in`.
3. Set `hssshangus.in` (or `www.hssshangus.in`) as the **Primary Domain**.
4. Netlify will automatically detect DNS and provision a **Free Let's Encrypt SSL/TLS Certificate** covering both `hssshangus.in` and `www.hssshangus.in` within 10–30 minutes.

---

## 3. Redirection Strategy

### A. Apex vs. `www` Redirection (`hssshangus.in` <--> `www.hssshangus.in`)
- **How it works**: Netlify automatically sets up a **301 Permanent Redirect** between `www` and non-`www`.
- **Recommendation**: Designate `hssshangus.in` as the primary domain. If any user types `www.hssshangus.in`, Netlify automatically 301-redirects them to `https://hssshangus.in/` while preserving the exact URL path.

### B. HTTP to HTTPS Redirection
- Netlify automatically enforces **HSTS and HTTP → HTTPS 301 redirects**. Any `http://` traffic is permanently upgraded to `https://`.

### C. Old Netlify URL (`hssshangus.netlify.app` → `hssshangus.in`)
To ensure visitors and search engines using your old Netlify link are redirected to your new domain, configure a 301 redirect rule in `netlify.toml`:
```toml
[[redirects]]
  from = "https://hssshangus.netlify.app/*"
  to = "https://hssshangus.in/:splat"
  status = 301
  force = false
```

### D. Search Engine Canonical Redirection (SEO)
- Search engines respect `<link rel="canonical" href="https://hssshangus.in/..." />`.
- When updating the codebase, canonical tags will point to `https://hssshangus.in`. Google will transfer indexing equity from `hssshangus.netlify.app` directly to `hssshangus.in` without penalty.

---

## 4. Required Code Changes

Files in the codebase that reference `hssshangus.netlify.app` and need updating during the rollout:

### Component 1: SEO & Canonical Tags
- **`src/seo/siteSeo.js`**: Update `SITE_ORIGIN`:
  ```javascript
  const SITE_ORIGIN = 'https://hssshangus.in';
  ```
  *(Auto-updates canonical tags, OpenGraph URLs `og:url`, Twitter meta cards, and Schema.org JSON-LD Structured Data).*
- **`public/sitemap.xml`**: Update all `<loc>` entries from `https://hssshangus.netlify.app/...` to `https://hssshangus.in/...`.
- **`public/robots.txt`**: Update the sitemap declaration:
  ```txt
  Sitemap: https://hssshangus.in/sitemap.xml
  ```

---

### Component 2: Backend & Serverless Function CORS Whitelist
- **`netlify/functions/staff-command.js`**: Add `https://hssshangus.in` and `https://www.hssshangus.in` to the allowed origins set.
- **`netlify/functions/lib/publicRecords.js`**: Add `https://hssshangus.in` and `https://www.hssshangus.in` to allowed lookup origins.
- **`netlify/functions/admission-workflow.js`**: Add `https://hssshangus.in` and `https://www.hssshangus.in` to default allowed origins.
- **`netlify/functions/ai-generate.js`**: Add `https://hssshangus.in` and `https://www.hssshangus.in` to allowed origins.

---

### Component 3: Security Policies & Watermarks
- **`netlify.toml` & `firebase.json`**: Include `https://hssshangus.in https://www.hssshangus.in` in `connect-src` CSP directives.
- **`src/index.css`**: Update the print/display watermark:
  ```css
  content: "Verified Official Record • hssshangus.in";
  ```
- **`twa-manifest.json`**: Update PWA/TWA manifest host and icon paths to `hssshangus.in`.

---

## 5. Critical External Services Configuration (Zero-Code, Dashboard Steps)

### Firebase Authentication Authorized Domains (MANDATORY)
When running on `hssshangus.in`, Google Sign-In and Phone Auth will fail with `auth/unauthorized-domain` unless the domain is added to Firebase:
1. Go to **Firebase Console → Authentication → Settings → Authorized domains**.
2. Click **Add domain** and add:
   - `hssshangus.in`
   - `www.hssshangus.in`

### Google reCAPTCHA / App Check (if enabled)
In **Google Cloud Console → Security → reCAPTCHA Enterprise** (or Firebase App Check):
Add `hssshangus.in` and `www.hssshangus.in` to the list of allowed domain names for the key.

### Google Search Console
1. Add `hssshangus.in` as a **Domain property** in Google Search Console (verify via a simple DNS TXT record in Spaceship).
2. Submit your new sitemap: `https://hssshangus.in/sitemap.xml`.

---

## 6. Verification Plan

### Automated Build & Regression Tests
- Run `npm run build` locally to verify:
  - Production bundle builds successfully.
  - Pre-rendered static search pages generate with canonical tags.
  - `seo-regression-check.js` passes with zero schema or sitemap mismatches.
- Run `npm run test:public` to ensure CORS and public lookup endpoints validate properly.

### Post-DNS Manual Verification
1. **DNS Propagation**: Check `https://dnschecker.org/#A/hssshangus.in` to verify the IP resolves to `75.2.60.5`.
2. **SSL Certificate**: Open `https://hssshangus.in` in an incognito window to verify the green padlock (Let's Encrypt SSL).
3. **Redirect Check**: Visit `http://hssshangus.in` and `http://www.hssshangus.in` to confirm automatic 301 redirection to `https://hssshangus.in`.
4. **Authentication Check**: Log in via Student Portal & Admin Portal to verify Google Auth / OTP login works without unauthorized domain errors.
5. **API & Lookup Check**: Verify student lookup and admission forms complete with 200 OK status.
