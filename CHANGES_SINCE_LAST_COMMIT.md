# Changes Since Last Commit

## Commit Message

`docs(agents): mandate Standard Admin full end-to-end operational parity and Firebase security rules sync`

## Files Changed

1. **[AGENTS.md](file:///d:/Shk_Gulfam/Projects/hss_shangus/AGENTS.md)**
   - Updated Rule 7 (Module & Permissions Catalog Synchronization Rule) item 5 to explicitly require auditing and synchronizing `firestore.rules`, `storage.rules`, and `staffAuthService.js` so that when a Standard Admin is granted access to a module, they operate it 100% end-to-end with zero Firestore/Storage `permission-denied` errors.
   - Added Rule 9: **Standard Admin End-to-End Operational Parity & Firebase Rules Rule** establishing mandatory guidelines for all future development:
     - Full operational parity (actions, batch updates, exports, saves, deletes) between permitted Standard Admins and Super Admins.
     - Mandatory backend security rules synchronization in `firestore.rules` (e.g. `settingsModule()`, `collectionModule()`, match blocks) and `storage.rules` via `canUse(module)` and `canUseAny([...])`.
     - Complete elimination of hardcoded client-side `isSuperAdmin` check lockouts within modules.

2. **[.agents/AGENTS.md](file:///d:/Shk_Gulfam/Projects/hss_shangus/.agents/AGENTS.md)**
   - Synchronized root agent instructions with the identical updates to Rule 7 and Rule 9.

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
git commit -m "docs(agents): mandate Standard Admin full end-to-end operational parity and Firebase security rules sync"
```

### 3. Push to Remote Repository
When ready, push the verified commit to your remote branch manually:
```bash
git push origin main
```
