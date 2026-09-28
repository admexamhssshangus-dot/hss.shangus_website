# Changes Log & Commit Reference

## Current Working Changes

### 1. Scroll-Triggered Replaying Stats Counter & Entrance Animations ([Home.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/pages/Home.jsx))
- **User Request Addressed:**
  - *"STUDENTS 700+ Enrolled Scholars TEACHERS 25+ Faculty Mentors SUBJECTS 22+ Academic Streams RESULT 90%+ Board Pass Rate....they shall play animation whenver we see them in new scroll too"*

- **Implementation Details:**
  1. **Controlled AnimatedCounter (`active` Mode):**
     - Enhanced `AnimatedCounter` to support a direct `active` boolean prop with `delay` staggering.
     - When a card scrolls into view (`active: true`), it starts a 1200ms cubic ease-out count-up animation from `0` to the target metric (`700+`, `25+`, `22+`, `90%+`).
     - When the card scrolls out of view (`active: false`), any running frame/timeout is canceled and the displayed value resets to `0`, ready to animate afresh on the next scroll.
  2. **Interactive `HomeStatCard` Component:**
     - Created a specialized `HomeStatCard` component wrapping each metric card with an `IntersectionObserver` (`threshold: 0.15`).
     - Staggered cascade: Card 0 starts at 0ms, Card 1 at 100ms, Card 2 at 200ms, and Card 3 at 300ms.
     - Micro-animations: Top gradient accent bar smoothly expands from `w-0` to `w-full` (`duration-700 ease-out`), and icon badge pops with a subtle scale and rotation (`scale-90 -rotate-3` -> `scale-100 rotate-0`).

---

### 2. Seamless Borderless Footer Campus Location & Direct Navigation ([Footer.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/components/Footer.jsx))
- **User Requests Addressed:**
  1. *"what is this vertical line doing between map and Main Road, Shangus, Anantnag, J&K - 192201...can redesgn it better and professional"*
  2. *"i donot think outines suits best....chek design again"*

- **Root Cause & Fix:**
  - An orphaned `div className="w-[2px] h-[10px] bg-[#10b981]"` was positioned between the Google Map iframe and the plain text address, appearing as an awkward stray vertical line.
  - Eliminated the stray line and rejected rigid boxed outlines in favor of a sleek, borderless, typography-first integration:
    - Anchored by a clean `MapPin` (size 17, `text-teal-400`) directly beside the address without boxed frames or borders.
    - Crisp, readable typography: `Main Road, Shangus, Anantnag, J&K — 192201` (`text-slate-300 text-[13.5px] leading-relaxed`).
    - Integrated direct navigation action: `Get Directions` with `ExternalLink` icon pointing directly to Google Maps navigation for HSS Shangus (`hover:text-teal-300`).
    - Matches the borderless, clean minimalist aesthetic of the sibling "Quick Links" and "Legal & Compliance" footer columns.

---

## Files Modified
- `src/pages/Home.jsx`
- `src/components/Footer.jsx`
- `CHANGES_SINCE_LAST_COMMIT.md`

---

## Local Commit Message
```bash
feat(home,footer): add replaying scroll animations for stats cards and refine borderless footer address
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
git commit -m "feat(home,footer): add replaying scroll animations for stats cards and redesign footer campus location card"
```

### To amend or edit this commit:
```bash
git reset --soft HEAD~1
# Make desired adjustments, then re-commit:
git commit -m "feat(home,footer): add replaying scroll animations for stats cards and redesign footer campus location card"
```

### Remote Push (STRICT MANUAL STEP):
- Per repository rules, the AI assistant is strictly prohibited from running `git push`.
- To push to GitHub / remote origin, run:
```bash
git push origin main
```



