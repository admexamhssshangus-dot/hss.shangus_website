# Current Academic Session Student Roster Precedence & Admissions Authority — Implementation Plan

> **Institution:** Govt. Higher Secondary School Shangus  
> **Target Academic Sessions:** Current `2025-26` (and forward-compatible with future sessions `2026-27+`)  
> **Status:** Archived Implementation Blueprint  
> **Reference Context:** Preserving the richest student profile from the `admissions` collection during concurrent overlap with `masterRegisters` until the annual session rollover is executed.

---

## 1. Executive Summary & Problem Context

During the active academic session (`2025-26`), student records exist in two Firestore collections:
1. **`admissions` Collection (Primary Live Authority)**:
   - Houses the verified online and physical admission applications submitted by or for students.
   - Contains the **most complete, up-to-date, and granular profile data**:
     - Precise subject choices for Class 11th and 12th (e.g., Medical, Non-Medical, Arts, Commerce electives).
     - Stream assignment (`Science`, `Arts`, `Commerce`, `Home Science`, or `General`).
     - Accurate parentage (Father's Name, Mother's Name, Guardian).
     - Contact details (Active Mobile Numbers, Address, Village/Town).
     - Application identifiers (`Form No.`, `Date of Birth`, `Category`, `Board Registration Number`).
2. **`masterRegisters` Collection (Permanent Institutional Archive)**:
   - Holds historical cohorts and flattened master registers from previous academic years.
   - Currently contains redundant/provisional entries for the current session (`2025-26`).
   - As established by school administration, **this overlap will be cleanly eliminated once the annual session rollover is officially executed**.

### The Root Cause Identified in Code:
In two critical evaluation portals:
- **Teacher Practicals Portal** ([PracticalsPage.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/teacher/PracticalsPage.jsx))
- **Teacher School-Based Assessment Portal** ([TeacherAssessmentsPage.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/teacher/TeacherAssessmentsPage.jsx))

Both `masterRegisters` and `admissions` are queried in parallel via `Promise.all`. However, during candidate processing, `masterDocs` was iterated **first** and `admDocs` **second**. 

When records were deduplicated into the internal uniqueness map (`uniqueMap`), the first record seen (`masterRegisters`) occupied the slot, causing the subsequent, richer `admissions` record to be **discarded as a duplicate**. Consequently, teachers were presented with older or incomplete student rows lacking freshly updated subjects or parentage.

---

## 2. System-Wide Portal Audit Matrix

The following table documents where student roster data is fetched and which collection takes precedence across every portal module:

| Portal / Module | Data Sources Queried | Current Order of Ingestion | Current "Winning" Source | Status / Action Needed |
| :--- | :--- | :--- | :--- | :--- |
| **Teacher Practicals**<br>`PracticalsPage.jsx` | `masterRegisters`<br>`admissions`<br>`practicalsData` | `masterDocs` first (L2028)<br>`admDocs` second (L2053) | ⚠️ **`masterRegisters`**<br>(Richer admission doc dropped in `uniqueMap`) | **Needs Precedence Inversion**: Invert loop order for current session so `admissions` enters first. |
| **Teacher School Assessments**<br>`TeacherAssessmentsPage.jsx` | `masterRegisters`<br>`admissions`<br>`practicalsData` | `masterDocs` first (L423)<br>`admDocs` second (L447) | ⚠️ **`masterRegisters`**<br>(Richer admission doc dropped in `uniqueMap`) | **Needs Precedence Inversion**: Invert loop order for current session so `admissions` enters first. |
| **Teacher Attendance**<br>`AttendancePage.jsx` | `admissions`<br>`masterRegisters` | `admDocs` first (L1207)<br>`masterDocs` second (L1226) | ✅ **`admissions`** | **Already Correct**: Admissions is prioritized for active session; master registers used only as fallback. |
| **Admin Practicals Suite**<br>`AdminPracticals.jsx` | `admissions`<br>`masterRegisters`<br>`practicalsData` | `admissionsData` first (L1062)<br>`masterRegisters` second (L1078) | ✅ **`admissions`** | **Already Correct**: Explicit `isLiveAdmission` guard preserves streams and subjects from admissions. |
| **Admin School Assessments Hub**<br>`AdminGkTestManager.jsx`<br>`SchoolAssessmentsHub.jsx` | `admissions` cache | Directly pulls from `getCachedCollectionSync('admissions')` | ✅ **`admissions`** | **Already Correct**: Pulls directly from the admissions pool. |
| **Admin Dashboard & Register**<br>`AdminDashboard.jsx`<br>`AdmissionRegisterSuite.jsx` | `admissions` | Subscribes directly to `getAdmissionsBySession` | ✅ **`admissions`** | **Already Correct**: Live admissions cohort is the sole active source. |
| **Student Data Fetcher Utility**<br>`studentDataFetcher.js` | Memory cache $\rightarrow$ `admissions` $\rightarrow$ `masterRegisters` | Scans cached admissions first; queries `masterRegisters` only if 0 records found | ✅ **`admissions`** | **Already Correct**: Only falls back to master registers when admissions returns empty. |
| **Student ID Cards & Certificates**<br>`StudentIdCardManager.jsx`<br>`StudentCertificateStudioView.jsx` | `admissions` + `masterRegisters` | Prefers `admissions` if present (`adms.length > 0 ? adms : mr`) | ✅ **`admissions`** | **Already Correct**: Admissions takes first priority for student identity cards and certificates. |

