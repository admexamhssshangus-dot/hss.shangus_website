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

### 6. Memory File of Changes & Manual Commit Instructions
- Always maintain and update `CHANGES_SINCE_LAST_COMMIT.md` in the workspace root documenting:
  - Exact list of files changed, added, or removed.
  - Detailed summary of changes since the previous commit.
  - The exact commit message used.
  - Instructions for the user on how to review the commit, manually amend/re-commit if desired (`git reset --soft HEAD~1` followed by `git commit -m "..."`), and manually push (`git push origin main`).
- In every completion response to the user:
  - Summarize all changes done since the last commit.
  - State the exact local commit message.
  - Explain how the user can manually inspect or re-execute the commit if desired.
  - Remind the user to run `git push origin main` manually.

### 7. Module & Permissions Catalog Synchronization Rule
- Whenever a significant change happens to portal features—such as adding a new module/studio, renaming or rebranding a module, removing a deprecated tool, or modifying permission capabilities:
  - **Mandatory Catalog Audit**: The assistant MUST immediately audit and synchronize:
    1. `src/portal/admin/adminModuleCatalog.js` (`ADMIN_MODULE_CATALOG`, `ROLE_PRESETS`, `ADMIN_CATEGORIES`, IDs, labels, descriptions, and aliases).
    2. `src/portal/admin/StaffPermissionsManager.jsx` (ensuring the updated modules, descriptions, categories, and presets appear in the administrative permissions matrix).
    3. `src/portal/admin/AdminToolsDropdown.jsx` (`MODULE_ICONS`, launcher handlers, and `isUserPermittedForModule` backward-compatibility aliases).
    4. `src/portal/admin/AdminDashboard.jsx` (`MODULE_LOADERS`, `mountedTabs`, and tab container mounting).
    5. Firestore security rules & RBAC (`firestore.rules`, `storage.rules`, and `staffAuthService.js` to ensure that when a Standard Admin is granted access to the module, they can operate it 100% end-to-end with zero Firestore/Storage permission-denied errors).
  - This ensures that staff, teachers, administrators, and students always receive the updated interfaces, functionalities, and access privileges seamlessly across portal updates.

### 8. Practicals & Academic Evaluation Data Boundary Rule
- **Strict Practicals Confidentiality**: Practicals data (Internal Assessment & External Practical marks, award rolls, and examiner signatures) is strictly confidential institutional academic data.
- **Never Available to Public Portal or Students**: Practicals data is strictly NEVER available to the public portal or student accounts under any circumstances. It is exclusively accessible via authenticated Teacher login and Admin login.
- **Clean End-to-End Separation**:
  - The **Practicals & Award Rolls Portal** (at both Teacher and Admin sides) holds ONLY practical data: Internal Assessment and External Practical.
  - All other examinations—including Pre-Board Examinations, Golden Tests, Mid-term Tests, Unit Assessments, Term End Examinations, and Competitive/OMR tests—are strictly handled and displayed exclusively within the **School Based Assessment Portal** (the third dedicated portal in Teacher Workspace, and the School Based Assessment Suite in Admin Portal).
  - Approvals of Pre-Board and other school examinations are processed exclusively within the **School Based Assessment Portal** and never in the Practicals portal.

### 9. Standard Admin End-to-End Operational Parity & Firebase Rules Rule
- **Complete End-to-End Operational Parity**:
  - Whenever a new module or administrative studio is added, or an existing module is updated:
  - If a **Standard Admin** is granted access/permission for that module, they MUST be able to use that module **100% end-to-end fully**, with the exact same functional capabilities, editing powers, saving controls, batch actions, and export privileges as a Super Admin.
- **Zero Firebase Permission Issues**:
  - Previously, all features and backend collections were accessible solely to Super Admin by default. Under the updated architecture, whenever a Standard Admin has access to any module, they must **NEVER** encounter Firebase Firestore or Storage `permission-denied` errors, silent query rejections, or write blockages.
  - **Mandatory Security Rules Synchronization**:
    - Whenever a module reads or writes to documents, collections, subcollections, or storage paths:
    - `firestore.rules` (e.g. `settingsModule()`, `collectionModule()`, match blocks) and `storage.rules` MUST explicitly permit Standard Admins holding that module's permission via `canUse(module)` or `canUseAny([...])`.
    - Backend security rules must NEVER restrict operational module collections solely to `isSuperAdmin()`.
- **Zero Client-Side UI Restrictions**:
  - Client-side code (`staffAuthService.js`, `AdminDashboard.jsx`, and inside individual module components) must NEVER hide or disable module features, buttons, or operational tools behind hardcoded `isSuperAdmin` checks when a Standard Admin holds permission for that module.
  - If a Standard Admin has permission for a module, they possess full operational authority to create, read, update, delete, batch-process, and export all data handled by that module.



