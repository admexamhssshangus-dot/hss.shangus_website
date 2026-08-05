/**
 * HSS SHANGUS — Modern React-Tailwind Style Student Application & Section Forms PDF Generator
 * Renders complete Govt Higher Secondary School Shangus admission forms, library forms,
 * and anti-drug declarations with all undertakings consolidated on the Declaration Page.
 */

function formatDateTimeDDMMMYYYY(rawDate) {
  if (!rawDate || rawDate === 'N/A' || rawDate === '—') {
    const d = new Date();
    const day = String(d.getDate()).padStart(2, '0');
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = monthNames[d.getMonth()];
    const year = d.getFullYear();
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const strHours = String(hours).padStart(2, '0');
    return `${day}-${month}-${year}, ${strHours}:${minutes} ${ampm}`;
  }
  try {
    const d = new Date(rawDate);
    if (isNaN(d.getTime())) return String(rawDate);
    const day = String(d.getDate()).padStart(2, '0');
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = monthNames[d.getMonth()];
    const year = d.getFullYear();
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const strHours = String(hours).padStart(2, '0');
    return `${day}-${month}-${year}, ${strHours}:${minutes} ${ampm}`;
  } catch (e) {
    return String(rawDate);
  }
}

/**
 * Computes the current Indian academic session (e.g. "2026-27") so the PDF never shows
 * a stale hardcoded session once the school year rolls over.
 */
function getCurrentAcademicSession() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0 = Jan
  // J&K schools typically start the academic session around March.
  if (month >= 2) {
    return `${year}-${String(year + 1).slice(-2)}`;
  }
  return `${year - 1}-${String(year).slice(-2)}`;
}

/**
 * Derives a division label from a percentage string like "62.40%" instead of always
 * printing a hardcoded "1st Div." regardless of the student's actual marks.
 */
function getDivisionFromPercentage(pctStr) {
  const p = parseFloat(pctStr);
  if (isNaN(p)) return '—';
  if (p >= 60) return '1st Division';
  if (p >= 45) return '2nd Division';
  if (p >= 33) return '3rd Division';
  return 'Fail';
}

/**
 * Helper to build HTML for single or bulk student form pages based on section options.
 */
