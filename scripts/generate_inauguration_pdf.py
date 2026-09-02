import os
import sys
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super(NumberedCanvas, self).__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super(NumberedCanvas, self).showPage()
        super(NumberedCanvas, self).save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        self.setFont("Helvetica-Bold", 8)
        self.setFillColor(colors.HexColor("#064e3b"))
        
        # Header on page > 1
        if self._pageNumber > 1:
            self.drawString(36, 11 * inch - 26, "GOVT. HIGHER SECONDARY SCHOOL SHANGUS • TECHNICAL REPORT CUM PRESENTATION")
            self.setFont("Helvetica", 8)
            self.setFillColor(colors.HexColor("#64748b"))
            self.drawRightString(8.5 * inch - 36, 11 * inch - 26, "Digital Campus System Architecture")
            self.setStrokeColor(colors.HexColor("#cbd5e1"))
            self.setLineWidth(0.6)
            self.line(36, 11 * inch - 30, 8.5 * inch - 36, 11 * inch - 30)
        
        # Footer on all pages
        self.setStrokeColor(colors.HexColor("#cbd5e1"))
        self.setLineWidth(0.6)
        self.line(36, 36, 8.5 * inch - 36, 36)
        
        self.setFont("Helvetica-Bold", 7.5)
        self.setFillColor(colors.HexColor("#064e3b"))
        self.drawString(36, 24, "GHSS SHANGUS DIGITAL ECOSYSTEM")
        self.setFont("Helvetica", 7.5)
        self.setFillColor(colors.HexColor("#64748b"))
        self.drawString(185, 24, "• Technical Whitepaper & Inauguration Presentation Guide")
        page_str = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(8.5 * inch - 36, 24, page_str)
        self.restoreState()