---

## 3. High-Level Architecture Flow

```mermaid
flowchart TD
    subgraph Input["Data Fetching Layer (Promise.all)"]
        F1["getAdmissionsBySession(session, class)"]
        F2["getMasterRegistersScoped(session, class)"]
    end

    subgraph ScopeCheck{"Is Active / Current Session? (2025-26)"}
        Input --> ScopeCheck
    end

    subgraph CurrentSessionPath["Active Session Workflow (Proposed)"]
        ScopeCheck -- "YES (2025-26)" --> P1["1. Process admDocs into allCandidates FIRST"]
        P1 --> P2["Populate richByReg, richByRoll, richByName from Admissions"]
        P2 --> P3["2. Process masterDocs SECOND (Backfill Only)"]
        P3 --> P4["Deduplicate in uniqueMap: Keep Admissions Record as Base"]
        P4 --> P5["Deep-merge: Preserve historical Exam Roll / Marks from Master if absent in Admissions"]
        P5 --> DisplayCurrent["Display Complete, Richest Student Profile to Teachers"]
    end

    subgraph HistoricalSessionPath["Historical Sessions (e.g., 2024-25, 2023-24)"]
        ScopeCheck -- "NO (Past Sessions)" --> H1["Process masterDocs FIRST (Permanent Institutional Archive)"]
        H1 --> H2["Fallback to admDocs if historical record exists"]
        H2 --> DisplayHistorical["Display Historical Archived Students"]
    end
```

---

## 4. Detailed Implementation Blueprint

### Phase 1: Precedence Inversion in `src/portal/teacher/PracticalsPage.jsx`

#### 1.1 Candidate Array Construction ([Lines 2025–2075](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/teacher/PracticalsPage.jsx#L2025-L2075))
- For the active session (`yearSuffix === CURRENT_SESSION` or `yearSuffix === '2025-26'`), process `admDocs` **before** `masterDocs`.
- Structure the loop dynamically:
  ```javascript
  const isCurrentActiveSession = isSessionMatch(yearSuffix, CURRENT_SESSION) || yearSuffix === '2025-26';
  const primaryDocs = isCurrentActiveSession ? admDocs : masterDocs;
  const secondaryDocs = isCurrentActiveSession ? masterDocs : admDocs;
  const primarySource = isCurrentActiveSession ? 'admissions' : 'masterRegisters';
  const secondarySource = isCurrentActiveSession ? 'masterRegisters' : 'admissions';
  ```
- Push `primaryDocs` first so the canonical admission documents form the foundation of `allCandidates`.

#### 1.2 Lookup Index Construction ([Lines 2086–2104](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/teacher/PracticalsPage.jsx#L2086-L2104))
- The lookup maps (`richByReg`, `richByForm`, `richByRoll`, `richByName`, `richByAdm`) rely on `setIfBetter`.
- Because `primaryDocs` (`admDocs`) enters first, the richer admission record will occupy each lookup key.
- If a secondary record from `masterRegisters` enters, `setIfBetter` will not overwrite the admission record unless the admission record was missing a class match.