export function buildStudentFormHtml(studentData, options = {}) {
  const {
    includeAdmissionForm = true,
    includeLibraryForm = true,
    separateDeclaration = false
  } = options;

  if (!studentData) return '';

  const formNo = studentData['Form Number'] || studentData['FormNo'] || studentData['formNo'] || studentData['form_no'] || 'N/A';
  const name = String(studentData["Student's Name (as per school records)"] || studentData["Student's Name"] || studentData['studentName'] || studentData['name'] || 'N/A').toUpperCase();
  const fatherName = String(studentData["Father's/Guardian's Name (as per school records)"] || studentData["Father's Name"] || studentData['fatherName'] || studentData['parentName'] || 'N/A').toUpperCase();
  const fatherOccupation = studentData["Father's/Guardian's Occupation"] || studentData["Father's Occupation"] || studentData["Father Occupation"] || studentData['fatherOccupation'] || 'N/A';
  const motherName = String(studentData["Mother's Name (as per school records)"] || studentData["Mother's Name"] || studentData['motherName'] || 'N/A').toUpperCase();
  const dob = studentData["DoB (as per school records)"] || studentData["DoB"] || studentData['dob'] || 'N/A';
  const gender = studentData["Gender"] || studentData['gender'] || 'N/A';
  const mobile = studentData["Mobile No. (with working WhatsApp)"] || studentData["Mobile No."] || studentData['mobile'] || 'N/A';
  const parentMobile = studentData["Parent's Mobile No. (must be working)"] || studentData["Father's/Guardian's Contact No."] || studentData["Parent Contact"] || studentData['parentMobile'] || studentData['parentContact'] || 'N/A';
  const email = studentData["Email Address"] || studentData["email"] || 'N/A';

  // Fee & Payment Transaction Details (Gateway ready for Razorpay / Cashfree)
  const paymentStatus = studentData['Payment Status'] || studentData['paymentStatus'] || studentData['feeStatus'] || studentData['cf_payment_status'] || studentData['razorpay_status'] || (studentData['isPaid'] ? 'PAID & VERIFIED' : 'Fee Pending / Not Collected');
  const txnId = studentData['Transaction ID'] || studentData['txnId'] || studentData['transactionId'] || studentData['razorpay_payment_id'] || studentData['cf_payment_id'] || studentData['utrNo'] || studentData['UTR'] || '—';
  const feeAmount = studentData['Fee Amount'] || studentData['feeAmount'] || studentData['amountPaid'] || studentData['fee'] || studentData['amount'] || '—';
  const paymentDate = studentData['Payment Date'] || studentData['paymentDate'] || studentData['txnDate'] || (studentData['paymentTimestamp'] ? formatDateTimeDDMMMYYYY(studentData['paymentTimestamp']) : '—');
  const paymentMode = studentData['Payment Mode'] || studentData['paymentMode'] || studentData['gateway'] || (studentData['razorpay_payment_id'] ? 'Razorpay Gateway' : studentData['cf_payment_id'] ? 'Cashfree Gateway' : '—');
  const receiptNo = studentData['Receipt No'] || studentData['receiptNo'] || studentData['receipt'] || studentData['orderId'] || studentData['razorpay_order_id'] || studentData['cf_order_id'] || '—';

  // Address
  const houseNo = studentData["House No."] || studentData["H.No."] || studentData['houseNo'] || '—';
  const village = studentData["Name of your village"] || studentData["Village"] || studentData['village'] || 'N/A';
  const block = studentData["Block"] || studentData['block'] || 'Achabal';
  const tehsil = studentData["Tehsil"] || studentData['tehsil'] || 'Anantnag';
  const district = studentData["District"] || studentData['district'] || 'Anantnag';
  const stateUt = studentData["State/UT"] || studentData["State"] || studentData['state'] || 'J&K';
  const pin = studentData["PIN code"] || studentData['pin'] || '192201';

  // Social & Physical
  const bloodGroup = studentData["Blood Group"] || studentData['bloodGroup'] || '—';
  const motherTongue = studentData["Your Mother Tongue"] || studentData["Mother Tongue"] || studentData['motherTongue'] || 'Kashmiri';
  const height = studentData["Height (cm)"] || studentData['height'] || '—';
  const weight = studentData["Weight (kg)"] || studentData['weight'] || '—';
  const religion = studentData["Religion"] || studentData['religion'] || 'Islam';
  const category = studentData["Social category"] || studentData['category'] || 'OM';
  const socioCat = studentData["Socio-economic category"] || studentData["Socio-economic Category"] || studentData['socioEconomicCategory'] || 'BPL';

  // Disability & Scholarship
  const isDiffAbled = studentData["Whether Any Disability"] || studentData["Whether Differently Abled"] || studentData['isDiffAbled'] || 'No';
  const disabilityType = studentData["Type of Disability"] || studentData["Disability Type"] || studentData['disabilityType'] || '—';
  const scholarPrev = studentData["Whether scholarship received in previous academic year"] || studentData["Whether scholarship received in Previous Academic Year"] || studentData['scholarPrev'] || 'No';
  const scholarType = studentData["Type of scholarship received"] || studentData["Scholarship Type"] || studentData['scholarType'] || '—';
  const scholarAmount = studentData["Amount received (INR)"] || studentData["Scholarship Amount Received"] || studentData['scholarAmount'] || '—';

  // Bank & Identifiers
  const bankAcc = studentData["Bank Account No."] || studentData['bankAccount'] || 'N/A';
  const bankName = studentData["Name of Bank"] || studentData['bankName'] || 'J&K Bank';
  const ifsc = studentData["IFSC code"] || studentData['ifsc'] || 'JAKA0SANGUS';
  const penNo = studentData["PEN number (given by UDISE portal)"] || studentData["PEN No."] || studentData['penNo'] || 'N/A';
  const apaarId = studentData["APAAR ID"] || studentData['apaarId'] || 'N/A';

  // Current & Previous Class Info
  const classSought = studentData["Admission sought for class"] || studentData["Class"] || studentData['class'] || 'N/A';
  const stream = studentData["Stream for Class 11th"] || studentData["Stream opted in Class 11th"] || studentData["Stream & Subjects for Class 12th"] || studentData["Stream"] || studentData['stream'] || 'General';
  const subjects = studentData["Subjects to be taken in Class 11th"] || studentData["Subjects Studied in Class 11th"] || studentData["Subjects to be taken in Class 10th"] || studentData["Subjects Studied in Class 10th"] || studentData["Subs"] || studentData["Subjects"] || studentData['subjects'] || 'N/A';
  const photoUrl = studentData["Student Photo"] || studentData["photo_id"] || studentData["photoUrl"] || studentData["photo"] || '/logo.png';
  const rollNo = studentData["Class Roll No"] || studentData["rollNo"] || studentData["Class R.No."] || '—';
  const admNo = studentData["Admission Number"] || studentData["admNo"] || studentData["Adm No."] || '—';
  const section = studentData["Section"] || studentData['section'] || '—';
  const session = studentData["Session"] || studentData['session'] || getCurrentAcademicSession();
  const aadhaar = studentData["Aadhar No."] || studentData['aadhar'] || studentData['aadhaar'] || 'N/A';

  // Previous Academic History (Single Clean Row) — dynamically resolved against the class actually
  // preceding the class sought, instead of always preferring 10th-class data.
  const prevExamClass = String(classSought).includes('12') ? '11th' : '10th';
  const prevSchool = studentData[`Name of Previous School (Class ${prevExamClass})`] || studentData["Previous School"] || studentData["Previous School Name"] || studentData['prevSchool'] || 'GOVT HR SEC SCHOOL SHANGUS';
  const prevBoard = studentData[`Board (Class ${prevExamClass})`] || studentData["Board Name"] || studentData['prevBoard'] || 'JKBOSE';
  const prevRollNo = studentData[`Exam Roll Number of Class ${prevExamClass}`] || studentData["Prev. Exam Roll No."] || studentData['prevRollNo'] || 'N/A';
  const dietBoardReg = studentData[`Board Registration No. (Class ${prevExamClass})`] || studentData["DIET Registration No."] || studentData["DIET/Board Reg. No."] || studentData["Board Reg. No."] || studentData['boardRegNo'] || 'N/A';
  const prevComplex = studentData["Name of Previous Complex Head"] || studentData["Prev. Complex Head"] || studentData['prevComplex'] || 'N/A';
  const prevYear = studentData[`Year of Passing Class ${prevExamClass}`] || studentData["Previous Year of Passing"] || studentData['prevYear'] || 'N/A';
  const prevMarks = studentData[`Total Marks Obtained in Class ${prevExamClass}`] || studentData["Total Marks Obtained in Class 10th"] || studentData["Total Marks Obtained in Class 11th"] || studentData["Marks Obtained"] || 'N/A';
  const prevMax = studentData[`Total Max. Marks in Class ${prevExamClass}`] || studentData["Total Max. Marks in Class 10th"] || studentData["Total Max. Marks in Class 11th"] || studentData["Max Marks"] || '500';
  const prevPct = studentData["Previous Percentage"] || studentData[`Percentage (Class ${prevExamClass})`] || (prevMarks !== 'N/A' && !isNaN(prevMarks) && !isNaN(prevMax) && parseFloat(prevMax) > 0 ? ((parseFloat(prevMarks) / parseFloat(prevMax)) * 100).toFixed(2) + '%' : 'N/A');
  const prevDiv = studentData["Previous Division"] || getDivisionFromPercentage(prevPct);

  // Sports & Extra-Curricular
  const idMark = studentData["Identification Mark (if any)"] || studentData["Identification Mark"] || studentData['idMark'] || '—';
  const prevSports = studentData["Previous participation in sports (if any)"] || studentData["Previous Sports Participation"] || studentData['prevSports'] || '—';

  const rawSubmDate = studentData["submittedAt"] || studentData["Submission Date"] || studentData["created_at"];
  const formattedSubmDate = formatDateTimeDDMMMYYYY(rawSubmDate);

  let html = '';

  // ──────────────────────────────────────────────────────────
  // SECTION 1: CONSOLIDATED 1-PAGE ADMISSION APPLICATION FORM
  // ──────────────────────────────────────────────────────────
  if (includeAdmissionForm) {
    html += `
      <!-- PAGE 1: CONSOLIDATED ADMISSION APPLICATION FORM -->
      <div class="print-page page-a4-consolidated">
        <div class="header-box">
          <div class="header-seal-col">
            <img src="/logo.png" alt="School Seal" class="header-logo" onerror="this.style.visibility='hidden';" />
          </div>
          <div class="header-text-col">
            <h1 class="school-title">Govt. Higher Secondary School Shangus</h1>
            <p class="school-sub">Anantnag Kashmir — 192201</p>
            <p class="school-badge">Board Reg. No.: <strong>010061</strong> | UDISE code: <strong>01061400618</strong></p>
          </div>
        </div>

        <div class="form-title-bar">
          <span>ADMISSION & REGISTRATION APPLICATION FORM — CLASS ${classSought.toUpperCase()} (${stream.toUpperCase()})</span>
        </div>

        <!-- Document Metadata Bar (Form No, Session, Submission Date & Timestamp) -->
        <table class="grid-table border-table" style="margin-bottom: 4px; background: #f0fdf4;">
          <tr>
            <td class="lbl blue-lbl" style="width: 12%;">Form Number:</td>
            <td class="val bold-txt red-txt" style="width: 16%; font-size: 10.5px;">${formNo}</td>
            <td class="lbl blue-lbl" style="width: 15%; font-weight: bold;">Academic Session:</td>
            <td class="val" style="width: 18%;">
              <span style="display: inline-block; background: #dbeafe; color: #1e40af; border: 1.5px solid #3b82f6; font-size: 11.5px; font-weight: 900; padding: 1.5px 8px; border-radius: 4px; letter-spacing: 0.5px;">
                ${session}
              </span>
            </td>
            <td class="lbl blue-lbl" style="width: 16%;">Online Submission:</td>
            <td class="val bold-txt" style="width: 23%; font-size: 9px; color: #0f766e;">${formattedSubmDate}</td>
          </tr>
        </table>

        <div class="top-row-grid">
          <div class="details-left">
            <table class="grid-table border-table">
              <tr>
                <td class="lbl blue-lbl">Student's Name:</td>
                <td class="val bold-txt">${name}</td>
                <td class="lbl blue-lbl">Date of Birth:</td>
                <td class="val bold-txt">${dob}</td>
              </tr>
              <tr>
                <td class="lbl blue-lbl">Father's Name:</td>
                <td class="val bold-txt">${fatherName}</td>
                <td class="lbl blue-lbl">Father Occupation:</td>
                <td class="val">${fatherOccupation}</td>
              </tr>
              <tr>
                <td class="lbl blue-lbl">Mother's Name:</td>
                <td class="val bold-txt">${motherName}</td>
                <td class="lbl blue-lbl">Gender / Cat / Socio:</td>
                <td class="val">${gender} / <strong>${category}</strong> / ${socioCat}</td>
              </tr>
              <tr>
                <td class="lbl blue-lbl">Mobile (WhatsApp):</td>
                <td class="val">${mobile}</td>
                <td class="lbl blue-lbl">Parent Contact:</td>
                <td class="val">${parentMobile}</td>
              </tr>
              <tr>
                <td class="lbl blue-lbl">Aadhaar Number:</td>
                <td class="val">${aadhaar}</td>
                <td class="lbl blue-lbl">Mother Tongue / Religion:</td>
                <td class="val">${motherTongue} / ${religion}</td>
              </tr>
              <tr style="height: 32px;">
                <td class="lbl blue-lbl" style="vertical-align: middle; font-weight: bold; background: #e0f2fe; color: #0369a1;">Class Roll No.:</td>
                <td class="val bold-txt teal-txt" style="vertical-align: middle; font-size: 11px; height: 32px; background: #fafafa;">${rollNo}</td>
                <td class="lbl blue-lbl" style="vertical-align: middle; font-weight: bold; background: #e0f2fe; color: #0369a1;">Admission No. / Sec:</td>
                <td class="val bold-txt" style="vertical-align: middle; font-size: 11px; height: 32px; background: #fafafa;">${admNo} / ${section}</td>
              </tr>
            </table>
          </div>
          <div class="photo-col">
            <div class="photo-box">
              <img src="${photoUrl}" alt="Student Photo" onerror="this.src='/logo.png';" />
            </div>
          </div>
        </div>

        <!-- Address & Residence -->
        <div class="section-heading">Residential Address & Financial Details</div>
        <table class="grid-table border-table">
          <tr>
            <td class="lbl blue-lbl">House No. / Address:</td>
            <td class="val">${houseNo}, ${village}</td>
            <td class="lbl blue-lbl">Block & Tehsil:</td>
            <td class="val">${block}, ${tehsil}</td>
            <td class="lbl blue-lbl">District & State:</td>
            <td class="val">${district}, ${stateUt} (${pin})</td>
          </tr>
          <tr>
            <td class="lbl blue-lbl">Email / Blood / Ht-Wt:</td>
            <td class="val">${email !== 'N/A' ? email : '—'} | ${bloodGroup} | ${height}/${weight}</td>
            <td class="lbl blue-lbl">Bank Account & IFSC:</td>
            <td class="val bold-mono">${bankAcc} (${bankName} / ${ifsc})</td>
            <td class="lbl blue-lbl">Scholarship / Disability:</td>
            <td class="val">${scholarPrev === 'Yes' ? `${scholarType} (₹${scholarAmount})` : 'None'} | ${isDiffAbled === 'Yes' ? disabilityType : 'No'}</td>
          </tr>
        </table>

        <!-- Previous Academic History (Single Clean Row) -->
        <div class="section-heading">Academic History & Official Identifiers</div>
        <table class="grid-table history-table">
          <thead>
            <tr>
              <th>Exam Class</th>
              <th>Year</th>
              <th>Previous School Institution</th>
              <th>Board</th>
              <th>Exam Roll No</th>
              <th>Marks Obt.</th>
              <th>Max Marks</th>
              <th>%age</th>
              <th>Division</th>
            </tr>
          </thead>
          <tbody>
            <tr class="highlight-row">
              <td><strong>Class ${prevExamClass}</strong></td>
              <td>${prevYear}</td>
              <td>${prevSchool}</td>
              <td>${prevBoard}</td>
              <td>${prevRollNo}</td>
              <td>${prevMarks}</td>
              <td>${prevMax}</td>
              <td><strong>${prevPct}</strong></td>
              <td>${prevDiv}</td>
            </tr>
          </tbody>
        </table>

        <table class="grid-table border-table" style="margin-top: 4px;">
          <tr>
            <td class="lbl blue-lbl">Board Reg. No.:</td>
            <td class="val bold-mono">${dietBoardReg}</td>
            <td class="lbl blue-lbl">PEN / APAAR:</td>
            <td class="val bold-mono">${penNo} / ${apaarId}</td>
            <td class="lbl blue-lbl">Complex / Sports:</td>
            <td class="val">${prevComplex} | ${prevSports}</td>
          </tr>
        </table>

        <!-- Subject Allocation -->
        <div class="section-heading">Class & Subject Allocation</div>
        <table class="grid-table border-table">
          <tr>
            <td class="lbl blue-lbl">Admission Class:</td>
            <td class="val bold-txt">Class ${classSought}</td>
            <td class="lbl blue-lbl">Stream Opted:</td>
            <td class="val bold-txt">${stream}</td>
            <td class="lbl blue-lbl">Identification Mark:</td>
            <td class="val">${idMark}</td>
          </tr>
          <tr>
            <td class="lbl blue-lbl">Subjects Offered:</td>
            <td class="val bold-txt blue-txt" colspan="5">${subjects}</td>
          </tr>
        </table>

        <!-- Fee & Payment Details -->
        <div class="section-heading">Fee & Payment Transaction Details</div>
        <table class="grid-table border-table">
          <tr>
            <td class="lbl blue-lbl">Payment Status:</td>
            <td class="val bold-txt teal-txt">${paymentStatus}</td>
            <td class="lbl blue-lbl">Transaction ID / UTR:</td>
            <td class="val bold-mono blue-txt">${txnId}</td>
            <td class="lbl blue-lbl">Amount Paid:</td>
            <td class="val bold-txt red-txt">${feeAmount !== '—' ? `₹${feeAmount}` : '—'}</td>
          </tr>
          <tr>
            <td class="lbl blue-lbl">Payment Date:</td>
            <td class="val">${paymentDate}</td>
            <td class="lbl blue-lbl">Payment Mode:</td>
            <td class="val">${paymentMode}</td>
            <td class="lbl blue-lbl">Receipt Ref No:</td>
            <td class="val bold-mono">${receiptNo}</td>
          </tr>
        </table>

        <!-- Attached Document Checklist -->
        <div class="section-heading">Attached Documents Checklist</div>
        <div class="checklist-grid">
          <span>[✓] Discharge/Character Cert. (Original)</span>
          <span>[✓] Marks Sheet Photocopy</span>
          <span>[✓] Bank Passbook Photocopy</span>
          <span>[✓] Aadhaar & Ration Card</span>
          <span>[✓] Category Cert. (If Any)</span>
        </div>

        ${separateDeclaration ? `
          <!-- Verification Note & Signatures (Full Declaration on Page 3) -->
          <div class="undertaking-compact">
            <p class="undertaking-txt" style="font-size: 8px; color: #475569; margin-bottom: 6px;">
              <strong>Verification Note:</strong> Details verified from original certificates. Full student, parent & anti-drug declarations are executed on the attached Declaration Page (Page 3).
            </p>
            <div class="signatures-row" style="margin-top: 28px;">
              <div class="sig-block">Signature of Student</div>
              <div class="sig-block">Signature of Parent/Guardian</div>
              <div class="sig-block">Sig. of I/C Exam</div>
              <div class="sig-block red-txt font-bold">Principal Signature</div>
            </div>
          </div>
        ` : `
          <!-- Consolidated Declaration of Conduct, Anti-Drug Policy & Parent Undertaking -->
          <div class="section-heading">Declaration of Conduct, Anti-Drug Policy & Parent Undertaking</div>
          <div class="compact-decl-box" style="font-size: 8.8px; line-height: 1.38; padding: 7px 10px; border: 1px solid #cbd5e1; border-radius: 4px; margin-bottom: 6px; color: #1e293b; background: #f8fafc;">
            <div style="font-weight: 800; color: #0f766e; margin-bottom: 2px; text-transform: uppercase; font-size: 9px;">
              1. Declaration by Student:
            </div>
            I, <strong>${name}</strong> (Form No: <strong>${formNo}</strong>), declare that all particulars given above are true, correct, and complete. I undertake to strictly obey all rules and regulations of Govt. HSS Shangus and maintain high standards of academic discipline and moral conduct.
            <div style="font-weight: 800; color: #15803d; margin: 4px 0 2px 0; text-transform: uppercase; font-size: 9px;">
              2. Declaration by Parent / Guardian:
            </div>
            I, <strong>${fatherName}</strong>, hereby request admission for my ward <strong>${name}</strong>. I take full responsibility for his/her conduct, attendance, and moral behavior both inside and outside the institution, and agree to pay all institutional fees.
            <div style="background: #fff1f2; border: 1px solid #fecdd3; border-left: 3.5px solid #e11d48; padding: 5px 8px; border-radius: 3px; margin-top: 4px;">
              <div style="font-weight: 800; color: #b91c1c; margin-bottom: 1.5px; text-transform: uppercase; font-size: 8.5px;">
                3. Anti-Drug, Anti-Smoking & Cell-Phone Ban Undertaking on Oath:
              </div>
              I, <strong>${name}</strong>, do hereby solemnly declare on oath that I shall <strong style="color: #dc2626;">STRICTLY ABSTAIN</strong> from smoking, tobacco, narcotics, illicit drugs, psychotropic substances, or alcohol. Any violation will result in <strong style="color: #dc2626;">IMMEDIATE REVOCATION OF ADMISSION and legal/police proceedings</strong>. Unauthorized <strong style="color: #dc2626;">cell phones are strictly prohibited</strong> on school grounds and will be <strong style="color: #dc2626;">permanently impounded</strong> without return.
            </div>
          </div>

          <div class="signatures-row" style="margin-top: 48px; margin-bottom: 8px;">
            <div class="sig-block">Signature of Student</div>
            <div class="sig-block">Signature of Parent/Guardian</div>
            <div class="sig-block">Sig. of I/C Exam</div>
            <div class="sig-block red-txt font-bold">Principal Signature</div>
          </div>
        `}

        <div class="page-footer-bar">
          <span>Form No: <strong style="color: #000;">${formNo}</strong> | Name: <strong style="color: #000;">${name}</strong> | Class: <strong style="color: #000;">${classSought}</strong></span>
          <span class="font-mono" style="font-weight: bold; color: #475569;">GHSS Shangus — Page 1/${separateDeclaration ? '3' : '2'}</span>
        </div>
      </div>
    `;
  }

  // ──────────────────────────────────────────────────────────
  // SECTION 2: LIBRARY FORM (FULL SINGLE A4 PAGE WITH LARGE HANDWRITING CELLS)
  // ──────────────────────────────────────────────────────────
  if (includeLibraryForm) {
    html += `
      <!-- PAGE 2: LIBRARY FORM (FULL PAGE WITH LARGE CELLS) -->
      <div class="print-page page-a4-library">
        <div class="header-box text-center">
          <div class="header-seal-col">
            <img src="/logo.png" alt="School Seal" class="header-logo" onerror="this.style.visibility='hidden';" />
          </div>
          <div class="header-text-col">
            <h1 class="school-title">Govt. Higher Secondary School Shangus</h1>
            <p class="school-sub">Anantnag Kashmir — 192201</p>
            <p class="school-badge">Board Reg. No.: <strong>010061</strong> | UDISE code: <strong>01061400618</strong></p>
          </div>
        </div>

        <div class="borrower-strip">
          <span>Session: <strong>${session}</strong> (Form No.: <strong>${formNo}</strong>)</span>
          <span class="borrower-box">BORROWER CARD NO: _______________________</span>
        </div>

        <h2 class="library-main-title">LIBRARY MEMBERSHIP & BOOK ISSUE LEDGER</h2>

        <div class="library-student-card">
          <table class="grid-table border-table">
            <tr>
              <td class="lbl blue-lbl">Student's Name:</td>
              <td class="val bold-txt">${name}</td>
              <td rowspan="5" class="photo-cell">
                <div class="photo-frame-library">
                  <img src="${photoUrl}" alt="Photo" onerror="this.src='/logo.png';" />
                </div>
              </td>
            </tr>
            <tr>
              <td class="lbl blue-lbl">Father's Name:</td>
              <td class="val">${fatherName}</td>
            </tr>
            <tr>
              <td class="lbl blue-lbl">Class / Adm. No / Roll No:</td>
              <td class="val bold-txt"><strong>Class ${classSought}</strong> / ${admNo} / <strong class="teal-txt">${rollNo}</strong></td>
            </tr>
            <tr>
              <td class="lbl blue-lbl">Contact Numbers:</td>
              <td class="val">${mobile} (Student) / ${parentMobile} (Parent)</td>
            </tr>
            <tr>
              <td class="lbl blue-lbl">Subjects:</td>
              <td class="val bold-txt" colspan="2">${subjects}</td>
            </tr>
          </table>
        </div>

        <!-- Book Log Table (Spacious 31px cells for manual librarian entry) -->
        <div class="section-heading" style="margin-top: 14px;">Book Issue & Return Log (Librarian Handwriting Register)</div>
        <table class="grid-table library-spacious-table">
          <thead>
            <tr>
              <th style="width: 4%;">#</th>
              <th style="width: 35%;">Name of Book(s) & Author(s)</th>
              <th style="width: 8%;">Acc. No</th>
              <th style="width: 10%;">Date Issued</th>
              <th style="width: 10%;">Date Returned</th>
              <th style="width: 8%;">Days Delay</th>
              <th style="width: 7%;">Fine (₹)</th>
              <th style="width: 9%;">Student Sig.</th>
              <th style="width: 9%;">Librarian Sig.</th>
            </tr>
          </thead>
          <tbody>
            ${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => `
              <tr class="spacious-handwriting-row">
                <td style="text-align: center; font-weight: bold; background: #f8fafc;">${i}</td>
                <td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="signatures-row" style="margin-top: 14px; margin-bottom: 6px;">
          <div class="sig-block">Signature of Student</div>
          <div class="sig-block">Signature of Librarian</div>
          <div class="sig-block red-txt font-bold">Principal Signature</div>
        </div>

        <div class="page-footer-bar">
          <span>Form No: <strong style="color: #000;">${formNo}</strong> | Name: <strong style="color: #000;">${name}</strong> | Class: <strong style="color: #000;">${classSought}</strong></span>
          <span class="font-mono" style="font-weight: bold; color: #475569;">GHSS Shangus — Page 2/${separateDeclaration ? '3' : '2'}</span>
        </div>
      </div>
    `;
  }

  // ──────────────────────────────────────────────────────────
  // SECTION 3: SEPARATE 1-PAGE DECLARATION OF STUDENT CONDUCT & ANTI-DRUG POLICY (IF SEPARATE OPTION ENABLED)
  // ──────────────────────────────────────────────────────────
  if (separateDeclaration) {
    html += `
      <!-- PAGE 3: CONSOLIDATED DECLARATIONS & ANTI-DRUG UNDERTAKING -->
      <div class="print-page page-a4-conduct">
        <div class="header-box text-center">
          <div class="header-seal-col">
            <img src="/logo.png" alt="School Seal" class="header-logo" onerror="this.style.visibility='hidden';" />
          </div>
          <div class="header-text-col">
            <h1 class="school-title">Govt. Higher Secondary School Shangus</h1>
            <p class="school-sub">Anantnag Kashmir — 192201</p>
            <p class="school-badge">Board Reg. No.: <strong>010061</strong> | UDISE code: <strong>01061400618</strong></p>
          </div>
        </div>

        <div class="form-title-bar" style="background: #991b1b; margin-bottom: 8px;">
          DECLARATION OF STUDENT CONDUCT, UNDERTAKING & ANTI-DRUG POLICY
        </div>

        <div class="conduct-body-box" style="font-size: 9.5px; line-height: 1.45; color: #1e293b;">
          <!-- SECTION A: DECLARATION BY STUDENT -->
          <h3 style="font-size: 11px; font-weight: 800; color: #991b1b; margin: 4px 0 3px 0;">Declaration by Student</h3>
          <ul style="margin: 0 0 8px 14px; padding: 0; list-style-type: disc;">
            <li>I declare that I have read each detail written in this application form.</li>
            <li>I declare that all the particulars and information given in the application form are true, correct, and complete and shall form the basis of my admission/registration at this institution.</li>
            <li>I undertake to inform this institution regarding any change in my opinion of any kind related to my admission.</li>
            <li>I shall obey all the rules and regulations of this institution issued from time to time by the management.</li>
            <li>I confirm that the sanction of my admission is subject to the execution of documents as per the institution's requirements.</li>
            <li>I agree that the institution has a right to make such inquiries about me as it deems fit to avoid law and order problems.</li>
          </ul>

          <!-- SECTION B: DECLARATION BY PARENT / GUARDIAN -->
          <h3 style="font-size: 11px; font-weight: 800; color: #991b1b; margin: 6px 0 3px 0;">Declaration by Parent/Guardian</h3>
          <ul style="margin: 0 0 10px 14px; padding: 0; list-style-type: disc;">
            <li>I hereby request the admission of my son/daughter, <strong>${name}</strong>, to Govt. HSS Shangus. I take full responsibility for his/her conduct both inside and outside the institution. I understand and agree to pay all required fees and expenses during his/her stay at the institution.</li>
          </ul>

          <!-- SECTION C: UNDERTAKING ON OATH & ANTI-DRUG POLICY -->
          <div style="background: #fff1f2; border: 1px solid #fecdd3; border-left: 4px solid #e11d48; padding: 8px 10px; border-radius: 4px; margin-top: 6px;">
            <p style="margin: 0 0 6px 0; font-weight: bold; color: #334155;">
              I, <strong>${name}</strong>, son/daughter/ward of <strong>${fatherName}</strong>, do hereby solemnly declare on oath that:
            </p>
            <ol style="margin: 0 0 0 16px; padding: 0; line-height: 1.45; color: #1e293b;">
              <li>I commit to maintaining the highest standards of discipline and will act as a responsible student throughout my tenure at this institution.</li>
              <li>I shall <strong style="color: #dc2626;">strictly abstain</strong> from smoking, as well as the <strong style="color: #dc2626;">possession, use, or distribution</strong> of any tobacco products on school grounds.</li>
              <li>I shall <strong style="color: #dc2626;">strictly abstain</strong> from the <strong style="color: #dc2626;">possession, use, or distribution</strong> of any narcotics, illicit drugs, or other substances of abuse.</li>
              <li>I acknowledge that if I am found in violation of the institution's anti-drug and anti-smoking policies, the school administration holds the absolute right to <strong style="color: #dc2626;">revoke my admission</strong>, and appropriate <strong style="color: #dc2626;">legal proceedings</strong> may be initiated against me.</li>
              <li>I acknowledge that unauthorized electronic devices, specifically <strong style="color: #dc2626;">cell phones</strong>, are <strong style="color: #dc2626;">strictly prohibited</strong> on school premises. I understand that if I am found in possession of, or using, a cell phone, the device will be <strong style="color: #dc2626;">immediately and permanently confiscated</strong> without the possibility of return.</li>
            </ol>
          </div>

          <div class="signatures-row" style="margin-top: 25px;">
            <div class="sig-block">Signature of Student</div>
            <div class="sig-block">Signature of Parent/Guardian</div>
            <div class="sig-block red-txt font-bold">Principal Signature</div>
          </div>
        </div>

        <div class="page-footer-bar">
          <span>Form No: <strong style="color: #000;">${formNo}</strong> | Name: <strong style="color: #000;">${name}</strong> | Class: <strong style="color: #000;">${classSought}</strong></span>
          <span class="font-mono" style="font-weight: bold; color: #475569;">GHSS Shangus — Page 3/3</span>
        </div>
      </div>
    `;
  }

  return html;
}

/**
 * Wraps form body HTML inside complete document frame with modern React-Tailwind styling.
 */
function wrapInPrintDocument(bodyHtml, titleStr = 'Student_Admission_Forms') {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${titleStr}</title>
      <style>
        @page {
          size: A4 portrait;
          margin: 0.5cm;
        }
        * { box-sizing: border-box; }
        body {
          font-family: Arial, Helvetica, sans-serif;
          font-size: 10px;
          color: #0f172a;
          background: #ffffff;
          margin: 0;
          padding: 0;
          line-height: 1.3;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .print-page {
          width: 100%;
          background: #ffffff;
          border: 2.5px solid #0f766e;
          outline: 1px solid #0d9488;
          outline-offset: -5px;
          border-radius: 2px;
          padding: 10px 12px;
          margin-bottom: 0;
          page-break-after: always;
          position: relative;
          box-sizing: border-box;
          z-index: 1;
          min-height: 284mm;
          max-height: 288mm;
        }
        .print-page::after {
          content: "";
          position: absolute;
          top: 50%;
          left: 50%;
          width: 320px;
          height: 320px;
          transform: translate(-50%, -50%);
          background-image: url('/logo.png');
          background-size: contain;
          background-repeat: no-repeat;
          background-position: center;
          opacity: 0.10;
          z-index: 10;
          pointer-events: none;
        }
        .print-page:last-child {
          page-break-after: avoid;
        }

        /* Responsive Viewport & Print Media Queries */
        @media print {
          body { background: #ffffff !important; margin: 0 !important; padding: 0 !important; }
          .print-page { border: 2.5px solid #0f766e !important; outline: 1px solid #0d9488 !important; outline-offset: -5px !important; box-shadow: none !important; page-break-after: always; }
          .print-page:last-child { page-break-after: avoid !important; }
        }
        @media screen and (max-width: 768px) {
          .print-page {
            width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            padding: 8px !important;
            border: 1px solid #0f766e !important;
          }
          .grid-table { font-size: 8.5px !important; }
          .school-title { font-size: 15px !important; }
          .form-title-bar { font-size: 10px !important; }
          .signatures-row { flex-wrap: wrap; gap: 10px; }
          .sig-block { width: 48% !important; }
        }

        /* Header Styling */
        .header-box {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          border-bottom: 2px solid #0f766e;
          padding-bottom: 4px;
          margin-bottom: 6px;
        }
        .header-seal-col { width: 100%; text-align: center; margin-bottom: 2px; }
        .header-logo { width: 46px; height: 46px; object-fit: contain; }
        .header-text-col { width: 100%; text-align: center; }
        .school-title {
          display: block;
          font-size: 19px;
          font-weight: 900;
          color: #0f766e;
          margin: 0 0 2px 0;
          text-transform: uppercase;
          letter-spacing: 0.4px;
        }
        .font-lg { font-size: 21px !important; }
        .school-sub { display: block; font-size: 10.5px; font-weight: bold; color: #334155; margin: 0 0 2px 0; }
        .school-badge { display: block; font-size: 9.5px; color: #475569; margin: 0; }

        .header-meta-col { text-align: right; font-size: 9px; }
        .meta-tag { background: #f1f5f9; border: 1px solid #cbd5e1; padding: 1.5px 5px; border-radius: 3px; margin-bottom: 2px; }

        .form-title-bar {
          background: #0f766e;
          color: #ffffff;
          font-weight: 900;
          font-size: 11.5px;
          text-align: center;
          padding: 4px;
          border-radius: 4px;
          margin-bottom: 6px;
          letter-spacing: 0.4px;
        }

        /* Grid & Table Utility */
        .grid-table { width: 100%; border-collapse: collapse; font-size: 9.5px; }
        .grid-table td, .grid-table th { padding: 3px 5px; border: 1px solid #cbd5e1; vertical-align: middle; }
        
        .lbl { font-weight: bold; color: #1e293b; background: #f8fafc; white-space: nowrap; }
        .blue-lbl { background: #f0f9ff; color: #0369a1; font-weight: bold; width: 18%; }
        .val { background: #ffffff; color: #0f172a; }
        .bold-txt { font-weight: 900; color: #000000; }
        .blue-txt { color: #0369a1; }
        .teal-txt { color: #0f766e; font-weight: 900; }
        .red-txt { color: #b91c1c; }
        .bold-mono { font-family: monospace; font-weight: bold; }

        .top-row-grid { display: flex; gap: 6px; margin-bottom: 4px; }
        .details-left { flex: 1; }
        .photo-col { width: 96px; text-align: center; }
        .photo-box { width: 92px; height: 115px; border: 2px solid #0f766e; border-radius: 4px; overflow: hidden; background: #f8fafc; }
        .photo-box img { width: 100%; height: 100%; object-fit: cover; }
        .photo-frame-library { width: 90px; height: 110px; border: 1.5px solid #0f766e; overflow: hidden; margin: 0 auto; }
        .photo-frame-library img { width: 100%; height: 100%; object-fit: cover; }

        .section-heading {
          background: #f1f5f9;
          color: #0f766e;
          font-weight: 900;
          font-size: 10.5px;
          padding: 4px 8px;
          border-left: 3.5px solid #0f766e;
          margin-top: 10px;
          margin-bottom: 5px;
          text-transform: uppercase;
        }

        .border-table {
          margin-bottom: 4px;
        }

        .checklist-grid {
          display: flex;
          justify-content: space-between;
          font-size: 9.5px;
          font-weight: bold;
          color: #1e293b;
          background: #fafafa;
          border: 1px solid #cbd5e1;
          padding: 4.5px 8px;
          border-radius: 3.5px;
          margin-bottom: 5px;
        }

        .history-table th { background: #e0f2fe; color: #0369a1; font-weight: bold; text-align: center; font-size: 9px; }
        .history-table td { text-align: center; font-size: 9px; }
        .highlight-row td { background: #fff; }

        /* Undertaking & Signatures */
        .undertaking-compact { margin-top: 6px; border-top: 1px dashed #94a3b8; padding-top: 4px; }
        .undertaking-txt { font-size: 9px; color: #334155; margin: 0 0 8px 0; line-height: 1.3; }
        .signatures-row { display: flex; justify-content: space-between; margin-top: 20px; }
        .sig-block { width: 23%; text-align: center; border-top: 1px dashed #64748b; padding-top: 3px; font-size: 9px; font-weight: bold; color: #334155; }

        .page-footer-bar {
          position: absolute;
          bottom: 4px;
          left: 10px;
          right: 10px;
          display: flex;
          justify-content: space-between;
          border-top: 1px solid #cbd5e1;
          padding-top: 2px;
          font-size: 8.5px;
          color: #64748b;
        }

        /* Library Form Styles */
        .borrower-strip { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; font-size: 10.5px; }
        .borrower-box { font-weight: 900; color: #000000; }
        .library-main-title { color: #15803d; font-size: 15px; font-weight: 900; text-align: center; margin: 4px 0 8px 0; letter-spacing: 0.5px; }
        .spacious-handwriting-row td { height: 56px; border: 1px solid #94a3b8; }
        .library-spacious-table th { background: #dcfce7; color: #15803d; font-weight: bold; text-align: center; font-size: 9px; border: 1px solid #86efac; }

        /* Conduct & Anti-Drug Styles */
        .conduct-title-banner { background: #fee2e2; border: 1.5px solid #f87171; border-radius: 6px; text-align: center; padding: 5px; margin-bottom: 10px; }
        .conduct-title-banner h2 { color: #b91c1c; font-size: 13px; font-weight: 900; margin: 0; }
        .conduct-body-box { padding: 2px; }
        .conduct-intro-p { font-size: 10px; font-weight: 500; color: #0f172a; margin-bottom: 8px; line-height: 1.4; }
        .conduct-ol { font-size: 9px; color: #1e293b; margin: 0 0 12px 16px; padding: 0; line-height: 1.55; }
        .conduct-ol li { margin-bottom: 4px; }
        .red-highlight { color: #dc2626; font-weight: 900; }
        
        .parent-decl-box {
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          border-left: 4px solid #16a34a;
          padding: 6px 10px;
          border-radius: 4px;
          margin-top: 6px;
        }
        .parent-decl-head {
          font-size: 9.5px;
          font-weight: 900;
          color: #15803d;
          margin: 0 0 3px 0;
        }
        .parent-decl-text {
          font-size: 8.5px;
          color: #166534;
          margin: 0;
          line-height: 1.35;
        }

        .cellphone-warning-box {
          background: #fff1f2;
          border: 1px solid #fda4af;
          border-left: 4px solid #e11d48;
          padding: 5px 8px;
          border-radius: 4px;
          font-size: 8.5px;
          color: #9f1239;
          margin-top: 6px;
        }
        * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          color-adjust: exact !important;
        }
      </style>
    </head>
    <body>
      ${bodyHtml}
    </body>
    </html>
  `;
}



/**
 * Lazily loads html2pdf.js from CDN to trigger automatic PDF file download directly to user's Downloads folder.
 */
let _html2pdfLoadPromise = null;
function loadHtml2Pdf() {
  if (typeof window !== 'undefined' && window.html2pdf) {
    return Promise.resolve(window.html2pdf);
  }
  if (_html2pdfLoadPromise) return _html2pdfLoadPromise;

  _html2pdfLoadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-html2pdf-loader]');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.html2pdf));
      existing.addEventListener('error', () => reject(new Error('html2pdf failed to load')));
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
    script.async = true;
    script.setAttribute('data-html2pdf-loader', 'true');
    script.onload = () => resolve(window.html2pdf);
    script.onerror = () => reject(new Error('Failed to load PDF engine (html2pdf.js). Check internet connection.'));
    document.head.appendChild(script);
  });

  return _html2pdfLoadPromise;
}

