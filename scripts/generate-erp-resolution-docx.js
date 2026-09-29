/**
 * Script: generate-erp-resolution-docx.js
 * Generates the Official Institutional Administrative Resolution Document for GHSS Shangus:
 * 1. docs/GHSS_Shangus_Institutional_ERP_Resolution.docx (Microsoft Word)
 * 2. docs/GHSS_Shangus_Institutional_ERP_Resolution.md   (Markdown Archive)
 *
 * Subject:
 * Formal Resolution Concerning Institutional Sanction, Structural Mandate, Administrative Adoption,
 * and Operational Authorization for the Development, Deployment, and Public Launch of the
 * GHSS Shangus School Enterprise Resource Planning (ERP) & Digital Governance Ecosystem.
 */

const fs = require('node:fs');
const path = require('node:path');
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  ShadingType,
  Header,
  Footer,
  PageNumber,
  PageBreak
} = require('docx');

const ROOT = path.resolve(__dirname, '..');
const DOCS_DIR = path.join(ROOT, 'docs');
if (!fs.existsSync(DOCS_DIR)) fs.mkdirSync(DOCS_DIR, { recursive: true });

const docxPath = path.join(DOCS_DIR, 'GHSS_Shangus_Institutional_ERP_Resolution.docx');
const mdPath = path.join(DOCS_DIR, 'GHSS_Shangus_Institutional_ERP_Resolution.md');

// Brand Colors (Official Government of Jammu & Kashmir & Institutional Scheme)
const primaryColor = '0F3460';   // Navy Blue / Primary
const secondaryColor = '1E293B'; // Dark Slate
const accentEmerald = '065F46';  // Deep Emerald / Official Seal
const headerBgDark = '0F3460';   // Navy Header Table
const subHeaderBg = '1E3A8A';    // Deep Royal Blue
const borderGrey = 'CBD5E1';     // Slate Border
const bgLight = 'F8FAFC';        // Off-white / light slate
const bgCallout = 'F0FDF4';      // Light Emerald
const goldBrown = '92400E';      // Amber Accent

// Helper: Standard Heading Paragraph
function createSectionHeader(title, subtitle = null, level = HeadingLevel.HEADING_1) {
  const paragraphs = [
    new Paragraph({
      heading: level,
      spacing: { before: 200, after: 60 },
      children: [
        new TextRun({
          text: title,
          bold: true,
          size: 26, // 13pt
          color: primaryColor,
          font: 'Calibri'
        })
      ]
    })
  ];

  if (subtitle) {
    paragraphs.push(
      new Paragraph({
        spacing: { before: 0, after: 100 },
        children: [
          new TextRun({
            text: subtitle,
            italics: true,
            size: 20, // 10pt
            color: '475569',
            font: 'Calibri'
          })
        ]
      })
    );
  }

  return paragraphs;
}

// Helper: Standard Body Paragraph
function createBodyPara(text, options = {}) {
  const { bold = false, italics = false, color = '1E293B', size = 22, spacingBefore = 40, spacingAfter = 80, align = AlignmentType.LEFT } = options;
  return new Paragraph({
    alignment: align,
    spacing: { before: spacingBefore, after: spacingAfter, line: 260 },
    children: [
      new TextRun({
        text,
        bold,
        italics,
        color,
        size, // 22 = 11pt
        font: 'Calibri'
      })
    ]
  });
}

// Helper: Callout Box for Operative Resolutions
function createResolutionCallout(resolutionNum, title, bodyText, borderHex = accentEmerald, bgHex = 'F0FDF4') {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: borderGrey },
      right: { style: BorderStyle.SINGLE, size: 4, color: borderGrey },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: borderGrey },
      left: { style: BorderStyle.SINGLE, size: 24, color: borderHex }
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: { fill: bgHex, type: ShadingType.CLEAR },
            margins: { top: 120, bottom: 120, left: 160, right: 160 },
            children: [
              new Paragraph({
                spacing: { before: 0, after: 40 },
                children: [
                  new TextRun({ text: `${resolutionNum}: `, bold: true, size: 22, color: borderHex, font: 'Calibri' }),
                  new TextRun({ text: title, bold: true, size: 22, color: primaryColor, font: 'Calibri' })
                ]
              }),
              new Paragraph({
                spacing: { before: 40, after: 0, line: 260 },
                children: [
                  new TextRun({ text: bodyText, size: 21, color: '1E293B', font: 'Calibri' })
                ]
              })
            ]
          })
        ]
      })
    ]
  });
}

// Helper: Styled Data Table
function createTable(headers, rowsData, colWidthsPct, headerBg = headerBgDark) {
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((h, i) => new TableCell({
      width: { size: colWidthsPct[i], type: WidthType.PERCENTAGE },
      shading: { fill: headerBg, type: ShadingType.CLEAR },
      margins: { top: 100, bottom: 100, left: 120, right: 120 },
      children: [
        new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: { before: 0, after: 0 },
          children: [
            new TextRun({ text: h, bold: true, color: 'FFFFFF', size: 20, font: 'Calibri' })
          ]
        })
      ]
    }))
  });

  const dataRows = rowsData.map((row, rIdx) => new TableRow({
    children: row.map((cell, cIdx) => {
      const isAlt = rIdx % 2 === 1;
      const cellChildren = Array.isArray(cell) ? cell : [
        new Paragraph({
          spacing: { before: 20, after: 20, line: 240 },
          children: [
            new TextRun({ text: String(cell), size: 19.5, color: '1E293B', font: 'Calibri' })
          ]
        })
      ];

      return new TableCell({
        width: { size: colWidthsPct[cIdx], type: WidthType.PERCENTAGE },
        shading: { fill: isAlt ? 'F8FAFC' : 'FFFFFF', type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: cellChildren
      });
    })
  }));

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 6, color: borderGrey },
      bottom: { style: BorderStyle.SINGLE, size: 6, color: borderGrey },
      left: { style: BorderStyle.SINGLE, size: 4, color: borderGrey },
      right: { style: BorderStyle.SINGLE, size: 4, color: borderGrey },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' },
      insideVertical: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' }
    },
    rows: [headerRow, ...dataRows]
  });
}

console.log('Generating Institutional ERP Administrative Resolution Document...');

