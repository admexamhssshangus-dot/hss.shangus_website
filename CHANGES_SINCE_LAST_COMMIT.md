# Changes Log & Commit Reference

## Latest Commit: Expand Custom Column Modal on Desktop & Implement Searchable Checkbox Dropdowns for Lab Subjects & Classes

**Commit Message:** `feat(roster): make custom column modal wider on desktop and integrate searchable checkbox dropdowns for lab subjects and applicable classes`

---

### Context & Requirements Addressed

- **User Request**:
  > *"make this wider on desktop...and use check box dropdown where possible/relevant"* (with reference screenshot of the Create Custom Column modal).

- **Root Causes & Issues Addressed**:
  1. **Narrow Modal on Desktop**:
     - The "Create Custom Column" modal previously had `max-w-xl` (~576px), causing the entire formula matrix, surcharge inputs, and subject list to be squeezed vertically into an uncomfortably cramped dialog with excessive vertical scrolling on desktop monitors.
  2. **Cluttered Inline Subject Checkbox List**:
     - Chargeable lab subjects were previously rendered as an inline flex-wrap container with dozens of small buttons with awkward text wrapping, overlapping count badges, and confusing visual clutter.
  3. **Lack of Grade/Class Scoping for Custom Columns**:
     - Custom fee columns could not be cleanly restricted to specific grades (e.g. Higher Secondary 11th & 12th RR Fee vs Secondary 9th & 10th).

---

### Solutions Implemented

1. **Wider Responsive Desktop Modal**:
   - Expanded modal width to `w-full max-w-xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl` with `p-4 sm:p-6 space-y-4`.
   - On desktop screens, reorganizes the Fee Matrix into a balanced, spacious 2-column grid (`lg:grid-cols-12 gap-4`):
     - **Left Column (`lg:col-span-6`)**: Base Fee Matrix table with Class 11th, 12th, 10th, 9th rates for 5 Subjects (Standard) and 6 Subjects (+Voc / Add), Lab Surcharge input, and Applicable Classes filter.
     - **Right Column (`lg:col-span-6`)**: Chargeable Lab Subjects selection via Searchable Checkbox Dropdown, Active Surcharge Tags tray, and Formula breakdown options.

2. **Searchable Multi-Select Checkbox Dropdown for Chargeable Lab Subjects (`ChargeableSubjectsDropdown`)**:
   - Replaced the cluttered inline list with a professional dropdown:
     - **Trigger Button**: Displays lab icon, selected count, and cumulative rate (`5 Lab Subjects Selected (+₹100 each)`).
     - **Floating Popover**:
       - Quick action toolbar: `Default Labs (5)`, `Select All`, and `Clear`.
       - Real-time search filter across all distinct subjects found in the school database.
       - Clean checkbox rows with subject titles and student enrollment counts.
       - Inline "Add Other Subject" input with Enter key support.
     - **Active Chips Tray**: Displays active surcharge subjects as neat removable tag chips with `×` buttons for instant 1-click removal.

3. **Applicable Classes Scoping Checkbox Dropdown (`ApplicableClassesDropdown`)**:
   - Added class-level scoping allowing administrators to choose which grades the custom fee applies to (`11th`, `12th`, `10th`, `9th`).
   - Integrated into `evaluateCustomColumnValue`: unselected grades display `—` automatically in generated rosters.
   - Non-applicable class rows are dimmed and badged with "Excluded" in the matrix table.

4. **Enhanced Fixed / Signature Box Mode**:
   - Added quick presets: `Pen Signature (Empty)`, `Paid`, `Pending`, `Exempted`, `₹500`, `₹1,000`.

---

### Exact List of Files Changed

- `src/portal/admin/CustomRosterDocumentBuilderView.jsx`
- `CHANGES_SINCE_LAST_COMMIT.md`

---

### Verification & Build Status

- **Build Verification**: `npm run build` executed and verified with **Exit Code 0**.
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
   git commit -m "feat(roster): make custom column modal wider on desktop and integrate searchable checkbox dropdowns for lab subjects and applicable classes"
   ```
4. **Push to Remote (STRICT MANUAL RULE)**:
   ```bash
   git push origin main
   ```