/**
 * Generates a real PDF file from form HTML and triggers a direct browser file download
 * into the user's Downloads folder (without showing the print dialog).
 */
async function generateAndDownloadPdf(bodyHtml, fileName, onProgress) {
  const safeFileName = fileName.toLowerCase().endsWith('.pdf') ? fileName : `${fileName}.pdf`;
  const fullDoc = wrapInPrintDocument(bodyHtml, fileName);

  try {
    if (onProgress) onProgress(15, 'Loading PDF engine...');
    const html2pdfLib = await loadHtml2Pdf();

    if (onProgress) onProgress(35, 'Formatting pages for direct download...');
    
    const parsed = new DOMParser().parseFromString(fullDoc, 'text/html');
    const styleText = Array.from(parsed.querySelectorAll('style')).map((s) => s.textContent).join('\n');
    const bodyInnerHtml = parsed.body ? parsed.body.innerHTML : '';

    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.top = '0';
    container.style.left = '0';
    container.style.width = '794px';
    container.style.background = '#ffffff';
    container.style.zIndex = '99999';
    container.style.boxSizing = 'border-box';

    const styleEl = document.createElement('style');
    // Unwrap @media print rules so html2canvas evaluates all page styling under screen mode
    const screenFriendlyStyle = styleText.replace(/@media\s+print\s*\{([\s\S]*?)\}/gi, '$1');
    styleEl.textContent = screenFriendlyStyle;
    container.appendChild(styleEl);

    const contentEl = document.createElement('div');
    contentEl.innerHTML = bodyInnerHtml;
    container.appendChild(contentEl);

    document.body.appendChild(container);

    await new Promise((resolve) => {
      const images = Array.from(container.querySelectorAll('img'));
      const waitForImages = (attemptsLeft = 40) => {
        const allLoaded = images.length === 0 || images.every((img) => img.complete && img.naturalWidth > 0);
        if (allLoaded || attemptsLeft <= 0) resolve();
        else setTimeout(() => waitForImages(attemptsLeft - 1), 100);
      };
      setTimeout(() => waitForImages(), 150);
    });

    try {
      if (onProgress) onProgress(70, 'Saving PDF file to Downloads...');
      const opt = {
        margin: 0,
        filename: safeFileName,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          logging: false,
          windowWidth: 1000,
          scrollX: 0,
          scrollY: 0
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'] }
      };

      await html2pdfLib().set(opt).from(container).save();
      if (onProgress) onProgress(100, 'Download complete!');
    } finally {
      if (document.body.contains(container)) {
        document.body.removeChild(container);
      }
    }
  } catch (err) {
    console.error('html2pdf direct download error, falling back to print stream:', err);
    if (onProgress) onProgress(80, 'Opening print stream fallback...');
    printHtmlViaIframe(fullDoc);
  }
}

