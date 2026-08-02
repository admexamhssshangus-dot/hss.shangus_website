/**
 * HSS SHANGUS — Browser-Native Student Application PDF Generator
 * Renders official Govt Higher Secondary School Shangus admission application form PDF.
 * Works 100% offline directly in browser without relying on Apps Script or external APIs.
 */

/**
 * Generate and download/print student admission form PDF.
 * @param {object} studentData - Complete student admission record
 */
export function generateStudentAdmissionPdf(studentData) {
  if (!studentData) return;

  const formNo = studentData['Form Number'] || studentData['FormNo'] || 'N/A';
  const name = studentData["Student's Name (as per school records)"] || studentData["Student's Name"] || 'N/A';
  const fatherName = studentData["Father's/Guardian's Name (as per school records)"] || studentData["Father's Name"] || 'N/A';
  const motherName = studentData["Mother's Name (as per school records)"] || studentData["Mother's Name"] || 'N/A';
  const dob = studentData["DoB (as per school records)"] || studentData["DoB"] || 'N/A';
  const gender = studentData["Gender"] || 'N/A';
  const mobile = studentData["Mobile No. (with working WhatsApp)"] || studentData["Mobile No."] || 'N/A';
  const parentMobile = studentData["Parent's Mobile No. (must be working)"] || studentData["Parent Contact"] || 'N/A';
  const email = studentData["Email Address"] || studentData["email"] || 'N/A';
  const village = studentData["Name of your village"] || studentData["Village"] || 'N/A';
  const district = studentData["District"] || 'Anantnag';
  const pin = studentData["PIN code"] || '192201';
  const classSought = studentData["Admission sought for class"] || studentData["Class"] || 'N/A';
  const stream = studentData["Stream for Class 11th"] || studentData["Stream opted in Class 11th"] || studentData["Stream"] || 'General';
  const subjects = studentData["Subjects to be taken in Class 11th"] || studentData["Subjects Studied in Class 11th"] || studentData["Subjects"] || 'N/A';
  const photoUrl = studentData["Student Photo"] || studentData["photo_id"] || 'https://via.placeholder.com/150';
  const status = studentData["Status"] || 'Submitted';
  const rollNo = studentData["Class Roll No"] || studentData["RollNo"] || 'Unassigned';
  const aadhaar = studentData["Aadhar No."] || 'N/A';
  const category = studentData["Social category"] || 'OM';
  const blood = studentData["Blood Group"] || 'N/A';

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Admission Form - ${formNo} - ${name}</title>
      <style>
        @page { size: A4; margin: 12mm; }
        body { font-family: Arial, Helvetica, sans-serif; color: #0f172a; font-size: 11px; margin: 0; padding: 0; }
        .header { text-align: center; border-bottom: 2px solid #0f766e; padding-bottom: 8px; margin-bottom: 12px; }
        .school-title { font-size: 18px; font-weight: bold; color: #0f766e; text-transform: uppercase; letter-spacing: 0.5px; }
        .sub-title { font-size: 11px; font-weight: bold; color: #475569; margin-top: 2px; }
        .form-badge { display: inline-block; background: #0f766e; color: #fff; padding: 3px 10px; border-radius: 4px; font-size: 11px; font-weight: bold; margin-top: 6px; }

        .top-info { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
        .info-table { width: 78%; border-collapse: collapse; }
        .info-table td { padding: 5px 8px; border: 1px solid #cbd5e1; font-size: 11px; }
        .info-table td.label { font-weight: bold; background: #f8fafc; color: #334155; width: 35%; }

        .photo-box { width: 110px; height: 135px; border: 2px solid #0f766e; border-radius: 4px; overflow: hidden; text-align: center; background: #f1f5f9; }
        .photo-box img { width: 100%; height: 100%; object-fit: cover; }

        .section-header { background: #0f766e; color: #fff; font-weight: bold; padding: 5px 10px; font-size: 11px; margin-top: 10px; margin-bottom: 6px; border-radius: 2px; }
        
        .full-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
        .full-table td { padding: 5px 8px; border: 1px solid #cbd5e1; font-size: 11px; }
        .full-table td.label { font-weight: bold; background: #f8fafc; color: #334155; width: 25%; }

        .subject-box { border: 1px solid #cbd5e1; padding: 8px 12px; background: #fafafa; border-radius: 4px; font-size: 11px; font-weight: bold; color: #0f766e; line-height: 1.6; }

        .footer-sig { display: flex; justify-content: space-between; margin-top: 35px; padding-top: 10px; }
        .sig-box { text-align: center; width: 30%; border-top: 1px dashed #64748b; padding-top: 4px; font-weight: bold; color: #475569; font-size: 10px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="school-title">GOVT HIGHER SECONDARY SCHOOL SHANGUS</div>
        <div class="sub-title">ANANTNAG, JAMMU & KASHMIR — 192201</div>
        <div class="sub-title">ONLINE ADMISSION APPLICATION FORM (${new Date().getFullYear()})</div>
        <div class="form-badge">FORM NO: ${formNo} | STATUS: ${status.toUpperCase()}</div>
      </div>

      <div class="top-info">
        <table class="info-table">
          <tr>
            <td class="label">Student's Name:</td>
            <td><strong>${name}</strong></td>
          </tr>
          <tr>
            <td class="label">Father's Name:</td>
            <td>${fatherName}</td>
          </tr>
          <tr>
            <td class="label">Mother's Name:</td>
            <td>${motherName}</td>
          </tr>
          <tr>
            <td class="label">Date of Birth:</td>
            <td>${dob}</td>
          </tr>
          <tr>
            <td class="label">Gender / Category:</td>
            <td>${gender} / ${category}</td>
          </tr>
          <tr>
            <td class="label">Admission Sought For:</td>
            <td><strong>Class ${classSought} (${stream})</strong></td>
          </tr>
        </table>
        <div class="photo-box">
          <img src="${photoUrl}" alt="Student Photo" />
        </div>
      </div>

      <div class="section-header">1. CONTACT & RESIDENTIAL ADDRESS</div>
      <table class="full-table">
        <tr>
          <td class="label">Mobile (WhatsApp):</td>
          <td>${mobile}</td>
          <td class="label">Parent Mobile:</td>
          <td>${parentMobile}</td>
        </tr>
        <tr>
          <td class="label">Email Address:</td>
          <td>${email}</td>
          <td class="label">Aadhaar Number:</td>
          <td>${aadhaar}</td>
        </tr>
        <tr>
          <td class="label">Village / Locality:</td>
          <td>${village}</td>
          <td class="label">District & PIN:</td>
          <td>${district} - ${pin}</td>
        </tr>
      </table>

      <div class="section-header">2. SUBJECT ALLOCATION & ACADEMIC STREAM</div>
      <table class="full-table">
        <tr>
          <td class="label">Allocated Stream:</td>
          <td><strong>${stream}</strong></td>
          <td class="label">Class Roll Number:</td>
          <td><strong>${rollNo}</strong></td>
        </tr>
      </table>
      <div class="subject-box">
        Selected Subjects: ${subjects}
      </div>

      <div class="section-header">3. APPLICANT DECLARATION & ACKNOWLEDGMENT</div>
      <p style="font-size: 10px; color: #475569; margin: 4px 0 12px 0; line-height: 1.4;">
        I hereby declare that all information furnished in this admission application is true, complete, and accurate to the best of my knowledge. I agree to abide by all rules and regulations of Govt Higher Secondary School Shangus.
      </p>

      <div class="footer-sig">
        <div class="sig-box">Signature of Student</div>
        <div class="sig-box">Signature of Parent/Guardian</div>
        <div class="sig-box">Admission Committee / Principal</div>
      </div>
    </body>
    </html>
  `;

  // Create printable offscreen iframe
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

  iframe.onload = () => {
    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      setTimeout(() => document.body.removeChild(iframe), 1000);
    }, 300);
  };
}

/**
 * Generate 1-Page Official Admit Card PDF for GK Test 2026
 * Fits 100% on a single A4 page with no overflow.
 * @param {object} data - Candidate registration data
 */
export function generateGkTestAdmitCardPdf(data) {
  if (!data) return;

  const examNo = data.examNumber || data.id || 'N/A';
  const name = data.name || data["Student's Name"] || 'N/A';
  const fatherName = data.fatherName || data["Father's Name"] || 'N/A';
  const className = data.className || data.class || 'N/A';
  const classRollNo = data.classRollNo || data['Class Roll No'] || '—';
  const boardRegNo = data.boardRegNo || data.formNo || 'Manual Entry';
  const session = data.session || '2025-26';
  const photoUrl = data.photoUrl || null;
  const initial = (name || '?')[0].toUpperCase();

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>GK_Test_Admit_Card_${examNo}_${name.replace(/\s+/g, '_')}</title>
      <style>
        @page {
          size: A4 portrait;
          margin: 8mm;
        }
        * { box-sizing: border-box; }
        body {
          font-family: Arial, Helvetica, sans-serif;
          color: #0f172a;
          margin: 0;
          padding: 0;
          background: #fff;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .card-container {
          width: 100%;
          max-height: 260mm;
          border: 2px solid #0f766e;
          border-radius: 12px;
          padding: 16px;
          box-sizing: border-box;
          page-break-inside: avoid;
        }
        .header {
          text-align: center;
          border-bottom: 2px solid #0f766e;
          padding-bottom: 8px;
          margin-bottom: 12px;
        }
        .school-title {
          font-size: 17px;
          font-weight: 900;
          color: #0f766e;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .sub-title {
          font-size: 10px;
          font-weight: bold;
          color: #475569;
          margin-top: 2px;
        }
        .quiz-badge {
          display: inline-block;
          background: #0f766e;
          color: #ffffff;
          padding: 3px 14px;
          border-radius: 20px;
          font-size: 10px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-top: 6px;
        }
        .roll-box {
          background: #f8fafc;
          border: 2px dashed #0f766e;
          border-radius: 8px;
          padding: 10px;
          text-align: center;
          margin-bottom: 12px;
        }
        .roll-label {
          font-size: 9px;
          font-weight: 900;
          color: #0f766e;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .roll-number {
          font-family: 'Courier New', Courier, monospace;
          font-size: 32px;
          font-weight: 900;
          color: #0f172a;
          letter-spacing: 4px;
          margin-top: 2px;
        }
        .details-grid {
          display: flex;
          gap: 12px;
          background: #f8fafc;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 12px;
        }
        .photo-area {
          width: 90px;
          height: 110px;
          border: 2px solid #0f766e;
          border-radius: 6px;
          overflow: hidden;
          background: #ccfbf1;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .photo-area img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .initial-avatar {
          font-size: 36px;
          font-weight: 900;
          color: #0f766e;
        }
        .info-table {
          width: 100%;
          border-collapse: collapse;
        }
        .info-table td {
          padding: 4px 6px;
          font-size: 11px;
          vertical-align: top;
        }
        .info-table .lbl {
          font-size: 9px;
          font-weight: bold;
          color: #64748b;
          text-transform: uppercase;
          display: block;
        }
        .info-table .val {
          font-weight: bold;
          color: #0f172a;
        }
        .schedule-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 6px;
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          border-radius: 8px;
          padding: 8px 12px;
          margin-bottom: 12px;
          font-size: 10px;
          color: #166534;
          font-weight: bold;
        }
        .instructions-box {
          background: #f8fafc;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          padding: 8px 12px;
          margin-bottom: 20px;
          font-size: 9.5px;
          color: #334155;
        }
        .instructions-title {
          font-weight: 900;
          color: #0f172a;
          text-transform: uppercase;
          margin-bottom: 4px;
        }
        .instructions-box ul {
          margin: 0;
          padding-left: 16px;
        }
        .instructions-box li {
          margin-bottom: 2px;
        }
        .signatures {
          display: flex;
          justify-content: space-between;
          margin-top: 30px;
          text-align: center;
          font-size: 9px;
          font-weight: bold;
          color: #475569;
        }
        .sig-col {
          width: 30%;
          border-top: 1px solid #94a3b8;
          padding-top: 4px;
        }
      </style>
    </head>
    <body>
      <div class="card-container">
        <div class="header">
          <div class="school-title">Govt. Higher Secondary School Shangus</div>
          <div class="sub-title">Anantnag, Jammu & Kashmir — 192201</div>
          <div class="quiz-badge">General Knowledge Quiz 2026 Admit Card</div>
        </div>

        <div class="roll-box">
          <div class="roll-label">Assigned Examination Roll Number</div>
          <div class="roll-number">${examNo}</div>
        </div>

        <div class="details-grid">
          <div class="photo-area">
            ${photoUrl && (photoUrl.startsWith('http') || photoUrl.startsWith('data:'))
              ? `<img src="${photoUrl}" alt="${name}" />`
              : `<div class="initial-avatar">${initial}</div>`
            }
          </div>
          <table class="info-table">
            <tr>
              <td>
                <span class="lbl">Candidate Name</span>
                <span class="val" style="font-size: 13px;">${name}</span>
              </td>
              <td>
                <span class="lbl">Father's Name</span>
                <span class="val">${fatherName}</span>
              </td>
            </tr>
            <tr>
              <td>
                <span class="lbl">Class</span>
                <span class="val">${className}</span>
              </td>
              <td>
                <span class="lbl">Class Roll No.</span>
                <span class="val">${classRollNo}</span>
              </td>
            </tr>
            <tr>
              <td>
                <span class="lbl">Board Reg. / Form No.</span>
                <span class="val" style="font-family: monospace;">${boardRegNo}</span>
              </td>
              <td>
                <span class="lbl">Session</span>
                <span class="val">${session}</span>
              </td>
            </tr>
          </table>
        </div>

        <div class="schedule-grid">
          <div>📅 <strong>Date of Test:</strong> Monday, 10 August 2026</div>
          <div>⏰ <strong>Reporting Time:</strong> 09:00 AM</div>
          <div>📍 <strong>Venue:</strong> Main Hall, HSS Shangus</div>
          <div>📝 <strong>Format:</strong> 60 MCQs (OMR Sheet)</div>
        </div>

        <div class="instructions-box">
          <div class="instructions-title">Important Candidate Instructions:</div>
          <ul>
            <li>Bring this Admit Card and your school Identity Card to the examination hall.</li>
            <li>Bring a <strong>blue or black ballpoint pen</strong> for darkening OMR circles. Do NOT use pencil.</li>
            <li>Carefully fill your 7-digit Exam Roll Number on your OMR sheet.</li>
            <li>Mobile phones and gadgets are strictly forbidden inside the hall.</li>
          </ul>
        </div>

        <div class="signatures">
          <div class="sig-col">Candidate's Signature</div>
          <div class="sig-col">Invigilator's Signature</div>
          <div class="sig-col">Convener / Principal Seal</div>
        </div>
      </div>
    </body>
    </html>
  `;

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

  iframe.onload = () => {
    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      setTimeout(() => document.body.removeChild(iframe), 1000);
    }, 300);
  };
}
