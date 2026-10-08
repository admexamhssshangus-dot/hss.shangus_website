# Changes Since Last Commit

## Commit Message

`feat(search): tiered module ranking (Title > Description > Deep Schema) and deep field/settings search indexing`

## Files Changed

1. **[src/portal/admin/adminModuleSearchEngine.js](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/adminModuleSearchEngine.js)**
   - **Tiered Scoring Hierarchy**: Re-architected `searchAdminModules` to strictly prioritize:
     - **1st Priority (Module Title / `label`)**: Exact match: `+100,000` pts; Title starts with query: `+60,000` pts; Title contains query phrase: `+40,000` pts; All tokens in title: `+25,000` pts; Title token match: `+12,000` pts. Guarantees that any title match (e.g. `"Student ID Card Studio"` for `"id card"`) decisively dominates non-title matches.
     - **2nd Priority (Brief Description / `desc`)**: Phrase match: `+10,000` pts; All tokens: `+6,000` pts; Token match: `+2,500` pts.
     - **3rd Priority (Keywords & Aliases)**: Exact match: `+5,000` pts; Phrase: `+3,500` pts; Token: `+1,500` pts.
     - **4th Priority (Deep Field Structure, Settings & Capabilities)**: Phrase match: `+4,000` pts; Token: `+1,800` pts.
     - **5th Priority (Category & Educational Thesaurus)**: Synonyms & category boost: `+500` to `+1,500` pts.
   - **Fixed Token Slicing & Boundary Bug**: Rewrote `matchTokenFuzzy` to prevent short tokens (`length <= 3`, e.g. `id`, `dob`, `cms`, `omr`, `fee`, `tc`) from matching substrings inside longer words. Queries like `"id"` or `"id card"` will no longer match `"consolidated"`, `"slideshow"`, or `"bonafide"`.
   - **High-Precision Word-Boundary Highlighter**: Updated `getHighlightedSegments` to use multi-word phrase patterns and regex word boundaries (`\b`) for short tokens, preventing words like `"consolidated"` from being chopped into `consol[id]ated`.
   - **Comprehensive Deep Schema Index (`MODULE_DEEP_INDEX`)**: Indexed the internal student form fields, settings, tools, and capabilities for all 27 administrative modules (e.g. `bank account`, `ifsc`, `blood group`, `nps`, `gp fund`, `form 16`, `recycle bin`, `hero slider`, `pre-board`, `defaulter threshold`, `feeder school`, `qr verification`).
   - **Contextual Search Match Badges**: Enhanced `_matchedReasons` to output rich badges (`"In Title"`, `"Field: Bank Account"`, `"Setting: Central Website Recycle Bin"`, `"id cards"`).

2. **[src/portal/admin/adminModuleCatalog.js](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/adminModuleCatalog.js)**
   - Imported `MODULE_DEEP_INDEX` and dynamically attached `fields`, `settings`, and `capabilities` to every module in `ADMIN_MODULE_CATALOG`.
   - Kept catalog self-documenting and in 100% synchronization with the search engine.

3. **[src/portal/admin/AdminToolsDropdown.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/AdminToolsDropdown.jsx)**
   - Updated `ADMIN_TOOL_MODULES` and `allItems` builder to include `fields`, `settings`, and `capabilities` for all regular modules and quick action tools (`quickCellEdit`, `bulkToolsAction`).

---

## Instructions for Review & Manual Push

### 1. Inspect the Local Commit
Review git log and diff:
```bash
git log -1 --stat
git diff HEAD~1
```

### 2. Amend / Re-commit (Optional)
If you wish to edit the commit message or modify files before pushing:
```bash
git reset --soft HEAD~1
# Make desired adjustments, then:
git add .
git commit -m "feat(search): tiered module ranking (Title > Description > Deep Schema) and deep field/settings search indexing"
```

### 3. Push to Remote Repository
When ready, push the verified commit to your remote branch manually:
```bash
git push origin main
```