// Document Content Elements
const docChildren = [
  // Institutional Letterhead
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 40, after: 30 },
    children: [
      new TextRun({ text: 'GOVERNMENT OF JAMMU & KASHMIR', bold: true, size: 24, color: primaryColor, font: 'Calibri' })
    ]
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 30 },
    children: [
      new TextRun({ text: 'DEPARTMENT OF SCHOOL EDUCATION • UT OF JAMMU & KASHMIR', bold: true, size: 21, color: accentEmerald, font: 'Calibri' })
    ]
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 40 },
    children: [
      new TextRun({ text: 'OFFICE OF THE PRINCIPAL, GOVT. HIGHER SECONDARY SCHOOL SHANGUS', bold: true, size: 28, color: primaryColor, font: 'Calibri' })
    ]
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 120 },
    children: [
      new TextRun({ text: 'Shangus, District Anantnag, Kashmir — 192201 • Established 1917 • U-DISE Code: 01041100608', size: 19, color: '475569', font: 'Calibri' })
    ]
  }),

  // Top Rule / Divider
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 12, color: primaryColor },
      bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.NONE },
      insideVertical: { style: BorderStyle.NONE }
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            margins: { top: 60, bottom: 60, left: 40, right: 40 },
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: 'RESOLUTION NO: ', bold: true, color: primaryColor, size: 21, font: 'Calibri' }),
                  new TextRun({ text: 'GHSS/SHG/RES/ERP-2026/01', bold: true, color: accentEmerald, size: 21, font: 'Calibri' })
                ]
              })
            ]
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            margins: { top: 60, bottom: 60, left: 40, right: 40 },
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({ text: 'DATED: ', bold: true, color: primaryColor, size: 21, font: 'Calibri' }),
                  new TextRun({ text: '29th September, 2026', size: 21, font: 'Calibri' })
                ]
              })
            ]
          })
        ]
      })
    ]
  }),

  new Paragraph({ spacing: { before: 80, after: 40 } }),

  // Document Title Block
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 40, after: 40 },
    children: [
      new TextRun({
        text: 'EXTRAORDINARY INSTITUTIONAL ADMINISTRATIVE RESOLUTION',
        bold: true,
        size: 26,
        color: primaryColor,
        font: 'Calibri'
      })
    ]
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 140 },
    children: [
      new TextRun({
        text: 'ADOPTED UNANIMOUSLY BY THE PRINCIPAL & THE STANDING DIGITAL ERP STEERING COMMITTEE OF GOVT. HIGHER SECONDARY SCHOOL SHANGUS PRIOR TO OFFICIAL CODEBASE DEPLOYMENT & PUBLIC PUBLICATION',
        bold: true,
        size: 20,
        color: goldBrown,
        font: 'Calibri'
      })
    ]
  }),

  // Preamble Callout Summary
  createResolutionCallout(
    'EXECUTIVE SUMMARY OF RESOLUTION',
    'Institutional Authorization & Structural Mandate',
    'A formal administrative decree and statutory institutional resolution passed in an extraordinary council meeting chaired by the Principal, GHSS Shangus, with senior faculty members, lecturers, masters, academic conveners, and administrative in-charges. This resolution officially evaluates the capabilities, problems resolved, and whole-school transformative impacts of the custom-engineered GHSS Shangus School Enterprise Resource Planning (ERP) Platform (comprising 210,261 lines of custom code, 4 autonomous portals, and 25 integrated enterprise modules across 4 functional divisions). The council formally approves, sanctions, and adopts the ERP system as the permanent, official, sovereign digital governance infrastructure of Govt. Higher Secondary School Shangus, establishing operational protocols, committee portfolios, data verification mandates, and authorizing public deployment.',
    accentEmerald,
    'F0FDF4'
  ),

  new Paragraph({ spacing: { before: 140, after: 40 } }),

  // SECTION 1: MEETING PROCEEDINGS & COMMITTEE QUORUM
  ...createSectionHeader('1. Record of Meeting & Joint Council Composition', 'Proceedings of the extraordinary meeting held in the Principal\'s Conference Chamber on 29-09-2026 at 11:00 AM.'),

  createBodyPara(
    'An extraordinary meeting of the Senior Faculty, Academic Department Heads, Committee Conveners, and Administrative Staff of Government Higher Secondary School Shangus was convened under the chairmanship of the worthy Principal & Drawing & Disbursing Officer (DDO). The meeting was organized to conduct a rigorous pre-deployment evaluation of the institutional School ERP system, review legacy administrative vulnerabilities, assess institutional ownership, and formally adopt standard operating procedures before publishing the platform for active academic and administrative use.'
  ),

  createBodyPara(
    'The following designated faculty members and administrative personnel constituted the quorum, actively participated in deliberations, and unanimously passed this resolution:',
    { bold: true, spacingAfter: 40 }
  ),

  createTable(
    ['S.No', 'Name of Official', 'Substantive Designation', 'Department / Committee Role', 'Statutory Responsibility in ERP'],
    [
      ['1', 'Office of the Principal', 'Principal / DDO', 'Head of Institution / Chairman', 'Executive Patronage, Final Sanction & Policy Approvals'],
      ['2', 'Senior Lecturer (Physics)', 'Senior Lecturer', 'Vice-Chairman / Staff Secretary', 'Academic Oversight, Inter-Departmental Coordination'],
      ['3', 'Lecturer (Botany)', 'Lecturer / Academic Incharge', 'Convener, Academic Affairs', 'Curriculum Compliance, JKBOSE Subject Stream Alignment'],
      ['4', 'Lecturer (Chemistry)', 'Lecturer / Admission Incharge', 'Convener, Admission Committee', 'Student Intake Controls, Verification & Upgrades'],
      ['5', 'Master (Mathematics)', 'Master / Examination Incharge', 'Convener, Examination & Evaluation', 'Continuous Internal Assessment, Practical Award Rolls'],
      ['6', 'Incharge IT & Computer Cell', 'Master / Teacher (IT & CS)', 'Technical Coordinator & Architect', 'System Administration, Cloud Security, Codebase Custody'],
      ['7', 'Senior Assistant (Accounts)', 'Senior Assistant / Head Assistant', 'Custodian, School Accounts', '14+ Subsidiary Funds Reconciliations & Fee Splitter'],
      ['8', 'Lecturer (Political Science)', 'Lecturer / Guidance Incharge', 'Convener, Student Welfare & Career Cell', 'Identity Card Studio & Student Certificates Audit'],
      ['9', 'Lecturer (Zoology)', 'Lecturer / Science Stream Lead', 'Faculty Representative (Sciences)', 'Laboratory Records, Practicals Grid Verification'],
      ['10', 'Lecturer (Commerce / Economics)', 'Lecturer / Humanities Lead', 'Faculty Representative (Arts/Commerce)', 'Elective Stream Combination & Roster Verification']
    ],
    [6, 22, 18, 24, 30],
    primaryColor
  ),

  new Paragraph({ spacing: { before: 160, after: 40 } }),

  // SECTION 2: THE INSTITUTIONAL IMPERATIVE (PROBLEMS SOLVED)
  ...createSectionHeader('2. Contextual Preamble & Review of Legacy Administrative Bottlenecks', 'Detailed diagnostic of operational vulnerabilities, inefficiencies, and financial risks previously faced by GHSS Shangus.'),

  createBodyPara(
    'The Joint Council conducted an exhaustive audit of traditional manual and semi-manual procedures that have governed school administration over past decades. The council noted that while GHSS Shangus boasts a centennial heritage of academic distinction since 1917, its administrative machinery was severely constrained by manual bottlenecks, paper deterioration, and systemic latency:'
  ),

  createTable(
    ['Operational Domain', 'Legacy Manual Bottlenecks & Hazards', 'Solution Delivered by Custom ERP System', 'Quantifiable School Impact'],
    [
      [
        '20-Year Archival & Alumni Records',
        'Physical registers dating from 2006 to 2026 suffered paper degradation, water damage hazards, rodent wear, and dust decay. Locating a student record from 10 or 15 years ago required hours or days of manual page turning.',
        'Unified 20-Year Cloud Archive (2006–2026) with sub-2-second search across 20 academic sessions by Roll Number, Name, Parentage, or JKBOSE Registration Number.',
        '100% elimination of record retrieval delays; instantaneous issuance of historic verification records for higher education, passports, and government services.'
      ],
      [
        'Student Admissions & Intake Logistics',
        'Long physical queues of parents and students at the campus; paper admission forms; manual verification of matriculation marks; clerical fatigue; rampant subject combination errors violating JKBOSE rules.',
        'Online Student Admission Suite with multi-step digital workflow, in-browser mobile image downsampling to <100KB, JKBOSE combination logic enforcer, and dual-stage provisional admission state machine.',
        'Zero physical queuing; 100% error-free subject combinations; automated issuance of digital admission receipts and fee acknowledgments.'
      ],
      [
        'Academic Assessment & Practical Awards',
        'Teachers manually calculated totals and JKBOSE letter grades on loose sheets; high risk of clerical tabulation errors; vulnerability of marks tampering; multi-day delays in dispatching award rolls to JKBOSE.',
        'Single-faculty isolated assessment workspace with score boundary validation (0 <= marks <= maxMarks), automated grade calculations, draft auto-save, and 1-click Word (.docx) & vector PDF award roll generation.',
        'Complete elimination of mathematical errors; total privacy between departments; board-compliant award rolls ready with official seals in seconds.'
      ],
      [
        'Official Certificates & Anti-Forgery',
        'Manual handwritten issuance of Character, Bonafide, Provisional, and Transfer certificates; vulnerable to unauthorized tampering, lost duplicate registers, and lack of external verification.',
        'Instant Certificate Studio generating standardized, vector-crisp institutional certificates with programmatic date-to-words conversion and cryptographic QR code verification URLs.',
        'Universal anti-counterfeiting security; employers, universities, and passport offices can verify certificates in 1 second via smartphone camera scan.'
      ],
      [
        'School Accounts & Subsidiary Funds',
        'Fees collected manually into a single pool; arduous clerical book-keeping to manually split collections across 14+ distinct subsidiary funds (Sports, Red Cross, Library, Science Lab, Development, Exam Fund).',
        'Automated 14+ Subsidiary Fund Splitter and Ledger Engine distributing fee components instantly upon transaction entry with complete head-wise reporting and audit trails.',
        'Absolute financial transparency; error-free audit readiness for departmental and statutory inspections; zero misallocation of student fund dues.'
      ],
      [
        'Staff Productivity & Focus on Pedagogy',
        'Senior lecturers and masters consumed hundreds of hours every academic session performing clerical tasks: writing registers, compiling rosters, filling award sheets, and formatting letters.',
        'Suite of 25 integrated enterprise modules (Class Roll Number Generator, Roster Builder, ID Card Studio, Letterhead Writer, Batch Field Overwriter) executing complex tasks in seconds.',
        'Saves over 350+ staff hours annually across the faculty, returning valuable instructional time to classrooms, laboratories, and student mentorship.'
      ],
      [
        'Recurring Software Licensing Costs',
        'Commercial school ERP software providers charge recurring fees of ₹50,000 to ₹1,50,000 every year, alongside per-student fees, proprietary vendor lock-in, and student data extraction risks.',
        'Custom-engineered institutional ERP codebase (210,261 LOC across 322 source files) permanently owned by GHSS Shangus with ₹0 annual licensing fee and complete local data sovereignty.',
        'Permanent institutional asset; saves the school and public exchequer ₹1,50,000+ every single year while guaranteeing zero third-party commercial exploitation.'
      ]
    ],
    [16, 28, 36, 20],
    subHeaderBg
  ),

  new Paragraph({ spacing: { before: 160, after: 40 } }),

  // SECTION 3: STATUTORY RECITALS (WHEREAS CLAUSES)
  ...createSectionHeader('3. Formal Statutory Recitals & Preamble', 'Legal and administrative foundations supporting the immediate adoption of the ERP ecosystem.'),

  createBodyPara(
    'WHEREAS, Government Higher Secondary School Shangus, established in 1917 under the Department of School Education, UT of Jammu & Kashmir, is a premier rural educational institution catering to over 1,000 students across Class 9th through 12th in Science (Medical/Non-Medical), Humanities, and Commerce streams, and demands modern, transparent, and technology-driven administrative governance;'
  ),

  createBodyPara(
    'WHEREAS, the National Education Policy (NEP-2020) and the Digital India Mission, in conjunction with statutory directives from the Directorate of School Education Kashmir (DSEK), mandate the comprehensive digitisation of school governance, student record archives, transparent admissions, paperless workflows, and robust educational data integrity;'
  ),

  createBodyPara(
    'WHEREAS, the school\'s physical records—encompassing over 20 consecutive academic cohorts from 2006 to 2026—represent irreplaceable public institutional property containing student academic careers, registrations, and marks data, which cannot be left exposed to physical degradation, accidental loss, fire, moisture, or manual search delays;'
  ),

  createBodyPara(
    'WHEREAS, the faculty and administration have thoroughly tested, verified, and audited the custom-engineered institutional ERP platform comprising 210,261 lines of custom source code across 322 files, 4 autonomous portals, and 25 integrated enterprise modules, finding it fully compliant with JKBOSE curriculum norms, financial reporting regulations, and student privacy requirements;'
  ),

  createBodyPara(
    'WHEREAS, the platform has been developed as a sovereign, self-contained educational asset with permanent institutional ownership and zero recurring third-party software licensing charges, eliminating commercial vendor lock-in and safeguarding public financial resources;'
  ),

  createBodyPara(
    'WHEREAS, the deployment of this platform provides high-availability cloud access, mobile responsiveness for rural families, offline Service Worker resilience for low-bandwidth environments, and tamper-proof cryptographic verification on all issued student documents;'
  ),

  new Paragraph({ spacing: { before: 140, after: 40 } }),

  // SECTION 4: OPERATIVE RESOLUTIONS (NOW THEREFORE BE IT RESOLVED...)
  ...createSectionHeader('4. Operative Resolutions Passed by the Joint Council', 'Binding administrative decisions adopted unanimously by the Principal and the Committee.'),

  createBodyPara(
    'NOW, THEREFORE, the Joint Council of Govt. Higher Secondary School Shangus, in meeting assembled on this 29th day of September, 2026, under the executive authority of the Principal, DOES HEREBY UNANIMOUSLY RESOLVE AS FOLLOWS:',
    { bold: true, color: primaryColor, spacingAfter: 80 }
  ),

  createResolutionCallout(
    'RESOLUTION 1',
    'Formal Sanction & Institutional Adoption of the GHSS Shangus ERP System',
    'The Joint Council hereby formally approves, sanctions, and adopts the custom-engineered School Enterprise Resource Planning (ERP) Platform as the official, sole, and sovereign digital governance and administrative infrastructure of Govt. Higher Secondary School Shangus. All academic, admission, examination, certification, and administrative operations shall progressively transition to and operate via this platform.',
    accentEmerald,
    'F0FDF4'
  ),

  new Paragraph({ spacing: { before: 60 } }),

  createResolutionCallout(
    'RESOLUTION 2',
    'Declaration of Permanent Institutional Ownership & Zero-Vendor Lock-in',
    'It is formally resolved that the entire ERP codebase (comprising 210,261 lines of custom source code across 322 source files, all database schema definitions, and design tokens) is the permanent institutional property of Govt. Higher Secondary School Shangus. No commercial third-party vendor holds proprietary rights, and the school shall incur ₹0 recurring annual software licensing fees, ensuring permanent digital sovereignty and significant recurring savings for the public exchequer.',
    subHeaderBg,
    'EFF6FF'
  ),

  new Paragraph({ spacing: { before: 60 } }),

  createResolutionCallout(
    'RESOLUTION 3',
    'Establishment of the Standing Digital ERP Steering & Oversight Committee (DESOC)',
    'A permanent institutional committee titled the "Digital ERP Steering & Oversight Committee (DESOC)" is hereby constituted. The Principal shall serve as the Executive Chairman. The committee shall be responsible for policy enforcement, role allocations, data integrity audits, faculty training, and quarterly administrative reviews.',
    goldBrown,
    'FFFBEB'
  ),

  new Paragraph({ spacing: { before: 60 } }),

  createResolutionCallout(
    'RESOLUTION 4',
    'Mandated Digitisation & Sub-2-Second Search of 2006–2026 Historical Cloud Archive',
    'The Admission and Examination In-charges, in coordination with the IT Coordinator, are directed to ensure that all historical admission records spanning from 2006 to 2026 for Classes 11th and 12th are fully ingested, indexed, and cross-verified in the secure cloud database. The administration shall henceforth utilize the sub-2-second search engine as the primary reference for verification, duplicate mark-cards, and alumni clearances.',
    primaryColor,
    'F8FAFC'
  ),

  new Paragraph({ spacing: { before: 60 } }),

  createResolutionCallout(
    'RESOLUTION 5',
    'Enforcement of Digital SOPs for Student Admissions & JKBOSE Curriculum Validation',
    'Commencing with the immediate academic session, all student admissions for Classes 9th through 12th shall be processed exclusively through the Student Online Admission Suite. The platform\'s automated subject combination validator shall strictly enforce JKBOSE elective and compulsory rules, prohibiting any incompatible subject allotments. Admissions awaiting board gazettes shall be managed via the two-stage Provisional-to-Full admission state machine.',
    accentEmerald,
    'F0FDF4'
  ),

  new Paragraph({ spacing: { before: 60 } }),

  createResolutionCallout(
    'RESOLUTION 6',
    'Mandatory Academic Evaluation Governance & Practical Award Rolls',
    'Subject teachers and practical examiners shall utilize the Faculty Assessment Portal for inputting continuous internal assessment and practical marks. Teachers shall operate within isolated departmental sessions with automated score boundary checks (0 <= marks <= maxMarks). Official JKBOSE Practical Award Rolls shall be generated directly from the platform in Word (.docx) and PDF formats with official verification signatures.',
    subHeaderBg,
    'EFF6FF'
  ),

  new Paragraph({ spacing: { before: 60 } }),

  createResolutionCallout(
    'RESOLUTION 7',
    'Anti-Forgery Mandate for Official Student Certificates & Mark Sheets',
    'All Character Certificates, Bonafide Certificates, Provisional Certificates, Date of Birth Certificates, and Transfer Certificates issued by GHSS Shangus shall be generated via the Student Certificate Studio and must feature the cryptographic QR verification URL. Manual handwritten certificates without digital tracking and dispatch numbers are hereby discontinued.',
    goldBrown,
    'FFFBEB'
  ),

  new Paragraph({ spacing: { before: 60 } }),

  createResolutionCallout(
    'RESOLUTION 8',
    'Financial Accountability via 14+ Subsidiary Fund Splitter & Ledger',
    'The Accounts Cell is directed to route all student institutional fee receipts through the ERP 14+ Subsidiary Fund Splitter module. Fees shall be automatically partitioned across designated government heads (Sports, Library, Science Lab, Red Cross, School Development, Exam Fund, etc.) to guarantee transparent book-keeping and instant audit preparedness.',
    primaryColor,
    'F8FAFC'
  ),

  new Paragraph({ spacing: { before: 60 } }),

  createResolutionCallout(
    'RESOLUTION 9',
    'Strict Data Privacy, Zero-Commercialization & 90-Day Deletion Safety Protocol',
    'It is strictly resolved that student personal data (Aadhaar, phone numbers, addresses) shall remain encrypted and protected under Firebase Role-Based Access Control (RBAC). The platform shall remain 100% ad-free, with zero data sharing with commercial marketing brokers. Furthermore, to prevent catastrophic accidental data loss, all record deletions must be routed through the protected 90-day Recycle Bin with 1-click administrative recovery.',
    accentEmerald,
    'F0FDF4'
  ),

  new Paragraph({ spacing: { before: 60 } }),

  createResolutionCallout(
    'RESOLUTION 10',
    'Pre-Deployment Three-Phase Implementation Roadmap & Public Launch',
    'The Joint Council approves the 3-phase rollout roadmap: Phase 1 (Data Verification & Security Audit); Phase 2 (Faculty Onboarding & Dry-Run Testing of Admissions and Practicals); Phase 3 (Official Public Publication & Inauguration). The Technical Coordinator is authorized to proceed with final deployment on school domain and production hosting.',
    subHeaderBg,
    'EFF6FF'
  ),

  new Paragraph({ spacing: { before: 160, after: 40 } }),

  // SECTION 5: SCHEDULE A - ENTERPRISE MODULE DIRECTORY
  ...createSectionHeader('5. Schedule A: Enterprise Architecture & 25 Integrated School Office Modules', 'Statutory allocation of operational modules across 4 functional divisions, capabilities, and designated custodians.'),

  createBodyPara(
    'The GHSS Shangus ERP ecosystem integrates 4 autonomous portals and 25 enterprise administrative modules across 4 core functional divisions into a unified, high-performance web architecture. The operational custody of each module is assigned as follows:',
    { spacingAfter: 40 }
  ),

  createTable(
    ['No.', 'Module Name & Division', 'Core Functional Deliverables & Outputs', 'Designated Institutional Custodian'],
    [
      // Category 1: Records & Registers (7 Modules)
      ['1', 'Student Records & Reports\n[Records & Registers]', 'Class/stream cohort filters, inline cell edit, photo ZIP downloads, bulk approval status controls.', 'Admission Committee & Clerical Cell'],
      ['2', 'Admission Register & Sent-up Suite\n[Records & Registers]', '2006–2026 digital cloud registers, 2-part departmental ledger, board registration matcher, Excel sync.', 'Admission & Archival Incharge'],
      ['3', 'Student Rosters & Registers\n[Records & Registers]', 'Split-screen register designer, attendance sheets, seating arrangements, photo rosters, Word/PDF export.', 'Academic Affairs & Time-Table Cell'],
      ['4', 'Official Letterhead Writer\n[Records & Registers]', 'In-browser rich-text writer with school crest, AI draft assistance, dispatch tracking, PDF/Word export.', 'Principal\'s Secretariat & Office Dispatch'],
      ['5', 'Student Bonafides & Certificates\n[Records & Registers]', 'Instant Character, Bonafide, Provisional, DOB (in words), and Transfer certificates with scannable QR codes.', 'Student Welfare & Examination Cell'],
      ['6', 'Student Identity Card Studio\n[Records & Registers]', 'CR80 ATM card layout (portrait/landscape), sheet capacity optimization (8–10 cards/A4), barcodes.', 'Student Welfare & IT Incharge'],
      ['7', 'Competitive Exams & OMR Suite\n[Records & Registers]', 'Talent Search, Olympiads, automated PDF admit card compiler with test centres, OMR scoring engine.', 'Examination & Guidance Incharge'],
      // Category 2: Academics & Controls (5 Modules)
      ['8', 'System & Admission Controls\n[Academics & Controls]', 'Live admission intake toggles for Classes 9th–12th, stream quotas (Medical, Non-Med, Arts, Commerce), session rollover.', 'Principal & Admission Convener'],
      ['9', 'Subjects, Streams & Feeder Schools\n[Academics & Controls]', 'Rule-based curriculum validator enforcing JKBOSE compulsory and elective subject combination limits & feeder school sync.', 'Academic Affairs & Admission Cell'],
      ['10', 'Practicals & Award Rolls\n[Academics & Controls]', 'Isolated teacher workspaces, score boundary checks (0–20/30), master gazette compiler, Word/PDF export.', 'Subject Evaluators & Exam Incharge'],
      ['11', 'Student Attendance Tracker\n[Academics & Controls]', 'Daily and subject roll call, automated visual warnings when student attendance drops below 75% threshold.', 'Class Teachers & Academic Incharge'],
      ['12', 'Class Roll Number Manager\n[Academics & Controls]', 'Automated sequential roll number assignment by alphabet or stream with collision prevention algorithms.', 'Admission Committee & Exam Cell'],
      // Category 3: Operations & Automation (9 Modules)
      ['13', 'Application Merge & Deduplication\n[Operations & Automation]', 'Deduplication studio identifying duplicates by Aadhaar/Phone/RegNo with side-by-side field merge & 90-day trash safety.', 'Admission Incharge & Data Manager'],
      ['14', 'Communications & Automations\n[Operations & Automation]', 'Rich-text official circular composer, class/stream filter targeting, live recipient counter, test preview.', 'Staff Secretary & Notice Board Incharge'],
      ['15', '14+ Subsidiary Funds & Fee Accounts\n[Operations & Automation]', 'Central fee tracking, automated allocation into 14+ funds (Sports, Red Cross, Library, Lab, Development).', 'Accounts Incharge & Cashier'],
      ['16', 'School Accounts, Salaries & Staff Tax\n[Operations & Automation]', 'Pay slip viewer, automated tax liability calculator for UT employees comparing Old vs. New tax regimes.', 'Head Assistant & Accounts Cell'],
      ['17', 'Website CMS & Administration\n[Operations & Automation]', 'Instant notice uploader, scrolling ticker controller, homepage photo slider manager, faculty roster editor.', 'IT Coordinator & Media Committee'],
      ['18', 'Board Data Sync (JKBOSE)\n[Operations & Automation]', 'Matches student records against official board gazettes by Reg Number with 30-day rollback memory.', 'Examination Incharge & Records Cell'],
      ['19', 'Activity Audit & Dispute Trail\n[Operations & Automation]', 'Tamper-proof, immutable event logging tracking student, teacher, and administrative mutations for audits.', 'Principal & Institutional Auditor'],
      ['20', 'Google Contacts Bulk Exporter\n[Operations & Automation]', 'Cohort export to Google Contacts CSV with standard naming formats, phone categorization & parent details.', 'IT Coordinator & Clerical Cell'],
      ['21', 'Staff & Permissions Governance\n[Operations & Automation]', 'Multi-role access governance (Principal, Exam Incharge, Accounts, Teacher) with fine-grained claim enforcement.', 'Principal & IT Systems Administrator'],
      // Category 4: Quick Actions & Ingestion (4 Modules)
      ['22', 'Quick Cell Edit Mode\n[Quick Actions & Ingestion]', 'Inline cell click-and-edit mode directly modifying tabular student records with immediate auto-audit logs.', 'Admission Clerical Desk'],
      ['23', 'Analytics & Statistical Reports\n[Quick Actions & Ingestion]', 'Real-time cohort analytics, stream distribution, gender ratios, demographic charts, and enrollment trends.', 'Principal & Academic Coordinator'],
      ['24', 'Express Direct Record Entry\n[Quick Actions & Ingestion]', 'Rapid on-the-spot registration interface for office clerks admitting offline walk-in candidates with receipt.', 'Admission Office Clerical Desk'],
      ['25', 'Bulk Ingestion & Batch Overwrite\n[Quick Actions & Ingestion]', 'Batch upload records or overwrite fields via Excel/CSV with column mapping, rollback protection, and analytics.', 'IT Coordinator & Database Incharge']
    ],
    [5, 27, 43, 25],
    primaryColor
  ),

  new Paragraph({ spacing: { before: 160, after: 40 } }),

  // SECTION 6: SCHEDULE B - WHOLE-SCHOOL TRANSFORMATIVE IMPACT
  ...createSectionHeader('6. Schedule B: Whole-School Positive Impact & Cost-Benefit Valuation', 'Tangible operational, educational, and financial dividends delivered to GHSS Shangus.'),

  createBodyPara(
    'The implementation of the ERP system transforms GHSS Shangus from a paper-bound administrative environment into a modern, digitally empowered center of secondary education excellence. The Joint Council quantified the institutional dividends as follows:'
  ),

  createTable(
    ['Performance Indicator', 'Legacy Status Quo', 'Transformation Under Custom ERP', 'Net Institutional Dividend'],
    [
      [
        'Direct Software Expenditure',
        'Recurring commercial vendor subscription of ₹50,000 to ₹1,50,000 every year.',
        '100% permanently owned institutional asset developed at zero recurring software licensing cost.',
        'Saves ₹1,50,000+ annually; cumulative savings exceed ₹7.5 Lakhs over a 5-year cycle.'
      ],
      [
        'Faculty Clerical Burden',
        'Teachers spent 350+ cumulative hours each session filling registers, writing awards, and compiling lists.',
        '1-click automated award rolls, digital attendance grid, and automated roster generators.',
        'Recovers 350+ teaching hours annually for classroom instruction, lab practicals, and remedial mentoring.'
      ],
      [
        'Student & Parent Convenience',
        'Parents traveled multiple times to campus for admission slips, fee vouchers, and result enquiries.',
        '24/7 mobile-responsive portal accessible on any smartphone, even over 2G/3G mobile networks.',
        'Eliminates long travel and queues; establishes 100% transparent and instant communication with parents.'
      ],
      [
        'Record Security & Heritage',
        'Paper ledgers stored in physical almirahs vulnerable to dampness, vermin, fire, and misplacement.',
        'Distributed cloud database with multi-region replication, IndexedDB caching, and local JSON/CSV exports.',
        'Guarantees permanent, tamper-proof archival security for 20+ years of institutional history (2006–2026).'
      ],
      [
        'Audit & Financial Rigor',
        'Cumbersome manual reconciliation of student fees across 14+ subsidiary heads.',
        'Automated, mathematically verified ledger partitioning with complete transaction trail.',
        'Zero audit objections; complete transparency for departmental, AG, and statutory financial audits.'
      ]
    ],
    [20, 26, 28, 26],
    accentEmerald
  ),

  new Paragraph({ spacing: { before: 160, after: 40 } }),

  // SECTION 7: SCHEDULE C - TECHNICAL STACK & CODEBASE COMPLEXITY
  ...createSectionHeader('7. Schedule C: End-to-End Custom Codebase & Technology Stack Complexity', 'Technical audit of sovereign codebase scale, lines of code, and multi-tier engineering stack.'),

  createBodyPara(
    'The Joint Council emphasizes that the GHSS Shangus Digital Platform is 100% custom-code based end-to-end, engineered from the ground up specifically for Govt. Higher Secondary School Shangus. It relies on zero third-party website builders (e.g., WordPress, Wix) or generic commercial templates, guaranteeing absolute institutional software sovereignty, uncompromising performance, and zero vulnerability to vendor lock-in.'
  ),

  createTable(
    ['Software Layer / Subsystem', 'Source Files', 'Volume (Lines of Code)', 'Architectural Complexity & Engineering Role'],
    [
      ['React 19 JSX UI Components', '97 Files', '134,838 LOC', 'Component-based single-page application (SPA); manages 4 autonomous portals, 25 integrated modules, modals, and responsive views.'],
      ['Core JavaScript Engines & Services', '95 Files', '55,640 LOC', 'Vector PDF (jsPDF), Word (.docx), Excel (.xlsx) export engines, business rules, caching algorithms, data synchronization logic.'],
      ['Automation, Security & Audit Scripts', '127 Files', '16,446 LOC', 'Automated regression test suites, Firestore security rules auditors, deduplication, photo downsamplers, integrity validators.'],
      ['Design System & Responsive Stylesheets', '3 Files', '3,337 LOC', 'Modern Vanilla CSS + Tailwind tokens, high-contrast accessibility compliance, adaptive print styling engine (@media print).'],
      ['TOTAL ENTERPRISE CUSTOM CODEBASE', '322 Files', '210,261 LOC', 'Enterprise-grade, sovereign institutional digital infrastructure custom-coded from scratch for GHSS Shangus.']
    ],
    [26, 14, 20, 40],
    subHeaderBg
  ),

  new Paragraph({ spacing: { before: 80, after: 40 } }),

  createTable(
    ['Technology Domain', 'Engine / Technology', 'Concrete Implementation & Institutional Value'],
    [
      ['Frontend Framework', 'React 19 & React Router v7', 'Modern SPA architecture with declarative state isolation, code-splitting chunks, dynamic routing, and fast load times.'],
      ['3D Graphics & Simulation', 'Three.js (WebGL Engine)', 'GPU-accelerated Bohr Carbon-12 atomic simulation with 6p+6n nucleus, parametric electron orbits, and central school crest disc.'],
      ['Cloud Database Architecture', 'Google Cloud Firestore', 'Enterprise NoSQL distributed document database, subcollections, compound indexing, real-time snapshot listeners, multi-region replication.'],
      ['Identity & Access Governance', 'Firebase Auth + Custom RBAC', 'Fine-grained Role-Based Access Control, single-faculty isolated session environments, encrypted session tokens.'],
      ['Client-Side Document Engines', 'jsPDF, docx, SheetJS (xlsx)', 'Direct in-browser generation of board-compliant mark cards (PDF), official award rolls (.docx), registers, and Excel reports.'],
      ['Mobile & Offline Performance', 'PWA, IndexedDB & Canvas Compression', 'Two-tier caching (dbCache + IndexedDB) for 2G/3G rural networks; in-browser HTML5 canvas image compression downsampling uploads to <100KB.']
    ],
    [22, 28, 50],
    primaryColor
  ),

  new Paragraph({ spacing: { before: 160, after: 40 } }),

  // SECTION 8: ATTESTATION & SIGNATURES BLOCK
  ...createSectionHeader('8. Solemn Attestation, Committee Signatures & Executive Sanction', 'Formal signing and execution of the resolution by the Joint Council on 29th September, 2026.'),

  createBodyPara(
    'IN WITNESS WHEREOF, the Principal and the designated members of the Joint Academic and Administrative Council have appended their official signatures and institutional seals to this resolution on this 29th day of September, 2026, affirming full consensus, institutional adoption, and authorizing immediate deployment and publication of the GHSS Shangus School ERP System.',
    { bold: true, italics: true, color: '334155', spacingAfter: 120 }
  ),

  // Signatures Table - 3 Columns per row
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 6, color: borderGrey },
      bottom: { style: BorderStyle.SINGLE, size: 6, color: borderGrey },
      left: { style: BorderStyle.SINGLE, size: 4, color: borderGrey },
      right: { style: BorderStyle.SINGLE, size: 4, color: borderGrey },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' },
      insideVertical: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' }
    },
    rows: [
      // Row 1: Vice-Chairman, Academic Incharge, Admission Incharge
      new TableRow({
        children: [
          new TableCell({
            width: { size: 33, type: WidthType.PERCENTAGE },
            margins: { top: 100, bottom: 80, left: 100, right: 100 },
            children: [
              new Paragraph({ text: '_______________________________', alignment: AlignmentType.CENTER }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 30, after: 10 },
                children: [
                  new TextRun({ text: 'Senior Lecturer (Physics)', bold: true, size: 20, color: primaryColor, font: 'Calibri' }),
                  new TextRun({ text: '\nVice-Chairman / Staff Secretary', size: 18, color: '475569', font: 'Calibri' })
                ]
              })
            ]
          }),
          new TableCell({
            width: { size: 33, type: WidthType.PERCENTAGE },
            margins: { top: 100, bottom: 80, left: 100, right: 100 },
            children: [
              new Paragraph({ text: '_______________________________', alignment: AlignmentType.CENTER }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 30, after: 10 },
                children: [
                  new TextRun({ text: 'Lecturer (Botany)', bold: true, size: 20, color: primaryColor, font: 'Calibri' }),
                  new TextRun({ text: '\nConvener, Academic Affairs', size: 18, color: '475569', font: 'Calibri' })
                ]
              })
            ]
          }),
          new TableCell({
            width: { size: 34, type: WidthType.PERCENTAGE },
            margins: { top: 100, bottom: 80, left: 100, right: 100 },
            children: [
              new Paragraph({ text: '_______________________________', alignment: AlignmentType.CENTER }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 30, after: 10 },
                children: [
                  new TextRun({ text: 'Lecturer (Chemistry)', bold: true, size: 20, color: primaryColor, font: 'Calibri' }),
                  new TextRun({ text: '\nConvener, Admission Committee', size: 18, color: '475569', font: 'Calibri' })
                ]
              })
            ]
          })
        ]
      }),
      // Row 2: Exam Incharge, IT Coordinator, Accounts Incharge
      new TableRow({
        children: [
          new TableCell({
            width: { size: 33, type: WidthType.PERCENTAGE },
            margins: { top: 100, bottom: 80, left: 100, right: 100 },
            children: [
              new Paragraph({ text: '_______________________________', alignment: AlignmentType.CENTER }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 30, after: 10 },
                children: [
                  new TextRun({ text: 'Master (Mathematics)', bold: true, size: 20, color: primaryColor, font: 'Calibri' }),
                  new TextRun({ text: '\nConvener, Examination Cell', size: 18, color: '475569', font: 'Calibri' })
                ]
              })
            ]
          }),
          new TableCell({
            width: { size: 33, type: WidthType.PERCENTAGE },
            margins: { top: 100, bottom: 80, left: 100, right: 100 },
            children: [
              new Paragraph({ text: '_______________________________', alignment: AlignmentType.CENTER }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 30, after: 10 },
                children: [
                  new TextRun({ text: 'Incharge IT & Computer Cell', bold: true, size: 20, color: primaryColor, font: 'Calibri' }),
                  new TextRun({ text: '\nTechnical Coordinator & Architect', size: 18, color: '475569', font: 'Calibri' })
                ]
              })
            ]
          }),
          new TableCell({
            width: { size: 34, type: WidthType.PERCENTAGE },
            margins: { top: 100, bottom: 80, left: 100, right: 100 },
            children: [
              new Paragraph({ text: '_______________________________', alignment: AlignmentType.CENTER }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 30, after: 10 },
                children: [
                  new TextRun({ text: 'Senior Assistant (Accounts)', bold: true, size: 20, color: primaryColor, font: 'Calibri' }),
                  new TextRun({ text: '\nCustodian, School Accounts', size: 18, color: '475569', font: 'Calibri' })
                ]
              })
            ]
          })
        ]
      }),
      // Row 3: Guidance Incharge, Science Rep, Arts/Commerce Rep
      new TableRow({
        children: [
          new TableCell({
            width: { size: 33, type: WidthType.PERCENTAGE },
            margins: { top: 100, bottom: 80, left: 100, right: 100 },
            children: [
              new Paragraph({ text: '_______________________________', alignment: AlignmentType.CENTER }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 30, after: 10 },
                children: [
                  new TextRun({ text: 'Lecturer (Political Science)', bold: true, size: 20, color: primaryColor, font: 'Calibri' }),
                  new TextRun({ text: '\nConvener, Student Welfare Cell', size: 18, color: '475569', font: 'Calibri' })
                ]
              })
            ]
          }),
          new TableCell({
            width: { size: 33, type: WidthType.PERCENTAGE },
            margins: { top: 100, bottom: 80, left: 100, right: 100 },
            children: [
              new Paragraph({ text: '_______________________________', alignment: AlignmentType.CENTER }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 30, after: 10 },
                children: [
                  new TextRun({ text: 'Lecturer (Zoology)', bold: true, size: 20, color: primaryColor, font: 'Calibri' }),
                  new TextRun({ text: '\nFaculty Rep. (Sciences)', size: 18, color: '475569', font: 'Calibri' })
                ]
              })
            ]
          }),
          new TableCell({
            width: { size: 34, type: WidthType.PERCENTAGE },
            margins: { top: 100, bottom: 80, left: 100, right: 100 },
            children: [
              new Paragraph({ text: '_______________________________', alignment: AlignmentType.CENTER }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 30, after: 10 },
                children: [
                  new TextRun({ text: 'Lecturer (Commerce / Economics)', bold: true, size: 20, color: primaryColor, font: 'Calibri' }),
                  new TextRun({ text: '\nFaculty Rep. (Commerce/Arts)', size: 18, color: '475569', font: 'Calibri' })
                ]
              })
            ]
          })
        ]
      })
    ]
  }),

  new Paragraph({ spacing: { before: 180, after: 40 } }),

  // Executive Approval & Seal Box - Principal
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 12, color: accentEmerald },
      right: { style: BorderStyle.SINGLE, size: 12, color: accentEmerald },
      bottom: { style: BorderStyle.SINGLE, size: 12, color: accentEmerald },
      left: { style: BorderStyle.SINGLE, size: 12, color: accentEmerald }
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: { fill: 'F0FDF4', type: ShadingType.CLEAR },
            margins: { top: 140, bottom: 140, left: 160, right: 160 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: 'OFFICIAL ADMINISTRATIVE ORDER & SANCTION', bold: true, size: 22, color: accentEmerald, font: 'Calibri' })
                ]
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 60, after: 100 },
                children: [
                  new TextRun({
                    text: 'The above resolution having been passed unanimously by the Joint Academic & Administrative Council of GHSS Shangus, is hereby formally ratified, sanctioned, and approved for immediate execution. The School Enterprise Resource Planning (ERP) System is officially declared the sovereign digital platform of Govt. Higher Secondary School Shangus. All stakeholders shall strictly abide by the Standard Operating Procedures formulated herein.',
                    italics: true,
                    size: 20,
                    color: '1E293B',
                    font: 'Calibri'
                  })
                ]
              }),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                spacing: { before: 80, after: 0 },
                children: [
                  new TextRun({ text: 'Sd/-\n', bold: true, size: 22, color: primaryColor, font: 'Calibri' }),
                  new TextRun({ text: 'PRINCIPAL / DDO (CHAIRMAN)\n', bold: true, size: 24, color: primaryColor, font: 'Calibri' }),
                  new TextRun({ text: 'Govt. Higher Secondary School Shangus\n', bold: true, size: 20, color: '475569', font: 'Calibri' }),
                  new TextRun({ text: 'Department of School Education, UT of Jammu & Kashmir\n', size: 18, color: '64748B', font: 'Calibri' }),
                  new TextRun({ text: '(Official Institutional Seal & Signature)', italics: true, size: 18, color: '94A3B8', font: 'Calibri' })
                ]
              })
            ]
          })
        ]
      })
    ]
  }),

  new Paragraph({ spacing: { before: 140, after: 40 } }),

  // Endorsement / Copy To Block
  new Paragraph({
    spacing: { before: 40, after: 40 },
    children: [
      new TextRun({ text: 'MEMO NO: ', bold: true, size: 20, color: primaryColor, font: 'Calibri' }),
      new TextRun({ text: 'GHSS/SHG/ERP-RES/2026/01-END\t\t\t\t\t\t', size: 20, font: 'Calibri' }),
      new TextRun({ text: 'DATED: 29-09-2026', bold: true, size: 20, color: primaryColor, font: 'Calibri' })
    ]
  }),
  new Paragraph({
    spacing: { before: 20, after: 20 },
    children: [
      new TextRun({ text: 'Copy submitted / forwarded for favour of kind information and official record to:', bold: true, size: 19, color: '334155', font: 'Calibri' })
    ]
  }),
  new Paragraph({
    spacing: { before: 10, after: 10 },
    children: [
      new TextRun({ text: '1. The Worthy Director, Directorate of School Education Kashmir (DSEK), Srinagar, for kind perusal.\n', size: 18, color: '475569', font: 'Calibri' }),
      new TextRun({ text: '2. The Chief Education Officer (CEO), Anantnag, for kind information.\n', size: 18, color: '475569', font: 'Calibri' }),
      new TextRun({ text: '3. The Zonal Education Officer (ZEO), Shangus, for information.\n', size: 18, color: '475569', font: 'Calibri' }),
      new TextRun({ text: '4. Assistant Secretary, J&K Board of School Education (JKBOSE) Sub-Office, Anantnag, for information.\n', size: 18, color: '475569', font: 'Calibri' }),
      new TextRun({ text: '5. All Committee Members & Faculty Members, GHSS Shangus, for strict compliance.\n', size: 18, color: '475569', font: 'Calibri' }),
      new TextRun({ text: '6. Institutional Website & Official Notice Board, for information of students and parents.\n', size: 18, color: '475569', font: 'Calibri' }),
      new TextRun({ text: '7. Office Record File / Dispatch Register, for permanent archival preservation.', size: 18, color: '475569', font: 'Calibri' })
    ]
  })
];

