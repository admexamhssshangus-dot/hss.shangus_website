# Changes Summary Since Last Commit

## Commit Summary
- **Commit Message**: `fix(practicals): make practicals admin portal fully responsive and resolve layout squishing`
- **Date**: October 03, 2026
- **Status**: Production Build Passed (`Exit Code 0`), verified locally with SEO and static prerendering checks passed.

---

## Architectural Purpose & Issues Resolved

### Problem Statement
1. **Broken Word Wrapping on Smaller Laptops and Tablets**:
   - In the **Master Document Audit** table:
     - The `RECORDS` column header was squished and wrapped mid-word as `RECORD \n S`.
     - The `STATUS` column badge was breaking mid-word as `APPROVE \n D`.
   - In the **Combined Faculty Roster** table:
     - The role badge was breaking mid-word as `EXAMINE \n R`.
     - Subject codes were rendering with repetitive tags (e.g., `11th • Botany (BO) (BO)`).
2. **Cramped Settings & Print Document Defaults**:
   - In **Settings & Permissions -> System & Print Defaults**:
     - The two primary configuration cards were constrained into `lg:col-span-5` and `lg:col-span-7`.
     - Inside `Print Document Defaults`, the 3 class header groups (Class 10th, Class 11th, Class 12th) were compressed into `xl:grid-cols-3` and each into `grid grid-cols-2`.
     - Each input was squeezed to approximately ~85px width, truncating crucial administrative text such as `Govt. Higher Secondary Scho...`, `Mr. Nawaz A...`, `SHGEDUO0...`, `700603450...`, and `Annual Regu...`.
3. **Table Cramping Without Horizontal Scroll on Mobile & Touch Devices**:
   - Data tables (Combined Faculty Roster, Master Document Audit, Class Awards Data Grid, and Subject Marks Matrix) lacked responsive container minimum widths and proper overflow boundaries, squeezing columns together rather than allowing fluid horizontal scrolling.

---

## Changes Implemented

### 1. Header Toolbar & Navigation Ribbon
- File: [src/portal/admin/AdminPracticals.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/AdminPracticals.jsx)
  - Switched layout from `flex-col md:flex-row` to `flex-col xl:flex-row items-start xl:items-center justify-between gap-3`.
  - Reorganized action buttons into `flex flex-wrap items-center justify-between sm:justify-start xl:justify-end gap-2 w-full xl:w-auto`.
  - Added responsive text visibility: `<span className="md:hidden">Faculty</span><span className="hidden md:inline">Faculty & Submissions</span>` and `<span className="md:hidden">Settings</span><span className="hidden md:inline">Settings & Permissions</span>`.
  - Separated utility tools (Excel dropdown and Recycle Bin) with responsive borders and padding.

### 2. Faculty & Submissions View
- File: [src/portal/admin/AdminPracticals.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/AdminPracticals.jsx)
  - **Stat Badges**: Added `whitespace-nowrap`, adaptive text labels (`<span className="hidden sm:inline">Total </span>Docs`), and clean responsive wrapping.
  - **View Mode Switcher**: Enhanced to a responsive grid on small viewports (`w-full sm:w-auto grid grid-cols-2 sm:flex`) with clean labels (`Faculty Roster`, `Master Audit`).
  - **Filter Toolbar**: Converted to `grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full lg:w-auto` for seamless touch accessibility.
  - **Combined Faculty Roster Table**:
    - Added container with `overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs` and `min-w-[960px]`.
    - Added `whitespace-nowrap` to all column headers and role badges (`whitespace-nowrap inline-block`), permanently eliminating mid-word breaks like `EXAMINE \n R`.
    - Sanitized duplicate subject abbreviations in the submissions column with regex deduplication.
  - **Faculty Drawer Submissions Table**:
    - Wrapped in `overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800` with `min-w-[700px]` and `whitespace-nowrap` badge formatting.
  - **Master Document Audit Table**:
    - Wrapped in `overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs` with `min-w-[960px]`.
    - Added `whitespace-nowrap` to `RECORDS` and `STATUS` headers and badges, eliminating `RECORD \n S` and `APPROVE \n D`.
    - Added clean truncation with tooltip fallback (`max-w-[220px] truncate title={s.id}`) to prevent ultra-long document identifiers from pushing columns out of proportion.

### 3. Subject Marks Matrix & Class Awards Data Grid
- File: [src/portal/admin/AdminPracticals.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/AdminPracticals.jsx)
  - Added `min-w-[620px]` and `overflow-x-auto` to the high-density Marks Matrix table.
  - Added `min-w-[950px]` to the student awards summary data table so student credentials, roll numbers, and all subject marks render cleanly with native horizontal scrolling on tablets and phones.

### 4. System Configuration & Print Document Defaults
- File: [src/portal/admin/AdminPracticals.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/AdminPracticals.jsx)
  - Completely replaced the cramped `lg:col-span-5` and `lg:col-span-7` column split with two full-width, spacious cards:
    - **Card 1: Global System Configuration**: inputs organized in a responsive `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 text-xs`.
    - **Card 2: Print Document Defaults & Official Headers**: organized into `grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 text-xs`.
    - Inside each class card (10th, 11th, 12th): Institution Name is full-width, Session & Incharge Name in `grid grid-cols-1 sm:grid-cols-2 gap-2.5`, Incharge CPIS & Mobile in `grid grid-cols-1 sm:grid-cols-2 gap-2.5`. Every text input now has 175px–350px width with zero truncation.

---

## Files Changed
- `src/portal/admin/AdminPracticals.jsx` (Modified)
- `CHANGES_SINCE_LAST_COMMIT.md` (Updated)

---

## Instructions for the User

### 1. How to Review This Commit
To inspect the changes committed locally:
```bash
git log -1 -p
```
or view a condensed stat summary:
```bash
git log -1 --stat
```

### 2. How to Amend or Re-Commit If Desired
If you wish to modify the commit message or make further edits:
```bash
git reset --soft HEAD~1
# (make edits or stage new changes)
git commit -m "fix(practicals): make practicals admin portal fully responsive and resolve layout squishing"
```

### 3. How to Push Changes
Per institutional policy, the assistant never pushes to remote repositories. When you are ready to publish:
```bash
git push origin main
```
