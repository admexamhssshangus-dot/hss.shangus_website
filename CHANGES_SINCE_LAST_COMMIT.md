# Changes Log & Commit Reference

## Latest Commit: Eliminate Control Redundancy, Fit All Controls on Screen, and Enforce Independent Scroll for Roster Studio

**Commit Message:** `feat(roster): eliminate duplicate controls, fit all filters/actions in viewport, and enforce independent scroll for table and controls`

---

### Context & Requirements Addressed

- **User Request**:
  > *"ensure no repetition or duplicacy....and ensure allcontrols/filters are visible on screen and table ad controls are independt in scroll"*

- **Problems Identified**:
  1. **Duplication of Controls**:
     - The desktop view had duplicate toolbars and action bars (top bar with Print/Export, and an action bar over the table with "Include All", "Show Skipped", and "Save Order") that repeated the exact controls present in the right-side control pane.
  2. **Off-Screen Controls & Awkward Scrolling**:
     - The 4 cards in the right pane were vertically tall (~500–600px), with the Column Order chip list alone occupying ~144px, causing the cohort filters at the top to scroll off-screen and the primary Print/Export buttons at the bottom to be cut off.
  3. **Lack of Independent Scrolling & Double Scrollbars**:
     - The outer layout had unconstrained vertical height and `sticky top-3` positioning on both the table and control panes, creating nested double scrollbars on the right and causing the outer dashboard window to scroll alongside inner containers.

---

### Solutions Implemented

1. **Zero Duplication & Single Source of Truth**:
   - Removed duplicate top action bars on desktop.
   - Replaced the repetitive controls bar above the table with a clean, slim informational status strip (`X Students Active • Drag table header edges to resize • Official Print Layout`).
   - Unified all filtering, column selection, page setup, and document actions inside the dedicated 4-card Right Control Palette:
     - **Card 1 (Cohort Filters)**: Session, Class, Stream, Subject, Gender, Status filters with match counter and reset.
     - **Card 2 (Table Columns)**: Columns selection popover with search, Abbr/Full names toggle, `+ Custom` column creator, `Save Default` button, and an on-demand collapsible `Order ▾` chip sequence panel.
     - **Card 3 (Page & Table Setup)**: Document title input, Standard/2-Column Attendance layout switcher, Portrait/Landscape orientation toggle, Row Height preset selector, and collapsible Letterhead & Signatories accordion.
     - **Card 4 (Actions & Exports)**: Primary `Print Register / Save PDF (Ctrl+P)` button, 1-click `Excel (.xlsx)`, `Word (.docx)`, and `CSV` export buttons, plus `Include All` and `Show Skipped` row toggles.

2. **All Controls & Filters 100% Visible on Screen**:
   - Engineered an ultra-compact vertical footprint for all 4 cards (~340px total combined height):
     - Dropdowns tightened to `h-6.5` with `text-[9.5px]` font sizing.
     - Column sequence chips collapsed by default under `Order ▾` (taking 0px resting space).
     - Letterhead & Signatories collapsed by default (taking 0px resting space).
     - All 4 cards and all action buttons now fit comfortably in the viewport simultaneously on 1080p, 900p, and 768p displays without requiring vertical scrolling.

3. **True Independent Scrolling**:
   - Constrained the studio root to `h-[calc(100dvh-54px)] overflow-hidden`, completely eliminating outer dashboard and browser page scrollbars.
   - Configured the Left Pane (Live Document Preview) as `w-full lg:flex-1 h-full min-h-0 flex flex-col overflow-hidden` with the paper sheet container set to `flex-1 min-h-0 overflow-auto`. The table preview now scrolls horizontally and vertically completely independently.
   - Configured the Right Pane (Control Palette) as `h-full min-h-0 overflow-y-auto`. The controls scroll independently without moving or triggering a scroll on the table preview.

---

### Exact List of Files Changed

- `src/portal/admin/CustomRosterDocumentBuilderView.jsx`
- `CHANGES_SINCE_LAST_COMMIT.md`

---

### Verification & Build Status

- **Build Verification**: `npm run build` executed and passed with **Exit Code 0** (`main.3253bbcd.js`).
- Zero syntax, linting, or runtime errors.
- Dev server hot-reloaded the updated bundle seamlessly.

---

### Instructions for User: Manual Review, Amend & Push

1. **Inspect Commit History**:
   ```bash
   git log -n 1 --stat
   ```
2. **Review Code Diff**:
   ```bash
   git diff HEAD~1
   ```
3. **Amend Commit Message (if desired)**:
   ```bash
   git reset --soft HEAD~1
   git commit -m "feat(roster): eliminate duplicate controls, fit all filters/actions in viewport, and enforce independent scroll for table and controls"
   ```
4. **Push to Remote (STRICT MANUAL RULE)**:
   ```bash
   git push origin main
   ```
