# Changes Log & Commit Reference

## Current Working Changes

### 1. Centralize Address and "Get Directions" Link on Mobile in Footer
- **User Request Addressed:**
  - `Main Road, Shangus,Anantnag, J&K — 192201`
  - `[Get Directions](https://maps.google.com/?q=Govt+Higher+Secondary+School+Shangus+Anantnag).....show it centralised like other menu items on mobile`
- **Root Cause & Layout Enhancement:**
  - In `src/components/Footer.jsx`, the "Contact Us" column previously had `items-start text-left gap-2.5` applied unconditionally to the Address block and `Get Directions` anchor.
  - While other footer sections (Quick Links, Legal & Compliance) were centered on mobile via `items-center text-center md:items-start md:text-left`, the school's postal address and maps link remained left-aligned on mobile devices.
- **Fix Implemented:**
  - Updated the Address and "Get Directions" navigation block in `src/components/Footer.jsx`:
    - Responsive flex alignment: `flex flex-col items-center md:items-start text-center md:text-left w-full`.
    - Centered icon and address wrapper: `flex items-center md:items-start justify-center md:justify-start gap-2 md:gap-2.5`.
    - Centered "Get Directions" link: `inline-flex items-center justify-center md:justify-start gap-1.5 text-xs font-semibold text-teal-400 hover:text-teal-300 mt-2 transition-colors group/dir cursor-pointer`.
    - Preserved exact left-aligned layout for desktop screens (`md:` breakpoint).

---

## Files Added / Modified
- `src/components/Footer.jsx` (Modified)
- `CHANGES_SINCE_LAST_COMMIT.md` (Modified)

---

## Local Commit Message
```bash
style(footer): center address and get directions link on mobile screens
```

---

## Instructions for User: Review & Push
All changes have been built and verified locally (`npm run build` completed with Exit Code 0), staged, and committed to your local Git repository.

### How to Inspect the Local Commit:
```bash
git log -1 --stat
git show HEAD
```

### How to Amend or Re-commit (if desired):
```bash
git reset --soft HEAD~1
# Make any additional changes if needed
git commit -m "style(footer): center address and get directions link on mobile screens"
```

### Manual Push (Mandatory Policy):
Per project rules, automatic remote pushes are strictly disabled. When you are ready to publish these changes to remote, please run:
```bash
git push origin main
```
