# Changes Log & Commit Reference

## Current Working Changes

### Smart Offline & Mobile Network Recognition & Zero Code Exposure Safeguard

- **User Request Addressed:**
  - *"when internet is not availabe...the website shows some weired error/seem exposing some code info....it shall rather smartly recognise adn respond to no mobile network/internet"*

- **Root Causes Identified & Solved:**
  1. **Raw Diagnostic Stack Traces in Error Boundary:**
     - Previously, `ModuleErrorBoundary` rendered a "Diagnostic Info" box containing the raw error message (`TypeError: Failed to fetch...`, `ChunkLoadError...`) and an expandable `<details>` containing the complete JavaScript stack trace `<pre>{this.state.error.stack}</pre>`, exposing internal file paths, module structures, and line numbers to visitors and students when connectivity failed.
     - **Solution:** Replaced raw code dumps with a clean, friendly, reassuring UI. Stack traces are now completely eliminated from user-facing screens and only logged safely to `console.warn` for developers.
  2. **Destructive Hard-Reloads when Offline in Lazy Loader:**
     - Previously, `lazyWithChunkRecovery` attempted `window.location.reload()` on chunk load failures. When a device is offline, reloading the browser page destroys the cached single-page app and throws the user onto Chrome's native offline crash page ("No internet / Dinosaur").
     - **Solution:** `lazyWithChunkRecovery` now checks `!navigator.onLine` and throws a clean `OfflineError`, allowing `ModuleErrorBoundary` to catch it and display a graceful in-app offline view while preserving the application state and shell.
  3. **Auto-Healing when Network Returns:**
     - `ModuleErrorBoundary` now listens to `window.addEventListener('online', ...)`. The exact moment mobile data or Wi-Fi reconnects, it automatically re-mounts and heals the failed component without requiring manual reloads.
  4. **Universal Floating Network Status Indicator ([NetworkStatusIndicator.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/components/NetworkStatusIndicator.jsx), [App.js](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/App.js)):**
     - Added a universal, glassmorphic floating indicator mounted via React Portal onto `document.body` across the entire website.
     - When offline: displays a warm, non-intrusive floating indicator (`No Internet Connection — Mobile data or Wi-Fi is disconnected`) with a quick "Retry" button.
     - When reconnected: flashes a brief confirmation badge (`Back Online! Reconnected successfully.`) for 3.5 seconds and calls `ensureFirestoreConnected()` to immediately awaken cloud database connections.
  5. **Toast Error Sanitization ([GlobalToast.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/components/common/GlobalToast.jsx)):**
     - `showToast` now automatically intercepts network and offline error codes (e.g. `client is offline`, `Failed to fetch`, `NetworkError`, `code=unavailable`, `net::ERR_`), converting them into clear, friendly messages: *"No internet connection. Please check your mobile data or Wi-Fi."*
     - Strips raw code headers (`FirebaseError:`, `TypeError:`, stack traces) from any toast notifications.
  6. **Sync Error Sanitization ([dbCache.js](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/services/dbCache.js)):**
     - Formatted `hss-sync-error` event messages to politely display *"Offline: Using cached records"* instead of dumping internal Firebase status codes.

---

## Files Modified & Added
- `src/components/ModuleErrorBoundary.jsx` (Transformed into smart offline-recognizing boundary with zero code leakage and auto-reconnect)
- `src/components/NetworkStatusIndicator.jsx` (New universal floating network & mobile data indicator mounted at root)
- `src/App.js` (Mounted `NetworkStatusIndicator`)
- `src/utils/lazyWithChunkRecovery.js` (Prevented destructive hard reloads when device is offline)
- `src/components/common/GlobalToast.jsx` (Sanitized error toasts to intercept offline errors and strip code leaks)
- `src/services/dbCache.js` (Sanitized sync error event payloads when offline)
- `CHANGES_SINCE_LAST_COMMIT.md`

---

## Local Commit Message
```bash
fix(network): smartly handle offline mobile network and eliminate raw code exposure in error boundary
```

---

## How to Review or Manually Manage Commits

### To review staged changes before commit:
```bash
git diff --staged
```

### If you want to commit manually:
```bash
git add .
git commit -m "fix(network): smartly handle offline mobile network and eliminate raw code exposure in error boundary"
```

### To amend or edit this commit:
```bash
git reset --soft HEAD~1
# Make desired adjustments, then re-commit:
git commit -m "fix(network): smartly handle offline mobile network and eliminate raw code exposure in error boundary"
```

### Remote Push (STRICT MANUAL STEP):
- Per repository rules, the AI assistant is strictly prohibited from running `git push`.
- To push to GitHub / remote origin, run:
```bash
git push origin main
```
