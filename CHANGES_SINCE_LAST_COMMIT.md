# Changes Log & Commit Reference

## Current Working Changes

### 1. Notice Board Height Calibration & Principal Message Gap Elimination ([Home.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/pages/Home.jsx))
- **User Request Addressed:**
  - *"where there is gap below principal message box....seems notice board card taking more vertical space"*

- **Root Cause Analysis:**
  - In `src/pages/Home.jsx` (`#home-briefing` section):
    - The section grid (`grid grid-cols-1 md:grid-cols-12 items-stretch`) forced both the left column (Notice Board) and the right column (Principal Message + Stats Cards) to match each other in total height.
    - The notice list container was configured with `max-h-[400px] sm:max-h-[430px] md:max-h-[460px]`. With 8 active notices populated, the notice board expanded vertically to ~560px.
    - The right column container had `flex flex-col justify-between gap-5 sm:gap-6`. Because the parent stretched to ~560px to accommodate the tall notice board, `justify-between` anchored the Principal's Message at the top and the Stats Cards at the very bottom, creating an awkward ~180px–190px dead vertical void in the middle.

- **Key Implementations & Layout Calibration:**
  1. **Notice List Max-Height Optimization:**
     - Reduced the notice list scroll container from `max-h-[400px] sm:max-h-[430px] md:max-h-[460px]` to `max-h-[240px] sm:max-h-[255px] md:max-h-[265px]`.
     - Displays 4–5 notices cleanly at a glance while allowing smooth vertical scrolling for older updates, with direct access to the full notice archive.
     - Capped total Notice Board card height at ~355px.
  2. **Right Column Alignment & Natural Spacing:**
     - Switched right column alignment from `justify-between gap-5 sm:gap-6` to `justify-start md:justify-between gap-3.5 sm:gap-4`.
     - Calibrated Principal Card inner padding from `p-3.5 sm:p-6` to `p-3.5 sm:p-5`.
     - Tightened header margin from `mb-3` to `mb-2.5 sm:mb-3`.
  3. **Visual & Geometric Balance:**
     - Both columns now calibrate naturally to ~350px–360px.
     - The dead vertical void below the Principal's Message is eliminated, replaced with a clean, cohesive, and balanced 14px–16px (`gap-3.5 sm:gap-4`) spacing directly above the Stats cards.

---

## Files Modified
- `src/pages/Home.jsx`
- `CHANGES_SINCE_LAST_COMMIT.md`

---

## Local Commit Message
```bash
fix(home): eliminate vertical gap below principal message by calibrating notice board height
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
git commit -m "fix(home): eliminate vertical gap below principal message by calibrating notice board height"
```

### To amend or edit this commit:
```bash
git reset --soft HEAD~1
# Make desired adjustments, then re-commit:
git commit -m "fix(home): eliminate vertical gap below principal message by calibrating notice board height"
```

### Remote Push (STRICT MANUAL STEP):
- Per repository rules, the AI assistant is strictly prohibited from running `git push`.
- To push to GitHub / remote origin, run:
```bash
git push origin main
```

