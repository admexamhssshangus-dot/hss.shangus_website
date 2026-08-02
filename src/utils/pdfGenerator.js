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
