# OMR Examination System Workflow

## 1. Project Goal
Create a student registration and OMR evaluation system for a general knowledge test scheduled for 10 August 2026. The system must support:
- student registration using registration number or form number
- automatic student data lookup
- manual fallback entry for students without prior results
- generation of a unique 7-digit examination number
- OMR metadata preparation for each submitted student
- invigilator upload of scanned OMR sheets to a folder
- automatic OCR/OMR processing with confidence-based validation
- admin review for flagged responses
- final results pushed to Firestore for admin dashboard visibility

## 2. Core Roles
### Student
- enters registration number or form number
- fetches latest registration details
- confirms submission
- receives exam number

### Invigilator
- logs in with email or mobile number
- uploads scanned OMR images
- monitors upload status

### Super Admin
- manages system configuration
- reviews flagged sheets
- approves final results
- downloads/prints prepared OMR templates

## 3. Registration Workflow
1. Student opens the registration page.
2. Student enters registration number or form number.
3. System looks for the latest student record.
4. If a match is found, the system pre-fills:
   - form number
   - session
   - registration number
   - class roll number
   - latest class
   - photo
   - name
   - father name
5. Student confirms the details.
6. System creates a unique 7-digit examination number.
7. The submission is stored in Firestore.

### Manual fallback
If no result is found:
- student can enter details manually
- required fields:
  - name
  - father name
  - class
  - class roll number
- session defaults to 2025-26
- photo upload is disabled
- exam number is still generated

## 4. OMR Preparation Workflow
For each valid submission:
- backend prepares an OMR record containing:
  - student ID
  - exam number
  - name
  - father name
  - form number
  - registration number
  - class roll number
  - class
  - session
  - photo reference
  - answer area metadata for 60 questions
  - signature areas for student and invigilator

The backend does not print physical OMR sheets directly. It creates the data and template configuration for the OMR sheets.

## 5. OMR Template Design
Each OMR sheet should include:
- student identity fields
- photo placeholder
- student signature area
- invigilator signature area
- 60 MCQ answer bubbles
- corner registration marks
- QR or barcode for identity lookup
- row/column reference marks for reliable detection

## 6. Image Scanning Workflow
1. Invigilator uploads phone-captured OMR images to a designated folder.
2. A Python service watches the folder continuously.
3. Each uploaded image is processed with:
   - skew correction
   - perspective correction
   - contrast enhancement
   - thresholding
   - bubble detection
   - QR/barcode detection
4. Each answer is classified as:
   - valid
   - invalid
   - multiple-marked
   - faint/unclear
   - unmarked
5. Low-confidence cases are flagged for manual review.
6. Accepted results are written to Firestore.

## 7. Accuracy Controls
To improve reliability:
- use fixed OMR template dimensions
- print strong black borders
- add corner reference marks
- add row guide marks
- include a QR code for identity
- reject weak or non-standard markings
- require manual review for low-confidence detections

## 8. Storage and Database Model
### Firestore collections
- students
- registrations
- omr_submissions
- omr_scans
- review_flags
- results

### Recommended document fields
- studentId
- examNumber
- formNumber
- registrationNumber
- session
- className
- classRollNumber
- name
- fatherName
- photoUrl
- photoStatus
- submittedAt
- status
- scanStatus
- answers
- reviewRequired
- reviewedBy

## 9. Google Drive and Storage Recommendation
Google Drive can be used for invigilator uploads, but Firebase Storage is usually simpler and more reliable for this flow.

If Google Drive is required, configure:
- Google Drive API
- service account credentials
- folder ID for uploads
- a watcher script to process new files automatically

### Placeholder configuration
- Google Drive folder ID: REPLACE_WITH_YOUR_FOLDER_ID

## 10. Implementation Plan
### Phase 1
- build student registration UI
- create Firestore documents for submissions
- generate exam numbers

### Phase 2
- build invigilator upload UI
- add backend upload endpoint
- create watcher script for folder monitoring

### Phase 3
- implement OMR image preprocessing and answer detection
- add review queue for invalid/unclear responses

### Phase 4
- add admin review dashboard and result publication

## 11. Recommended Technology Stack
- React for frontend
- Firebase Firestore for structured data
- Firebase Storage or Google Drive for image storage
- Node.js/Express for backend APIs
- Python with OpenCV for OMR image processing

## 12. Acceptance Criteria
The system is acceptable when:
- students can register with registration number or form number
- manual fallback works for missing data
- each submission receives a unique exam number
- OMR metadata is created for each submission
- invigilator uploads can be processed automatically
- weak or invalid markings are flagged rather than silently accepted
- final results can be reviewed and published by admin
