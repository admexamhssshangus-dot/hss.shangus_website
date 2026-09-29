# Changes Log & Commit Reference

## Current Working Changes

### 1. Header Navigation: Removal of Redundant "Sync" Button
- **User Request Addressed:**
  - *"and remove sync button not needed...."*
- **Implementation Details:**
  - In [AdminDashboard.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/AdminDashboard.jsx), removed the on-demand Cloud `Sync` button from the top administrative sub-navigation bar next to `Setup` and `Modules`.
  - Cleaned up the unused `RefreshCw` icon import from `lucide-react`.

### 2. Studio Layout: Fix Empty Right Side & Enable Full Horizontal Expansion on Drag
- **User Requests Addressed:**
  - *"why preview doensot fill space horizontally when dragged ..certificates right side is empty?"*
- **Root Cause & Fixes:**
  1. **Fixed Certificate Studio Layout Hierarchy ([StudentCertificateStudioView.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/StudentCertificateStudioView.jsx)):**
     - **Issue:** The left preview pane div (`line 5470`) was not closed before the vertical splitter and right-hand card. As a result, the draggable splitter and the unified tools/filters card were accidentally placed *inside* the 67% left container stacked below the certificate, leaving the entire right 33% of the desktop page completely blank and empty.
     - **Fix:** Properly closed the left preview pane div immediately after the certificate canvas container, making the Left Half (Preview), Draggable Splitter Handle, and Right Half (Unified Tools & Filters Card) true direct siblings of `.cert-split-container`. Removed the trailing extra `</div>`.
  2. **Enabled Full Horizontal Expansion on Drag in Both Studios:**
     - **Official Letterhead Writer ([OfficialLetterWriterView.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/OfficialLetterWriterView.jsx)):** Removed restrictive `max-w-[860px]` and `mx-auto` from the letterhead preview container (`w-full min-w-0`), allowing the letterhead canvas to fill the full 2/3 workspace horizontally and expand seamlessly as the user drags the splitter.
     - **Student Bonafides & Certificates Studio ([StudentCertificateStudioView.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/StudentCertificateStudioView.jsx)):** Removed restrictive `max-w-[860px]` and `mx-auto` from the certificate canvas container (`w-full min-w-0`), allowing the certificate to stretch horizontally and adapt dynamically to splitter adjustments.
  3. **Guaranteed Side-by-Side Flex Dimensions:**
     - Added `lg:flex-nowrap` to both `.cert-split-container` and `.letter-split-container`.
     - Replaced rigid percentage widths with precise `calc(${leftSplitPct}% - 9px)` on the left pane and `calc(${100 - leftSplitPct}% - 9px)` on the right pane to account for the 18px draggable splitter, preventing flex wrap or horizontal page overflow.

---

## Files Modified
- `src/portal/admin/AdminDashboard.jsx`: Removed redundant on-demand cloud sync button from top sub-nav bar; cleaned up `RefreshCw` import.
- `src/portal/admin/OfficialLetterWriterView.jsx`: Removed `max-w-[860px]` restriction from preview canvas container to fill available width horizontally on splitter drag; set `calc()` split widths and `lg:flex-nowrap`.
- `src/portal/admin/StudentCertificateStudioView.jsx`: Fixed container div nesting so the right tools/filters card renders side-by-side with the preview canvas; removed `max-w-[860px]` to enable horizontal expansion on drag; set `calc()` split widths and `lg:flex-nowrap`.
- `CHANGES_SINCE_LAST_COMMIT.md`: Documented changes, commit message, and manual push instructions.

---

## Local Commit Message
```bash
fix(studio): restore certificates right card, expand preview horizontally on drag, and remove top sync button
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
git commit -m "fix(studio): restore certificates right card, expand preview horizontally on drag, and remove top sync button"
```