/**
 * Sends HTML content to an offscreen iframe to trigger clean browser printing/PDF saving.
 * Verifies all images are 100% loaded before invoking the browser print dialog.
 */
function printHtmlViaIframe(htmlContent) {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';

  document.body.appendChild(iframe);
  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(htmlContent);
  doc.close();

  const executePrint = () => {
    const images = Array.from(doc.images || []);
    const waitForImages = (attempts = 30) => {
      const allLoaded = images.length === 0 || images.every(img => img.complete && img.naturalWidth > 0);
      if (allLoaded || attempts <= 0) {
        setTimeout(() => {
          try {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
          } catch (e) {
            console.error('Print iframe error:', e);
          }
          setTimeout(() => {
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
          }, 3000);
        }, 300);
      } else {
        setTimeout(() => waitForImages(attempts - 1), 100);
      }
    };
    waitForImages();
  };

  if (doc.readyState === 'complete') {
    executePrint();
  } else {
    iframe.onload = executePrint;
  }
}

/**
 * Generate and print a single student admission form PDF with configurable section options.
 */
export function generateStudentAdmissionPdf(studentData, options = {}) {
  if (!studentData) return;
  const htmlBody = buildStudentFormHtml(studentData, options);
  const fullDocument = wrapInPrintDocument(htmlBody, `Admission_Form_${studentData['Form Number'] || 'Student'}`);
  printHtmlViaIframe(fullDocument);
}

