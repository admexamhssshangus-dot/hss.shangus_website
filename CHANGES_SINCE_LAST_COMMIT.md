# Changes Log & Commit Reference

## Latest Commit: Right-Side Controls with 2/3 Table Space & Compact Searchable Column Dropdown

**Commit Message:** `feat(roster): move controls to right with 2/3 table space and compact searchable columns dropdown`

---

### Architectural & UI Overview

Per user request:
1. **Layout Reorientation (Table Preview on Left, Controls on Right)**:
   - Live document preview & roster table now occupies the **LEFT** side with a default allocation of **67% (2/3 of desktop viewport width)**.
   - Filter & configuration controls have been moved to the **RIGHT** side with a default allocation of **33% (1/3 of desktop viewport width)**.
   - The central vertical splitter handle allows smooth real-time drag resizing between 45% and 80%, with a double-click shortcut to instantly reset back to the default 2/3 (67%) layout.
2. **Compact Searchable Database Column Dropdown (`RosterColumnsDropdown`)**:
   - Replaced the bulky, open 3-column card grid with an ultra-compact checkbox dropdown anchored cleanly to the right side of the control panel.
   - Equipped with a real-time live search bar that searches across **all 35+ columns registered in the database** (e.g. typing `roll`, `dob`, `photo`, `stream`, `marks`, `aadhaar`, `blood`, `fee`).
   - Categorized database field groups (Core Identity, Academic Details, Contact & Addresses, etc.) with check boxes, match count indicator, quick toggle between Core and All 35 columns, "+ Custom Column" launcher, and "Reset Default Columns" shortcut.
3. **Logically Grouped Control Palette (4 Cohesive Cards)**:
   - **Card 1: Cohort Filters**:
     - Header with matched student count (`X/Y Matched`), fallback merge alert indicator (`[⚠️ N Flagged]`), and 1-click `Reset` button.
     - Clean 2-column compact grid of filter dropdowns: Session, Class, Stream, Subject (with real-time search), Gender, and Form Status.
   - **Card 2: Table Columns & Database Fields**:
     - Full-width compact `RosterColumnsDropdown`.
     - Quick toolbar: `⚡ Abbr (GE, PH)` vs `📝 Full` subject toggle, `+ Custom` column button, `Save Default` layout button, and system default reset button.
     - Active column sequence chips with `◀` and `▶` 1-click reorder arrows, column labels (clickable to edit custom formula/fee columns), and `×` removal button.
   - **Card 3: Document Layout & Page Setup**:
     - Document Title input with printed register placeholder.
     - Layout mode buttons (`Standard` vs `2-Col Attendance`).
     - Orientation buttons (`Portrait` vs `Landscape`).
     - Row Height preset selector dropdown.
     - Collapsible accordion for Institutional Letterhead & Signatories (School Name override, Subtitle, Cohort Badges ON/OFF, and Left/Right Signatory titles).
   - **Card 4: Actions & Exports**:
     - Primary, high-contrast `Print Register / Save PDF (Ctrl+P)` button.
     - 3-column quick export buttons: Excel (`.xlsx`), Word (`.docx`), and CSV (`.csv`).
     - Student inclusion toggles: `Include All / Deselect All` and `Show / Hide Skipped Rows`.

---

### Exact List of Files Changed

- `src/portal/admin/CustomRosterDocumentBuilderView.jsx`
- `CHANGES_SINCE_LAST_COMMIT.md`

---

### Verification & Build Status

- **Build Verification**: `npm run build` executed and passed with **Exit Code 0** (`main.734bcd04.js`).
- Zero syntax or runtime compilation errors.
- Desktop layout verified with 67% table preview width on the left and 33% control pane on the right.
- Mobile view (`< lg`) continues to provide the dedicated mobile options modal with the unified control palette.

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
   git commit -m "feat(roster): move controls to right with 2/3 table space and compact searchable columns dropdown"
   ```
4. **Push to Remote (STRICT MANUAL RULE)**:
   ```bash
   git push origin main
   ```
