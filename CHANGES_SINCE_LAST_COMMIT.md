# Changes Since Last Commit

## Commit Message

`feat(beneficiary): add drag-to-resize divider between document canvas and controls sidebar`

## Files Changed

1. **[src/portal/admin/BeneficiarySanctionOrdersView.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/BeneficiarySanctionOrdersView.jsx)**:
   - **Drag-to-Resize Sidebar**: Added a live, smooth drag-to-resize handle between the document canvas (`<main>`) and the right controls sidebar (`<aside>`).
   - **State & Refs**:
     - `sidebarWidth` state (default `350px`, min `260px`, max `580px`) — drives the sidebar's inline `style={{ width: sidebarWidth }}`.
     - `isResizing`, `resizeStartX`, `resizeStartWidth` refs track drag session without causing extra re-renders.
   - **Mouse Handlers**:
     - `handleResizeMouseDown` on the divider handle: captures start position and sidebar width, applies `cursor: col-resize` and `user-select: none` to `document.body` during drag.
     - `window` `mousemove` listener: computes delta and calls `setSidebarWidth` live for a silky-smooth resize.
     - `window` `mouseup` listener: resets `isResizing` and restores cursor/user-select. Both listeners are registered once in a `useEffect` and cleaned up on unmount.
   - **Visual Divider Handle**: 6px-wide `<div>` between the canvas and sidebar with `cursor-col-resize`, a subtle center line, and a teal glow on hover — clearly signaling draggability. Hidden during print (`print:hidden`).

---

## Verification

- **Build Verification**: `npm run build` completed with **Exit Code 0** and zero breaking errors. All 12 public SEO pages and sitemap checks passed cleanly.

---

## How to Review, Amend, or Re-commit

1. **Inspect Commit Details**:
   ```bash
   git log -1 --stat
   git show HEAD
   ```

2. **Amend or Re-commit Manually (if desired)**:
   ```bash
   git reset --soft HEAD~1
   git add .
   git commit -m "feat(beneficiary): add drag-to-resize divider between document canvas and controls sidebar"
   ```

3. **Push to Remote (Manual Step)**:
   Per strict project policy, remote push is never executed by the assistant:
   ```bash
   git push origin main
   ```