// Document Definition
const doc = new Document({
  creator: 'Office of the Principal, GHSS Shangus',
  title: 'Institutional Administrative Resolution - Adoption of GHSS Shangus School ERP',
  description: 'Official statutory resolution passed by the Principal and the Standing Digital ERP Steering Committee of Govt. Higher Secondary School Shangus adopting the School ERP platform.',
  styles: {
    default: {
      document: {
        run: { font: 'Calibri', size: 22, color: '1E293B' },
        paragraph: { spacing: { line: 260, after: 60 } }
      }
    }
  },
  sections: [{
    properties: {
      page: {
        margin: { top: 720, bottom: 720, left: 900, right: 900 } // ~0.5in top/bottom, 0.625in left/right
      }
    },
    headers: {
      default: new Header({
        children: [
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
              new TextRun({
                text: 'OFFICE OF THE PRINCIPAL • GHSS SHANGUS • INSTITUTIONAL RESOLUTION (ERP ADOPTION)',
                size: 16,
                color: '64748B',
                bold: true,
                font: 'Calibri'
              })
            ]
          })
        ]
      })
    },
    footers: {
      default: new Footer({
        children: [
          new Paragraph({
            alignment: AlignmentType.SPACE_BETWEEN,
            children: [
              new TextRun({
                text: 'Resolution Ref: GHSS/SHG/RES/ERP-2026/01 • Institutional Charter & Statutory Sanction',
                size: 16,
                color: '94A3B8',
                font: 'Calibri'
              }),
              new TextRun({
                children: ['Page ', PageNumber.CURRENT, ' of ', PageNumber.TOTAL_PAGES],
                size: 16,
                color: '94A3B8',
                font: 'Calibri'
              })
            ]
          })
        ]
      })
    },
    children: docChildren
  }]
});

