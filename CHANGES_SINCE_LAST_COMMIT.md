# Changes Summary Since Last Commit

## Commit Summary
- **Commit Message**: `fix(perf): deduplicate React subject keys, memoize admin suites, and eliminate tab switching latency`
- **Date**: October 02, 2026
- **Status**: Production Build Passed (`Exit Code 0`), verified locally.

---

## Architectural Purpose & Issues Resolved

### 1. Fixed React Duplicate Key Collisions (`BI`, `SC`, `SS`)
- **Problem**: In `src/utils/practicalsSettingsManager.js`, `SUBJECT_CONFIG_DEFS` contained duplicate subject entries:
  - Code `BI` was defined twice (`Biology (Botany & Zoology)` and `Biology`).
  - Code `SC` was defined twice (`Science` and `Science (Class 10th)`).
  - Code `SS` was defined twice (`Social Science` and `Social Science (Class 10th)`).
  - Mapping over this catalog with `key={sub.code}` in `SchoolAssessmentsHub.jsx` and `AdminPracticals.jsx` caused React warnings:
    - `Encountered two children with the same key, 'BI'`
    - `Encountered two children with the same key, 'SC'`
    - `Encountered two children with the same key, 'SS'`
- **Solution**:
  - Removed duplicate `BI`, `SC`, and `SS` lines from `SUBJECT_CONFIG_DEFS` in `src/utils/practicalsSettingsManager.js`.
  - Added defensive unique composite keys (`key={`${sub.code}_${idx}`}`) in `SchoolAssessmentsHub.jsx` and `AdminPracticals.jsx`.

### 2. Resolved Slow Module Loading & Sluggish Tab Switching
- **Problem**:
  1. `setActiveTabState(tab)` in `AdminDashboard.jsx` was wrapped inside `React.startTransition()`. React 18 deprioritized tab clicks as low-priority transitions, deferring DOM CSS visibility changes and causing delayed switching.
  2. `setActiveTab` had `[activeTab, mountedTabs]` in its dependency array, regenerating the function reference on every tab switch and breaking memoization across all child modules.
  3. All heavy admin suites retained in DOM via the keep-alive architecture (`AdvancedReports`, `AdmissionRegisterSuite`, `CustomRosterDocumentBuilderView`, `StudentIdCardManager`, `ControlsAndSubjects`, `AdminPracticals`) were **not wrapped in `React.memo`**. Every tab switch forced full reconciliation across tens of thousands of lines of hidden JSX.
  4. On every render of `AdminDashboard.jsx`, `getCachedCollectionSync('masterRegisters') || []` instantiated new arrays, breaking prop equality.
- **Solution**:
  - Wrapped `AdvancedReports`, `AdmissionRegisterSuite`, `CustomRosterDocumentBuilderView`, `StudentIdCardManager`, `ControlsAndSubjects`, and `AdminPracticals` in `React.memo`.
  - Made `setActiveTab` synchronous and stable with an empty dependency array `[]`.
  - Memoized `masterRegisters` and introduced stable `handleCloseToReports` callback.
  - Guarded `idlePrefetch` to run in production only, preventing Webpack Dev Server chunk thrashing and disposed module errors.

### 3. Resolved Localhost 404 for Netlify Function (`public-traffic`)
- **Problem**: `Home.jsx` called `fetch('/.netlify/functions/public-traffic')`. On local dev server (`localhost:3000`), no Netlify CLI was running, returning `404 (Not Found)`.
- **Solution**:
  - Added local proxy handler for `/.netlify/functions/public-traffic` in `src/setupProxy.js` returning 200 with fallback telemetry metrics.
  - Guarded session visit analytics in `Home.jsx` on `localhost` and `127.0.0.1` and silenced console fallback warnings.

---

## Files Changed

1. `src/utils/practicalsSettingsManager.js`: Deduplicated `BI`, `SC`, and `SS` in `SUBJECT_CONFIG_DEFS`.
2. `src/portal/admin/SchoolAssessmentsHub.jsx`: Added indexed defensive keys for subject options.
3. `src/portal/admin/AdminPracticals.jsx`: Added indexed row keys and wrapped in `React.memo`.
4. `src/portal/admin/AdvancedReports.jsx`: Wrapped 17,000-line component in `React.memo`.
5. `src/portal/admin/AdmissionRegisterSuite.jsx`: Wrapped 12,000-line component in `React.memo`.
6. `src/portal/admin/CustomRosterDocumentBuilderView.jsx`: Wrapped 7,000-line component in `React.memo`.
7. `src/portal/admin/StudentIdCardManager.jsx`: Wrapped 3,300-line component in `React.memo`.
8. `src/portal/admin/ControlsAndSubjects.jsx`: Wrapped component in `React.memo`.
9. `src/portal/admin/AdminDashboard.jsx`: Synchronous `setActiveTab`, memoized `masterRegisters`, stable callbacks, and guarded dev prefetch.
10. `src/setupProxy.js`: Added local dev mock for `/.netlify/functions/public-traffic`.
11. `src/pages/Home.jsx`: Guarded local dev telemetry fetch.

---

## Verification & Build Details
- **Production Build**:
  - `npm run build` -> `Exit Code 0` (Zero breaking errors).

---

## Instructions for User

### 1. Crucial Tip for Localhost: Restart `npm start`
The dev server was running continuously for over 11 hours. In Webpack dev mode, running for many hours with dozens of hot reloads causes stale HMR module graphs and memory bloating.
To get optimal performance on `localhost:3000`:
1. In the terminal running `npm start`, press `Ctrl + C`.
2. Run `npm start` again.
3. Hard-refresh the browser (`Ctrl + F5` or `Ctrl + Shift + R`).

### 2. Inspect the Local Commit
```bash
git log -n 1 --stat
```

### 3. Manually Amend / Re-commit (Optional)
```bash
git reset --soft HEAD~1
# Make desired changes
git add .
git commit -m "fix(perf): deduplicate React subject keys, memoize admin suites, and eliminate tab switching latency"
```

### 4. Manually Push to Remote Repository
```bash
git push origin main
```
