# Changes Log & Commit Reference

## Current Working Changes

### 1. Student Certificates Studio: Classified Dropdown, Static Tools & Prominent Toolbar
- **User Requests Addressed:**
  - *"i think tempaltes shall be in dropdown in classifed manner too.....and keep right side tools static when left side preview is scrolled"*
  - *"and remove duplicate buttons like AI i can see or others....and redesign certain buttons to be more prominent like history, new templates etc whatever suits best"*
- **Implementation Details ([StudentCertificateStudioView.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/StudentCertificateStudioView.jsx)):**
  1. **Categorized Certificate Templates Dropdown:**
     - Replaced the large 11-card template grid with a classified `<select>` dropdown organized into clean `<optgroup>` categories:
       - `📂 Bonafide & Age Certificates`
       - `📂 Character & Conduct Certificates`
       - `📂 Admission & Enrollment`
       - `📂 Transfer & Migration`
       - `📂 Transfer & Character Certificates (TC/DC)`
       - `✨ Custom Saved Presets`
     - Added quick template actions beside the selector: `[Duplicate]`, `[Overwrite]` (for custom presets), `⭐ Set Default`, and `🗑️ Delete Custom`.
  2. **Static Right Tools on Scroll:**
     - Added `lg:sticky lg:top-1 self-start` to the right-hand unified tools card.
     - Ensured the certificate canvas maintains independent viewport scrolling via `max-h-[75dvh] lg:max-h-[calc(100dvh-95px)] overflow-y-auto`.
     - Centered the draggable splitter handle with `sticky top-1/2 -translate-y-1/2`.
  3. **Removed Duplicate AI Button & Unified AI Assist:**
     - Removed the redundant standalone `[AI]` button that was directly adjacent to the AI icon menu button.
     - Redesigned the primary Gemini AI trigger into a prominent `[ ✨ AI Assist ▾ ]` button with rich gradient styling and clear dropdown menu (Draft Certificate, Polish & Humanize, Formalize Terms, Shorten Wording).
  4. **Redesigned Prominent `+ Template` & `History` Buttons:**
     - Replaced tiny 28px square icon buttons with clear, color-coded, labeled buttons:
       - `[ 🔖 + Template ]` with purple accent badge and hover states (`Save Certificate format as reusable template`).
       - `[ 📜 History ]` with indigo accent badge and hover states (`Browse past generated documents archive`).

---

### 2. Official Letterhead Writer: Static Tools, Deduplicated AI & Prominent Buttons
- **User Requests Addressed:**
  - *"here also keep right side tools static when preview is scrolled"*
  - *"and remove duplicate buttons like AI i can see or others....and redesign certain buttons to be more prominent like history, new templates etc whatever suits best"*
- **Implementation Details ([OfficialLetterWriterView.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/OfficialLetterWriterView.jsx)):**
  1. **Static Right Tools on Scroll:**
     - Added `lg:sticky lg:top-1 self-start` to the right controls pane.
     - Kept draggable splitter handle centered on scroll with `sticky top-1/2 -translate-y-1/2`.
     - Confirmed independent vertical scrolling on the A4 letter sheet container (`max-h-[75dvh] lg:max-h-[calc(100dvh-95px)] overflow-y-auto`).
  2. **Removed Duplicate AI Button:**
     - Removed the redundant top-row `[AI]` button that duplicated the dedicated `[✨ Gemini AI]` tab sitting right below the rich-text formatting toolbar.
  3. **Redesigned Prominent `+ Template` & `History` Buttons:**
     - Redesigned `BookmarkPlus` and `History` into labeled, prominent buttons:
       - `[ 🔖 + Template ]` (purple badge)
       - `[ 📜 History ]` (indigo badge)

---

## Files Modified
- `src/portal/admin/StudentCertificateStudioView.jsx`: Classified certificate template dropdown with optgroups; static right tools pane; removed duplicate AI button; prominent labeled `AI Assist ▾`, `+ Template`, and `History` buttons.
- `src/portal/admin/OfficialLetterWriterView.jsx`: Static right tools pane; removed duplicate AI button in top row; prominent labeled `+ Template` and `History` buttons.
- `CHANGES_SINCE_LAST_COMMIT.md`: Documented changes, commit message, and manual push instructions.

---

## Local Commit Message
```bash
fix(studio): static tools pane on scroll, categorized cert templates, and prominent deduplicated toolbar
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
git commit -m "fix(studio): static tools pane on scroll, categorized cert templates, and prominent deduplicated toolbar"
```
