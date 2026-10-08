/**
 * adminModuleSearchEngine.js
 * 
 * High-performance, Google-like fuzzy and deep semantic search engine for Administrative Modules & Tools.
 * 
 * Features:
 * - Strict preference hierarchy:
 *   1st Priority: Module Name / Title (label)
 *   2nd Priority: Brief Description (desc / description)
 *   3rd Priority: Keywords & Aliases
 *   4th Priority: Deep Field Structure, Settings, and Capabilities
 *   5th Priority: Domain Semantic Thesaurus & Categories
 * - Strict token matching: Short tokens (<= 3 chars, e.g. "id", "cms", "dob", "omr") match whole words only,
 *   never slicing into unrelated words (e.g. "id" never matches "consolidated", "slideshow", or "bonafide").
 * - High-precision word-boundary highlighter for search previews.
 * - Deep module schema indexing: Search by form fields (e.g. "bank account", "ifsc", "blood group", "gp fund", "nps", "roll no"),
 *   settings (e.g. "recycle bin", "hero slider", "defaulter threshold", "feeder school"), and capabilities.
 * - Informative matched badges ("In Title", "Field: Bank Account", "Setting: Hero Slider").
 */

// ─────────────────────────────────────────────────────────────────────────────
// 1. DOMAIN-SPECIFIC EDUCATIONAL SEMANTIC THESAURUS
// ─────────────────────────────────────────────────────────────────────────────
export const SEMANTIC_THESAURUS = Object.freeze({
  identity: [
    'id card', 'identity card', 'id cards', 'student id', 'badge', 'smart card',
    'photo id', 'student pass', 'card design', 'lanyard', 'cr80'
  ],
  board: [
    'jkbose', 'bose', 'state board', 'board exam', 'sent up', 'sent-up', 'gazette',
    'roll return', 'roll returns', 'matric', 'higher secondary', 'pre-board', 'pre board',
    'board reg', 'board roll', 'board ingestion', 'board data', 'verified data', 'board sync'
  ],
  marks: [
    'score', 'scores', 'result', 'results', 'grade', 'grades', 'eval', 'evaluation',
    'assessment', 'awards', 'award roll', 'practical', 'practicals', 'viva', 'theory',
    'internal assessment', 'external practical', 'test', 'exam', 'gazette', 'mark list'
  ],
  exam: [
    'test', 'examination', 'assessment', 'pre-board', 'golden test', 'unit test', 'term test',
    'omr', 'mcq', 'competitive', 'neet', 'jee', 'gk', 'admit card', 'hall ticket'
  ],
  admission: [
    'intake', 'enrol', 'enrolment', 'enrollment', 'form', 'apply', 'applicant', 'entry',
    'direct entry', 'new student', 'registration', 'provisional', 'ledger', 'register',
    'feeder', 'feeder school', 'class 10', 'class 11', 'class 12'
  ],
  fee: [
    'fees', 'fund', 'funds', 'dues', 'payment', 'collection', 'receipt', 'concession',
    'scholarship', 'money', 'ledger', 'account', 'financial'
  ],
  salary: [
    'pay', 'tax', 'income tax', 'tds', 'deduction', 'payroll', 'accounts clerk',
    'nps', 'gp fund', 'form 16', 'statement', 'staff salary', 'allowance'
  ],
  photo: [
    'picture', 'image', 'camera', 'avatar', 'batch photo', 'photo export', 'student photo', 'photograph'
  ],
  message: [
    'email', 'sms', 'whatsapp', 'notification', 'notify', 'alert', 'broadcast',
    'parent message', 'delivery log', 'announcement'
  ],
  staff: [
    'teacher', 'teachers', 'faculty', 'lecturer', 'master', 'permission', 'permissions',
    'role', 'roles', 'rbac', 'access', 'admin', 'superadmin', 'designation', 'credential', 'login'
  ],
  certificate: [
    'bonafide', 'character', 'provisional', 'dob', 'birth', 'slc', 'transfer', 'discharge',
    'achievement certificate', 'qr verification', 'school leaving'
  ],
  achievements: [
    'achievement', 'achievements', 'hall of fame', 'fame', 'topper', 'toppers', 'position', 'positions',
    'ut positions', 'top ranks', 'rankers', 'awards', 'medals', 'honors', 'trophies', 'merit',
    'neet', 'jee', 'cuet', 'sports', 'jkbose toppers', 'hall of fame cms'
  ],
  export: [
    'download', 'excel', 'csv', 'spreadsheet', 'sheets', 'pdf', 'print', 'word', 'docx'
  ],
  delete: [
    'trash', 'bin', 'recycle', 'recycle bin', 'deleted', 'restore', 'recovery', 'history', 'archive'
  ],
  attendance: [
    'absent', 'present', 'leave', 'roll call', 'daily register', 'monthly attendance',
    'percentage', 'attendance defaulter'
  ],
  roll: [
    'class roll', 'roll number', 'roll returns', 'sent-up roll', 'serial number',
    'exam roll', 'sequence', 'auto roll'
  ],
  website: [
    'cms', 'homepage', 'portal', 'slider', 'hero', 'notices', 'circular', 'gallery',
    'news', 'public site'
  ],
  audit: [
    'logs', 'activity', 'history', 'who did what', 'dispute', 'trail', 'timestamp',
    'security log', 'investigation'
  ],
  duplicate: [
    'merge', 'deduplication', 'double admission', 'identical', 'clone', 'repeat'
  ],
  contacts: [
    'phone', 'mobile', 'parents phone', 'phonebook', 'google contacts', 'directory', 'whatsapp list', 'vcard'
  ],
  curriculum: [
    'subject', 'subjects', 'stream', 'streams', 'medical', 'non-medical', 'arts',
    'commerce', 'combination', 'elective', 'compulsory', 'course'
  ],
  letter: [
    'letterhead', 'official letter', 'draft', 'compose', 'ai letter', 'order', 'circular', 'memo'
  ],
  benefit: [
    'mutual benefit fund', 'beneficiary', 'bank debit order', 'sanction order', 'poor fund',
    'financial assistance', 'disbursement', 'ifsc', 'account number', 'committee signatures'
  ]
});

