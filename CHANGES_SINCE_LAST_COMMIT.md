# Changes Log & Commit Reference

## Current Working Changes

### 1. Document & Certificate Studios: Unified Tools & Filters Single-Card Layout + 2/3 Preview Area
- **User Requests Addressed:**
  - *"arrange the tools and filters on one side and certificate preview on 2/3 of page"* (Student Bonafides & Certificates Studio)
  - *"here also tools and filtes into same card"* (Official Letterhead Writer)
- **Detailed Changes Implemented:**
  1. **Official Letterhead Writer ([OfficialLetterWriterView.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/OfficialLetterWriterView.jsx)):**
     - **Removed Floating Vertical Dock:** Completely removed the separate floating dock that hovered between the canvas and sidebar, eliminating visual clutter.
     - **Single Unified Right Card:** Integrated all document actions (Print, Word .docx, Save Cloud, Bookmark Template, History Archive, Gemini AI) and formatting tools (Undo, Redo, ¶, H1, H2, Bold, Italic, Underline, Strikethrough, Color Palette Popout, Alignments L/C/R/J, Lists, Table Popout, Divider Line, Clear Format) directly into the pinned top toolbar of the right-hand card.
     - **Unified Scrolling Content Area:** Positioned the category-grouped Template Selector, Duplicate/Overwrite actions, Quick Field Inserts, and Gemini AI drafter cleanly below the tools toolbar inside the exact same right-hand card.
     - **Expanded Left Document Canvas:** Cleaned up the A4 paper viewport to occupy ~2/3 width (`leftSplitPct ≈ 68%`), fully centered with max-width 860px and draggable splitter handle.
  2. **Student Bonafides & Certificates Studio ([StudentCertificateStudioView.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/StudentCertificateStudioView.jsx)):**
     - **Reorganized Workspace Layout:** Swapped the view layout so that the Live A4 Certificate Preview Paper occupies the **Left ~2/3** of the page (`leftSplitPct ≈ 67%`, resizable from 35% to 80% via central draggable splitter, double-click resets to 67%).
     - **Consolidated Tools & Filters into Same Card:** Consolidated all certificate formatting tools and database actions into a single unified card on the **Right ~1/3** of the screen:
       - **Pinned Top Toolbar:**
         - Row 1: Print, Word (.docx), Save Cloud, Student Photo Toggle (ON/OFF indicator), Insert Student Database Field popover (`{STUDENT_NAME}`, `{CLASS}`, `{ROLL_NO}`, etc. with clean downward positioning), Save As New Template, Archived Documents History, and Gemini AI Assistant.
         - Row 2: Rich text controls (Undo, Redo, ¶, H1, H2, Bold, Italic, Underline, Strikethrough, Color Palette Popover, Align Left/Center/Right/Justify, Bulleted/Numbered Lists, Table Tools Popover with 2x2/2x3/3x3 presets and row/col controllers, Horizontal Divider, Clear Format).
       - **Scrollable Filter & Template Area:** Positioned session filter, class filter, live student search & selection badge, TC/DC result inputs, and certificate template selection cards directly below the toolbar in the same card.
     - **Responsive & Modal Consistency:** Kept mobile drawer/toolbar intact for phone viewports; desktop users experience a spacious document canvas and consolidated right-hand studio card.

---

## Files Modified
- `src/portal/admin/OfficialLetterWriterView.jsx`: Removed redundant floating dock; unified tools toolbar and templates/inserts into the same right card; centered 2/3 paper canvas.
- `src/portal/admin/StudentCertificateStudioView.jsx`: Moved live A4 certificate preview to left 2/3 of page; consolidated tools and filters into single unified card on right 1/3; centered draggable splitter with 67% default.
- `CHANGES_SINCE_LAST_COMMIT.md`: Documented changes, local commit message, and manual push instructions.

---

## Local Commit Message
```bash
feat(studio): unify tools and filters into single card and expand preview to 2/3 width
```

---

## Instructions for User: Review & Push
All changes have been built and verified locally (`npm run build` completed with Exit Code 0).

To push these changes to remote GitHub:
```bash
git push origin main
```

If you wish to inspect or modify the commit before pushing:
```bash
# View last commit details
git log -1 -p

# To amend or re-commit if desired:
git reset --soft HEAD~1
git commit -m "feat(studio): unify tools and filters into single card and expand preview to 2/3 width"
```
