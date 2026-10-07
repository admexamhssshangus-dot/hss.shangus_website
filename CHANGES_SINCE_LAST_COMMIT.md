# Changes Since Last Commit

## Commit Message

`feat(portal): add minimal outline-free login submenu, display UDISE & Board codes on About page, and fix glimpse scroll`

## Files Changed & Remediated

1. `src/components/Navbar.jsx`:
   - **Minimal & Compact Login Hover Submenu**: Redesigned the desktop hover submenu into a clean, compact (48px / 192px width), outline-free list. Removed all heavy borders, header banners, and box outlines around individual items. Each item is a sleek single row with smooth background hover highlighting and colored Lucide glyphs:
     - 🎓 **Student Login** (`/portal/login?role=student`)
     - 👨‍🏫 **Teacher Login** (`/portal/login?role=teacher`)
     - 🛡️ **Standard Admin** (`/portal/login?role=admin`)
   - **Streamlined Mobile Login Grid**: Clean, borderless 3-button quick role selector for mobile drawer navigation.

2. `src/portal/LoginPage.jsx`:
   - **Automatic Role Tab Routing**: Configured `LoginPage` to parse the `role` / `tab` URL query parameter (`?role=student|teacher|admin|superadmin`) and location state on initial render and route changes, automatically activating the corresponding workspace tab and chromatic theme.

3. `src/pages/About.jsx`:
   - **Institutional Credentials Display**: Added authentic school accreditation badge (`Board Reg. No.: 010061 | UDISE code: 01061400618`) in the hero section and the "Glimpse of the Institution" card header.
   - **Smooth Glimpse Scroll Redirection**: Attached `fullGlimpseRef` to the expanded 4 Institutional Pillars section so clicking **"View Full Glimpses"** automatically expands and smoothly scrolls down into the full glimpses, removing the need for manual scrolling. Collapsing smoothly scrolls back to the card header.

4. `src/pages/Home.jsx`:
   - **Pristine Hero Layout**: Completely removed the pill badge from the hero section and the mobile stats card per user request, keeping the hero clean, fast, and uncluttered.
   - **Audience Quick Action Hub**: Added 4 accessible launcher cards (Admissions, Official Notices, Board Results & Gazettes, Digital Campus ERP Portals).
   - **Eliminated `"0+"` Stat Flicker**: Fixed `AnimatedCounter` to render verified benchmark milestone values immediately on initial paint.

5. `public/index.html` & `public/search-overview.css`:
   - **Eliminated Blocking Loader**: Replaced the blocking fullscreen overlay ("Loading School Data…") with an instant 3px top shimmer hydration bar (`.hss-hydration-indicator`).
   - Added accessible keyboard skip navigation link (`.hss-skip-link`).

6. `scripts/generate-search-pages.js` & `src/seo/siteSeo.js`:
   - Updated pre-rendered search overview templates and structured data with authentic institutional information (`Board Reg. No.: 010061 | UDISE code: 01061400618`).
   - Set high fetch priority on hero card media for optimal Largest Contentful Paint (LCP).

7. `src/pages/AdminPortal.jsx` & `src/utils/staffLetterMergeUtils.js`:
   - Standardized the 11-digit school UDISE code default to **`01061400618`** (preserving leading zero) across administrative exports and staff letter merges.

## Verification

- `npm run build` executed and completed with **Exit Code 0**.
- All 12 public HTML pages generated and validated.
- All SEO regression checks, metadata, sitemaps, and accessibility tags verified passing.

## Instructions for User: Manual Push & Inspection

1. **Inspect Commit History**:
   ```bash
   git log -n 1 --stat
   ```
2. **If You Want to Amend or Re-commit**:
   ```bash
   git reset --soft HEAD~1
   git commit -m "feat(portal): add minimal outline-free login submenu, display UDISE & Board codes on About page, and fix glimpse scroll"
   ```
3. **Push to Remote Repository** (Run manually whenever you are ready):
   ```bash
   git push origin main
   ```
   *(Note: If you recently purged git history for sensitive file cleanup, use `git push origin --force --all`)*