function showPdfProgressModal(title = 'Generating PDF Document', message = 'Formatting pages and preparing download...') {
  const modalId = 'pdf-progress-modal-overlay';
  let modal = document.getElementById(modalId);
  if (!modal) {
    modal = document.createElement('div');
    modal.id = modalId;
    modal.style.position = 'fixed';
    modal.style.top = '70px';
    modal.style.right = '16px';
    modal.style.zIndex = '999999';
    modal.style.fontFamily = 'Arial, Helvetica, sans-serif';
    modal.style.pointerEvents = 'none';

    modal.innerHTML = `
      <div style="background: #ffffff; border: 1px solid #cbd5e1; border-left: 4px solid #16a34a; border-radius: 8px; padding: 10px 14px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.18); min-width: 280px; max-width: 340px; pointer-events: auto; display: flex; flex-direction: column; gap: 6px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <div style="width: 18px; height: 18px; border: 2.5px solid #cbd5e1; border-top-color: #16a34a; border-radius: 50%; animation: pdfSpin 0.8s linear infinite; flex-shrink: 0;"></div>
          <style>@keyframes pdfSpin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }</style>
          <div style="flex: 1; min-width: 0;">
            <h4 id="pdf-modal-title" style="margin: 0; font-size: 12px; font-weight: 800; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${title}</h4>
            <p id="pdf-modal-msg" style="margin: 2px 0 0 0; font-size: 10.5px; color: #475569; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${message}</p>
          </div>
        </div>
        <div style="width: 100%; height: 4px; background: #e2e8f0; border-radius: 2px; overflow: hidden; position: relative;">
          <div id="pdf-modal-progress-bar" style="width: 25%; height: 100%; background: linear-gradient(90deg, #16a34a, #22c55e); border-radius: 2px; transition: width 0.3s ease-in-out;"></div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }
  return {
    update: (percent, msg) => {
      const bar = document.getElementById('pdf-modal-progress-bar');
      const msgEl = document.getElementById('pdf-modal-msg');
      if (bar) bar.style.width = `${percent}%`;
      if (msgEl && msg) msgEl.innerText = msg;
    },
    close: () => {
      if (modal && document.body.contains(modal)) {
        document.body.removeChild(modal);
      }
    }
  };
}



/**
 * Directly triggers a real client-side PDF file download into user's Downloads folder.
 */
export async function downloadStudentAdmissionPdf(studentData, options = {}) {
  if (!studentData) return;
  const htmlBody = buildStudentFormHtml(studentData, options);
  const formNo = studentData['Form Number'] || studentData['FormNo'] || studentData['formNo'] || 'Form';
  const studentName = String(studentData["Student's Name (as per school records)"] || studentData["Student's Name"] || studentData['name'] || 'Student').replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `Admission_Form_${formNo}_${studentName}`;

  const progress = showPdfProgressModal('Downloading PDF Document', 'Formatting form and downloading file...');
  try {
    await generateAndDownloadPdf(htmlBody, fileName, (pct, msg) => progress.update(pct, msg));
  } catch (err) {
    console.error('PDF download error:', err);
  } finally {
    progress.close();
  }
}

/**
 * Generate and print bulk student application forms with configurable section options and clean page breaks.
 */
export function generateBulkAdmissionPdf(studentsList, options = {}) {
  if (!Array.isArray(studentsList) || studentsList.length === 0) return;
  const htmlBody = studentsList
    .map(st => buildStudentFormHtml(st, options))
    .join('');
  const fullDocument = wrapInPrintDocument(htmlBody, `Bulk_Admission_Forms_${studentsList.length}_Students.pdf`);
  printHtmlViaIframe(fullDocument);
}

/**
 * Directly triggers a real client-side PDF file download for bulk student forms into user's Downloads folder.
 */
export async function downloadBulkAdmissionPdf(studentsList, options = {}) {
  if (!Array.isArray(studentsList) || studentsList.length === 0) return;
  const htmlBody = studentsList
    .map(st => buildStudentFormHtml(st, options))
    .join('');
  const fileName = `Bulk_Admission_Forms_${studentsList.length}_Students`;

  const progress = showPdfProgressModal('Downloading Bulk PDF Forms', `Formatting ${studentsList.length} student application forms...`);
  try {
    await generateAndDownloadPdf(htmlBody, fileName, (pct, msg) => progress.update(pct, msg));
  } catch (err) {
    console.error('Bulk PDF download error:', err);
  } finally {
    progress.close();
  }
}

/**
 * Generate 1-Page Official Admit Card PDF for GK Test 2026
 * @param {object} regData - Registration details for GK Test candidate
 */
export function generateGkTestAdmitCardPdf(regData = {}) {
  const regNo = regData.regNo || regData.rollNo || regData.id || 'N/A';
  const candidateName = (regData.name || regData.candidateName || 'N/A').toUpperCase();
  const fatherName = (regData.parentName || regData.fatherName || 'N/A').toUpperCase();
  const cls = regData.class || regData.classGrade || 'N/A';
  const school = regData.school || regData.institution || 'Govt HR SEC SCHOOL SHANGUS';
  const category = regData.category || 'General';
  const contact = regData.mobile || regData.contact || 'N/A';
  const examCenter = regData.center || 'Govt. Higher Secondary School Shangus';
  const examDate = regData.examDate || 'Sunday, 17th May 2026';
  const examTime = regData.examTime || '11:00 AM – 01:00 PM';
  const photoUrl = regData.photoUrl || '/logo.png';

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>GK Test 2026 Admit Card - ${regNo} - ${candidateName}</title>
      <style>
        @page { size: A4 portrait; margin: 0.5cm; }
        body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #0f172a; margin: 0; padding: 0; line-height: 1.4; }
        .admit-card { border: 2px solid #0f766e; padding: 16px; border-radius: 8px; background: #ffffff; width: 100%; box-sizing: border-box; }
        .header { text-align: center; border-bottom: 2px solid #0f766e; padding-bottom: 10px; margin-bottom: 12px; }
        .school-title { font-size: 18px; font-weight: bold; color: #0f766e; text-transform: uppercase; }
        .exam-title { font-size: 14px; font-weight: bold; color: #b91c1c; margin-top: 4px; }
        .info-grid { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px; }
        .info-table { width: 75%; border-collapse: collapse; }
        .info-table td { padding: 5px 8px; border: 1px solid #cbd5e1; }
        .lbl { font-weight: bold; background: #f8fafc; color: #334155; width: 35%; }
        .photo-box { width: 110px; height: 135px; border: 2px solid #0f766e; border-radius: 4px; overflow: hidden; background: #f1f5f9; text-align: center; }
        .photo-box img { width: 100%; height: 100%; object-fit: cover; }
        .rules-title { font-size: 12px; font-weight: bold; color: #0f766e; margin-top: 14px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; }
        .rules-list { margin: 6px 0 16px 18px; padding: 0; font-size: 10px; color: #334155; }
        .rules-list li { margin-bottom: 4px; }
        .sigs { display: flex; justify-content: space-between; margin-top: 35px; padding-top: 8px; }
        .sig-box { text-align: center; width: 30%; border-top: 1px dashed #64748b; font-weight: bold; color: #475569; font-size: 10.5px; }
      </style>
    </head>
    <body>
      <div class="admit-card">
        <div class="header">
          <div class="school-title">GOVT HIGHER SECONDARY SCHOOL SHANGUS</div>
          <div class="exam-title">OFFICIAL ADMIT CARD — ALL KASHMIR GK TALENT SEARCH TEST 2026</div>
        </div>

        <div class="info-grid">
          <table class="info-table">
            <tr><td class="lbl">Registration / Roll No:</td><td><strong style="color: #b91c1c; font-size: 13px;">${regNo}</strong></td></tr>
            <tr><td class="lbl">Candidate's Name:</td><td><strong>${candidateName}</strong></td></tr>
            <tr><td class="lbl">Father's Name:</td><td>${fatherName}</td></tr>
            <tr><td class="lbl">Class / Category:</td><td>Class ${cls} (${category})</td></tr>
            <tr><td class="lbl">School / Institution:</td><td>${school}</td></tr>
            <tr><td class="lbl">Mobile / Contact:</td><td>${contact}</td></tr>
            <tr><td class="lbl">Examination Center:</td><td><strong>${examCenter}</strong></td></tr>
            <tr><td class="lbl">Date & Time of Exam:</td><td><strong>${examDate} (${examTime})</strong></td></tr>
          </table>
          <div class="photo-box">
            <img src="${photoUrl}" alt="Photo" onerror="this.src='/logo.png';" />
          </div>
        </div>

        <div class="rules-title">INSTRUCTIONS FOR CANDIDATES</div>
        <ol class="rules-list">
          <li>Candidates must produce this printed Admit Card along with a valid Identity Proof at the examination center.</li>
          <li>Reporting time at the examination center is 30 minutes prior to commencement of the test.</li>
          <li>Electronic devices including cell phones, smart watches, and calculators are strictly banned inside the hall.</li>
          <li>Use blue or black ballpoint pen only for writing responses on the answer sheet.</li>
        </ol>

        <div class="sigs">
          <div class="sig-box">Candidate's Signature</div>
          <div class="sig-box">Invigilator's Signature</div>
          <div class="sig-box">Controller of Examinations</div>
        </div>
      </div>
    </body>
    </html>
  `;

  printHtmlViaIframe(htmlContent);
}