// Write to .docx
Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync(docxPath, buffer);
  console.log('✅ Word Resolution Document (.docx) created successfully at:', docxPath);
}).catch(err => {
  console.error('❌ Error generating resolution docx:', err);
  process.exit(1);
});

// Also create companion markdown file for immediate inspection and reference
const mdContent = `# GOVERNMENT OF JAMMU & KASHMIR
## DEPARTMENT OF SCHOOL EDUCATION • UT OF JAMMU & KASHMIR
### OFFICE OF THE PRINCIPAL, GOVT. HIGHER SECONDARY SCHOOL SHANGUS
*Shangus, District Anantnag, Kashmir — 192201 • Established 1917 • U-DISE: 01041100608*

---

**RESOLUTION NO:** \`GHSS/SHG/RES/ERP-2026/01\`  
**DATED:** 29th September, 2026  
**VENUE:** Principal's Conference Chamber, Administrative Block, GHSS Shangus  
**SUBJECT:** Extraordinary Institutional Administrative Resolution Concerning Institutional Sanction, Structural Mandate, Administrative Adoption, and Operational Authorization for the Development, Deployment, and Public Launch of the GHSS Shangus School Enterprise Resource Planning (ERP) & Digital Governance Ecosystem.

---

### Executive Preamble & Summary
A formal administrative decree and statutory institutional resolution passed in an extraordinary council meeting chaired by the Principal, GHSS Shangus, with senior faculty members, lecturers, masters, academic conveners, and administrative in-charges. This resolution officially evaluates the capabilities, problems resolved, and whole-school transformative impacts of the custom-engineered GHSS Shangus School Enterprise Resource Planning (ERP) Platform (comprising **210,261 lines of custom code**, **4 autonomous portals**, and **25 integrated enterprise modules across 4 functional divisions**). The council formally approves, sanctions, and adopts the ERP system as the permanent, official, sovereign digital governance infrastructure of Govt. Higher Secondary School Shangus, establishing operational protocols, committee portfolios, data verification mandates, and authorizing public deployment.

---

### 1. Record of Meeting & Joint Council Composition
An extraordinary meeting of the Senior Faculty, Academic Department Heads, Committee Conveners, and Administrative Staff of Government Higher Secondary School Shangus was convened under the chairmanship of the worthy Principal & Drawing & Disbursing Officer (DDO). The meeting was organized to conduct a rigorous pre-deployment evaluation of the institutional School ERP system, review legacy administrative vulnerabilities, assess institutional ownership, and formally adopt standard operating procedures before publishing the platform for active academic and administrative use.

| S.No | Name of Official / Portfolio | Substantive Designation | Department / Committee Role | Statutory Responsibility in ERP |
| :--- | :--- | :--- | :--- | :--- |
| **1** | **Office of the Principal** | Principal / DDO | Head of Institution / Chairman | Executive Patronage, Final Sanction & Policy Approvals |
| **2** | **Senior Lecturer (Physics)** | Senior Lecturer | Vice-Chairman / Staff Secretary | Academic Oversight, Inter-Departmental Coordination |
| **3** | **Lecturer (Botany)** | Lecturer / Academic Incharge | Convener, Academic Affairs | Curriculum Compliance, JKBOSE Subject Stream Alignment |
| **4** | **Lecturer (Chemistry)** | Lecturer / Admission Incharge | Convener, Admission Committee | Student Intake Controls, Verification & Upgrades |
| **5** | **Master (Mathematics)** | Master / Examination Incharge | Convener, Examination & Evaluation | Continuous Internal Assessment, Practical Award Rolls |
| **6** | **Incharge IT & Computer Cell** | Master / Teacher (IT & CS) | Technical Coordinator & Architect | System Administration, Cloud Security, Codebase Custody |
| **7** | **Senior Assistant (Accounts)** | Senior Assistant / Head Assistant | Custodian, School Accounts | 14+ Subsidiary Funds Reconciliations & Fee Splitter |
| **8** | **Lecturer (Political Science)** | Lecturer / Guidance Incharge | Convener, Student Welfare & Career Cell | Identity Card Studio & Student Certificates Audit |
| **9** | **Lecturer (Zoology)** | Lecturer / Science Stream Lead | Faculty Representative (Sciences) | Laboratory Records, Practicals Grid Verification |
| **10** | **Lecturer (Commerce / Economics)** | Lecturer / Humanities Lead | Faculty Representative (Arts/Commerce) | Elective Stream Combination & Roster Verification |

---

### 2. Contextual Preamble & Review of Legacy Administrative Bottlenecks
The Joint Council conducted an exhaustive audit of traditional manual and semi-manual procedures that have governed school administration over past decades. The council noted that while GHSS Shangus boasts a centennial heritage of academic distinction since 1917, its administrative machinery was severely constrained by manual bottlenecks, paper deterioration, and systemic latency:

1. **20-Year Archival & Alumni Records**:
   - *Legacy Bottleneck*: Physical registers dating from 2006 to 2026 suffered paper degradation, water damage hazards, rodent wear, and dust decay. Locating a student record from 10 or 15 years ago required hours or days of manual page turning.
   - *ERP Solution*: Unified 20-Year Cloud Archive (2006–2026) with sub-2-second search across 20 academic sessions by Roll Number, Name, Parentage, or JKBOSE Registration Number.
   - *School Impact*: 100% elimination of record retrieval delays; instantaneous issuance of historic verification records for higher education, passports, and government services.

2. **Student Admissions & Intake Logistics**:
   - *Legacy Bottleneck*: Long physical queues of parents and students at the campus; paper admission forms; manual verification of matriculation marks; clerical fatigue; rampant subject combination errors violating JKBOSE rules.
   - *ERP Solution*: Online Student Admission Suite with multi-step digital workflow, in-browser mobile image downsampling to <100KB, JKBOSE combination logic enforcer, and dual-stage provisional admission state machine.
   - *School Impact*: Zero physical queuing; 100% error-free subject combinations; automated issuance of digital admission receipts and fee acknowledgments.

3. **Academic Assessment & Practical Awards**:
   - *Legacy Bottleneck*: Teachers manually calculated totals and JKBOSE letter grades on loose sheets; high risk of clerical tabulation errors; vulnerability of marks tampering; multi-day delays in dispatching award rolls to JKBOSE.
   - *ERP Solution*: Single-faculty isolated assessment workspace with score boundary validation (0 <= marks <= maxMarks), automated grade calculations, draft auto-save, and 1-click Word (.docx) & vector PDF award roll generation.
   - *School Impact*: Complete elimination of mathematical errors; total privacy between departments; board-compliant award rolls ready with official seals in seconds.

4. **Official Certificates & Anti-Forgery**:
   - *Legacy Bottleneck*: Manual handwritten issuance of Character, Bonafide, Provisional, and Transfer certificates; vulnerable to unauthorized tampering, lost duplicate registers, and lack of external verification.
   - *ERP Solution*: Instant Certificate Studio generating standardized, vector-crisp institutional certificates with programmatic date-to-words conversion and cryptographic QR code verification URLs.
   - *School Impact*: Universal anti-counterfeiting security; employers, universities, and passport offices can verify certificates in 1 second via smartphone camera scan.

5. **School Accounts & Subsidiary Funds**:
   - *Legacy Bottleneck*: Fees collected manually into a single pool; arduous clerical book-keeping to manually split collections across 14+ distinct subsidiary funds (Sports, Red Cross, Library, Science Lab, Development, Exam Fund).
   - *ERP Solution*: Automated 14+ Subsidiary Fund Splitter and Ledger Engine distributing fee components instantly upon transaction entry with complete head-wise reporting and audit trails.
   - *School Impact*: Absolute financial transparency; error-free audit readiness for departmental and statutory inspections; zero misallocation of student fund dues.

6. **Staff Productivity & Focus on Pedagogy**:
   - *Legacy Bottleneck*: Senior lecturers and masters consumed hundreds of hours every academic session performing clerical tasks: writing registers, compiling rosters, filling award sheets, and formatting letters.
   - *ERP Solution*: Suite of 25 integrated enterprise modules (Class Roll Number Generator, Roster Builder, ID Card Studio, Letterhead Writer, Batch Field Overwriter) executing complex tasks in seconds.
   - *School Impact*: Saves over 350+ staff hours annually across the faculty, returning valuable instructional time to classrooms, laboratories, and student mentorship.

7. **Recurring Software Licensing Costs**:
   - *Legacy Bottleneck*: Commercial school ERP software providers charge recurring fees of ₹50,000 to ₹1,50,000 every year, alongside per-student fees, proprietary vendor lock-in, and student data extraction risks.
   - *ERP Solution*: Custom-engineered institutional ERP codebase (210,261 LOC across 322 source files) permanently owned by GHSS Shangus with ₹0 annual licensing fee and complete local data sovereignty.
   - *School Impact*: Permanent institutional asset; saves the school and public exchequer ₹1,50,000+ every single year while guaranteeing zero third-party commercial exploitation.

---

### 3. Formal Statutory Recitals (WHEREAS Clauses)
- **WHEREAS**, Government Higher Secondary School Shangus, established in 1917 under the Department of School Education, UT of Jammu & Kashmir, is a premier rural educational institution catering to over 1,000 students across Class 9th through 12th in Science (Medical/Non-Medical), Humanities, and Commerce streams, and demands modern, transparent, and technology-driven administrative governance;
- **WHEREAS**, the National Education Policy (NEP-2020) and the Digital India Mission, in conjunction with statutory directives from the Directorate of School Education Kashmir (DSEK), mandate the comprehensive digitisation of school governance, student record archives, transparent admissions, paperless workflows, and robust educational data integrity;
- **WHEREAS**, the school's physical records—encompassing over 20 consecutive academic cohorts from 2006 to 2026—represent irreplaceable public institutional property containing student academic careers, registrations, and marks data, which cannot be left exposed to physical degradation, accidental loss, fire, moisture, or manual search delays;
- **WHEREAS**, the faculty and administration have thoroughly tested, verified, and audited the custom-engineered institutional ERP platform comprising 210,261 lines of custom source code across 322 files, 4 autonomous portals, and 25 integrated enterprise modules, finding it fully compliant with JKBOSE curriculum norms, financial reporting regulations, and student privacy requirements;
- **WHEREAS**, the platform has been developed as a sovereign, self-contained educational asset with permanent institutional ownership and zero recurring third-party software licensing charges, eliminating commercial vendor lock-in and safeguarding public financial resources;
- **WHEREAS**, the deployment of this platform provides high-availability cloud access, mobile responsiveness for rural families, offline Service Worker resilience for low-bandwidth environments, and tamper-proof cryptographic verification on all issued student documents;

---

### 4. Operative Resolutions Passed by the Joint Council

#### Resolution 1: Formal Sanction & Institutional Adoption of the GHSS Shangus ERP System
> **RESOLVED UNANIMOUSLY**, that the Joint Council hereby formally approves, sanctions, and adopts the custom-engineered School Enterprise Resource Planning (ERP) Platform as the official, sole, and sovereign digital governance and administrative infrastructure of Govt. Higher Secondary School Shangus. All academic, admission, examination, certification, and administrative operations shall progressively transition to and operate via this platform.

#### Resolution 2: Declaration of Permanent Institutional Ownership & Zero-Vendor Lock-in
> **RESOLVED UNANIMOUSLY**, that the entire ERP codebase (comprising 210,261 lines of custom source code across 322 source files, all database schema definitions, and design tokens) is the permanent institutional property of Govt. Higher Secondary School Shangus. No commercial third-party vendor holds proprietary rights, and the school shall incur ₹0 recurring annual software licensing fees, ensuring permanent digital sovereignty and significant recurring savings for the public exchequer.

#### Resolution 3: Establishment of the Standing Digital ERP Steering & Oversight Committee (DESOC)
> **RESOLVED UNANIMOUSLY**, that a permanent institutional committee titled the "Digital ERP Steering & Oversight Committee (DESOC)" is hereby constituted. The Principal shall serve as the Executive Chairman. The committee shall be responsible for policy enforcement, role allocations, data integrity audits, faculty training, and quarterly administrative reviews.

#### Resolution 4: Mandated Digitisation & Sub-2-Second Search of 2006–2026 Historical Cloud Archive
> **RESOLVED UNANIMOUSLY**, that the Admission and Examination In-charges, in coordination with the IT Coordinator, are directed to ensure that all historical admission records spanning from 2006 to 2026 for Classes 11th and 12th are fully ingested, indexed, and cross-verified in the secure cloud database. The administration shall henceforth utilize the sub-2-second search engine as the primary reference for verification, duplicate mark-cards, and alumni clearances.

#### Resolution 5: Enforcement of Digital SOPs for Student Admissions & JKBOSE Curriculum Validation
> **RESOLVED UNANIMOUSLY**, that commencing with the immediate academic session, all student admissions for Classes 9th through 12th shall be processed exclusively through the Student Online Admission Suite. The platform's automated subject combination validator shall strictly enforce JKBOSE elective and compulsory rules, prohibiting any incompatible subject allotments. Admissions awaiting board gazettes shall be managed via the two-stage Provisional-to-Full admission state machine.

#### Resolution 6: Mandatory Academic Evaluation Governance & Practical Award Rolls
> **RESOLVED UNANIMOUSLY**, that subject teachers and practical examiners shall utilize the Faculty Assessment Portal for inputting continuous internal assessment and practical marks. Teachers shall operate within isolated departmental sessions with automated score boundary checks (0 <= marks <= maxMarks). Official JKBOSE Practical Award Rolls shall be generated directly from the platform in Word (.docx) and PDF formats with official verification signatures.

#### Resolution 7: Anti-Forgery Mandate for Official Student Certificates & Mark Sheets
> **RESOLVED UNANIMOUSLY**, that all Character Certificates, Bonafide Certificates, Provisional Certificates, Date of Birth Certificates, and Transfer Certificates issued by GHSS Shangus shall be generated via the Student Certificate Studio and must feature the cryptographic QR verification URL. Manual handwritten certificates without digital tracking and dispatch numbers are hereby discontinued.

#### Resolution 8: Financial Accountability via 14+ Subsidiary Fund Splitter & Ledger
> **RESOLVED UNANIMOUSLY**, that the Accounts Cell is directed to route all student institutional fee receipts through the ERP 14+ Subsidiary Fund Splitter module. Fees shall be automatically partitioned across designated government heads (Sports, Library, Science Lab, Red Cross, School Development, Exam Fund, etc.) to guarantee transparent book-keeping and instant audit preparedness.

#### Resolution 9: Strict Data Privacy, Zero-Commercialization & 90-Day Deletion Safety Protocol
> **RESOLVED UNANIMOUSLY**, that student personal data (Aadhaar, phone numbers, addresses) shall remain encrypted and protected under Firebase Role-Based Access Control (RBAC). The platform shall remain 100% ad-free, with zero data sharing with commercial marketing brokers. Furthermore, to prevent catastrophic accidental data loss, all record deletions must be routed through the protected 90-day Recycle Bin with 1-click administrative recovery.

#### Resolution 10: Pre-Deployment Three-Phase Implementation Roadmap & Public Launch
> **RESOLVED UNANIMOUSLY**, that the Joint Council approves the 3-phase rollout roadmap: Phase 1 (Data Verification & Security Audit); Phase 2 (Faculty Onboarding & Dry-Run Testing of Admissions and Practicals); Phase 3 (Official Public Publication & Inauguration). The Technical Coordinator is authorized to proceed with final deployment on school domain and production hosting.

---

### 5. Schedule A: Enterprise Architecture & 25 Integrated School Office Modules

| No. | Module Name & Division | Core Functional Deliverables & Outputs | Designated Institutional Custodian |
| :--- | :--- | :--- | :--- |
| **1** | **Student Records & Reports** [Records & Registers] | Class/stream cohort filters, inline cell edit, photo ZIP downloads, bulk approval status controls. | Admission Committee & Clerical Cell |
| **2** | **Admission Register & Sent-up Suite** [Records & Registers] | 2006–2026 digital cloud registers, 2-part departmental ledger, board registration matcher, Excel sync. | Admission & Archival Incharge |
| **3** | **Student Rosters & Registers** [Records & Registers] | Split-screen register designer, attendance sheets, seating arrangements, photo rosters, Word/PDF export. | Academic Affairs & Time-Table Cell |
| **4** | **Official Letterhead Writer** [Records & Registers] | In-browser rich-text writer with school crest, AI draft assistance, dispatch tracking, PDF/Word export. | Principal's Secretariat & Office Dispatch |
| **5** | **Student Bonafides & Certificates** [Records & Registers] | Instant Character, Bonafide, Provisional, DOB (in words), and Transfer certificates with scannable QR codes. | Student Welfare & Examination Cell |
| **6** | **Student Identity Card Studio** [Records & Registers] | CR80 ATM card layout (portrait/landscape), sheet capacity optimization (8–10 cards/A4), barcodes. | Student Welfare & IT Incharge |
| **7** | **Competitive Exams & OMR Suite** [Records & Registers] | Talent Search, Olympiads, automated PDF admit card compiler with test centres, OMR scoring engine. | Examination & Guidance Incharge |
| **8** | **System & Admission Controls** [Academics & Controls] | Live admission intake toggles for Classes 9th–12th, stream quotas (Medical, Non-Med, Arts, Commerce), session rollover. | Principal & Admission Convener |
| **9** | **Subjects, Streams & Feeder Schools** [Academics & Controls] | Rule-based curriculum validator enforcing JKBOSE compulsory and elective subject combination limits & feeder school sync. | Academic Affairs & Admission Cell |
| **10** | **Practicals & Award Rolls** [Academics & Controls] | Isolated teacher workspaces, score boundary checks (0–20/30), master gazette compiler, Word/PDF export. | Subject Evaluators & Exam Incharge |
| **11** | **Student Attendance Tracker** [Academics & Controls] | Daily and subject roll call, automated visual warnings when student attendance drops below 75% threshold. | Class Teachers & Academic Incharge |
| **12** | **Class Roll Number Manager** [Academics & Controls] | Automated sequential roll number assignment by alphabet or stream with collision prevention algorithms. | Admission Committee & Exam Cell |
| **13** | **Application Merge & Deduplication** [Operations & Automation] | Deduplication studio identifying duplicates by Aadhaar/Phone/RegNo with side-by-side field merge & 90-day trash safety. | Admission Incharge & Data Manager |
| **14** | **Communications & Automations** [Operations & Automation] | Rich-text official circular composer, class/stream filter targeting, live recipient counter, test preview. | Staff Secretary & Notice Board Incharge |
| **15** | **14+ Subsidiary Funds & Fee Accounts** [Operations & Automation] | Central fee tracking, automated allocation into 14+ funds (Sports, Red Cross, Library, Lab, Development). | Accounts Incharge & Cashier |
| **16** | **School Accounts, Salaries & Staff Tax** [Operations & Automation] | Pay slip viewer, automated tax liability calculator for UT employees comparing Old vs. New tax regimes. | Head Assistant & Accounts Cell |
| **17** | **Website CMS & Administration** [Operations & Automation] | Instant notice uploader, scrolling ticker controller, homepage photo slider manager, faculty roster editor. | IT Coordinator & Media Committee |
| **18** | **Board Data Sync (JKBOSE)** [Operations & Automation] | Matches student records against official board gazettes by Reg Number with 30-day rollback memory. | Examination Incharge & Records Cell |
| **19** | **Activity Audit & Dispute Trail** [Operations & Automation] | Tamper-proof, immutable event logging tracking student, teacher, and administrative mutations for audits. | Principal & Institutional Auditor |
| **20** | **Google Contacts Bulk Exporter** [Operations & Automation] | Cohort export to Google Contacts CSV with standard naming formats, phone categorization & parent details. | IT Coordinator & Clerical Cell |
| **21** | **Staff & Permissions Governance** [Operations & Automation] | Multi-role access governance (Principal, Exam Incharge, Accounts, Teacher) with fine-grained claim enforcement. | Principal & IT Systems Administrator |
| **22** | **Quick Cell Edit Mode** [Quick Actions & Ingestion] | Inline cell click-and-edit mode directly modifying tabular student records with immediate auto-audit logs. | Admission Clerical Desk |
| **23** | **Analytics & Statistical Reports** [Quick Actions & Ingestion] | Real-time cohort analytics, stream distribution, gender ratios, demographic charts, and enrollment trends. | Principal & Academic Coordinator |
| **24** | **Express Direct Record Entry** [Quick Actions & Ingestion] | Rapid on-the-spot registration interface for office clerks admitting offline walk-in candidates with receipt. | Admission Office Clerical Desk |
| **25** | **Bulk Ingestion & Batch Overwrite** [Quick Actions & Ingestion] | Batch upload records or overwrite fields via Excel/CSV with column mapping, rollback protection, and analytics. | IT Coordinator & Database Incharge |

---

### 6. Schedule B: Whole-School Positive Impact & Cost-Benefit Valuation

| Performance Indicator | Legacy Status Quo | Transformation Under Custom ERP | Net Institutional Dividend |
| :--- | :--- | :--- | :--- |
| **Direct Software Expenditure** | Recurring commercial vendor subscription of ₹50,000 to ₹1,50,000 every year. | 100% permanently owned institutional asset developed at zero recurring software licensing cost. | Saves ₹1,50,000+ annually; cumulative savings exceed ₹7.5 Lakhs over a 5-year cycle. |
| **Faculty Clerical Burden** | Teachers spent 350+ cumulative hours each session filling registers, writing awards, and compiling lists. | 1-click automated award rolls, digital attendance grid, and automated roster generators. | Recovers 350+ teaching hours annually for classroom instruction, lab practicals, and remedial mentoring. |
| **Student & Parent Convenience** | Parents traveled multiple times to campus for admission slips, fee vouchers, and result enquiries. | 24/7 mobile-responsive portal accessible on any smartphone, even over 2G/3G mobile networks. | Eliminates long travel and queues; establishes 100% transparent and instant communication with parents. |
| **Record Security & Heritage** | Paper ledgers stored in physical almirahs vulnerable to dampness, vermin, fire, and misplacement. | Distributed cloud database with multi-region replication, IndexedDB caching, and local JSON/CSV exports. | Guarantees permanent, tamper-proof archival security for 20+ years of institutional history (2006–2026). |
| **Audit & Financial Rigor** | Cumbersome manual reconciliation of student fees across 14+ subsidiary heads. | Automated, mathematically verified ledger partitioning with complete transaction trail. | Zero audit objections; complete transparency for departmental, AG, and statutory financial audits. |

---

### 7. Schedule C: End-to-End Custom Codebase & Technology Stack Complexity

The Joint Council emphasizes that the GHSS Shangus Digital Platform is **100% custom-code based end-to-end**, engineered from the ground up specifically for Govt. Higher Secondary School Shangus. It relies on zero third-party website builders (e.g., WordPress, Wix) or generic commercial templates, guaranteeing absolute institutional software sovereignty, uncompromising performance, and zero vulnerability to vendor lock-in.

#### Codebase Volume Breakdown (Direct Source File Audit)
| Software Layer / Subsystem | Source Files | Volume (Lines of Code) | Architectural Complexity & Engineering Role |
| :--- | :--- | :--- | :--- |
| **React 19 JSX UI Components** | 97 Files | 134,838 LOC | Component-based single-page application (SPA); manages 4 autonomous portals, 25 integrated modules, modals, and responsive views. |
| **Core JavaScript Engines & Services** | 95 Files | 55,640 LOC | Vector PDF (jsPDF), Word (.docx), Excel (.xlsx) export engines, business rules, caching algorithms, data synchronization logic. |
| **Automation, Security & Audit Scripts** | 127 Files | 16,446 LOC | Automated regression test suites, Firestore security rules auditors, deduplication, photo downsamplers, integrity validators. |
| **Design System & Responsive Stylesheets** | 3 Files | 3,337 LOC | Modern Vanilla CSS + Tailwind tokens, high-contrast accessibility compliance, adaptive print styling engine (@media print). |
| **TOTAL ENTERPRISE CUSTOM CODEBASE** | **322 Files** | **210,261 LOC** | **Enterprise-grade, sovereign institutional digital infrastructure custom-coded from scratch for GHSS Shangus.** |

#### Multi-Tier Technology Stack
| Technology Domain | Engine / Technology | Concrete Implementation & Institutional Value |
| :--- | :--- | :--- |
| **Frontend Framework** | React 19 & React Router v7 | Modern SPA architecture with declarative state isolation, code-splitting chunks, dynamic routing, and fast load times. |
| **3D Graphics & Simulation** | Three.js (WebGL Engine) | GPU-accelerated Bohr Carbon-12 atomic simulation with 6p+6n nucleus, parametric electron orbits, and central school crest disc. |
| **Cloud Database Architecture** | Google Cloud Firestore | Enterprise NoSQL distributed document database, subcollections, compound indexing, real-time snapshot listeners, multi-region replication. |
| **Identity & Access Governance** | Firebase Auth + Custom RBAC | Fine-grained Role-Based Access Control, single-faculty isolated session environments, encrypted session tokens. |
| **Client-Side Document Engines** | jsPDF, docx, SheetJS (xlsx) | Direct in-browser generation of board-compliant mark cards (PDF), official award rolls (.docx), registers, and Excel reports. |
| **Mobile & Offline Performance** | PWA, IndexedDB & Canvas Compression | Two-tier caching (dbCache + IndexedDB) for 2G/3G rural networks; in-browser HTML5 canvas image compression downsampling uploads to <100KB. |

---

### 8. Solemn Attestation, Committee Signatures & Executive Sanction

*IN WITNESS WHEREOF, the Principal and the designated members of the Joint Academic and Administrative Council have appended their official signatures and institutional seals to this resolution on this 29th day of September, 2026, affirming full consensus, institutional adoption, and authorizing immediate deployment and publication of the GHSS Shangus School ERP System.*

| S.No | Name & Designation | Committee Role / Department | Signature & Date |
| :--- | :--- | :--- | :--- |
| 1 | **Senior Lecturer (Physics)** | Vice-Chairman / Staff Secretary | \`_________________________\` |
| 2 | **Lecturer (Botany)** | Convener, Academic Affairs | \`_________________________\` |
| 3 | **Lecturer (Chemistry)** | Convener, Admission Committee | \`_________________________\` |
| 4 | **Master (Mathematics)** | Convener, Examination Cell | \`_________________________\` |
| 5 | **Incharge IT & Computer Cell** | Technical Coordinator & Architect | \`_________________________\` |
| 6 | **Senior Assistant (Accounts)** | Custodian, School Accounts | \`_________________________\` |
| 7 | **Lecturer (Political Science)** | Convener, Student Welfare Cell | \`_________________________\` |
| 8 | **Lecturer (Zoology)** | Faculty Representative (Sciences) | \`_________________________\` |
| 9 | **Lecturer (Commerce / Economics)** | Faculty Representative (Arts/Commerce) | \`_________________________\` |

---

### Official Administrative Order & Ratification

The above resolution having been passed unanimously by the Joint Academic & Administrative Council of GHSS Shangus, is hereby formally ratified, sanctioned, and approved for immediate execution. The School Enterprise Resource Planning (ERP) System is officially declared the sovereign digital platform of Govt. Higher Secondary School Shangus. All stakeholders shall strictly abide by the Standard Operating Procedures formulated herein.

\`\`\`text
                                                            Sd/-
                                                 PRINCIPAL / DDO (CHAIRMAN)
                                            Govt. Higher Secondary School Shangus
                                    Department of School Education, UT of Jammu & Kashmir
                                            (Official Institutional Seal & Signature)
\`\`\`

---

**MEMO NO:** \`GHSS/SHG/ERP-RES/2026/01-END\`  
**DATED:** 29-09-2026  

*Copy submitted / forwarded for favour of kind information and official record to:*
1. The Worthy Director, Directorate of School Education Kashmir (DSEK), Srinagar, for kind perusal.
2. The Chief Education Officer (CEO), Anantnag, for kind information.
3. The Zonal Education Officer (ZEO), Shangus, for information.
4. Assistant Secretary, J&K Board of School Education (JKBOSE) Sub-Office, Anantnag, for information.
5. All Committee Members & Faculty Members, GHSS Shangus, for strict compliance.
6. Institutional Website & Official Notice Board, for information of students and parents.
7. Office Record File / Dispatch Register, for permanent archival preservation.
`;

fs.writeFileSync(mdPath, mdContent);
console.log('✅ Markdown Companion Document (.md) created successfully at:', mdPath);
