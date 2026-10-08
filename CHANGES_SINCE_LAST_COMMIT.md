# Changes Since Last Commit

## Commit Message

`feat(beneficiary): move studio controls to right sidebar, make layout compact, and fix table total wrap`

## Files Changed

1. **[src/portal/admin/BeneficiarySanctionOrdersView.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/BeneficiarySanctionOrdersView.jsx)**:
   - **Controls Relocated to Right Sidebar**: Moved the configuration, student fetcher, and column styling `<aside>` panel from the left to the right side of the workspace, placing the live WYSIWYG document canvas `<main>` prominently on the left/center.
   - **Collapsible Controls Sidebar**: Added `showControlsPanel` state toggle along with a sleek `Controls` toggle button in the top action bar (`PanelRightClose` / `PanelRightOpen`), allowing users to collapse the right sidebar completely for an expansive, distraction-free document preview.
   - **High-Density Compact Design**:
     - **Top Action Bar**: Streamlined header padding (`py-1.5 px-3 min-h-[42px]`), reduced button heights to `h-7`, added strict `whitespace-nowrap shrink-0` to all action buttons (History, Save Draft, Excel, Word, Print/PDF, Orientation toggle), and shortened preset selector width to eliminate awkward multi-line text wrapping (such as `Landsca pe`, `Portra it`, `Histor y`) on standard laptop displays (1366x768).
     - **Control Cards**: Tightened padding (`p-2.5`, `space-y-2`), reduced input/select heights (`h-7 py-0 px-2 text-xs`), made textareas compact with responsive heights (`h-14` / `h-16`), and formatted labels with crisp uppercase typography (`text-[9px] font-bold uppercase`).
     - **Visual Styling Controls Exposed**: Added instant density toggle pills (`compact`, `standard`, `spacious`), font size options (`8.5pt`, `9.5pt`, `10.5pt`, `11.5pt`), and a letterhead border frame toggle directly within Section 3 for direct document personalization.
   - **Table Footer Total Row Fix**:
     - Fixed the issue where the `TOTAL` text wrapped vertically into `TOTA \n L` inside the narrow 5% S.No cell.
     - Implemented dynamic `colSpan` spanning all non-currency columns with right-aligned `Total Amount Sanctioned :`, aligning the grand total amount (`₹ {formattedTotalAmount}`) precisely under the amount column with `whitespace-nowrap`.

---

## Verification

- **Build Verification**: `npm run build` completed with **Exit Code 0** and zero breaking errors. All 12 public static pages, sitemaps, and SEO regression checks passed cleanly.
- **Visual & Layout Verification**:
  - The studio controls are anchored to the right (`border-l`), leaving the document sheet centered and visible on the left.
  - No text wraps awkwardly in the top bar buttons or table footer cells.
  - The collapsible controls panel allows full-width document view on any resolution.

---

## How to Review, Amend, or Re-commit

If you wish to review or amend this commit:

1. **Review Commit Details**:
   ```bash
   git log -1 --stat
   git show HEAD
   ```

2. **Amend or Re-commit Manually (if desired)**:
   ```bash
   git reset --soft HEAD~1
   # Make any adjustments if desired
   git add .
   git commit -m "feat(beneficiary): move studio controls to right sidebar, make layout compact, and fix table total wrap"
   ```

3. **Push to Remote (Manual Step)**:
   Per strict project policy, remote push is never executed by the assistant:
   ```bash
   git push origin main
   ```
