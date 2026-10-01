# Changes Log & Commit Reference

## Latest Commit: Fix Column Selector and Cohort Filter Popups Cropping at Viewport Bottom

**Commit Message:** `fix(roster): prevent column selector and cohort popups from cropping at viewport bottom`

---

### Context & Requirements Addressed

- **User Issue**:
  > *"the popup is cropped from down"*
  - Screenshot showed the `Select Table Columns` popover (`CONFIGURE COLUMNS (4 ACTIVE)`) extending beyond the bottom edge of the browser viewport.
  - The bottom categories, "Reset Default Columns", and "Done" buttons were inaccessible / cut off because the popup was anchored downwards (`top-full mt-1`) with a fixed `max-h-[460px]`, which exceeded the remaining viewport space below the button.

---

### Solutions Implemented

1. **Smart Viewport-Aware Dropup / Dropdown Positioning**:
   - In [src/portal/admin/CustomRosterDocumentBuilderView.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/CustomRosterDocumentBuilderView.jsx) inside `RosterColumnsDropdown`:
     - Dynamically measures `getBoundingClientRect()` to compute available vertical space:
       - `spaceBelow = window.innerHeight - rect.bottom - 16`
       - `spaceAbove = rect.top - 16`
     - If `spaceBelow < 360px` and `spaceAbove > spaceBelow`, the dropdown automatically opens upwards (`bottom-full mb-1`) instead of downwards (`top-full mt-1`).
     - Constrains `maxHeight` to `Math.min(500, availableSpace)` so the popup is always 100% contained within the visible viewport bounds.
     - Listens to `window.resize` and `window.scroll` (capture phase) to dynamically re-adjust if the user resizes the window or scrolls the control palette.

2. **Flexbox Architecture with Pinned Header & Sticky Footer**:
   - Transformed the popup container into a vertical flex container (`flex flex-col`):
     - **Header** (`shrink-0`): Stays pinned at the top with "Configure Columns", count badge, "+ All 35", "+ Custom", and close button.
     - **Search Bar** (`shrink-0`): Always visible below the header.
     - **Columns & Categories List** (`flex-1 min-h-0 overflow-y-auto`): Scrolls smoothly within the constrained height.
     - **Footer** (`shrink-0`): Stays permanently pinned at the bottom, ensuring the "Reset Default Columns" and "Done" buttons are never cropped off or hidden.

3. **Synchronized `CohortCheckboxDropdown`**:
   - Applied the same viewport-aware positioning (`dropUp` and responsive `maxHeight`) and `flex flex-col` layout to `CohortCheckboxDropdown` (Subjects, Genders, Statuses in Cohort Filters) to prevent bottom cropping across all popovers in the suite.

---

### Exact List of Files Changed

- [src/portal/admin/CustomRosterDocumentBuilderView.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/CustomRosterDocumentBuilderView.jsx)
- [CHANGES_SINCE_LAST_COMMIT.md](file:///d:/Shk_Gulfam/Projects/hss_shangus/CHANGES_SINCE_LAST_COMMIT.md)

---

### Build & Quality Verification

- **Production Build**: Verified with `npm run build` — compiled with `Exit Code 0` and zero breaking errors.
- **Firebase Security Rules**: No Firestore or Storage rules were modified in this change.

---

### Manual Review & Git Instructions for User

If you want to inspect, amend, or re-commit:

1. **Inspect Commit History**:
   ```bash
   git log -1 --stat
   git show HEAD
   ```

2. **Amend or Re-commit if Desired**:
   ```bash
   git reset --soft HEAD~1
   git add .
   git commit -m "fix(roster): prevent column selector and cohort popups from cropping at viewport bottom"
   ```

3. **Push to Remote (When Ready)**:
   ```bash
   git push origin main
   ```
