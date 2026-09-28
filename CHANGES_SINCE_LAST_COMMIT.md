# Changes Log & Commit Reference

## Current Working Changes

### 1. Slide and Notice Live Synchronization Architecture Safeguard
- **Context & Requirement:**
  - Verified and safeguarded what happens when an admin adds new slide images, modifies titles/captions/fit, or reorders slides.
  - Ensured that static fallbacks (`slides.txt`, `notices.txt`) never overwrite fresh, live Firestore data stored in `localStorage` from admin updates.
- **Resolutions in [Home.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/pages/Home.jsx):**
  - Added cache guards around `fetchStaticSlidesFallback()`, `fetchStaticNoticesFallback()`, and `fetchStaticTrafficFallback()` so static files only load when local cache is truly empty (e.g. brand new user on first visit).
  - Background Firestore synchronization continuously pulls the live `doc(db, 'site', 'slideshow')` data for visitors whenever the cache TTL expires (or on first visit).
  - The live `BroadcastChannel('hss_data_sync')` listener updates all open tabs instantly whenever an admin saves slides in the Admin Console.
  - The `<Slideshow>` component dynamically supports any number of slides, custom titles/captions, and all image sources (Firebase Storage URLs, external links, or local `/slides/` paths).

---

## Files Modified
- `src/pages/Home.jsx`
- `CHANGES_SINCE_LAST_COMMIT.md`

---

## Local Commit Message
```bash
fix(slideshow): ensure static slide and notice fallbacks preserve live admin CMS updates
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
git commit -m "fix(slideshow): ensure static slide and notice fallbacks preserve live admin CMS updates"
```

### To amend or edit this commit:
```bash
git reset --soft HEAD~1
# Make desired adjustments, then re-commit:
git commit -m "fix(slideshow): ensure static slide and notice fallbacks preserve live admin CMS updates"
```

### Remote Push (STRICT MANUAL STEP):
- Per repository rules, the AI assistant is strictly prohibited from running `git push`.
- To push to GitHub / remote origin, run:
```bash
git push origin main
```
