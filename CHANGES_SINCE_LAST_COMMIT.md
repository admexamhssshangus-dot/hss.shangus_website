# Changes Log & Commit Reference

## Latest Commit: Fix Unstyled Site Rendering Caused by CSP Blocking media="print" Stylesheet Onload Handler

**Commit Message:** `fix(seo): restore direct stylesheet linking to prevent csp inline handler blockage`

---

### Context & Root Cause Analysis

When inspecting `https://hssshangus.in/`, the site rendered as raw, unstyled HTML with default serif/sans fonts, unstyled form controls, and plain blue links.

#### Root Cause:
1. In `scripts/generate-search-pages.js`, an asynchronous CSS loading optimization was replacing the standard CRA stylesheet tag with:
   ```html
   <link href="/static/css/main.xxx.css" rel="stylesheet" media="print" onload="this.media='all'">
   ```
2. Netlify's production `Content-Security-Policy` header in `netlify.toml` specifies:
   ```text
   script-src 'self' https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/ https://apis.google.com https://cdnjs.cloudflare.com;
   ```
   Crucially, `script-src` intentionally omits `'unsafe-inline'`.
3. In strict compliance with CSP, modern browsers (Chrome, Edge, Safari, Firefox) **blocked the inline `onload="this.media='all'"` event handler attribute**.
4. Because the `onload` handler never fired, the browser never switched `media` from `"print"` to `"all"`.
5. The browser therefore treated the entire stylesheet as print-only, applying **zero CSS rules** to the screen rendering, resulting in completely raw unstyled HTML.

---

### Changes Made

1. **`scripts/generate-search-pages.js`**:
   - Removed the `media="print" onload="this.media='all'"` inline handler replacement.
   - Replaced with direct preload + unconditional stylesheet link:
     ```javascript
     '<link rel="preload" as="style" href="$1"><link href="$1" rel="stylesheet">'
     ```
   - This maintains browser preload priority while ensuring CSS applies immediately on screen without executing any inline JavaScript.

2. **`public/index.html`**:
   - Replaced Google Fonts preload with direct `<link rel="stylesheet">`, eliminating the inline `onload="this.onload=null;this.rel='stylesheet'"` handler that was also blocked by CSP.

3. **Verification**:
   - Verified that `npm run build` succeeds cleanly with **Exit Code 0** and passes all 11 SEO regression checks.
   - Verified local rendering via browser subagent: the site renders 100% styled, vibrant, with full themes, navigation bar, cards, hero, and fonts.

---

### Exact List of Files Changed

- [scripts/generate-search-pages.js](file:///d:/Shk_Gulfam/Projects/hss_shangus/scripts/generate-search-pages.js) (Restored direct stylesheet link without inline onload handler)
- [public/index.html](file:///d:/Shk_Gulfam/Projects/hss_shangus/public/index.html) (Switched Google Fonts to standard stylesheet link compliant with strict CSP)
- [CHANGES_SINCE_LAST_COMMIT.md](file:///d:/Shk_Gulfam/Projects/hss_shangus/CHANGES_SINCE_LAST_COMMIT.md) (Updated memory log)

---

### Build Verification & Metrics

- `npm run build`: **Exit Code 0** (completed with zero breaking errors; 11 HTML pages, sitemap, canonical links generated cleanly).

---

### Manual Review & Push Instructions

To review or amend this local commit:
```bash
# Check current local commit
git log -1 --stat

# If you wish to amend or re-commit:
git reset --soft HEAD~1
git commit -m "fix(seo): restore direct stylesheet linking to prevent csp inline handler blockage"

# Push manually whenever ready (DO NOT push automatically):
git push origin main
```
