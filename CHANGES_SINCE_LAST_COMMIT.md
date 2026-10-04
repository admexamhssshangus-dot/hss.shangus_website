# Changes Summary Since Last Commit

## Commit Summary

- **Commit Message**: `perf(student-records): speed up search and filter interactions`
- **Date**: October 04, 2026
- **Status**: Production build and performance regression checks passed locally.

---

## Student Records & Reports Performance

- **File**: `src/portal/admin/AdvancedReports.jsx`
  - Stops preloading and fully formatting archive chunks during the initial Student Records grid render.
  - Stops opening the Filters menu from triggering historical archive hydration. Archives now load only for an actual search, a selected historical session, or an archive-specific tool.
  - Removes an unused duplicate local-search-index build that consumed CPU and memory without serving the table search path.
  - Adds precomputed filter keys and applies session, class, gender, stream, category, and status filters before the costly fuzzy/phonetic search evaluation.
  - Reuses each record's prebuilt search blob rather than assembling a fallback string per search evaluation.
  - Adds exact in-memory lookup maps for admission number, registration number, form number, roll number, and mobile number. Prefixed searches such as `reg:…` and bare long numerical searches now skip a full-dataset scan when an exact match exists, while partial and fuzzy matching retain the existing fallback behavior.

## Files Changed

1. `src/portal/admin/AdvancedReports.jsx`
2. `CHANGES_SINCE_LAST_COMMIT.md`

## Verification

- `npm run performance:check` — passed.
- `npm run build` — passed with exit code 0. The repository's pre-existing ESLint warnings remain, with no build-breaking errors.
- Firestore rules and storage rules were not changed; no rules deployment was required.

## Instructions for User

### Review the Local Commit

```bash
git log -1 --stat
git show HEAD
```

### Amend or Re-commit (Optional)

```bash
git reset --soft HEAD~1
git commit -m "perf(student-records): speed up search and filter interactions"
```

### Push Manually

Per the project policy, the commit is local only. When you are ready:

```bash
git push origin main
```
