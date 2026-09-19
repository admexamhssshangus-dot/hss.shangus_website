# Archive: Firestore Database Maintenance & Modifications Ledger

**Created Date**: September 19, 2026  
**Project**: GHSS Shangus (`hsssdb`)  
**Context**: Pre-Board Awards reflection, absent status cleanup, and registration collision resolution.  
**Netlify Deployment Note**: The published site on Netlify is running production build `main@94446b7` (production deploys currently paused until monthly credits reset). All Firestore updates documented below take effect **directly and immediately** on the live database without requiring any Netlify build credits.

---

## 1. Summary of Firestore Changes

| Document Path (`practicalsData`) | Action Taken | Previous State | New State | Backup Location |
| :--- | :--- | :--- | :--- | :--- |
| `12th_General English_Pre-Board Test_2025-26` | Draft flag cleared | `isDraft: true`, `status: 'approved'` (blocked from public view) | `isDraft: false`, `status: 'approved'` | Firestore snapshot |
| `12th_Healthcare_Pre-Board Test_2025-26` | Draft flag cleared | `isDraft: true`, `status: 'approved'` (blocked from public view) | `isDraft: false`, `status: 'approved'` | Firestore snapshot |
| `11th_Political Science_Pre-Board Test_2025-26` | Cleaned 31 unintended `AB` entries back to pending `""` | 31 unfilled students marked `AB` due to teacher submission dialog | 31 unfilled students reset to pending `""`. All 40 scored records preserved (including Tamana Manzoor with 21 marks). `isDraft: false`. | `practicalsBin/bin_11th_Political Science_Pre-Board Test_2025-26_1789810806714` |
| `11th_Environmental Science_Pre-Board Test_2025-26` | Cleaned 10 unintended `AB` entries back to pending `""` | 10 unfilled students marked `AB` due to teacher submission dialog | 10 unfilled students reset to pending `""`. All 13 scored records preserved. `isDraft: false`. | `practicalsBin` backup |

---

## 2. Detailed Document Changes

### A. 12th General English (`12th_General English_Pre-Board Test_2025-26`)
- **Issue**: The award sheet was approved by the administrator, but `isDraft` remained `true`. Because client views filtered `isDraft === true`, 203 student records were hidden from the Master Gazette and Public Result Lookup.
- **Modification**: Updated document field `isDraft` to `false`.
- **Status**: Live and verified. 203 student records now reflect in gazette and result lookups.

### B. 12th Healthcare (`12th_Healthcare_Pre-Board Test_2025-26`)
- **Issue**: Similar to English, `isDraft` remained `true` despite administrative approval.
- **Modification**: Updated document field `isDraft` to `false`.
- **Status**: Live and verified. 62 student records now reflect in gazette and result lookups.

### C. 11th Political Science (`11th_Political Science_Pre-Board Test_2025-26`)
- **Issue**:
  - The teacher entered marks for 40 students (e.g. Tamana Manzoor scored 21 marks).
  - The submission workflow automatically marked 31 unfilled students as `'AB'`.
  - When Tamana Manzoor (`2401010000200028`) searched for her result on the live site, loose suffix matching matched Mehreen Hussain (`2301013000200028`) because both end in `200028`, returning `AB`.
- **Modification**:
  - Full snapshot backed up to `practicalsBin`.
  - 31 unfilled students reset from `'AB'` to `""` (pending award).
  - All 40 scored students preserved exactly as submitted by the teacher.
  - Set `isDraft: false`, `status: 'approved'`.

### D. 11th Environmental Science (`11th_Environmental Science_Pre-Board Test_2025-26`)
- **Issue**: 10 unfilled students were automatically converted to `'AB'`.
- **Modification**:
  - Snapshot backed up to `practicalsBin`.
  - 10 unfilled students reset from `'AB'` to `""` (pending award).
  - All 13 scored students preserved.
  - Set `isDraft: false`, `status: 'approved'`.

---

## 3. Maintenance Scripts Archive

All maintenance, inspection, and verification scripts are tracked in `scripts/`:

| Script File | Purpose |
| :--- | :--- |
| `scripts/inspect_target_docs.mjs` | Reads current Firestore practical documents directly via Google Cloud REST API. |
| `scripts/inspect_ps_bins.mjs` | Inspects backup records inside `practicalsBin`. |
| `scripts/repair_preboard_awards.mjs` | Execution script that performed backups and cleaned draft/absent statuses. |
| `scripts/debug_tamana_full.mjs` | End-to-end verification script testing Tamana Manzoor's registration and score resolution. |
| `scripts/test_tamana_lookup.mjs` | Isolated test comparing suffix matching vs exact identity matching. |

---

## 4. How to Inspect, Revert, or Clear Changes Later

If you wish to review or rollback any of these documents:

1. **To view current document status**:
   ```bash
   node -e "import('./scripts/inspect_target_docs.mjs')"
   ```
2. **To inspect backup versions in the Recycle Bin (`practicalsBin`)**:
   ```bash
   node -e "import('./scripts/inspect_ps_bins.mjs')"
   ```
3. **To restore from a backup**:
   Each backup in `practicalsBin` contains the complete `records` array and metadata from prior to the repair. A restore script can copy `records` from `practicalsBin/<backup_id>` back to `practicalsData/<document_id>`.

---

## 5. Next Steps for Website Frontend Push
- Local Git commit: `d18106f6` contains:
  - Strict registration length and student name verification in `PublicResultLookup.jsx` and Netlify function.
  - Teacher portal two-button submission modal (Preventing future auto-marking of empty rows as `AB`).
  - Draft filter adjustments for approved records.
- **When Netlify credits reset**:
  Run:
  ```bash
  git push origin main
  ```
  Netlify will automatically build commit `d18106f6`, deploying all frontend updates to production.
