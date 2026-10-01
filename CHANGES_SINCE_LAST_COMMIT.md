# Changes Log & Commit Reference

## Latest Commit: Remove Redundant Teacher Portal Link from Admin Dashboard Header

**Commit Message:** `fix(admin): remove redundant teacher portal link from admin dashboard header`

---

### Context & Clarification

- **User Inquiry**:
  > *"why there is teacher portal link, one email can be registered one role only.....,"*
- **Clarification**:
  - In a previous commit (`c058a582`), a quick switcher button (`Teacher Portal`) was introduced under the mistaken assumption that staff members might hold "dual roles" (both Administrative and Teaching/Faculty responsibilities).
  - As the institution's operational model dictates, **each registered email address is strictly assigned to one single role** (Administrator, Teacher, or Student).
  - An Administrator logged into the Admin Portal has no reason to enter practical awards or class attendance designed for teachers, and vice-versa.
  - Consequently, placing a "Teacher Portal" link in the top bar of [AdminDashboard.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/AdminDashboard.jsx) was redundant, misleading, and cluttered the header space.

---

### Changes Applied

1. **`src/portal/admin/AdminDashboard.jsx`**:
   - Removed the `<Link to="/portal/teacher">Teacher Portal</Link>` button from the header action toolbar.
   - Cleaned up unused imports (`Link` from `react-router-dom`, `BookOpen` from `lucide-react`).
   - Restored clean, focused administrative workspace navigation (Setup button, administrative Modules switcher dropdown, and sync status HUD).

---

### Exact List of Files Changed

- `src/portal/admin/AdminDashboard.jsx`
- `CHANGES_SINCE_LAST_COMMIT.md`

---

### Verification & Build Status

- **Build Verification**: `npm run build` executed and passed with **Exit Code 0** (`main.b6d1fbae.js`).
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
   git commit -m "fix(admin): remove redundant teacher portal link from admin dashboard header"
   ```
4. **Push to Remote (STRICT MANUAL RULE)**:
   ```bash
   git push origin main
   ```
