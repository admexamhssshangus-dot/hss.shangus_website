# Changes Log & Commit Reference

## Current Working Changes

### Comprehensive Employee Profile & Photo Management in Accounts & Staff Clerk Portal
- **User Request Addressed:**
  - *"allow all fields info including photo accessible/editable to clerk portal"*

- **Context & Problem:**
  - In the Accounts & Staff Tax Clerk portal (`SchoolAccountsManager.jsx`), staff management was previously constrained to a narrow subset of tax, salary, and basic designation fields.
  - Clerks could not view, edit, or upload employee passport photos, manage personal identity details (Father's name/parentage, DOB, gender, permanent and present addresses, Aadhar number, category, B.Ed completion status, subject in PG, visibility/active status, inactive reason), service particulars (designation at first appointment, zone name, UDISE code, DDO code HRMS), or manage historical posting profiles and custom fields.
  - Avatars were generic placeholder icons with no employee photos shown in the directory table or expanded drawers.

- **Architectural & UX Solutions Implemented:**
  1. **5-Tab Comprehensive Establishment & Employee Editor Modal** ([SchoolAccountsManager.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/SchoolAccountsManager.jsx)):
     - Replaced the previous single-column basic form with a modern 5-tab segmented editor:
       - **Personal Details** (`User` icon): Full Name, Parentage (Father's Name), Date of Birth, Gender (Male/Female/Other), Mobile Number, Email Address, Permanent Address, Present Address, Aadhar Number, Category (OM/RBA/OBC/SC/ST/EWS), B.Ed Status (Yes/No/In Progress), Subject in PG, Visibility Status (Visible/Hidden), Deployment Status (Regular/Deployed In/Deployed Out), Inactive Reason (Transferred/Retired/Deployed Out/Other), and Profile/Bio.
       - **Staff Photo & Bio** (`Camera` icon):
         - Live portrait preview card with status badges.
         - Local photo file picker with client-side canvas compression (`compressStaffPhoto`) reducing photos to <50KB passport format.
         - Firebase Storage cloud upload integration (`uploadStaffPhotoToCloud`) with fallback to Base64 data URL.
         - Manual Photo URL/path input (supporting `/slides/photos/...` and web links).
         - Instant "Remove Photo" action.
       - **Service Particulars** (`Building2` icon): Designation, Department/Wing, Teaching Subject, Service Cadre (Teaching/Ministerial/Non-Teaching), Highest Qualification, Date of 1st Joining (Govt Service), Designation at 1st Appointment, Zone Name, UDISE Code (`ddo_code`), and DDO Code HRMS (`ddo_code_hrms`).
       - **Accounts & Tax** (`CreditCard` icon): CPIS ID, PAN, Pension Scheme (NPS / GPF toggle buttons), PRAN/GPF Account Number, Bank Account No., IFSC Code, Gross Annual Salary (with monthly breakdown), TDS Deducted Up-to-Date, Active Tax Regime, Deductions (80C, 80D, HRA, 80CCD(2)), and Live Side-by-Side Tax Comparison (New vs Old) with recommendation banner & 1-click apply cheaper regime.
       - **Postings & Custom** (`History` icon):
         - Historical Postings Profile table with Office/Institution, Designation, From Date, To Date, and Delete/Add actions.
         - Custom & Additional Fields manager with dynamic key-value inputs and deletion.
  2. **Table & Drawer Profile Enhancements** ([SchoolAccountsManager.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/SchoolAccountsManager.jsx)):
     - Added photo avatars directly into the Staff Directory table rows with graceful fallback initials and active cadre indicators.
     - Redesigned the expanded employee drawer into 5 structured cards (Photo & Identity, Service Particulars, Accounts & Banking, Tax & Deductions, Address & Records) with a direct "Edit All Fields & Photo" button.
  3. **Data Integrity & Clerk Security Verification**:
     - Synchronizes seamlessly with the master Firestore document `systemSettings/facultyPrivate` and broadcasts changes to `hss_public_faculty` and the local broadcast channel.
     - Preserves full audit logging via `logAdminActivity` and clerk security verification modals displaying exact field diffs before cloud synchronization.

---

## Files Modified
- `src/portal/admin/SchoolAccountsManager.jsx`
- `CHANGES_SINCE_LAST_COMMIT.md`

---

## Local Commit Message
```bash
feat(clerk): enable comprehensive employee profile and photo editing in accounts portal
```

---

## Instructions for User: Review & Push
All changes have been tested and verified locally (`npm run build` completed with Exit Code 0).

To push these changes to your remote Git repository:
```bash
git push origin main
```

If you wish to inspect or modify the local commit:
```bash
# View the last commit details
git log -1 --stat

# To amend or re-commit if desired
git reset --soft HEAD~1
git commit -m "feat(clerk): enable comprehensive employee profile and photo editing in accounts portal"
```
