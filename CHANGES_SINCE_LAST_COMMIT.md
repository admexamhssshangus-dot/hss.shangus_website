# Changes Since Last Commit

## Commit Message
`fix(teacher-portal): resolve temporal dead zone runtime crash in practical evaluation view`

## Date & Time
- **Timestamp**: 2026-10-05T17:00:00+05:30

## Root Cause Analysis
- **Problem**: When navigating to `https://hssshangus.in/portal/teacher/practicals`, users encountered `ModuleErrorBoundary` displaying `"Unable to Display Section"`.
- **Root Cause**: In `src/portal/teacher/PracticalsPage.jsx`, `isSubmissionOpenForCurrentClass` was defined at line 1266 using `useMemo(() => isSubmissionOpen && ..., [isSubmissionOpen, ...])`. However, `const [isSubmissionOpen, setIsSubmissionOpen] = useState(true);` was not declared until line 1405. In JavaScript (ES6+), referencing a `const` variable before its declaration causes an immediate runtime `ReferenceError: Cannot access 'isSubmissionOpen' before initialization` (Temporal Dead Zone). This unhandled exception occurred during component render, causing `ModuleErrorBoundary` to catch the error and present the error fallback card.

## Files Changed
1. `src/portal/teacher/PracticalsPage.jsx`:
   - Moved `const [isSubmissionOpen, setIsSubmissionOpen] = useState(true);` to the top of the component (line 1138) alongside `practicalsSettings`, ensuring it is initialized prior to any `useMemo`, `useCallback`, or downstream hook execution.
   - Removed the duplicate delayed declaration of `isSubmissionOpen` from line 1405.
   - Added ultra-defensive optional chaining and fallback defaults for `currentSubjectObj?.code`, `currentSubjectObj?.name`, and `currentMarksConfig?.max` across evaluation configuration helpers, save payloads, blank marks roll printing, and header labels.

## Verification
- **Static Analysis & Linting**:
  - `npx eslint src/portal/teacher/PracticalsPage.jsx`: 0 errors; the `no-use-before-define` error for `isSubmissionOpen` is completely resolved.
- **Jest Test Suite**:
  - `npm test -- src/portal/teacher/PracticalsPage.test.jsx --watchAll=false` (24/24 tests passed).
- **Automated Regression Checks**:
  - `npm run admission:check`: Passed (83 schema fields classified; provisional PDF 1 page; full PDF 2 pages).
  - `npm run security:check`: Passed.
  - `npm run performance:check`: Passed.
  - `npm run seo:check`: Passed (11 public pages, metadata, sitemap, routing).
- **Production Build**:
  - `npm run build`: Completed successfully with `Exit Code 0`.

## Instructions for the User
1. **To deploy the fix to the live website (`hssshangus.in`):**
   ```bash
   npm run deploy:firebase
   # or
   firebase deploy --only hosting
   ```
2. **To inspect the local commit:**
   ```bash
   git show --stat
   # or
   git log -1 -p
   ```
3. **To re-commit or amend if desired:**
   ```bash
   git reset --soft HEAD~1
   git commit -m "Your custom commit message"
   ```
4. **To push to remote:**
   ```bash
   git push origin main
   ```
