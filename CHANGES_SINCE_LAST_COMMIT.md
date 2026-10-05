# Changes Since Last Commit

## Commit Message
`feat(practicals): enhance submission lock visibility, real-time sync, and view-only messaging in teacher portal`

## Date & Time
- **Timestamp**: 2026-10-05T14:05:00+05:30

## Files Changed
1. `src/portal/teacher/PracticalsPage.jsx`:
   - **Prominent Header Lock Badge**: Added a distinct `SUBMISSIONS LOCKED` badge with a lock icon in the top navigation bar when practical submissions are locked for the active class.
   - **Expanded Alert Notification Banner**: Enhanced the locked notification banner with an "Administration Lock" badge and clear descriptive text explaining that practical & internal marks submissions for the class are closed by administration, placing the portal into View-Only Mode while keeping offline printouts accessible.
   - **Class Dropdown Indicators**: Added `(Locked)` indicators next to Class 10th, 11th, and 12th in both desktop and mobile class selector dropdowns based on real-time `submissionWindows` status.
   - **Action Footer Lock Notice**: Added an inline warning above the Save Draft and Final Submit buttons informing the teacher that submissions are currently closed and actions are locked.
   - **Input & Submit Guards**: All marks inputs and submission action buttons remain strictly disabled when an admin lock is active, with dialog notifications if attempted.

## Verification
- Verified production build via `npm run build` (Completed with `Exit Code 0`, zero breaking errors, all 11 public SEO pages verified).

## Instructions for the User
1. **To inspect the local commit:**
   ```bash
   git show --stat
   # or
   git log -1 -p
   ```
2. **To re-commit or amend if desired:**
   ```bash
   git reset --soft HEAD~1
   git commit -m "Your custom commit message"
   ```
3. **To push to remote:**
   ```bash
   git push origin main
   ```
