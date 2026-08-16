# Admin Portal Redesign & Security Plan

The current React implementation of the `AdminPracticals.jsx` page is a direct visual clone of the legacy Google Apps Script UI and assumes a strict JSON format for the database. 

However, reviewing the actual Firebase data reveals that legacy submissions use a flat stringified key-value format (e.g. `"92/201002081. Student Name": 10`). Additionally, the current UI is quite rigid and takes up a lot of vertical space. 

To improve UI, performance, and security, I propose the following changes:

## Proposed Changes

### 1. Data Normalization (Backward Compatibility)
We will update the data parsing logic in `AdminPracticals.jsx` to seamlessly support both the new `records: []` format (written by the React portal) and the legacy flat-key format (written by Google Apps Script). 
- We will use regex to extract the Roll No, Name, and Marks from the old keys dynamically during the load phase.
- This avoids a risky database migration while ensuring 100% data visibility.

### 2. UI/UX Refinement (Compact & Modern)
We will break free from the old Apps Script table format for the on-screen dashboard (while keeping the physical printouts exactly the same).
- **Summary Cards:** Display top-level stats (Total Evaluated, Total Absent, Total Pending) using modern Tailwind cards.
- **Accordion Layout:** Group submissions by Class (11th/12th), and then present a clean DataGrid for subjects instead of stacking massive HTML tables.
- **Action Toolbar:** Consolidate actions (Email, Print Awards, Print Attendance) into a sleek, sticky toolbar when viewing a specific subject.

### 3. Performance Enhancements
- Instead of raw Firestore queries on every page load, we will wrap the fetching of `practicalsData` and `users` using a lightweight session cache (with a refresh button), drastically reducing your Firebase read costs.

### 4. Security Rules (`firestore.rules`)
Currently, your Firestore database rules are set to `allow read, write: if true;` globally, which is highly insecure.
#### [MODIFY] firestore.rules
- Restrict `adminPracticalsSettings` to Admin users only.
- Restrict `practicalsData` writes to authenticated faculty/teachers and Admins.
- Ensure only authenticated users can access `admissions`.

## User Review Required

> [!WARNING]
> **Security Rules Lockdown:** Modifying `firestore.rules` will strictly enforce role-based access. Are you comfortable with me locking down these collections now, or do you have any specific email addresses that should be hardcoded as Super Admins in the rules before doing so?

> [!NOTE] 
> The printed documents (Awards, Attendance) will **still use the legacy Apps Script CSS formats** for official use, but the on-screen dashboard will look completely modern and compact.

Please click **Proceed** if this plan aligns with your vision for the refined Admin portal.
