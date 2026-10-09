# Changes Since Last Commit

## Commit Message

`feat(certStudio): expand database field catalog and modernize studio UX`

## Files Changed

1. **[src/utils/certificateExportUtils.js](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/utils/certificateExportUtils.js)**
   - **Comprehensive Database Field Tokens**: Expanded `interpolateCertificateTemplate` and `retokenizeCertificateBody` to natively support 30+ student database fields with canonical alias keys and fallback formatters:
     - *Identity & Government*: Aadhaar Number (`{AADHAAR_NUMBER}`), PEN Number (`{PEN_NUMBER}`), APAAR ID (`{APAAR_ID}`), Social Category (`{CATEGORY}`), Socio-Economic Type (`{SOCIO_CATEGORY}`), Ration Card No (`{RATION_CARD_NO}`), Disability/CWSN (`{DISABILITY_STATUS}`), Blood Group (`{BLOOD_GROUP}`), Mother Tongue (`{MOTHER_TONGUE}`), Religion (`{RELIGION}`).
     - *Academic History & Board*: Exam Roll No (`{EXAM_ROLL_NO}`), Previous School (`{PREVIOUS_SCHOOL}`), Previous Board (`{PREVIOUS_BOARD}`), Previous Roll No (`{PREVIOUS_ROLL_NO}`), Passing Year (`{PASSING_YEAR}`), Previous Marks (`{PREVIOUS_MARKS}`), DIET Reg No (`{DIET_REG_NO}`), Marks Percentage (`{MARKS_PERCENTAGE}`), Subjects (`{SUBJECTS}`).
     - *Enrollment & Institutional*: Admission Form No (`{ADMISSION_FORM_NO}`), Admission No (`{ADMISSION_NO}`), Old Admission No (`{OLD_ADMISSION_NO}`), Admission Date (`{ADMISSION_DATE}`), Admission Type (`{ADMISSION_TYPE}`), Academic Session (`{SESSION}`), Withdrawal Date (`{WITHDRAWAL_DATE}`), Conduct Status (`{CONDUCT_STATUS}`).
     - *Contact, Residence & Banking*: Mobile No (`{MOBILE_NO}`), Guardian Contact (`{GUARDIAN_CONTACT}`), Email Address (`{EMAIL_ADDRESS}`), PIN Code (`{PIN_CODE}`), Bank Account No (`{BANK_ACCOUNT_NO}`), Bank Name (`{BANK_NAME}`), IFSC Code (`{IFSC_CODE}`).
   - **Custom Fields Extraction Fix**: Fixed template interpolation bug where `customFields` was only inspected on `options.customFields`; now safely checks `options`, `studentData`, and `mergedProps`.

2. **[src/portal/admin/StudentCertificateStudioView.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/StudentCertificateStudioView.jsx)**
   - **Portal-Rendered Insert Field Popover**: Replaced the clipped inline dropdown (`overflow-hidden` container issue) with a floating `createPortal` dropdown anchored to the `Field` toolbar button with fixed viewport coordinates, smooth backdrop overlay, and search filter (`🔍 Filter fields...`).
   - **Complete Categorized Field Catalog**: Categorized 30+ database fields with live value previews for the selected student, enabling 1-click token insertion at cursor.
   - **Canvas Scaffolding Clean-Up**: Removed loud "INC PART: 1454 -1 +1" badges from both General Reference and TC/DC metadata boxes on the certificate canvas, replacing them with sleek, compact `[- | +]` micro-steppers beside the certificate number input.
   - **Canvas Header Typography Refinement**: Updated school name banner typography (`font-extrabold tracking-wider select-none`) to prevent font ligature and serif optical smearing.
   - **"Edit Dynamic Field Values" Modal Upgrade**:
     - Added `✨ Auto-Add From Record` button that automatically scans the active student's record and activates all non-empty fields.
     - Added category filter pills: `All`, `Identity & Govt IDs`, `Academic History & Board`, `Enrollment & School`, `Contact & Banking`.
     - Added instant search box for database field badges with live value chips and toggle-on/off capability.

---

## Instructions for the User

### 1. How to Review the Local Commit
You can review the changes and commit log locally:
```bash
git log -1 --stat
git show HEAD
```

### 2. How to Amend or Re-commit (Optional)
If you wish to edit the commit message or make adjustments:
```bash
git reset --soft HEAD~1
# Make desired adjustments...
git add .
git commit -m "feat(certStudio): expand database field catalog and modernize studio UX"
```

### 3. How to Push to Remote Repository
In accordance with our strict Git safety rules, the assistant does not push automatically. When you are ready, please push the commit manually:
```bash
git push origin main
```
