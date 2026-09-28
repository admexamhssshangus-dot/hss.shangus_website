# Changes Log & Commit Reference

## Current Working Changes

### 1. Notice Board White Bar Elimination & Absolute Grid Inset Alignment ([Home.jsx](file:///d:/Shk_Gulfam\Projects\hss_shangus\src\pages\Home.jsx))
- **User Request Addressed:**
  - *"some white bar above browse notice archive"*

- **Root Cause Analysis:**
  - In `src/pages/Home.jsx` (`#home-briefing` section):
    - The Right Column (Principal Message + Stats Cards) naturally measures ~442px in total height.
    - Because the parent grid applies `items-stretch`, the Left Column (Notice Board card) was stretched to match that 442px height.
    - Inside the Notice card, the header is 49px, the footer is 58px, and available content height was ~335px.
    - However, the list had a hardcoded `max-h-[265px]`, and the footer had `mt-auto`.
    - This caused the list to freeze at 265px while `mt-auto` pushed the footer to the very bottom, creating a **~68.5px empty void** of card background (`bg-white`) directly above the "Browse Notice Archive" button, appearing as a thick, awkward white bar.

- **Key Implementations & Layout Architecture:**
  1. **Grid Inset Positioning (`md:relative` + `md:absolute md:inset-0`):**
     - Left column wrapper is set to `md:relative`, allowing the Right Column to dictate the true natural row height (~442px) without circular expansion.
     - The inner Notice card is set to `md:absolute md:inset-0`, cleanly filling 100% of the grid cell height.
  2. **Seamless List Fill (`flex-1 min-h-0 md:max-h-none`):**
     - Replaced hardcoded `max-h-[265px]` on desktop with `flex-1 min-h-0 md:max-h-none max-h-[300px]`.
     - On desktop, the list now expands to fill the entire remaining 334px of card height directly from header to footer with **0px margin/gap**.
     - On mobile screens (`< md`), `max-h-[300px]` keeps the list compact and scrollable so phone visitors don't have to scroll excessively.
  3. **Zero-Gap Footer Integration:**
     - Removed `mt-auto` and added `shrink-0` to the header and footer containers.
     - The notice list touches the top border of the footer directly, and the custom scrollbar extends smoothly all the way to the footer border.

---

## Files Modified
- `src/pages/Home.jsx`
- `CHANGES_SINCE_LAST_COMMIT.md`

---

## Local Commit Message
```bash
fix(home): eliminate white bar above notice archive button via absolute grid cell positioning
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
git commit -m "fix(home): eliminate white bar above notice archive button via absolute grid cell positioning"
```

### To amend or edit this commit:
```bash
git reset --soft HEAD~1
# Make desired adjustments, then re-commit:
git commit -m "fix(home): eliminate white bar above notice archive button via absolute grid cell positioning"
```

### Remote Push (STRICT MANUAL STEP):
- Per repository rules, the AI assistant is strictly prohibited from running `git push`.
- To push to GitHub / remote origin, run:
```bash
git push origin main
```


