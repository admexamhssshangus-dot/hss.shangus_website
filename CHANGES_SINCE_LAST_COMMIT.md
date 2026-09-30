# Changes Log & Commit Reference

## Current Working Changes

### 1. Make Administrative Modules Popup Taller & Wider
- **User Request Addressed:**
  - *"make the modules popup taller as more modules now than earlier"*
- **Enhancements Implemented in `src/portal/admin/AdminToolsDropdown.jsx`:**
  - **Significantly Expanded Modal Height:**
    - Replaced the rigid, cramped `sm:h-[500px]` and `sm:max-h-[540px]` with responsive, generous heights: `sm:h-[680px] md:h-[720px] lg:h-[760px]` bounded safely by `max-h-[calc(100vh-20px)] sm:max-h-[calc(100vh-48px)]`.
    - This allows all 9 modules in Categories like Operations & Automation and Records & Registers to display cleanly with minimal or zero vertical scrolling.
  - **Expanded Modal Width:**
    - Increased width from `sm:w-[680px] md:w-[720px]` to `sm:w-[760px] md:w-[840px] lg:w-[920px]`, giving descriptions and action buttons ample breathing space.
  - **Wider Left Category Navigation Sidebar:**
    - Expanded desktop sidebar width from `w-52` to `w-56 md:w-60`.
    - Eliminated ellipsis truncation on long category titles (`Records & Regis...` -> `Records & Registers`, `Academics & C...` -> `Academics & Controls`, `Operations & A...` -> `Operations & Automation`).
  - **Optimized Viewport Positioning:**
    - Adjusted top placement to `top-2.5 sm:top-5 md:top-6` for balanced vertical centering across varied laptop and desktop displays.

### 2. Administrative Modules Catalog Reclassification & Streamlining
- **Enhancements Implemented in `src/portal/admin/adminModuleCatalog.js` & `src/portal/admin/AdminToolsDropdown.jsx`:**
  - **Promoted Express Direct Record Entry (`directEntry`):**
    - Established as a first-class, standalone launcher module in **Records & Registers** (`launcher: true`, `aliases: ['directEntry', 'directEntryAction', 'ingestion']`).
    - Configured with `PlusCircle` icon and direct launch handling in `AdminToolsDropdown.jsx`.
    - Removed `'directEntry'` from `boardSync` aliases to avoid search collisions.
  - **Consolidated JKBOSE Subject Roll Return:**
    - Retired standalone `jkboseSubjectRolls` launcher; mapped its aliases (`['jkboseSubjectRolls', 'subjectRolls', 'jkboseRolls']`) directly to `analyticsReports` (`Analytics & Statistical Reports Suite`), where Tab 2 houses the official circular statement with compression.
  - **Streamlined Quick Actions (Category 4):**
    - Removed redundant duplicate items (`analyticsReports` and `directEntryAction`) from Quick Actions.
    - Quick Actions now strictly hosts rapid operational tools: `quickCellEdit` (inline cell edit toggle) and `bulkToolsAction` (Bulk Tools & Ingestion Suite drawer).
    - Updated `getCategoryCount` so Quick Actions accurately reports 2 available tools.
  - **Role Governance Updates:**
    - Added `directEntry` permission to `academic_incharge` and `records_incharge` in `ROLE_PRESETS`.

---

## Files Added / Modified
- `src/portal/admin/AdminToolsDropdown.jsx` (Modified: modal height, width, sidebar width, icon mapping, click routing, and Quick Actions cleanup)
- `src/portal/admin/adminModuleCatalog.js` (Modified: promoted directEntry to Records & Registers, aliases consolidation, Quick Actions cleanup, role presets)
- `CHANGES_SINCE_LAST_COMMIT.md` (Modified)

---

## Local Commit Message
```bash
feat(portal): expand administrative modules modal height and streamline module catalog with dedicated direct entry launcher
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
git commit -m "feat(portal): expand administrative modules modal height and streamline module catalog with dedicated direct entry launcher"
```

### Manual Push (Mandatory Policy):
Per project rules, automatic remote pushes are strictly disabled. When you are ready to publish these changes to remote, please run:
```bash
git push origin main
```
