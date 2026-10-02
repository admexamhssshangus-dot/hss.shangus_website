# Changes Summary Since Last Commit

## Commit Summary
- **Commit Message**: `fix(practicals): enhance mobile responsiveness by compacting toolbar controls and grouping fail list into awards export`
- **Date**: October 02, 2026
- **Status**: Production Build Passed (`Exit Code 0`), verified locally.

---

## Architectural Purpose & Mobile Responsive Enhancements

### 1. Mobile Responsiveness & Search Bar Preservation
- **Problem**: On mobile screens (~360px–400px), fixed text labels on `[Subjects (15) ▾]` and `[Filters ▾]` forced the search input to shrink down into an illegible stub (`Q S`), while the stats badge and buttons wrapped across 3–4 awkward lines.
- **Solution**:
  - **Adaptive Button Labels**:
    - `[Subjects]` button now displays `📖 (15) ▾` on mobile screens (`< sm`), expanding to `📖 Subjects (15) ▾` on tablets/desktops (`sm:`).
    - `[Filters]` button now displays `🎚 ▾` on mobile screens (`< sm`), expanding to `🎚 Filters ▾` on tablets/desktops (`sm:`).
  - **Expanded Search Bar**: Frees up over **95px** of horizontal space on mobile, allowing the search bar to comfortably display `Search students, roll, reg...` without truncation.
  - **Compact Header Badge**: Abbreviated counts and labels on mobile (`203/203 • 15 Subs`, hiding redundant words like `Sts` and `unassigned` on narrow viewports).
  - **Sleek Fail/Absent Button**: Compacted on mobile (`<AlertTriangle size={11} /> Fail`), expanding to `Fail / Absent` on larger displays.

### 2. Grouped Fail/Absent Defaulters List into `[Awards / Export ▾]`
- **Enhancement**: Added **Print Fail / Absent List** directly into the `[Awards / Export ▾]` dropdown under `Evaluation & Attendance Prints`.
- **Subject Target Awareness**: Fully respects the Target Subject Control (can generate the Fail/Absent list for All Active Subjects or filtered to a single particular subject).
- **Consolidated Access**: All evaluation prints, attendance sheets, official award rolls, fail/absent defaulter lists, consolidated cover letters, and spreadsheet/word exports are now unified within one central launcher.

### 3. Viewport-Aware Dropdown Menus
- Styled `Awards / Export` menu with `w-[min(calc(100vw-20px),22rem)] max-h-[85vh] overflow-y-auto` to prevent overflow beyond screen edges on mobile devices and enable vertical scrolling when needed.
- Styled `Subjects` menu with `w-[min(calc(100vw-20px),16rem)] max-h-[70vh] overflow-y-auto`.

---

## Files Changed & Synchronizations Completed

### 1. `src/portal/admin/AdminPracticals.jsx`
- Added `Print Fail / Absent List` inside `Awards / Export` dropdown with full subject-target binding.
- Updated `AwardsSummaryView` toolbar Row 1 and Row 2 with responsive classes (`hidden sm:inline`, `min-w-0`, compact padding).
- Bound dropdown menu widths to `min(calc(100vw - 20px), ...)` with viewport-constrained scroll containers.

---

## Verification & Build Details
- **Production Build**:
  - `npm run build` -> `Exit Code 0`
  - All static pages, SEO regression checks, and bundle chunks verified.

---

## Instructions for User

### 1. Inspect the Local Commit
To inspect the local commit:
```bash
git log -n 1 --stat
```

### 2. Manually Amend / Re-commit (Optional)
If you wish to adjust the commit message or files before pushing:
```bash
git reset --soft HEAD~1
# Make desired changes
git add .
git commit -m "fix(practicals): enhance mobile responsiveness by compacting toolbar controls and grouping fail list into awards export"
```

### 3. Manually Push to Remote Repository
As per project policy, the assistant never pushes to remote repositories. Please push manually when ready:
```bash
git push origin main
```