def build_pdf(filename):
    doc = SimpleDocTemplate(
        filename,
        pagesize=letter,
        leftMargin=36,
        rightMargin=36,
        topMargin=40,
        bottomMargin=44
    )

    styles = getSampleStyleSheet()

    # Brand Colors
    c_primary = colors.HexColor("#064e3b")      # Deep Emerald
    c_teal = colors.HexColor("#0f766e")         # Teal
    c_dark = colors.HexColor("#0f172a")         # Slate 900
    c_slate = colors.HexColor("#334155")        # Slate 700
    c_muted = colors.HexColor("#64748b")        # Slate 500
    c_amber = colors.HexColor("#b45309")        # Amber / Gold
    c_bg_light = colors.HexColor("#f8fafc")     # Slate 50
    c_bg_emerald = colors.HexColor("#f0fdf4")   # Emerald 50
    c_border = colors.HexColor("#cbd5e1")       # Slate 300

    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=18,
        leading=22,
        textColor=c_primary,
        alignment=1,
        spaceAfter=3
    )

    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10.5,
        leading=14,
        textColor=c_teal,
        alignment=1,
        spaceAfter=6
    )

    meta_style = ParagraphStyle(
        'DocMeta',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=11,
        textColor=c_muted,
        alignment=1,
        spaceAfter=10
    )

    h1_style = ParagraphStyle(
        'H1',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=c_primary,
        spaceBefore=10,
        spaceAfter=4,
        keepWithNext=True
    )

    h2_style = ParagraphStyle(
        'H2',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9.5,
        leading=13,
        textColor=c_teal,
        spaceBefore=7,
        spaceAfter=3,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'Body',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=12,
        textColor=c_dark,
        spaceAfter=4
    )

    speech_style = ParagraphStyle(
        'SpeechText',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=12.5,
        textColor=c_dark,
        spaceAfter=4
    )

    cue_style = ParagraphStyle(
        'StageCue',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=11,
        textColor=c_amber,
        spaceBefore=2,
        spaceAfter=3
    )

    bullet_style = ParagraphStyle(
        'Bullet',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=12,
        textColor=c_dark,
        leftIndent=10,
        spaceAfter=2
    )

    table_cell = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=10.5,
        textColor=c_dark
    )

    table_cell_bold = ParagraphStyle(
        'TableCellBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10.5,
        textColor=c_dark
    )

    table_header = ParagraphStyle(
        'TableHead',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10.5,
        textColor=colors.white
    )

    story = []

    # ═══════════════════════════════════════════════════════════
    # TITLE & METADATA
    # ═══════════════════════════════════════════════════════════
    story.append(Paragraph("GOVERNMENT HIGHER SECONDARY SCHOOL SHANGUS", title_style))
    story.append(Paragraph("TECHNICAL ARCHITECTURE REPORT CUM INAUGURATION PRESENTATION GUIDE", subtitle_style))
    story.append(Paragraph("<b>A Complete Engineering Monograph & Presenter's Keynote Companion</b><br/><i>Software Footprint: 128,600+ Lines of Production Code Across 136 Modules • Stack: React 18, Google Cloud Firestore, Serverless Edge Handlers & PWA Architecture</i>", meta_style))
    story.append(HRFlowable(width="100%", thickness=1.2, color=c_primary, spaceBefore=0, spaceAfter=8))

    # ═══════════════════════════════════════════════════════════
    # SECTION 1: EXECUTIVE SUMMARY & SYSTEM OVERVIEW
    # ═══════════════════════════════════════════════════════════
    story.append(Paragraph("1. Executive Summary & Architectural Overview", h1_style))
    story.append(Paragraph(
        "The <b>Govt. Higher Secondary School Shangus Digital Campus</b> is a cloud-native, enterprise-grade educational management and public engagement ecosystem. "
        "Engineered to completely replace physical registers, manual paper forms, and fragmented administrative spreadsheets, the platform bridges three critical tiers of institutional stakeholders: "
        "<b>(1) The Public Community & Prospective Students</b>, <b>(2) Teachers & Academic Evaluators</b>, and <b>(3) Institutional Administrators & DDO Officers</b>. "
        "The system operates with zero third-party software licensing fees, utilizing scalable Google Cloud NoSQL persistence and high-speed edge distribution.",
        body_style
    ))

    # Architecture Overview Table
    arch_data = [
        [Paragraph("System Layer", table_header), Paragraph("Underlying Technologies", table_header), Paragraph("Architectural Role & Functional Responsibility", table_header)],
        [
            Paragraph("<b>Frontend SPA</b>", table_cell_bold),
            Paragraph("React 18, React Router v6, Tailwind CSS & Vanilla CSS Design Tokens, Lucide Vectors", table_cell),
            Paragraph("High-performance Single Page Application (SPA) rendering responsive dashboards, interactive attendance grids, and WYSIWYG document studios with sub-100ms UI updates.", table_cell)
        ],
        [
            Paragraph("<b>Persistence & Database</b>", table_cell_bold),
            Paragraph("Cloud Firestore (NoSQL Document Store), IndexedDB, Web Storage (LocalStorage/SessionStorage)", table_cell),
            Paragraph("Dual-tiered storage model combining cloud real-time replication with client-side caching for instant offline resiliency and fast retrieval under varying network bandwidths.", table_cell)
        ],
        [
            Paragraph("<b>Security & Identity</b>", table_cell_bold),
            Paragraph("Firebase Auth, PBKDF2 with SHA-512 & 16-byte Cryptographic Salts, 2-Step Handshake OTP", table_cell),
            Paragraph("Zero-trust access model with granular role-based access control (RBAC), multi-factor admin verification, and cryptographic password hashing resistant to rainbow table attacks.", table_cell)
        ],
        [
            Paragraph("<b>Computation Engines</b>", table_cell_bold),
            Paragraph("Custom Pure JS Math Engines, jsPDF Vector Streamer, HTML-to-Canvas Renderer", table_cell),
            Paragraph("Client-side mathematical processors for income tax calculations (Old vs New Regime), automated award roll compilation, and instant PDF certificate generation with anti-forgery QR codes.", table_cell)
        ],
        [
            Paragraph("<b>Serverless & Edge</b>", table_cell_bold),
            Paragraph("Netlify Edge Functions, Node.js 22 Cloud Functions, Google Apps Script API Bridge", table_cell),
            Paragraph("Edge proxying for rate limiting, secure contact dispatch, and high-availability database replication without maintaining expensive dedicated servers.", table_cell)
        ],
    ]
    t_arch = Table(arch_data, colWidths=[1.3*inch, 2.7*inch, 3.5*inch])
    t_arch.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), c_primary),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('GRID', (0,0), (-1,-1), 0.5, c_border),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [c_bg_light, colors.white]),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3.5),
        ('TOPPADDING', (0,0), (-1,-1), 3.5),
    ]))
    story.append(t_arch)
    story.append(Spacer(1, 6))

    # ═══════════════════════════════════════════════════════════
    # SECTION 2: TECHNICAL GLOSSARY & BACKGROUND CONCEPTS
    # ═══════════════════════════════════════════════════════════
    story.append(Paragraph("2. Technical Glossary: Definitions & Background of Core Concepts", h1_style))
    story.append(Paragraph("<i>This glossary provides the technical rationale and operational definitions behind the engineering paradigms powering the platform:</i>", meta_style))

    glossary_data = [
        [Paragraph("Technical Term / Concept", table_header), Paragraph("Definition & Institutional Application in GHSS Shangus Portal", table_header)],
        [
            Paragraph("<b>NoSQL Document Model (Cloud Firestore)</b>", table_cell_bold),
            Paragraph("A non-relational database structure that stores information in flexible JSON-like documents grouped into collections. Unlike traditional SQL databases that require strict table schemas and complex migrations, Firestore allows dynamic attributes (such as customizable practical subjects or flexible admission fields) and provides sub-second document reads and automated horizontal scaling.", table_cell)
        ],
        [
            Paragraph("<b>Zero-Trust Security & Declarative Rules</b>", table_cell_bold),
            Paragraph("A security framework based on the principle of 'never trust, always verify'. Implemented via declarative <code>firestore.rules</code> and <code>storage.rules</code>, every read, write, update, and delete request is evaluated on Google servers against authentication tokens, verified email domains, and ownership constraints before any data is accessed.", table_cell)
        ],
        [
            Paragraph("<b>PBKDF2 Cryptographic Hashing</b><br/><i>(Password-Based Key Derivation Function 2)</i>", table_cell_bold),
            Paragraph("An enterprise standard cryptographic algorithm that applies a pseudorandom function (such as SHA-512) along with a unique 16-byte random salt across thousands of iterations to user passwords. This renders stored credentials completely impervious to precomputed rainbow table attacks, dictionary attacks, and unauthorized decryption.", table_cell)
        ],
        [
            Paragraph("<b>Two-Step Handshake OTP Protocol</b>", table_cell_bold),
            Paragraph("A multi-factor verification mechanism protecting administrative workstations. When an administrator signs in, an ephemeral token document is created with a strict expiration window. The administrator must verify a secondary confirmation handshake before elevated privileges (such as database clearing or staff modifications) are unlocked.", table_cell)
        ],
        [
            Paragraph("<b>Progressive Web App (PWA) & Service Worker</b>", table_cell_bold),
            Paragraph("A web technology pattern that allows standard browser web applications to deliver native-app speed, installability, and offline capabilities. Service workers cache critical static assets and data streams, allowing teachers and students in remote 2G/3G connectivity zones to access portals without interruption.", table_cell)
        ],
        [
            Paragraph("<b>Atomic Batched Writes (<code>writeBatch</code>)</b>", table_cell_bold),
            Paragraph("A database operation where multiple document mutations (such as creating 50 public faculty entries and updating 1 summary document) execute as a single atomic unit. If any single write fails, the entire batch is rolled back, guaranteeing absolute data consistency and eliminating partial state corruption.", table_cell)
        ],
        [
            Paragraph("<b>Client-Side DOM-to-Vector PDF Streaming</b>", table_cell_bold),
            Paragraph("The on-the-fly generation of high-resolution, vector-crisp documents directly in the user's browser memory (via jsPDF). Instead of waiting for a slow backend server to render PDFs, documents like ID cards, admission acknowledgements, and Form 16 statements are compiled and downloaded in milliseconds.", table_cell)
        ],
        [
            Paragraph("<b>Anti-Forgery QR Code Data Embedding</b>", table_cell_bold),
            Paragraph("A cryptographic verification badge embedded directly on student certificates (Character, Provisional, Bonafide). Scanning the QR code with any smartphone camera instantly decodes and verifies the student's admission number, session, and issuance timestamp against the school's verified cloud records.", table_cell)
        ],
        [
            Paragraph("<b>Dual-Regime Income Tax Mathematics</b>", table_cell_bold),
            Paragraph("A financial algorithm customized for Jammu & Kashmir Government Employees. It computes income tax under both the Section 115BAC New Regime and the Old Regime with standard deduction (₹50k/₹75k), HRA exemptions, Section 80C/80D deductions, Section 87A marginal relief, and Health & Education cess (4%).", table_cell)
        ],
    ]

    t_glossary = Table(glossary_data, colWidths=[2.2*inch, 5.3*inch])
    t_glossary.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), c_teal),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('GRID', (0,0), (-1,-1), 0.5, c_border),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [c_bg_light, colors.white]),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3.5),
        ('TOPPADDING', (0,0), (-1,-1), 3.5),
    ]))
    story.append(t_glossary)
    story.append(Spacer(1, 8))

    # ═══════════════════════════════════════════════════════════
    # SECTION 3: SUBSYSTEM BREAKDOWN & ARCHITECTURAL SPECS
    # ═══════════════════════════════════════════════════════════
    story.append(Paragraph("3. Detailed Subsystem Breakdown & Engineering Specifications", h1_style))

    subsystems = [
        ("Subsystem A: Public Institutional Gateway & Content Management (CMS)",
         "The public gateway serves as the primary digital face of GHSS Shangus. Powered by dynamic React route hydration, it presents real-time institutional notices with automated active-day badges, a mobile-optimized hero slideshow, an interactive faculty directory, and transparent subject combination guidelines. Content updates made by administrators are synchronized via Cloud Firestore within 300 milliseconds globally."),
        
        ("Subsystem B: 4-Stage Student Lifecycle & Automated Admission Engine",
         "The admission engine orchestrates student onboarding through a validated 4-step workflow: (1) Personal & Demographic Data, (2) Academic History & Marks Validation, (3) Stream & Subject Selection with conflict checking, and (4) Photo/Document Uploads. The system automatically issues a deterministic Form Number and generates an official PDF slip. Administrators utilize auto-sequencing algorithms to allocate roll numbers without duplicate clashes."),

        ("Subsystem C: Teacher Workspace, Daily Attendance Matrix & Practical Award Rolls",
         "Designed for rapid execution on mobile devices, the Teacher Portal features a high-density classroom attendance grid allowing faculty to record attendance for an entire class in under 30 seconds. The Science Practicals Module enables internal examiners to grade practical experiments, calculate automated totals, verify passing benchmarks, and generate standardized JKBOSE-format award rolls ready for official submission."),

        ("Subsystem D: Administrative Governance & 11,400-Line Analytical Reporting Suite",
         "The administrative backbone features an extensive analytical suite capable of cross-filtering thousands of student records across multiple axes (Gender, Stream, Category, Session). Data can be instantly exported to CSV, Excel, or structured print reports. Built-in data integrity monitors detect roster inconsistencies and provide one-click reconciliation."),

        ("Subsystem E: Dynamic Student Certificate & Identity Studio",
         "The Certificate Studio eliminates multi-day turnaround times for issuing Character Certificates, Provisional Certificates, Transfer Certificates, and Bonafide Letters. Student records are automatically hydrated into standardized institutional layouts, stamped with dynamic verification QR codes, and exported as vector-crisp PDFs ready for institutional seal and signature.")
    ]

    for title, desc in subsystems:
        story.append(Paragraph(f"<b>{title}</b>", h2_style))
        story.append(Paragraph(desc, body_style))

    story.append(Spacer(1, 6))

    # ═══════════════════════════════════════════════════════════
    # SECTION 4: MASTER PRESENTATION SPEECH & STAGE WALKTHROUGH
    # ═══════════════════════════════════════════════════════════
    story.append(Paragraph("4. Master Keynote Presentation Script (Verbatim Delivery)", h1_style))
    story.append(Paragraph("<i>This script blends technical authority with inspirational institutional pride. Use the stage cues in bold brown to coordinate with on-screen actions:</i>", meta_style))

    story.append(Paragraph("<b>[STAGE CUE: Step confidently to the podium, acknowledge dignitaries with a formal nod, establish eye contact with the audience, and speak with warmth and clarity.]</b>", cue_style))
    story.append(Paragraph("Respected Chief Guest, Worthy Principal Sir, esteemed faculty colleagues, distinguished community elders, dear parents, and my energetic student friends: A very warm good morning to you all.", speech_style))

    story.append(Paragraph("Today marks a momentous milestone in the history of <b>Government Higher Secondary School Shangus</b>. For decades, our institution has stood as an unwavering beacon of education, leadership, and moral character in South Kashmir. Today, we step firmly into the vanguard of 21st-century educational technology.", speech_style))

    story.append(Paragraph("<b>[STAGE CUE: Point to the projector screen displaying the modern GHSS Shangus homepage.]</b>", cue_style))
    story.append(Paragraph("It is my distinct privilege to present to you the technical realization of our institutional vision: the official <b>GHSS Shangus Digital Campus & Governance Portal</b>—a platform engineered from the ground up comprising over <b>128,600 lines of custom production code</b> across 136 integrated modules.", speech_style))

    story.append(Paragraph("<b>[STAGE CUE: Scroll through the Homepage, highlighting the real-time Notice Ticker and Faculty Roster.]</b>", cue_style))
    story.append(Paragraph("Allow me to guide you through the technical pillars that make this ecosystem transformative. First, our <b>Public Gateway</b> replaces the traditional physical notice board with a real-time cloud-synchronized notification hub. Parents and students from across the valley can view datesheets, admission circulars, and academic calendars instantly on any smartphone with zero delay.", speech_style))

    story.append(Paragraph("<b>[STAGE CUE: Navigate to the Admissions Tab and showcase the 4-step registration form.]</b>", cue_style))
    story.append(Paragraph("Second, our <b>Online Admission & Student Lifecycle Engine</b> eradicates the long queues and tedious paperwork of the past. Applicants register through a multi-step validated form, select their subject combinations with automated eligibility checks, and immediately download an official, timestamped PDF acknowledgement. Administrators can allocate roll numbers across entire cohorts with intelligent auto-sequencing algorithms in seconds.", speech_style))

    story.append(Paragraph("<b>[STAGE CUE: Open Teacher Portal; show the Attendance Matrix and Practicals Scoring Grid.]</b>", cue_style))
    story.append(Paragraph("Third, we have empowered our teaching faculty with specialized academic workspaces. Our <b>Smart Attendance Grid</b> allows daily classroom attendance to be marked in under 30 seconds with automatic attendance percentage calculations. Our <b>Science Practicals Engine</b> automates score tabulations, passing mark validations, and board-ready award roll printing, saving hundreds of teacher-hours each academic term.", speech_style))

    story.append(Paragraph("<b>[STAGE CUE: Open Admin Portal; demonstrate the Certificate Studio and Staff Tax Calculator.]</b>", cue_style))
    story.append(Paragraph("Fourth, inside our <b>Administrative Governance Suite</b>, we have introduced the <b>Instant Certificate Studio</b>. Character, Provisional, and Bonafide certificates that once required days of ledger searching are now generated in 5 seconds, embedded with an anti-forgery QR code for instant mobile verification. Alongside this, our custom <b>Staff Tax & Form 16 Calculator</b> computes comparative tax liabilities under both Old and New Regimes specifically customized for Jammu & Kashmir UT government employees.", speech_style))

    story.append(Paragraph("<b>[STAGE CUE: Point to the green security indicator in the top navbar.]</b>", cue_style))
    story.append(Paragraph("Underpinning this entire platform is a zero-trust cloud infrastructure. Every student document is isolated, administrative sessions are guarded by salted PBKDF2 cryptographic hashing and 2-step verification, and client-side caching guarantees lightning-fast responsiveness even in areas with limited mobile data connectivity.", speech_style))

    story.append(Paragraph("<b>[STAGE CUE: Turn respectfully towards the Principal Sir and Chief Guests.]</b>", cue_style))
    story.append(Paragraph("This portal represents our dedication to transparency, speed, and educational excellence. I now invite our Worthy Principal Sir and Hon'ble Chief Guests to press the ceremonial launch button and declare the <b>Govt. Higher Secondary School Shangus Digital Campus officially live!</b>", speech_style))
    story.append(Paragraph("<b>[STAGE CUE: Lead the hall in enthusiastic applause as dignitaries inaugurate the website!]</b>", cue_style))

    story.append(Spacer(1, 6))

    # ═══════════════════════════════════════════════════════════
    # SECTION 5: TECHNICAL Q&A & SYSTEM RESILIENCE
    # ═══════════════════════════════════════════════════════════
    story.append(Paragraph("5. Technical Q&A, Resilience & Disaster Recovery Guide", h1_style))

    qa_data = [
        ("How does the system maintain high availability and prevent data loss?",
         "<b>Technical Mechanism:</b> Data is stored in Google Cloud Firestore with multi-region replication. In addition, the administrative console provides 1-click full JSON/CSV database export capabilities, allowing regular offline snapshots to be stored securely."),
        ("What happens when network connectivity is slow or intermittent?",
         "<b>Technical Mechanism:</b> The application implements a Service Worker caching strategy and stores master roster indexes in browser LocalStorage and IndexedDB. Read operations execute locally with instantaneous response times, synchronizing mutations as soon as connectivity resumes."),
        ("How is unauthorized data tampering prevented across public and staff roles?",
         "<b>Technical Mechanism:</b> Server-enforced Firestore Security Rules (<code>firestore.rules</code>) validate every mutation against authenticated Firebase tokens and custom claims. Client-side attempts to forge role permissions or bypass validation are rejected at the database level.")
    ]

    for q, a in qa_data:
        story.append(Paragraph(f"<b>{q}</b>", h2_style))
        story.append(Paragraph(a, body_style))

    # Build PDF with dynamic NumberedCanvas
    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"Successfully generated technical report PDF: {filename}")

if __name__ == '__main__':
    out_path = os.path.join('docs', 'Inauguration_Presenter_Notes_GHSS_Shangus.pdf')
    build_pdf(out_path)
    root_path = 'Inauguration_Presenter_Notes_GHSS_Shangus.pdf'
    build_pdf(root_path)