#### 1.3 Deduplication & Smart Field Merging in `uniqueMap` ([Lines 2304–2326](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/teacher/PracticalsPage.jsx#L2304-L2326))
- Instead of unconditionally discarding the second record if `uniqueMap.has(key)`, implement a non-destructive field merge:
  ```javascript
  if (!uniqueMap.has(key)) {
    uniqueMap.set(key, st);
  } else {
    const existing = uniqueMap.get(key);
    // If existing record came from admissions, enrich it with any missing identifiers from masterRegisters
    if (existing._source === 'admissions' || isCurrentActiveSession) {
      uniqueMap.set(key, {
        ...st,          // Secondary fields
        ...existing,    // Admissions fields take precedence for identity, subjects, stream, parentage
        // Backfill exam roll or board roll if master register had it and admissions was blank
        examRollNo: existing.examRollNo || st.examRollNo || st.boardRollNo || '',
        boardRollNo: existing.boardRollNo || st.boardRollNo || '',
        admNo: existing.admNo || st.admNo || ''
      });
    }
  }
  ```

---

### Phase 2: Precedence Inversion in `src/portal/teacher/TeacherAssessmentsPage.jsx`

#### 2.1 Candidate Array Construction ([Lines 420–466](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/teacher/TeacherAssessmentsPage.jsx#L420-L466))
- In `loadData`, apply identical precedence logic:
  - If `selectedSession === CURRENT_SESSION` or `selectedSession === '2025-26'`, push `admDocs` into `allCandidates` first, followed by `masterDocs`.
  - Tag each record with its source (`_source: 'admissions'` vs `_source: 'masterRegisters'`).

#### 2.2 Uniqueness Deduplication ([Lines 595–625](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/teacher/TeacherAssessmentsPage.jsx#L595-L625))
- Prioritize the `admissions` record for student demographic and subject fields (`rawSubjects`, `subjects`, `subjectsAbbr`, `fatherName`, `parentName`, `formNo`, `regNo`).
- Preserve any previously entered marks (`marks`, `isAbsent`) from `savedMarksMap` seamlessly.

---

### Phase 3: Annual Rollover Safety & Forward Compatibility

1. **Clean Separation of Concerns**:
   - `admissions` remains the dedicated repository for incoming, active academic sessions.
   - `masterRegisters` remains the permanent, historical archive.
2. **Rollover Automation Protocol**:
   - When administration executes the annual session rollover via `SessionArchivalModal.jsx` (protected by Admin PIN `313313`):
     - Approved records from `2025-26` in `admissions` are committed as permanent archive chunks to `masterRegisters`.
     - The duplicate `2025-26` records currently in `masterRegisters` are reconciled.
     - The `admissions` collection is wiped clean and initialized for `2026-27`.
   - Because our implementation checks `isSessionMatch(session, CURRENT_SESSION)`, once `siteSettings.session` advances to `2026-27`, the portal will **automatically** treat `2026-27` admissions as the active cohort and `2025-26` as a historical cohort from `masterRegisters`—with **zero code changes required**.

---

## 5. Verification & Testing Checklist

When executing this implementation:
- [ ] **Build Validation**: Run `npm run build` and ensure `Exit Code 0` with zero breaking lint/syntax errors.
- [ ] **Class 11th Subject Verification**: Open Class 11th in Practicals and School Assessments; confirm that students display their distinct elective subjects (e.g. *Biology*, *Urdu*, *Computer Science*, *Economics*) instead of generic defaults.
- [ ] **Class 12th Subject Verification**: Verify Class 12th students match their enrolled subjects and streams.
- [ ] **Identity Field Completeness**: Verify that Form Number, Parentage (Father's Name), and Board Registration Numbers populate from the admission document.
- [ ] **Zero Mark Loss**: Confirm that existing draft or approved practical marks in `practicalsData` overlay correctly onto the enriched student profile.
- [ ] **Historical Session Integrity**: Switch session filter to `2024-25 (Oct-Nov)` or `2024-25 (Mar-Apr)`; confirm that historical master registers load and display normally without regressions.
