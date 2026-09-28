# Changes Log & Commit Reference

## Current Working Changes

### 1. Enable Keyboard "Next" Key & Arrow Navigation for Student Marks Entry
- **Context & Requirement:**
  - Teachers entering practical evaluation marks on mobile phones reported that the "Next" key on the on-screen keyboard (Gboard / iOS / Samsung Keyboard) did not advance to the next student.
  - Teachers had to manually tap every single student's input box individually.
  - The user requested:
    > *"teachers are complaining that the next key on key board is not working...i mean it shall go to next student...currently we need to click each cell individually"*
- **Resolutions in [PracticalsPage.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/teacher/PracticalsPage.jsx):**
  - **Keyboard Event Handler (`handleInputKeyDown`):**
    - Listens for `Enter`, `keyCode === 13`, `Tab` (without Shift), or `ArrowDown` to immediately advance focus to the next student's marks input cell (`idx + 1`).
    - Listens for `Shift + Tab` or `ArrowUp` to navigate backward to the previous student's marks input cell (`idx - 1`).
    - Uses `nextEl.focus()` and `nextEl.select()` so teachers can immediately type the next student's marks without needing to delete or backspace existing values.
    - Uses `nextEl.scrollIntoView({ behavior: 'smooth', block: 'center' })` to keep the active input visible in the middle of the screen above the virtual keyboard.
    - Automatically blurs the active input when reaching the end of the student roster, smoothly dismissing the soft keyboard so teachers can review or submit.
  - **Mobile Roster Cards & Desktop Table Inputs:**
    - Added `id={`practical-mark-input-mobile-${idx}`}` and `id={`practical-mark-input-desktop-${idx}`}`.
    - Added `enterKeyHint={idx === displayedStudents.length - 1 ? 'done' : 'next'}` to explicitly show the "Next" action button on mobile keyboards.
    - Added `onFocus={(e) => e.target.select()}` for instant overwrite capability when clicking or navigating.
    - Connected `onKeyDown={(e) => handleInputKeyDown(e, idx, 'mobile')}` and desktop equivalent.
  - **Validation Incomplete Modal:**
    - Applied identical keyboard navigation logic to incomplete mark resolution inputs in the pre-submission validation dialog.
- **Build Verification:**
  - Tested with `npm run build` — completed with `Exit Code 0` and zero breaking errors.

---

## Files Modified
- `src/portal/teacher/PracticalsPage.jsx`
- `CHANGES_SINCE_LAST_COMMIT.md`

---

## Local Commit Message
```bash
feat(practicals): enable mobile keyboard next key and arrow navigation for marks entry
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
git commit -m "feat(practicals): enable mobile keyboard next key and arrow navigation for marks entry"
```

### To amend or edit this commit:
```bash
git reset --soft HEAD~1
# Make desired adjustments, then re-commit:
git commit -m "feat(practicals): enable mobile keyboard next key and arrow navigation for marks entry"
```

### Remote Push (STRICT MANUAL STEP):
- Per repository rules, the AI assistant is strictly prohibited from running `git push`.
- To push to GitHub / remote origin, run:
```bash
git push origin main
```
