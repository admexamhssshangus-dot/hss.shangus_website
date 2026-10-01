# Changes Log & Commit Reference

## Latest Commit: Enforce Strict Deduplication Hierarchy & Flagged Fallback in Custom Roster Builder

**Commit Message:** `fix(roster): enforce board reg then form no hierarchy with flagged name-father-mobile fallback`

---

### Deduplication Hierarchy & Architectural Overview

Following institutional identity requirements:
1. **Primary Key**: `board reg no_class_session` (`reg_${cleanReg}_${cls}_${sess}`)
   - Matches official JKBOSE Board Registration Number scoped to the student's class and academic session.
2. **Secondary Key**: `form number_class_session` (`form_${cleanForm}_${cls}_${sess}`)
   - Matches institutional Admission Form Number (with `adm_` prefix normalized) scoped to class and session.
3. **Tertiary Fallback**: `student name_father name_mobile_class_session` (`nfm_${cleanName}_${cleanFather}_${cleanMob}_${cls}_${sess}`)
   - Applied only when both Board Registration Number and Form Number are unavailable or unlinked across intake documents.
   - Requires normalized 10-digit mobile number in addition to student name, father name, class, and session to prevent false merges of distinct students/cousins with identical names and parentage.
   - **Flagged Record**: Records merged via this fallback heuristic are automatically tagged with `_isFallbackMerge: true` and an explicit reason string.
4. **Final Fallback**: `docId_class_session` (`doc_${cleanDocId}`)
   - Isolates unique documents when no matching identifiers exist.

---

### Summary of Changes

1. **Authoritative Hierarchy Implementation (`src/portal/admin/CustomRosterDocumentBuilderView.jsx`)**:
   - Updated `getRosterRowId` to generate scoped row keys strictly following the hierarchy:
     1. Primary: `reg_${cleanReg}_${cls}_${sess}`
     2. Secondary: `form_${cleanForm}_${cls}_${sess}`
     3. Tertiary Fallback: `nfm_${cleanName}_${cleanFather}_${cleanMob}_${cls}_${sess}`
     4. Default: `doc_${row.docId}_${cls}_${sess}`
   - Updated `combinedRawStudents`:
     - Keys `seenMap` by `reg:${reg}:${cls}:${sess}`, `fno:${fNo}:${cls}:${sess}`, and fallback `nfm:${name}:${father}:${mob}:${cls}:${sess}`.
     - Flags fallback merges with `_isFallbackMerge = true`.
   - Updated `unifiedStudentPool`:
     - Multi-index registry with `indexByReg`, `indexByForm`, `indexByNameFatherMobile`, and `indexByDoc`.
     - Completely removed unsafe `indexByNameFather` and `indexByNameRoll` heuristics that risked conflating cousins or students sharing identical first and father names.
     - Automatically flags merged candidate records with `_isFallbackMerge: true`.

2. **Visual Flagging & Audit UI (`src/portal/admin/CustomRosterDocumentBuilderView.jsx`)**:
   - In the live document preview table, whenever a student record was merged via the Name+Father+Mobile fallback, a prominent amber `[⚠️ Fallback Merge]` badge with explanatory tooltip is rendered next to the student's name.
   - In the Cohort Filter summary header, an active indicator badge (`[⚠️ N Flagged]`) alerts administrators whenever fallback-merged students exist within the active filtered cohort.
   - In the 2-column examination attendance preview, candidate cells display an audit warning indicator `⚠` with full tooltip explanation.

---

### Exact List of Files Changed

- `src/portal/admin/CustomRosterDocumentBuilderView.jsx`
- `CHANGES_SINCE_LAST_COMMIT.md`

---

### Verification & Build Status

- **Build Verification**: `npm run build` executed and passed with **Exit Code 0** (`main.f846225d.js`).
- **Algorithm Verification**: Verified via simulation script that:
  - Arif Maqbool (Record A with Board Reg No + Form No and Record B with Form No only) cleanly consolidates into 1 candidate row.
  - Distinct students with identical names and father names but different form numbers / phone numbers are preserved as distinct candidates.
  - Candidates merged via the Name+Father+Mobile fallback are cleanly flagged and highlighted in the UI.

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
   git commit -m "fix(roster): enforce board reg then form no hierarchy with flagged name-father-mobile fallback"
   ```
4. **Push to Remote (STRICT MANUAL RULE)**:
   ```bash
   git push origin main
   ```
