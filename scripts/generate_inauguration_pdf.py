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
        
        # Header (pages > 1)
        if self._pageNumber > 1:
            self.drawString(36, 11 * inch - 28, "GOVT. HIGHER SECONDARY SCHOOL SHANGUS • INAUGURATION PRESENTATION GUIDE")
            self.setFont("Helvetica", 8)
            self.setFillColor(colors.HexColor("#64748b"))
            self.drawRightString(8.5 * inch - 36, 11 * inch - 28, "Digital Campus & Governance Suite")
            self.setStrokeColor(colors.HexColor("#cbd5e1"))
            self.setLineWidth(0.6)
            self.line(36, 11 * inch - 32, 8.5 * inch - 36, 11 * inch - 32)
        
        # Footer (all pages)
        self.setStrokeColor(colors.HexColor("#cbd5e1"))
        self.setLineWidth(0.6)
        self.line(36, 38, 8.5 * inch - 36, 38)
        
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748b"))
        self.drawString(36, 25, "Official Inauguration Address & Speaker Notes • Designed for Live Demonstration")
        page_str = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(8.5 * inch - 36, 25, page_str)
        self.restoreState()

def build_pdf(filename):
    doc = SimpleDocTemplate(
        filename,
        pagesize=letter,
        leftMargin=36,
        rightMargin=36,
        topMargin=44,
        bottomMargin=46
    )

    styles = getSampleStyleSheet()

    # Custom styles
    c_primary = colors.HexColor("#064e3b")
    c_teal = colors.HexColor("#0f766e")
    c_dark = colors.HexColor("#0f172a")
    c_slate = colors.HexColor("#334155")
    c_amber = colors.HexColor("#b45309")

    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=c_primary,
        alignment=1, # Center
        spaceAfter=4
    )

    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=15,
        textColor=c_teal,
        alignment=1,
        spaceAfter=12
    )

    meta_style = ParagraphStyle(
        'DocMeta',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor("#475569"),
        alignment=1,
        spaceAfter=14
    )

    h1_style = ParagraphStyle(
        'H1',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=14,
        leading=18,
        textColor=c_primary,
        spaceBefore=12,
        spaceAfter=6,
        keepWithNext=True
    )

    h2_style = ParagraphStyle(
        'H2',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=15,
        textColor=c_teal,
        spaceBefore=9,
        spaceAfter=4,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'Body',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9.2,
        leading=13.5,
        textColor=c_dark,
        spaceAfter=6
    )

    speech_style = ParagraphStyle(
        'SpeechText',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9.2,
        leading=14,
        textColor=colors.HexColor("#0f172a"),
        spaceAfter=6
    )

    cue_style = ParagraphStyle(
        'StageCue',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor("#b45309"),
        spaceBefore=2,
        spaceAfter=4
    )

    bullet_style = ParagraphStyle(
        'Bullet',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=c_dark,
        leftIndent=12,
        spaceAfter=3
    )

    table_cell = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=11.5,
        textColor=c_dark
    )

    table_header = ParagraphStyle(
        'TableHead',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11.5,
        textColor=colors.white
    )

    story = []

    # ─────────────────────────────────────────────────────────
    # HEADER & TITLE
    # ─────────────────────────────────────────────────────────
    story.append(Paragraph("GOVERNMENT HIGHER SECONDARY SCHOOL SHANGUS", title_style))
    story.append(Paragraph("OFFICIAL INAUGURATION KEYNOTE ADDRESS & PRESENTER'S COMPANION GUIDE", subtitle_style))
    story.append(Paragraph("<b>Authoritative Walkthrough & Demonstration Manual for the Digital Campus Ecosystem</b><br/><i>Architecture: 130,000+ Lines of Production Cloud Code • Powered by React, Firebase Cloud Firestore & Automated Engines</i>", meta_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=c_primary, spaceBefore=0, spaceAfter=10))

    # ─────────────────────────────────────────────────────────
    # QUICK REFERENCE: TIMING & AGENDA
    # ─────────────────────────────────────────────────────────
    story.append(Paragraph("1. Executive Presentation Agenda & Stage Timing", h1_style))
    
    agenda_data = [
        [Paragraph("Phase", table_header), Paragraph("Topic & Core Focus", table_header), Paragraph("Key Screen / Live Demo Action", table_header), Paragraph("Duration", table_header)],
        [Paragraph("<b>Phase 1</b>", table_cell), Paragraph("<b>Opening & Visionary Hook:</b> Welcoming dignitaries; the transition from paper to a 21st-century digital campus.", table_cell), Paragraph("Landing on Homepage & Hero Slideshow", table_cell), Paragraph("3 min", table_cell)],
        [Paragraph("<b>Phase 2</b>", table_cell), Paragraph("<b>Public Institutional Gateway:</b> Transparency, dynamic notices, subject combinations, faculty roster & mobile PWA.", table_cell), Paragraph("Scroll Notice Board & Dynamic Faculty Grid", table_cell), Paragraph("3 min", table_cell)],
        [Paragraph("<b>Phase 3</b>", table_cell), Paragraph("<b>Student Lifecycle & Admissions:</b> 4-stage admission portal, automated roll allotment, fee reconciliation & ID cards.", table_cell), Paragraph("Open Admission Portal & Roll Number Assigner", table_cell), Paragraph("4 min", table_cell)],
        [Paragraph("<b>Phase 4</b>", table_cell), Paragraph("<b>Academic & Teacher Grid:</b> Smart daily attendance matrix, science practicals scoring & award rolls.", table_cell), Paragraph("Demonstrate Teacher Attendance & Practicals Tab", table_cell), Paragraph("4 min", table_cell)],
        [Paragraph("<b>Phase 5</b>", table_cell), Paragraph("<b>Administrative Powerhouse:</b> 11,400-line Advanced Reports Suite, Certificate Studio, Form 16 Tax Calculator & Financial Ledgers.", table_cell), Paragraph("Live Demo: Certificate Generator & Tax Engine", table_cell), Paragraph("6 min", table_cell)],
        [Paragraph("<b>Phase 6</b>", table_cell), Paragraph("<b>Cloud Security & Speed:</b> Zero-trust Firebase rules, military-grade PBKDF2 auth, offline speed & data privacy.", table_cell), Paragraph("Show 2-Step Handshake OTP & Cloud Sync Banner", table_cell), Paragraph("3 min", table_cell)],
        [Paragraph("<b>Phase 7</b>", table_cell), Paragraph("<b>Grand Inauguration Launch:</b> Formal dedication to students and countdown with Hon'ble Principal & Chief Guests.", table_cell), Paragraph("Principal / Chief Guest clicks Inauguration Banner", table_cell), Paragraph("2 min", table_cell)],
    ]

    t_agenda = Table(agenda_data, colWidths=[1.0*inch, 3.2*inch, 2.5*inch, 0.8*inch])
    t_agenda.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), c_primary),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#cbd5e1")),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.HexColor("#f8fafc"), colors.white]),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('TOPPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(t_agenda)
    story.append(Spacer(1, 10))

    # ─────────────────────────────────────────────────────────
    # MASTER INAUGURAL SPEECH (WORD-FOR-WORD)
    # ─────────────────────────────────────────────────────────
    story.append(Paragraph("2. Master Keynote Speech (Verbatim Delivery Script)", h1_style))
    story.append(Paragraph("<i>Use the verbatim script below for confident, inspiring, and eloquent delivery from the podium. Stage cues are marked in bold brown.</i>", meta_style))

    story.append(Paragraph("<b>[STAGE CUE: Stand tall at the podium, smile warmly, look at the Chief Guest, Principal, and gathering, and begin with a clear, resonant tone.]</b>", cue_style))
    story.append(Paragraph("Respected Chief Guest, Worthy Principal Sir, esteemed faculty members, distinguished community elders, dear parents, and my vibrant student friends: A very warm and auspicious good morning to each and every one of you.", speech_style))
    
    story.append(Paragraph("Today marks a historic turning point in the illustrious journey of <b>Government Higher Secondary School Shangus</b>. For decades, this great institution has stood as an unwavering beacon of wisdom, character building, and academic excellence in our valley. Today, we take a giant, quantum leap into the modern digital era.", speech_style))

    story.append(Paragraph("<b>[STAGE CUE: Point towards the projector screen showing the vibrant, modern GHSS Shangus homepage.]</b>", cue_style))
    story.append(Paragraph("It is my immense honor and privilege to present before you the official digital backbone of our school—a custom-crafted, world-class, paperless management ecosystem and institutional web portal spanning over <b>130,000 lines of precision-engineered code</b>.", speech_style))

    story.append(Paragraph("This is not just a standard school website. It is an end-to-end <b>Enterprise Digital Campus</b> that unifies our public community, our students, our teachers, and our administrative machinery into a single, seamless, high-speed cloud platform.", speech_style))

    # Speech Section 1
    story.append(Paragraph("<b>1. The Public Institutional Gateway — Transparency at Every Click</b>", h2_style))
    story.append(Paragraph("<b>[STAGE CUE: Scroll gently down the Homepage, showcasing the real-time Notice Ticker, the dynamic Hero Carousel, and the Staff Directory.]</b>", cue_style))
    story.append(Paragraph("First, let us look at our public gateway. In the past, whenever a parent or student needed an urgent date sheet, a syllabus notification, or an admission update, they had to travel miles to check the physical notice board. Today, that entire paradigm is transformed.", speech_style))
    story.append(Paragraph("Every announcement, holiday notification, and institutional order published by our administrative office appears <b>instantly in real time</b> on this homepage, accessible from any smartphone in the world within milliseconds. Our dynamic faculty roster honors our teachers by displaying their qualifications, subjects, and departments with crystal clarity.", speech_style))

    # Speech Section 2
    story.append(Paragraph("<b>2. Automated Student Lifecycle & Online Admissions</b>", h2_style))
    story.append(Paragraph("<b>[STAGE CUE: Click on 'Admissions' in the navigation bar and show the 4-step streamlined admission form.]</b>", cue_style))
    story.append(Paragraph("Consider the student admission process. Previously, hundreds of applicants stood in long queues during freezing winter or peak admission seasons, filling multiple paper forms that had to be manually recorded into physical ledger books.", speech_style))
    story.append(Paragraph("Now, with our <b>Online Admission Suite</b>, a student can submit their complete application, select their subject streams with built-in validation rules, and receive an official, timestamped PDF acknowledgement slip with a verified Form Number directly on their phone. On the administrative side, our portal features intelligent bulk roll number assignment with auto-fill logic, eliminating human errors and reconciling admission records in seconds.", speech_style))

    # Speech Section 3
    story.append(Paragraph("<b>3. Faculty & Academic Operations — Empowering Our Teachers</b>", h2_style))
    story.append(Paragraph("<b>[STAGE CUE: Navigate to the Teacher Portal, show the interactive Daily Attendance Grid and Science Practicals scoring engine.]</b>", cue_style))
    story.append(Paragraph("Our teachers are the true heartbeat of GHSS Shangus. We have engineered specialized, intuitive workspaces dedicated exclusively to reducing their administrative burden so they can focus on what matters most: <i>teaching and inspiring our youth</i>.", speech_style))
    story.append(Paragraph("Through the <b>Teacher Workspace</b>, faculty members can record daily classroom attendance in less than 30 seconds with automated present/absent analytics. Furthermore, our state-of-the-art <b>Science Practicals Scoring Engine</b> automatically compiles laboratory scores, checks minimum passing thresholds, formats official board-ready award rolls, and archives performance records without a single manual calculation.", speech_style))

    # Speech Section 4
    story.append(Paragraph("<b>4. The Administrative Powerhouse & Governance Suite</b>", h2_style))
    story.append(Paragraph("<b>[STAGE CUE: Open the Admin Portal. Demonstrate the Student Certificate Studio and the Staff Tax Calculator.]</b>", cue_style))
    story.append(Paragraph("Where this platform truly shines as an institutional marvel is inside the <b>Administrative Governance Suite</b>. Allow me to highlight three revolutionary capabilities:", speech_style))
    
    story.append(Paragraph("• <b>The Instant Student Certificate Studio:</b> Generating Character Certificates, Provisional Certificates, Bonafide Letters, and Transfer Certificates used to take days of manual typing and ledger searching. Today, with one click, the system hydrates the student's verified records, embeds an anti-forgery verification QR code, and generates an official, ready-to-print institutional certificate in under 5 seconds.", bullet_style))
    story.append(Paragraph("• <b>Bulk Student ID Card Engine:</b> With one click, hundreds of student ID cards are dynamically formatted with high-resolution photo integration, blood groups, parent contact numbers, and barcode identifiers, saving the institution tens of thousands of rupees in external outsourcing.", bullet_style))
    story.append(Paragraph("• <b>Comprehensive Staff Income Tax & Form 16 Calculator:</b> An intelligent financial engine specifically customized for Jammu & Kashmir government employees, computing both Old and New Tax Regimes, standard deductions, HRA exemptions, and 80C rebates with instant Form 16 generation.", bullet_style))

    # Speech Section 5
    story.append(Paragraph("<b>5. Security, Privacy & Cloud Reliability</b>", h2_style))
    story.append(Paragraph("<b>[STAGE CUE: Point to the green security badge in the top bar.]</b>", cue_style))
    story.append(Paragraph("Behind this sleek interface lies an enterprise-grade cloud foundation powered by Google Cloud and Firebase. Every single student record is protected by <b>zero-trust security rules</b>. Administrative access requires military-grade PBKDF2 salted encryption and 2-step token verification. Even in areas with limited network connectivity, our smart client-side caching ensures pages load in the blink of an eye.", speech_style))

    # Speech Conclusion
    story.append(Paragraph("<b>6. The Dedication & Grand Launch</b>", h2_style))
    story.append(Paragraph("<b>[STAGE CUE: Turn respectfully towards the Principal Sir and Chief Guests.]</b>", cue_style))
    story.append(Paragraph("Ladies and gentlemen, this digital transformation is not merely a milestone in software engineering—it is a solemn promise of transparency, efficiency, and world-class educational empowerment for every boy and girl in the Shangus region.", speech_style))
    story.append(Paragraph("With immense pride, gratitude to our leadership, and boundless hope for our students' bright future, I now invite our Worthy Principal Sir and Hon'ble Dignitaries to press the ceremonial button and declare the <b>Govt. Higher Secondary School Shangus Digital Campus officially live!</b>", speech_style))
    story.append(Paragraph("<b>[STAGE CUE: Lead the auditorium in enthusiastic applause and gesture dignitaries to the screen!]</b>", cue_style))

    story.append(Spacer(1, 10))
    story.append(HRFlowable(width="100%", thickness=1, color=c_teal, spaceBefore=4, spaceAfter=8))

    # ─────────────────────────────────────────────────────────
    # MODULE-BY-MODULE FEATURE DEEP DIVE FOR LIVE DEMO
    # ─────────────────────────────────────────────────────────
    story.append(Paragraph("3. Presenter's Live Demonstration Cue Cards", h1_style))
    story.append(Paragraph("<i>Keep these tactical bullet points in mind during the live demo and open Q&A session:</i>", meta_style))

    features_data = [
        [Paragraph("Feature Area", table_header), Paragraph("Key Capabilities to Highlight", table_header), Paragraph("Talking Point for Dignitaries", table_header)],
        [
            Paragraph("<b>1. Public Gateway & CMS</b>", table_cell),
            Paragraph("• Instant Notice Publisher with 'Days Active' badge<br/>• Dynamic Hero Slideshow manager<br/>• Complete Subject Stream combinations<br/>• Instant WhatsApp & Email contact links", table_cell),
            Paragraph("Zero recurring web agency costs; school administrators update content in real time from any device.", table_cell)
        ],
        [
            Paragraph("<b>2. Admissions & Student Data</b>", table_cell),
            Paragraph("• Multi-stage student registration<br/>• Automated Form Number generator<br/>• Real-time provisional to full admission upgrades<br/>• Auto-fill roll number sequencing", table_cell),
            Paragraph("Eliminates admission queues and paperwork; complete digital archive from Day 1.", table_cell)
        ],
        [
            Paragraph("<b>3. Teacher & Academic Grid</b>", table_cell),
            Paragraph("• 30-second daily attendance matrix<br/>• Practical scoring with auto-aggregates<br/>• Board-ready practical award rolls<br/>• Secure teacher authentication & 2-step verification", table_cell),
            Paragraph("Saves hundreds of teacher-hours each month, completely eliminating manual score tallying.", table_cell)
        ],
        [
            Paragraph("<b>4. Certificate & ID Studio</b>", table_cell),
            Paragraph("• Character, Bonafide, Transfer, DOB certificates<br/>• Dynamic QR-code verification badge<br/>• Bulk ID card generation with photo hydration<br/>• Official letter & dispatch layout writer", table_cell),
            Paragraph("Certificates issued in 5 seconds instead of 3 days. Zero risk of duplicate or forged credentials.", table_cell)
        ],
        [
            Paragraph("<b>5. Staff Tax & Ledger Suite</b>", table_cell),
            Paragraph("• Old vs New tax regime comparative engine<br/>• Surcharge brackets, 87A rebate & cess math<br/>• Financial ledger & school fund distributions<br/>• Printable PDF Form 16 statements", table_cell),
            Paragraph("Eliminates tax computation disputes and provides complete financial transparency for faculty.", table_cell)
        ],
        [
            Paragraph("<b>6. Advanced Reports Engine</b>", table_cell),
            Paragraph("• 11,400+ LOC analytical powerhouse<br/>• Multi-parameter filtering (Stream, Gender, Category)<br/>• Export to PDF, CSV, Excel & Print-ready formats<br/>• Recycle bin with restore safety guards", table_cell),
            Paragraph("Instant statistical submissions for Chief Education Office (CEO) and Directorate reports.", table_cell)
        ],
    ]

    t_features = Table(features_data, colWidths=[1.5*inch, 3.4*inch, 2.6*inch])
    t_features.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), c_teal),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#cbd5e1")),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.HexColor("#f8fafc"), colors.white]),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('TOPPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(t_features)
    story.append(Spacer(1, 10))

    # ─────────────────────────────────────────────────────────
    # ANTICIPATED Q&A & CONFIDENT RESPONSES
    # ─────────────────────────────────────────────────────────
    story.append(Paragraph("4. Anticipated Questions & Confident Answers (Q&A Cheat Sheet)", h1_style))

    qas = [
        ("Q1: Is student and faculty data completely safe on this platform?",
         "<b>Answer:</b> Yes, absolutely. The portal implements enterprise-grade Cloud Firestore security rules where student records are strictly isolated. Critical administrative functions are shielded by military-grade PBKDF2 salted password hashing and 2-step verification handshakes. No unauthorized user can access or modify records."),
        ("Q2: What happens if a teacher or student has slow 2G/3G mobile internet?",
         "<b>Answer:</b> The platform is built as a lightweight Progressive Web App (PWA) utilizing browser-level caching (BroadcastChannel and LocalStorage). Once loaded, pages and portals operate instantly with sub-second responsiveness, even on modest internet speeds."),
        ("Q3: Is technical expertise required to manage notices, slides, or student records?",
         "<b>Answer:</b> Not at all. The administrative interface is designed with a user-friendly, point-and-click CMS. Adding a notice, updating a photo, or assigning roll numbers requires no coding whatsoever and can be done in seconds by any staff member."),
        ("Q4: How does this portal assist higher educational authorities (CEO/DSEK)?",
         "<b>Answer:</b> With our built-in Advanced Reports Suite, any institutional query—such as total enrollment by stream, gender ratio, category breakdown, or practical exam status—can be generated and exported to official PDF/Excel in a single click.")
    ]

    for q, a in qas:
        story.append(Paragraph(f"<b>{q}</b>", h2_style))
        story.append(Paragraph(a, body_style))

    # Build Document with custom NumberedCanvas
    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"Successfully generated presentation PDF: {filename}")

if __name__ == '__main__':
    out_path = os.path.join('docs', 'Inauguration_Presenter_Notes_GHSS_Shangus.pdf')
    build_pdf(out_path)
    
    # Also write a root copy for easy accessibility
    root_path = 'Inauguration_Presenter_Notes_GHSS_Shangus.pdf'
    build_pdf(root_path)
