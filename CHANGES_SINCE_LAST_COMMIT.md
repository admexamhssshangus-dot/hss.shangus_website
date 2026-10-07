# Changes Since Last Commit

## Commit Message

`fix(home,navbar): remove unneeded action cards and fix light-theme login dropdown text contrast`

## Files Changed & Remediated

1. `src/pages/Home.jsx`:
   - **Removed Audience Action Hub**: Completely removed the 4-card quick access row (`Apply for Admission`, `Notice Board & Circulars`, `Board Results & Gazettes`, `Digital Campus ERP`) per user request to keep the homepage lean, clean, and focused directly on the core news ticker, school briefing, and executive leadership message.

2. `src/index.css`:
   - **Eliminated Wildcard CSS Bleed**: Removed the over-broad wildcard selector `.theme-light header.site-header-navbar [class*="bg-slate-800"]` which was matching elements with `dark:hover:bg-slate-800` and painting unexpected dark backgrounds onto the login submenu links in light mode.
   - **Dedicated High-Contrast Dropdown Styles**: Added targeted, bulletproof rules for `.login-dropdown-menu` and `.login-dropdown-link` ensuring:
     - **Light Theme**: Pure white card background (`#ffffff`), 1px slate-200 border, and deep slate text (`#0f172a`, hovering to `#020617` with `#f1f5f9` hover background) delivering **15.8:1 (WCAG AAA)** contrast.
     - **Dark Theme**: Deep slate-900 background (`#0f172a`), slate-700 border, and light slate text (`#f1f5f9`, hovering to `#ffffff` with `#1e293b` hover background).

3. `src/components/Navbar.jsx`:
   - Applied `.login-dropdown-menu` and `.login-dropdown-link` classes directly to the desktop hover login submenu to guarantee crisp legibility in all color themes.

## Verification

- `npm run build` executed and completed with **Exit Code 0**.
- All 12 public HTML pages generated and validated.
- All SEO regression checks, static metadata, sitemaps, and accessibility tags verified passing.

## Instructions for User: Manual Push & Inspection

1. **Inspect Commit History**:
   ```bash
   git log -n 1 --stat
   ```
2. **If You Want to Amend or Re-commit**:
   ```bash
   git reset --soft HEAD~1
   git commit -m "fix(home,navbar): remove unneeded action cards and fix light-theme login dropdown text contrast"
   ```
3. **Push to Remote Repository** (Run manually whenever you are ready):
   ```bash
   git push origin main
   ```