export const STOP_WORDS = new Set([
  'of', 'in', 'at', 'on', 'to', 'for', 'by', 'and', 'or', 'the', 'a', 'an', 'is', 'as', 'with', 'amp'
]);

// ─────────────────────────────────────────────────────────────────────────────
// 2. COMPREHENSIVE DEEP MODULE INDEX (FIELDS, SETTINGS & CAPABILITIES)
// ─────────────────────────────────────────────────────────────────────────────
export const MODULE_DEEP_INDEX = Object.freeze({
  reports: {
    fields: [
      'Registration Number', 'Admission Number', 'Class Roll Number', 'Student Name',
      'Father Name', 'Mother Name', 'Date of Birth (DOB)', 'Gender', 'Category (OM/RBA/SC/ST/EWS)',
      'Stream (Medical/Non-Med/Arts/Commerce)', 'Chosen Subjects', 'Mobile Phone', 'Parent Contact',
      'Residential Address', 'District', 'Tehsil', 'Pincode', 'Aadhaar Number', 'Blood Group',
      'Previous School', '10th Marks', 'Percentage', 'Admission Status', 'Fee Status', 'ID Card Issued'
    ],
    settings: [
      'Status Filters (Approved, Pending, Provisional, Dropped)', 'Recycle Bin & Trash Recovery',
      'Restore Deleted Records', 'Permanent Purge Safeguard', 'Column Selector & Visibility',
      'Batch Photo ZIP Export', 'Excel Data Export', 'Printable Record Sheets', 'Quick Cell Edit Mode',
      'Cohort Filter by Class & Stream', 'Multi-field Search'
    ],
    capabilities: [
      'Review and approve student intake', 'Safe record soft-deletion and restoration',
      'Batch export student datasets to spreadsheet', 'Bulk status assignment'
    ]
  },

  admRegisterSuite: {
    fields: [
      'Admission Serial Number', 'Register Folio Number', 'Admission Date', 'Student Name',
      'Parentage', 'Date of Birth in Figures & Words', 'Permanent Residence', 'Previous School Attended',
      'Class Admitted', 'Stream Assigned', 'Board Registration Number', 'JKBOSE Sent-up Roll Number',
      'Discharge / Leaving Date', 'Reason for Leaving', 'Transfer Certificate (TC) Number', 'Official Remarks'
    ],
    settings: [
      'Session Year Selector', 'Class Filter (10th, 11th, 12th)', 'Sent-up Register Column Layout',
      'Legal Landscape Print Layout', 'Official Ledger Pagination', 'Permanent Register Archiving',
      'Gazette Result Verification', 'Range-compressed Roll Export'
    ],
    capabilities: [
      'Maintain permanent institutional admission ledger', 'Generate official JKBOSE sent-up roll returns',
      'Print legal ledger registers', 'Track student admission and discharge history'
    ]
  },

  analyticsReports: {
    fields: [
      'Class Enrollment Counts', 'Gender Ratio (Boys vs Girls)', 'Stream Intake Distribution',
      'Category Representation', 'Subject Enrollment Figures', 'Roll Number Sequences',
      'Range Compression Blocks', 'JKBOSE Roll Return Statements'
    ],
    settings: [
      'Class-wise Distribution Charts', 'Stream Intake Pie Visualization', 'Subject Distribution Bar Chart',
      'Automatic Range Compression Algorithm', 'Official JKBOSE Subject Roll Return Format',
      '1-Click Printable Statistical Report', 'CSV & Excel Metrics Export'
    ],
    capabilities: [
      'Institutional enrollment demographics analysis', 'Official JKBOSE subject roll statement generation',
      'Visual enrollment analytics and metrics'
    ]
  },

  directEntry: {
    fields: [
      'Student Full Name', 'Father Name', 'Mother Name', 'Gender', 'Date of Birth',
      'Assigned Class & Stream', 'Chosen Compulsory & Elective Subjects', 'Student Mobile Phone',
      'Parent Mobile Number', 'Permanent Address', 'Previous School', '10th Roll Number & Marks',
      'Admission Date', 'Category'
    ],
    settings: [
      'Live Duplicate Detection Guard', 'Instant Validation Engine', 'Immediate Registration Number Generator',
      'Stream Subject Pool Auto-fill', 'Walk-in Direct Admission Ingestion', 'Direct Intake Registry Insertion'
    ],
    capabilities: [
      'Rapid single-student walk-in admission', 'Instant duplicate prevention on phone, name, and DOB',
      'Direct insertion into approved or pending intake'
    ]
  },

  customRoster: {
    fields: [
      'Student Photo Thumbnail', 'Class Roll No', 'Admission Reg No', 'Student Full Name',
      'Father Name', 'Stream & Class', 'Subject Combination', 'Contact Phone', 'Category',
      'Signature Column', 'Blank Remarks Column', 'Custom Fee / Dues Column'
    ],
    settings: [
      'Dynamic Column Builder', 'Custom Column Ordering & Reorder', 'Student Photo Thumbnail Toggle',
      'Fee Register Grid Layout', 'Attendance Register Grid Layout', 'Custom Title & Subtitle Header',
      'Compact Print Mode', 'Legal & A4 Page Size', 'Excel Spreadsheet Export'
    ],
    capabilities: [
      'Design custom printable student rosters', 'Generate exam signature sheets and fee registers',
      'Export tailored tabular student reports'
    ]
  },

  officialLetter: {
    fields: [
      'Dispatch / Reference Number', 'Letter Date', 'Official Subject / Heading', 'Recipient Addressee (To)',
      'Salutation', 'Letter Body Content', 'Signatory Authority (Principal / Incharge)', 'Signatory Designation',
      'Official School Seal / Stamp', 'Enclosures List', 'Copy To (Endorsement / Circulation)'
    ],
    settings: [
      'Official Institutional Ice-Blue Letterhead Banner', 'Gemini AI Letter Composition Assistant',
      'Multi-key AI API Key Configuration', 'Predefined Institutional Letter Templates',
      'Direct Inline Canvas Editing with Stepper Buttons', 'Automatic Draft Autosave',
      'Letter History & Archive', 'Print Margin Removal', 'High-res PDF Letter Export'
    ],
    capabilities: [
      'Draft official school correspondence', 'AI-assisted formal letter composition',
      'Standardized institutional letterhead printing'
    ]
  },

  certStudio: {
    fields: [
      'Certificate Serial Number', 'Certificate Type (Bonafide, Character, DOB, Provisional, SLC, Achievement)',
      'Student Name', 'Parentage', 'Residential Address', 'Admission Reg No', 'Class & Roll Number',
      'Date of Birth (Figures & Words)', 'Character & Conduct Assessment', 'Issue Date', 'QR Verification Security Hash'
    ],
    settings: [
      'Certificate Template Selection', 'Authorized Signatory Toggle (Principal / Headmaster)',
      'QR Code Verification URL Generator', 'Security Border Frame Style', 'Automated DOB-in-Words Interpolation',
      'Batch Certificate Issuance', 'Issuance Audit Log & Verification Portal'
    ],
    capabilities: [
      'Generate authoritative institutional certificates', 'QR code tamper-proof verification',
      'Batch student certificate printing'
    ]
  },

  idCards: {
    fields: [
      'Student Photo', 'Student Full Name', 'Father Name', 'Class & Stream', 'Class Roll Number',
      'Admission Registration Number', 'Date of Birth (DOB)', 'Blood Group', 'Student Mobile Number',
      'Residential Address', 'Emergency Contact', 'Issue Date', 'Valid Upto Date', 'Principal Signature',
      'Barcode / QR Code'
    ],
    settings: [
      'Card Orientation (Landscape / Portrait / PVC)', 'Standard CR80 ID Card Dimensions',
      'Batch Print Sheet Layout (8 / 10 Cards Per Sheet)', 'Lanyard Hole Punch Spacing Guide',
      'Photo Cropper & High-DPI Resolution', 'Custom Color Theme & School Branding',
      'Backside Terms, Rules & Transport Routes', 'Print Range Selector'
    ],
    capabilities: [
      'Batch design and print student identity cards', 'Cohort-based ID card filtering',
      'Automated photo resolution and barcode embedding'
    ]
  },

  beneficiaryStudio: {
    fields: [
      'Sanction Order Reference Number', 'Order Date', 'Beneficiary Student Name', 'Parentage',
      'Class & Stream', 'Admission Reg No', 'Bank Name', 'Branch Name', 'Bank Account Number',
      'IFSC Code', 'Sanctioned Amount', 'Disbursement Head', 'Committee Signatories', 'Principal Approval'
    ],
    settings: [
      'Quick Student Finder & Search', 'Bulk Multi-class Reg No Fetch', 'Auto-sum Total Sanction Amount Calculator',
      'Bank Debit Directive Official Layout', 'Committee Signatures Block', 'Red Letterhead Border Frame Toggle',
      'Official Letterhead Banner Header', 'Direct Inline Reference & Date Stepper', 'Isolated Print Window',
      'Excel Beneficiary Export'
    ],
    capabilities: [
      'Manage Mutual Benefit Fund and Poor Fund disbursements', 'Prepare bank debit sanction orders',
      'Fetch and compile multi-class beneficiary lists'
    ]
  },

  gkTest: {
    fields: [
      'Examination Type (Pre-Board Exam, Golden Test, Mid-term, Unit Test, Term End, Competitive / OMR)',
      'Academic Session', 'Class & Stream', 'Subject Name', 'Maximum Marks', 'Passing Minimum Marks',
      'Theory Marks', 'Objective / OMR Marks', 'Student Marks Obtained', 'Gazette Result Status (Pass / Fail)',
      'Admit Card Number', 'Exam Roll Number', 'Examination Center Code', 'Question Paper Code', 'OMR Answer Key'
    ],
    settings: [
      'Teacher Mark Submission Approval Workflow', 'Consolidated Result Gazette Generator',
      'Admit Card Generator & Batch Printing', 'OMR MCQ Sheet Processing & Scoring',
      'Grading Scale & Pass Criteria Configuration', 'Result Gazette PDF & Excel Export',
      'Examination Date Sheet Schedule'
    ],
    capabilities: [
      'Central hub for School Based Assessments and Pre-Board tests', 'Approve teacher exam evaluations',
      'Generate student admit cards and gazette rolls'
    ]
  },

  controls: {
    fields: [
      'Academic Session Year (2025-26, 2026-27)', 'Admission Windows Status (Open / Closed for 10th, 11th, 12th)',
      'Faculty Workspace Switch (Active / Disabled)', 'Cloud Storage Bucket Usage', 'Storage Quota Limit & Health',
      'Upload File Size Limits', 'System Maintenance Mode', 'Annual Session Rollover Date'
    ],
    settings: [
      'Admission Window Open / Close Toggles', 'Faculty Portal Workspace Enabler',
      'Cloud Storage Quota Health Monitor', 'Storage Garbage Collection & Space Reclamation',
      'Annual Academic Session Rollover Safe Migration', 'Configuration Audit Trail'
    ],
    capabilities: [
      'Global system operational configuration', 'Manage admission windows and session transitions',
      'Monitor cloud storage quotas and performance'
    ]
  },

  curriculum: {
    fields: [
      'Stream Name (Medical, Non-Medical, Arts, Commerce)', 'Stream Code', 'Compulsory Subjects List',
      'Elective Subject Pools', 'Subject Codes', 'Theory Max Marks', 'Practical Max Marks',
      'Feeder School Name', 'Feeder School Code', 'Feeder School Zone / District'
    ],
    settings: [
      'Admission Form Dynamic Schema Synchronization', 'Subject Pool Combination Rules',
      'Maximum Subject Selection Limits (5 Compulsory + 1 Additional)', 'Feeder Schools Registry Directory',
      'Stream Activation & Deactivation Toggles'
    ],
    capabilities: [
      'Define academic streams and subject combinations', 'Sync subject pools to student admission forms',
      'Maintain institutional feeder schools registry'
    ]
  },

  practicals: {
    fields: [
      'Subject Name', 'Practical Paper Code', 'Class (11th, 12th)', 'Internal Assessment Marks',
      'External Practical Marks', 'Maximum Practical Marks', 'Class Roll Number', 'Student Name',
      'Father Name', 'Marks in Figures & Words', 'Internal Examiner Name & Designation',
      'External Examiner Name & School', 'Examiner Signature Timestamp'
    ],
    settings: [
      'Strict Evaluation Data Boundary (Internal Assessment & External Practical ONLY)',
      'Practical Marks Freeze & Final Locking', 'Authoritative Award Roll PDF Generation',
      'Teacher Submission Verification & Audit', 'Spreadsheet Reconciler & Mark Range Guard'
    ],
    capabilities: [
      'Confidential practical marks evaluation and award rolls',
      'Strict data separation from school-based exams',
      'Examiner signature locking and gazette preparation'
    ]
  },

  attendanceMgmt: {
    fields: [
      'Attendance Date', 'Class & Section', 'Stream', 'Student Roll Number', 'Student Name',
      'Attendance Status (Present, Absent, Leave, Medical)', 'Total Working Days', 'Total Present Days',
      'Monthly Attendance Percentage', 'Defaulter Threshold (75%)'
    ],
    settings: [
      'Daily Roll Call Register Grid', 'Subject-wise Attendance Mode', 'Monthly Consolidated Register',
      'Attendance Defaulter Warning List Generator', 'Rapid Mark-All-Present Shortcut',
      'Attendance Summary Report Print & Export'
    ],
    capabilities: [
      'Record and monitor daily student attendance', 'Identify attendance defaulters below mandatory percentage',
      'Generate consolidated monthly attendance registers'
    ]
  },

  rollNo: {
    fields: [
      'Class & Stream', 'Current Roll Number', 'New Roll Number', 'Auto-sequence Prefix',
      'Sort Order Criteria (Alphabetical by Name, Admission Date, Merit / 10th Marks, Gender)', 'Collision Status'
    ],
    settings: [
      'Auto Roll Number Assigner Algorithm', 'Bulk Sequential Re-indexing',
      'Duplicate Roll Collision Prevention Guard', 'Roll Sync with Approved Admissions',
      'Stream Roll Range Boundaries', 'Roll Number Freeze / Lock'
    ],
    capabilities: [
      'Automate class roll number assignment', 'Re-index and sequence student cohorts',
      'Prevent duplicate and conflicting roll numbers'
    ]
  },

  mergeStudio: {
    fields: [
      'Duplicate Group ID', 'Match Confidence Percentage',
      'Matching Attributes (Name, Parentage, DOB, Phone, Aadhaar)', 'Master Record Candidate',
      'Duplicate Record Candidate', 'Field Conflict Resolution (Keep Primary / Keep Secondary / Custom Merge)'
    ],
    settings: [
      'Disjoint-Set Union (DSU) Deduplication Clustering', 'Fuzzy Match Sensitivity Threshold',
      'Safe Pre-merge Backup to Recycle Bin', '1-Click Smart Merge', 'Field-by-Field Interactive Comparison',
      'Merge Audit Logging'
    ],
    capabilities: [
      'Detect duplicate student applications and double admissions',
      'Safely merge redundant student records without data loss', 'Consolidate student profile history'
    ]
  },

  automations: {
    fields: [
      'Email Subject Line', 'Email Body (Rich HTML / Plain Text)', 'Sender Display Name & Address',
      'Recipient Target Cohort (Class, Stream, All Students, Parents)', 'WhatsApp Notification Body',
      'SMS Notification Text', 'Delivery Status (Delivered, Bounced, Queued)', 'Dispatch Timestamp'
    ],
    settings: [
      'Rich-Text Formatting Toolbar', 'Real-time Recipient Cohort Filter & Counter',
      'Test Flight Preview & Send Test Email', 'Dynamic Template Variables ({{student_name}}, {{roll_no}})',
      'Delivery Audit Logs & Bounced Tracker', 'Batch Sending Rate Throttler'
    ],
    capabilities: [
      'Compose and broadcast bulk emails to student cohorts', 'Send urgent parent announcements and notices',
      'Monitor delivery logs and broadcast analytics'
    ]
  },

  funds: {
    fields: [
      'Fee Head Name (Admission Fee, Tuition, Exam, Sports, Library, Red Cross, Computer Fund)',
      'Fee Amount per Stream', 'Fee Concession Category (Orphan, BPL, Merit, Staff Child)',
      'Student Fee Ledger Account', 'Receipt Serial Number', 'Amount Paid', 'Balance / Due Amount',
      'Payment Date', 'Payment Mode (Cash, Online, Bank Transfer)'
    ],
    settings: [
      'Fee Structure & Head Builder', 'Student Ledger Reconciler', 'Fee Receipt Generator & Printable Voucher',
      'Defaulter Due Notice Generator', 'Over-distribution & Negative Balance Safeguards',
      'Fee Collection Summary & Account Export'
    ],
    capabilities: [
      'Define institutional fee structures', 'Track individual student fee collections and dues',
      'Generate official fee receipts and financial statements'
    ]
  },

  accounts: {
    fields: [
      'Staff Employee Name', 'Employee Code / ID', 'Designation', 'Basic Pay', 'Dearness Allowance (DA)',
      'House Rent Allowance (HRA)', 'Travel Allowance (TA)', 'Gross Monthly Salary',
      'National Pension System (NPS)', 'General Provident Fund (GP Fund)', 'Income Tax (TDS)',
      'Professional Tax', 'Net Pay', 'Form 16 Part B', 'Tax Deductions (80C, 80D, 80CCD)',
      'Assessment & Financial Year'
    ],
    settings: [
      'Staff Income Tax Calculation Engine', 'Old vs New Tax Regime Comparator',
      'Monthly Salary Bill / Pay Statement Generator', 'Dedicated Accounts Clerk Workspace',
      'Form 16 Tax Statement Generator', 'Annual Fiscal Budget Planning'
    ],
    capabilities: [
      'Compute employee income tax and TDS deductions', 'Prepare monthly staff salary statements and pay bills',
      'Manage GP Fund, NPS, and Form 16 documentation'
    ]
  },

  cms: {
    fields: [
      'Hero Slideshow Title', 'Slideshow Subtitle', 'Banner Image URL', 'Call to Action Button Link',
      'Notice / Circular Headline', 'Notice Category', 'Notice Attachment PDF', 'Publish Date',
      'Expiry Date', 'Custom Page URL Slug', 'Page HTML Content', 'Photo Gallery Album'
    ],
    settings: [
      'Hero Slideshow Slide Ordering', 'Notice Board Pin / Unpin Priority', 'Public vs Private Page Visibility',
      'Central Website Recycle Bin & Restore', 'Live Website Preview Mode', 'Media Asset Optimizer & CDN Linker'
    ],
    capabilities: [
      'Manage public school website content and notices', 'Configure homepage hero slideshow and banners',
      'Publish custom pages and circulars with attachments'
    ]
  },

  achievementsCms: {
    fields: [
      'Student Full Name', 'Parentage', 'Achievement Category (JKBOSE Topper, UT Position, District Rank, NEET, JEE, Sports, CUET)',
      'Academic Year / Session', 'Board Roll Number', 'Marks / Score Obtained',
      'Rank / Position (1st, 2nd, 3rd, Top 10)', 'Medal / Trophy / Award Name', 'Student Photograph'
    ],
    settings: [
      'Student Fast-lookup Ingestion', 'UT Position Spotlight Showcase', 'Hall of Fame Carousel Ordering',
      'Photo Aspect Ratio Cropper', 'Cross-tab Real-time Sync', 'Public Website Spotlight Toggle'
    ],
    capabilities: [
      'Showcase student academic and sports achievements', 'Spotlight board exam toppers and competitive exam qualifiers',
      'Publish institutional hall of fame honors'
    ]
  },

  boardSync: {
    fields: [
      'Board Registration Number', 'Board Roll Number', 'JKBOSE Official Gazette File',
      'Gazette Candidate Name', 'Father Name', 'Mother Name', 'Date of Birth', 'Stream',
      'Subject Marks (English, Physics, Chemistry, etc.)', 'Result Status', 'Discrepancy Flags'
    ],
    settings: [
      'Bulk Overwrite Admissions with Board Data', 'Gazette PDF & Spreadsheet Parser',
      'Class Roll Number Preservation Safeguard', 'Authoritative Field Classification',
      '30-Day Rollback & Undo Memory', 'Discrepancy Reconciliation Table'
    ],
    capabilities: [
      'Ingest and sync verified JKBOSE board gazette records',
      'Bulk overwrite student admission details with board data',
      '30-day safe rollback memory for peace of mind'
    ]
  },

  activityAudit: {
    fields: [
      'Audit Event ID', 'Timestamp', 'Actor Name', 'Actor Email',
      'Actor Role (Super Admin, Admin, Teacher, Student)', 'Module Affected',
      'Action Performed (Create, Update, Delete, Export, Merge, Restore, Login)',
      'Client IP Address', 'Target Record ID', 'Previous State (Diff Before)', 'New State (Diff After)'
    ],
    settings: [
      'Paginated Audit Log Explorer', 'Multi-filter by Date, Actor, Action, and Module',
      'Dispute Investigation & Resolution Viewer', 'Immutable Security Rules Enforced', 'CSV Audit Log Export'
    ],
    capabilities: [
      'Immutable audit trail across all administrative operations',
      'Resolve disputes with exact before/after change diffs',
      'Investigate unauthorized or erroneous record modifications'
    ]
  },

  googleContacts: {
    fields: [
      'Given Name', 'Family Name', 'Display Name', 'Additional Name (Class / Stream)',
      'Student Mobile Phone', 'Parent Mobile Number', 'Student Email', 'Residential Address',
      'Subject Abbreviations', 'Contact Group / Label (e.g. Class 11 Medical 2025)'
    ],
    settings: [
      '38-Column Official Google Contacts Header Schema', 'Cohort Filter by Class and Stream',
      'Subject Abbreviation Code Formatter', '1-Click CSV Download',
      'Step-by-step Google Contacts Import Guide'
    ],
    capabilities: [
      'Bulk export student and parent contacts to Google Contacts CSV',
      'Format mobile numbers and labels for Android / iPhone sync',
      'Export cohort-based WhatsApp contact lists'
    ]
  },

  staff: {
    fields: [
      'Staff Full Name', 'Official Email Address', 'Contact Mobile Number',
      'Designation (Principal, Lecturer, Master, Teacher, Accounts Clerk)',
      'Assigned Role (Teacher, Standard Admin, Super Admin)',
      'Assigned Modules Permission Codes', 'Account Status (Active, Suspended)', 'Last Login Timestamp'
    ],
    settings: [
      'Granular Module-scoped Permissions Matrix',
      'Role Presets (Full Admin, Academic Incharge, Records Incharge, Accounts Clerk, Teacher)',
      'Password Reset & Credential Management', 'Deactivate / Reactivate Staff Account',
      'Super Admin Immutable Role Safeguard'
    ],
    capabilities: [
      'Manage faculty and administrator user accounts', 'Grant fine-grained module permissions to staff',
      'Enforce role-based access control (RBAC)'
    ]
  },

  quickCellEdit: {
    fields: [
      'Table Cell Value (Name, Roll, Reg, Phone, Category, Stream)', 'Inline Cell Input', 'Cell Change History'
    ],
    settings: [
      'Inline Quick Cell Edit Toggle', 'Direct Click-to-edit Table Cells',
      'Instant Validation & Auto-save', 'Audit Logging of Cell Modifications'
    ],
    capabilities: [
      'Rapidly edit individual table cells without opening edit modals',
      'Quick inline correction of spelling, phone numbers, or categories'
    ]
  },

  bulkToolsAction: {
    fields: [
      'Student Photo Batch', 'Bulk Field Target', 'Bulk Value', 'Target Cohort Scope'
    ],
    settings: [
      'Batch Photo ZIP Downloader & Exporter', 'Bulk Admission Status Updater',
      'Bulk Stream / Section Assigner', 'Rollback Memory Protection'
    ],
    capabilities: [
      'Perform batch updates across hundreds of student records',
      'Download student photos in a single ZIP archive', 'Execute bulk cohort promotions'
    ]
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. FUZZY STRING METRIC (DAMERAU-LEVENSHTEIN WITH WORD-BOUNDARY GUARDS)
// ─────────────────────────────────────────────────────────────────────────────
export function getDamerauLevenshteinDistance(str1, str2) {
  if (!str1) return str2 ? str2.length : 0;
  if (!str2) return str1.length;
  if (str1 === str2) return 0;

  const len1 = str1.length;
  const len2 = str2.length;
  const d = [];

  for (let i = 0; i <= len1; i++) {
    d[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    d[0][j] = j;
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,       // deletion
        d[i][j - 1] + 1,       // insertion
        d[i - 1][j - 1] + cost // substitution
      );

      // Transposition check
      if (
        i > 1 &&
        j > 1 &&
        str1[i - 1] === str2[j - 2] &&
        str1[i - 2] === str2[j - 1]
      ) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }

  return d[len1][len2];
}

export function normalizeSearchText(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Checks if queryToken matches targetToken.
 * 
 * Strict boundary rules:
 * - Length <= 2 (e.g. "id", "tc", "no"): STRICT whole-word match or compound (id-card). NO mid-word substring.
 * - Length == 3 (e.g. "dob", "cms", "omr", "fee", "tax"): Whole-word or plural/suffix. NO mid-word substring.
 * - Length >= 4: Prefix and substring matches allowed if length ratio is reasonable.
 */
export function matchTokenFuzzy(queryToken, targetToken) {
  if (!queryToken || !targetToken) return { isMatch: false, score: 0 };
  if (queryToken === targetToken) return { isMatch: true, score: 100, distance: 0 };

  const qLen = queryToken.length;
  const tLen = targetToken.length;

  // 1. Very short tokens (len <= 2): e.g. "id", "no", "tc", "it"
  // Strictly require exact word match or compound prefix (e.g. "id-card").
  // Substring matching inside words (e.g. "consolidated", "slideshow", "bonafide") is strictly disallowed.
  if (qLen <= 2) {
    if (targetToken === queryToken) {
      return { isMatch: true, score: 100, distance: 0 };
    }
    if (targetToken.startsWith(queryToken + '-') || targetToken.startsWith(queryToken + '_')) {
      return { isMatch: true, score: 95, distance: 0 };
    }
    return { isMatch: false, score: 0 };
  }

  // 2. Short 3-char tokens: e.g. "dob", "cms", "omr", "fee", "tax", "nps", "slc"
  if (qLen === 3) {
    if (targetToken === queryToken) {
      return { isMatch: true, score: 100, distance: 0 };
    }
    if (targetToken === queryToken + 's' || targetToken === queryToken + 'es') {
      return { isMatch: true, score: 95, distance: 0 };
    }
    if (targetToken.startsWith(queryToken + '-') || targetToken.startsWith(queryToken + '_')) {
      return { isMatch: true, score: 90, distance: 0 };
    }
    if (targetToken.startsWith(queryToken) && tLen <= 5) {
      return { isMatch: true, score: 85, distance: 0 };
    }
    return { isMatch: false, score: 0 };
  }

  // 3. Tokens with len >= 4:
  // Exact plural / singular variation
  if (targetToken === queryToken + 's' || queryToken === targetToken + 's' ||
      targetToken === queryToken + 'es' || queryToken === targetToken + 'es') {
    return { isMatch: true, score: 95, distance: 0 };
  }

  // Prefix match (e.g. "admit" -> "admitted", "card" -> "cards")
  if (targetToken.startsWith(queryToken)) {
    const ratio = queryToken.length / targetToken.length;
    return { isMatch: true, score: 85 + Math.round(ratio * 15), distance: 0 };
  }

  // Substring match - only allowed if targetToken is not overwhelmingly long
  if (targetToken.includes(queryToken) && tLen <= qLen + 6) {
    return { isMatch: true, score: 70, distance: 0 };
  }

  // Fuzzy match with Damerau-Levenshtein
  const maxAllowedDistance = qLen <= 5 ? 1 : (qLen <= 8 ? 2 : 3);
  const distance = getDamerauLevenshteinDistance(queryToken, targetToken);

  if (distance <= maxAllowedDistance) {
    const penalty = distance * 20;
    const lengthSimilarity = 1 - Math.abs(qLen - tLen) / Math.max(qLen, tLen);
    const score = Math.max(20, Math.round(70 - penalty + lengthSimilarity * 20));
    return { isMatch: true, score, distance };
  }

  return { isMatch: false, score: 0 };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. PRECISION SEMANTIC QUERY EXPANDER
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Expands a query into its semantic concepts and synonyms without exploding unrelated terms.
 */
export function expandSemanticQuery(rawQuery) {
  const norm = normalizeSearchText(rawQuery);
  const tokens = norm.split(' ').filter(Boolean);
  const expandedConcepts = new Set();
  const searchSynonyms = new Set();

  const meaningfulTokens = tokens.filter(tok => !STOP_WORDS.has(tok) && tok.length > 1);

  // 1. Check if the FULL query matches or contains any multi-word concept synonyms
  Object.entries(SEMANTIC_THESAURUS).forEach(([conceptKey, synList]) => {
    // Check if full query matches a synonym
    if (synList.some(s => s === norm || norm.includes(s) || s.includes(norm))) {
      expandedConcepts.add(conceptKey);
      searchSynonyms.add(conceptKey);
      synList.forEach(s => searchSynonyms.add(s));
    }
  });

  // 2. Token-by-token matching (Only for exact concept keys or exact single-word synonyms)
  meaningfulTokens.forEach(tok => {
    // Direct concept key match
    if (SEMANTIC_THESAURUS[tok]) {
      expandedConcepts.add(tok);
      SEMANTIC_THESAURUS[tok].forEach(syn => searchSynonyms.add(syn));
    }

    // Exact single-word synonym lookup (avoid multi-word partial matching like 'card' matching 'admit card')
    Object.entries(SEMANTIC_THESAURUS).forEach(([conceptKey, synList]) => {
      const hasExactSingleWord = synList.some(s => !s.includes(' ') && (s === tok || (tok.length >= 4 && s.startsWith(tok))));
      if (hasExactSingleWord) {
        expandedConcepts.add(conceptKey);
        searchSynonyms.add(conceptKey);
      }
    });
  });

  return {
    originalTokens: tokens,
    expandedConcepts: Array.from(expandedConcepts),
    allSynonyms: Array.from(searchSynonyms),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. CORE SEARCH & TIERED RANKING ENGINE
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Searches administrative modules with strict preference hierarchy:
 * 1st Priority: Module Name / Title (label)
 * 2nd Priority: Brief Description (desc / description)
 * 3rd Priority: Keywords & Aliases
 * 4th Priority: Deep Field Structure, Settings, and Capabilities
 * 5th Priority: Domain Thesaurus & Categories
 */
export function searchAdminModules(items, rawQuery) {
  if (!rawQuery || !rawQuery.trim() || !Array.isArray(items)) {
    return items || [];
  }

  const cleanQuery = normalizeSearchText(rawQuery);
  const queryTokens = cleanQuery.split(' ').filter(Boolean);
  if (queryTokens.length === 0) return items;

  const { allSynonyms } = expandSemanticQuery(cleanQuery);
  const scoredResults = [];

  items.forEach(item => {
    let score = 0;
    const matchedReasons = [];
    const matchedFieldSet = new Set();
    const matchedSettingSet = new Set();
    let titleHitCount = 0;
    let descHitCount = 0;
    let anyHit = false;

    // Normalizations
    const labelNorm = normalizeSearchText(item.label);
    const descNorm = normalizeSearchText(item.desc || item.description);
    const catNorm = normalizeSearchText(item.category);
    const idNorm = normalizeSearchText(item.id);
    const aliasesNorm = (item.aliases || []).map(normalizeSearchText);
    const keywordsNorm = (item.keywords || []).map(normalizeSearchText);

    // Deep schema lookup (from item or from MODULE_DEEP_INDEX fallback)
    const deepInfo = MODULE_DEEP_INDEX[item.id] || {};
    const itemFields = [...(item.fields || []), ...(deepInfo.fields || [])];
    const itemSettings = [...(item.settings || []), ...(deepInfo.settings || [])];
    const itemCapabilities = [...(item.capabilities || []), ...(deepInfo.capabilities || [])];

    const labelWords = labelNorm.split(' ').filter(Boolean);
    const descWords = descNorm.split(' ').filter(Boolean);
    const allKeywords = [...keywordsNorm, ...aliasesNorm];

    // ─────────────────────────────────────────────────────────────────────────
    // TIER 1: MODULE NAME / TITLE (HIGHEST PRIORITY: 10,000 - 100,000+ points)
    // ─────────────────────────────────────────────────────────────────────────
    let hasTitleMatch = false;

    // 1.1 Exact Title match
    if (labelNorm === cleanQuery || idNorm === cleanQuery) {
      score += 100000;
      hasTitleMatch = true;
      matchedReasons.push('In Title');
    }
    // 1.2 Title starts with query phrase
    else if (labelNorm.startsWith(cleanQuery)) {
      score += 60000;
      hasTitleMatch = true;
      matchedReasons.push('In Title');
    }
    // 1.3 Title contains exact query phrase (e.g. "id card" inside "Student ID Card Studio")
    else if (labelNorm.includes(cleanQuery)) {
      score += 40000;
      hasTitleMatch = true;
      matchedReasons.push('In Title');
    }

    // 1.4 Check query tokens in title words
    let allTokensInLabel = queryTokens.length > 0;
    queryTokens.forEach(qTok => {
      let tokInLabel = false;
      for (const lWord of labelWords) {
        const fuzzy = matchTokenFuzzy(qTok, lWord);
        if (fuzzy.isMatch) {
          tokInLabel = true;
          titleHitCount++;
          score += 12000 + fuzzy.score * 50; // ~17,000 per matching title word
          break;
        }
      }
      if (!tokInLabel) allTokensInLabel = false;
    });

    if (allTokensInLabel && queryTokens.length > 1) {
      score += 25000; // Bonus: All query tokens found in title
      hasTitleMatch = true;
      if (!matchedReasons.includes('In Title')) matchedReasons.push('In Title');
    } else if (titleHitCount > 0) {
      hasTitleMatch = true;
      if (!matchedReasons.includes('In Title')) matchedReasons.push('In Title');
    }

    if (hasTitleMatch) anyHit = true;

    // ─────────────────────────────────────────────────────────────────────────
    // TIER 2: BRIEF DESCRIPTION (SECOND PRIORITY: 1,500 - 15,000 points)
    // ─────────────────────────────────────────────────────────────────────────
    let hasDescMatch = false;

    // 2.1 Description contains exact query phrase
    if (descNorm.includes(cleanQuery)) {
      score += 10000;
      hasDescMatch = true;
    }

    // 2.2 Check query tokens in description words
    let allTokensInDesc = queryTokens.length > 0;
    queryTokens.forEach(qTok => {
      let tokInDesc = false;
      for (const dWord of descWords) {
        const fuzzy = matchTokenFuzzy(qTok, dWord);
        if (fuzzy.isMatch) {
          tokInDesc = true;
          descHitCount++;
          score += 2500 + fuzzy.score * 15; // ~4,000 per matching desc word
          break;
        }
      }
      if (!tokInDesc) allTokensInDesc = false;
    });

    if (allTokensInDesc && queryTokens.length > 1) {
      score += 6000;
      hasDescMatch = true;
    } else if (descHitCount > 0) {
      hasDescMatch = true;
    }

    if (hasDescMatch) anyHit = true;

    // ─────────────────────────────────────────────────────────────────────────
    // TIER 3: KEYWORDS & ALIASES (THIRD PRIORITY: 800 - 6,000 points)
    // ─────────────────────────────────────────────────────────────────────────
    let keywordHits = 0;
    allKeywords.forEach(kw => {
      if (kw === cleanQuery) {
        score += 5000;
        keywordHits++;
        matchedReasons.push(kw);
      } else if (kw.includes(cleanQuery)) {
        score += 3500;
        keywordHits++;
        matchedReasons.push(kw);
      } else {
        // Token check
        let kwMatchesToken = false;
        queryTokens.forEach(qTok => {
          const kwWords = kw.split(' ');
          for (const kWord of kwWords) {
            const fuzzy = matchTokenFuzzy(qTok, kWord);
            if (fuzzy.isMatch) {
              score += 1500;
              kwMatchesToken = true;
              break;
            }
          }
        });
        if (kwMatchesToken && keywordHits < 2) {
          keywordHits++;
          matchedReasons.push(kw);
        }
      }
    });

    if (keywordHits > 0) anyHit = true;

    // ─────────────────────────────────────────────────────────────────────────
    // TIER 4: DEEP FIELD STRUCTURE, SETTINGS & CAPABILITIES (800 - 5,000 points)
    // ─────────────────────────────────────────────────────────────────────────
    // 4.1 Search in Form / Student Fields
    itemFields.forEach(field => {
      const fieldNorm = normalizeSearchText(field);
      if (fieldNorm === cleanQuery || fieldNorm.includes(cleanQuery)) {
        score += 4000;
        matchedFieldSet.add(`Field: ${field.split('(')[0].trim()}`);
        anyHit = true;
      } else {
        queryTokens.forEach(qTok => {
          const fWords = fieldNorm.split(' ');
          for (const fWord of fWords) {
            const fuzzy = matchTokenFuzzy(qTok, fWord);
            if (fuzzy.isMatch) {
              score += 1800;
              matchedFieldSet.add(`Field: ${field.split('(')[0].trim()}`);
              anyHit = true;
              break;
            }
          }
        });
      }
    });

    // 4.2 Search in Module Settings & Tools
    itemSettings.forEach(setting => {
      const settingNorm = normalizeSearchText(setting);
      if (settingNorm === cleanQuery || settingNorm.includes(cleanQuery)) {
        score += 4000;
        matchedSettingSet.add(`Setting: ${setting.split('(')[0].trim()}`);
        anyHit = true;
      } else {
        queryTokens.forEach(qTok => {
          const sWords = settingNorm.split(' ');
          for (const sWord of sWords) {
            const fuzzy = matchTokenFuzzy(qTok, sWord);
            if (fuzzy.isMatch) {
              score += 1800;
              matchedSettingSet.add(`Setting: ${setting.split('(')[0].trim()}`);
              anyHit = true;
              break;
            }
          }
        });
      }
    });

    // 4.3 Search in Capabilities
    itemCapabilities.forEach(cap => {
      const capNorm = normalizeSearchText(cap);
      if (capNorm.includes(cleanQuery)) {
        score += 3500;
        anyHit = true;
      } else {
        queryTokens.forEach(qTok => {
          const cWords = capNorm.split(' ');
          for (const cWord of cWords) {
            const fuzzy = matchTokenFuzzy(qTok, cWord);
            if (fuzzy.isMatch) {
              score += 1200;
              anyHit = true;
              break;
            }
          }
        });
      }
    });

    // Add deep matches to matchedReasons
    matchedFieldSet.forEach(f => matchedReasons.push(f));
    matchedSettingSet.forEach(s => matchedReasons.push(s));

    // ─────────────────────────────────────────────────────────────────────────
    // TIER 5: CATEGORY & SEMANTIC THESAURUS BOOST (500 - 1,500 points)
    // ─────────────────────────────────────────────────────────────────────────
    if (catNorm.includes(cleanQuery)) {
      score += 1500;
    }

    allSynonyms.forEach(syn => {
      if (queryTokens.includes(syn)) return;
      if (labelNorm.includes(syn)) {
        score += 1000;
      } else if (allKeywords.some(kw => kw.includes(syn))) {
        score += 600;
      } else if (descNorm.includes(syn)) {
        score += 400;
      }
    });

    // ─────────────────────────────────────────────────────────────────────────
    // MULTI-TERM COVERAGE MULTIPLIER
    // ─────────────────────────────────────────────────────────────────────────
    if (queryTokens.length > 1) {
      const totalHits = titleHitCount + descHitCount + keywordHits + matchedFieldSet.size + matchedSettingSet.size;
      const coverage = totalHits / queryTokens.length;
      if (coverage >= 1) {
        score = Math.round(score * 1.5);
      } else if (coverage >= 0.5) {
        score = Math.round(score * 1.2);
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // QUALIFICATION
    // ─────────────────────────────────────────────────────────────────────────
    if (anyHit && score >= 500) {
      // Deduplicate matched reasons and limit to top 3
      const uniqueReasons = Array.from(new Set(matchedReasons)).slice(0, 3);

      scoredResults.push({
        ...item,
        _searchScore: score,
        _hasTitleMatch: hasTitleMatch,
        _matchedReasons: uniqueReasons,
      });
    }
  });

  // Sort strictly:
  // 1. Items with Title Match first, then by score descending
  scoredResults.sort((a, b) => {
    if (a._hasTitleMatch && !b._hasTitleMatch) return -1;
    if (!a._hasTitleMatch && b._hasTitleMatch) return 1;
    return b._searchScore - a._searchScore;
  });

  return scoredResults;
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. HIGH-PRECISION HIGHLIGHTER (RESPECTS WORD BOUNDARIES)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Splits text into highlighted and plain segments based on search terms.
 * Guarantees that short tokens (e.g. "id", "cms", "dob") only highlight isolated words,
 * never slicing inside unrelated words (e.g. "consolidated", "slideshow", "bonafide").
 */
export function getHighlightedSegments(text, rawQuery) {
  if (!text || !rawQuery || !rawQuery.trim()) {
    return [{ text: text || '', highlight: false }];
  }

  const cleanQuery = normalizeSearchText(rawQuery);
  const queryTokens = cleanQuery.split(' ').filter(Boolean);
  if (queryTokens.length === 0) return [{ text: text || '', highlight: false }];

  // Build patterns with strict word boundaries
  const patterns = [];

  // 1. Full multi-token phrase first (e.g., "\b(id\s+cards?)\b")
  if (queryTokens.length > 1) {
    const escapedPhrase = queryTokens
      .map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('\\s+');
    patterns.push(`\\b${escapedPhrase}s?\\b`);
  }

  // 2. Individual tokens with word boundary guards
  queryTokens.forEach(tok => {
    const escaped = tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (tok.length <= 3) {
      // Short tokens MUST match at word boundaries (e.g. "ID", "DOB", "CMS", "FEE", "TAX")
      // Will NOT match inside "consolidated", "slideshow", "bonafides", "identity"
      patterns.push(`\\b${escaped}s?\\b`);
    } else {
      // Longer tokens: match word boundaries or word beginnings (e.g. "card" -> "card", "cards")
      patterns.push(`\\b${escaped}[a-z]*\\b`);
    }
  });

  const fullRegex = new RegExp(`(${patterns.join('|')})`, 'gi');
  const parts = String(text).split(fullRegex);

  return parts
    .filter(part => part !== undefined && part !== '')
    .map(part => {
      fullRegex.lastIndex = 0;
      return {
        text: part,
        highlight: fullRegex.test(part),
      };
    });
}
