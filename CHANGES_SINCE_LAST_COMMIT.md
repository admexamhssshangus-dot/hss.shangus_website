# Changes Log & Commit Reference

## Latest Commit: Purge Netlify Schema Leak, Add Rich Search Structured Data & Thumbnail Snippets

**Commit Message:** `fix(seo): purge netlify.app schema leak, add FAQPage rich snippets, multi-image structured data and campus thumbnail`

---

### Summary of Changes

1. **Purged `netlify.app` Schema Leak (`src/seo/siteSeo.js`)**:
   - **Root Cause**: `src/seo/siteSeo.js` previously listed `'hssshangus.netlify.app'` inside `WebSite.alternateName` alongside the official domain and school names. This actively signaled to Google's semantic indexing bots that `hssshangus.netlify.app` was a valid ongoing alias for the institution, slowing down canonical consolidation.
   - **Fix**: Removed `'hssshangus.netlify.app'` entirely from `alternateName`. Added automated regression assertion in `scripts/seo-regression-check.js` ensuring `netlify.app` is never advertised in structured data.

2. **Enabled Google Rich Search Results & FAQ Accordion Snippets (`src/seo/siteSeo.js`)**:
   - Added schema.org `FAQPage` structured data on the homepage (`/`), providing Google with high-relevance institutional FAQs (streams offered, online admission procedures, result lookup portal, and school location). This enables Google to render rich expandable Q&A accordions directly below the search result snippet.
   - Expanded `HighSchool` schema:
     - Multi-image aspect ratios (`slides/og-card.jpg`, `slides/aboutus.jpg`, `logo192.png`) meeting Google's rich result guidelines.
     - Added `openingHoursSpecification` (Monday–Saturday 10:00 AM – 4:00 PM).
     - Added `department` hierarchy (`Department of Science`, `Department of Humanities`, `Secondary Education Wing`).
     - Added `hasCredential` recognizing JKBOSE Higher Secondary (10+2) and Secondary (10th) certifications.

3. **Restored Google Search Thumbnail for `hssshangus.in` (`scripts/generate-search-pages.js`, `src/seo/applySeo.js`)**:
   - **Root Cause**: While Netlify's old crawl cache captured the campus card, `hssshangus.in` lacked `<link rel="image_src">` tags and did not have a crawlable hero figure in the static pre-rendered overview `<main>` body, causing Googlebot's thumbnail picker to omit the snippet image.
   - **Fix**:
     - Added `<link rel="image_src" href="...">` and `<meta property="og:image:secure_url">` to `renderHead`.
     - Injected a prominent campus hero image (`/slides/og-card.jpg`, 1200x630) into the pre-rendered static HTML overview (`renderOverview`), ensuring search engines immediately index a high-resolution visual thumbnail.
     - Added dynamic `<link rel="image_src">` injection to `src/seo/applySeo.js` for seamless client-side route transitions.

4. **Preserved Forced 301 Redirects (`netlify.toml`)**:
   - Verified that `https://hssshangus.netlify.app/*` strictly returns `HTTP/1.1 301 Moved Permanently` to `https://hssshangus.in/:splat`.

---

### Files Modified

- `src/seo/siteSeo.js` — Removed `hssshangus.netlify.app` from `alternateName`, added multi-image aspect ratios, `openingHoursSpecification`, `department`, `hasCredential`, and `FAQPage` structured data.
- `src/seo/applySeo.js` — Added client-side `<link rel="image_src">` synchronization.
- `scripts/generate-search-pages.js` — Added `<link rel="image_src">`, `og:image:secure_url`, and prominent campus hero image in static HTML overview.
- `scripts/seo-regression-check.js` — Added regression assertion forbidding `netlify.app` in `WebSite.alternateName`.
- `CHANGES_SINCE_LAST_COMMIT.md` — Updated with complete documentation of this commit.

---

### Verification Results

- `npm run build`: **Compiled successfully with Exit Code 0**.
- Generated 11 static search pages, canonical redirects, and sitemap.
- SEO checks passed: 11 pages, static metadata/content, sitemap, routing, privacy headers, and offline navigation.

---

### Instructions for User Review & Push

To inspect or review the commit:
```bash
git log -1 -p
```

If you wish to amend or re-commit:
```bash
git reset --soft HEAD~1
git commit -m "fix(seo): purge netlify.app schema leak, add FAQPage rich snippets, multi-image structured data and campus thumbnail"
```

To push to the remote repository (Mandatory Manual Rule):
```bash
git push origin main
```
