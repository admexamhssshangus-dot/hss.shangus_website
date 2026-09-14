# Project Instructions & Workflow Rules

## Mandatory Development & Git Workflow

Whenever completing or verifying changes requested by the user, follow this strict 5-step workflow:

### 1. Build Verification
- Always test and verify changes locally by running:
  ```bash
  npm run build
  ```
- Ensure the production build completes with `Exit Code 0` and zero breaking errors before proceeding.

### 2. Automatic Firebase Rules Deployment
- Whenever `firestore.rules` (or `storage.rules`) are modified or require an update:
  - Automatically deploy/push the updated security rules to Firebase:
    ```bash
    npm run deploy:rules
    # or
    npx -y firebase-tools deploy --only firestore:rules
    ```
  - If Storage rules are also modified:
    ```bash
    npx -y firebase-tools deploy --only storage
    ```
  - Verify that the Firebase rules deployment completes successfully before proceeding to Git staging.

### 3. Stage Changes
- Stage the verified files:
  ```bash
  git add .
  ```

### 4. Commit Changes Locally
- Create a clear, descriptive, professional commit message summarizing the work completed:
  ```bash
  git commit -m "<Clear, concise summary of changes>"
  ```

### 5. Git Push Policy (STRICT MANUAL RULE)
- **NEVER execute `git push` commands under any circumstances.**
- The assistant is **strictly prohibited** from pushing changes to remote Git repositories (e.g. GitHub/GitLab).
- After committing locally, inform the user:
  > *"Changes have been built, staged, and committed locally. Please run `git push origin main` manually whenever you are ready."*
