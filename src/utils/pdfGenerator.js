/**
 * HSS SHANGUS — Modern React-Tailwind Style Student Application & Section Forms PDF Generator
 * Renders complete Govt Higher Secondary School Shangus admission forms, library forms,
 * and anti-drug declarations with all undertakings consolidated on the Declaration Page.
 */
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { generateVerificationSignature, getStudentRollVal } from './idCardRenderer';
import { createQrSvgDataUri } from './qrSvgGenerator';
import { getStudentPhotoUrl } from './imageCompressor';
import { recordApplicationPrint } from '../services/printTrackerService';
import { saveGeneratedDocToHistory } from '../services/docHistoryService';

function getCompulsorySubjects(targetClass = '11th', stream = 'Science') {
  const cls = String(targetClass || '');
  const strm = String(stream || '');
  if (cls.includes('9') || cls.includes('10') || cls.includes('8')) {
    return ["English", "Mathematics", "Science", "Social Science"];
  }
  if (strm === 'Humanities' || strm === 'Arts') {
    return ["General English"];
  }
  if (strm === 'Commerce') {
    return ["General English", "Accountancy", "Business Studies"];
  }
  return ["General English", "Physics", "Chemistry"];
}

function formatAllSubjects(rawSubjectsString = '', targetClass = '11th', stream = 'Science') {
  const compulsory = getCompulsorySubjects(targetClass, stream);
  const chosenArray = typeof rawSubjectsString === 'string'
    ? rawSubjectsString.split(', ').map(s => s.trim()).filter(Boolean)
    : (Array.isArray(rawSubjectsString) ? rawSubjectsString : []);
  
  const allSubjects = [...new Set([...compulsory, ...chosenArray])];
  return allSubjects.join(', ');
}

function parseRawDate(raw) {
  if (!raw) return null;
  if (raw instanceof Date) return isNaN(raw.getTime()) ? null : raw;
  if (typeof raw.toDate === 'function') return raw.toDate();
  if (typeof raw.toMillis === 'function') return new Date(raw.toMillis());
  if (typeof raw === 'object') {
    if (typeof raw.seconds === 'number') return new Date(raw.seconds * 1000);
    if (typeof raw._seconds === 'number') return new Date(raw._seconds * 1000);
  }
  if (typeof raw === 'number') {
    // If Excel serial number e.g. 45497.5 (days since 1899-12-30)
    if (raw > 30000 && raw < 70000) {
      const utc_days = Math.floor(raw - 25569);
      const utc_value = utc_days * 86400;
      const date_info = new Date(utc_value * 1000);
      const fractional_day = raw - Math.floor(raw) + 0.0000001;
      let total_seconds = Math.floor(86400 * fractional_day);
      date_info.setSeconds(date_info.getSeconds() + total_seconds);
      return date_info;
    }
    // If epoch timestamp in seconds
    if (raw < 10000000000) return new Date(raw * 1000);
    // If epoch timestamp in milliseconds
    return new Date(raw);
  }
  if (typeof raw === 'string') {
    const s = raw.trim();
    if (!s || s === '—' || s === 'N/A' || s === '-' || s.toLowerCase() === 'null') return null;

    // Check if Firestore string like "Timestamp(seconds=1721815800, nanoseconds=0)"
    const tsMatch = s.match(/seconds\s*[:=]\s*(\d+)/i);
    if (tsMatch) {
      return new Date(parseInt(tsMatch[1], 10) * 1000);
    }

    // Check if ISO string e.g. 2025-07-24T14:30:00 or 2025-07-24
    if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(s)) {
      const d = new Date(s);
      if (!isNaN(d.getTime())) return d;
    }

    // Check if DD-MM-YYYY or DD/MM/YYYY with optional time e.g. "24-07-2025 14:30:00" or "24/07/2025 02:30 PM"
    const dmyMatch = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?(?:\s*(AM|PM))?)?/i);
    if (dmyMatch) {
      const [, day, month, year, hours, minutes, seconds, ampm] = dmyMatch;
      let h = hours ? parseInt(hours, 10) : 0;
      const m = minutes ? parseInt(minutes, 10) : 0;
      const sec = seconds ? parseInt(seconds, 10) : 0;
      if (ampm) {
        if (ampm.toUpperCase() === 'PM' && h < 12) h += 12;
        if (ampm.toUpperCase() === 'AM' && h === 12) h = 0;
      }
      const d = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10), h, m, sec);
      if (!isNaN(d.getTime())) return d;
    }

    // Check if DD-MMM-YYYY e.g. 24-Jul-2025
    const monthMap = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
    const dmmmMatch = s.match(/^(\d{1,2})[-/ ]([a-zA-Z]{3,9})[-/ ](\d{4})(?:\s+(\d{1,2}):(\d{1,2}))?/i);
    if (dmmmMatch) {
      const [, day, mStr, year, hours, minutes] = dmmmMatch;
      const mKey = mStr.toLowerCase().substring(0, 3);
      if (monthMap[mKey] !== undefined) {
        const h = hours ? parseInt(hours, 10) : 0;
        const m = minutes ? parseInt(minutes, 10) : 0;
        const d = new Date(parseInt(year, 10), monthMap[mKey], parseInt(day, 10), h, m);
        if (!isNaN(d.getTime())) return d;
      }
    }

    // Direct Date.parse fallback
    const parsed = Date.parse(s);
    if (!isNaN(parsed)) return new Date(parsed);
  }
  return null;
}

function formatDobDDMMYYYY(dobRaw) {
  if (!dobRaw) return 'N/A';
  const str = String(dobRaw).trim();

  // If ISO YYYY-MM-DD (e.g. 2003-03-18 or 1991-03-02)
  const isoMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return `${d.padStart(2, '0')}-${m.padStart(2, '0')}-${y}`;
  }

  // If already DD-MM-YYYY (e.g. 02-03-1991)
  const dmyMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    return `${d.padStart(2, '0')}-${m.padStart(2, '0')}-${y}`;
  }

  // If DD-MMM-YYYY (e.g. 02-Mar-1991)
  const monthMap = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
  const dmmmMatch = str.match(/^(\d{1,2})[-/]([a-zA-Z]{3})[-/](\d{4})$/);
  if (dmmmMatch) {
    const [, d, mStr, y] = dmmmMatch;
    const mNum = monthMap[mStr.toLowerCase()] || '01';
    return `${d.padStart(2, '0')}-${mNum}-${y}`;
  }

  const parsed = parseRawDate(dobRaw);
  if (parsed && !isNaN(parsed.getTime())) {
    const day = String(parsed.getDate()).padStart(2, '0');
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const year = parsed.getFullYear();
    return `${day}-${month}-${year}`;
  }

  return str;
}

function formatDateTimeDDMMMYYYY(rawDate) {
  if (!rawDate) return '—';
  const d = parseRawDate(rawDate);
  if (!d) {
    const s = String(rawDate).trim();
    if (!s || s === '—' || s === 'N/A' || s.includes('Timestamp(') || s.includes('seconds=')) return '—';
    return s;
  }
  try {
    const day = String(d.getDate()).padStart(2, '0');
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = monthNames[d.getMonth()];
    const year = d.getFullYear();
    const hours = d.getHours();
    const minutes = d.getMinutes();

    // If time is not present (00:00:00), return clean date DD-MMM-YYYY
    if (hours === 0 && minutes === 0 && d.getSeconds() === 0) {
      return `${day}-${month}-${year}`;
    }

    const ampm = hours >= 12 ? 'PM' : 'AM';
    const h12 = hours % 12 || 12;
    const strHours = String(h12).padStart(2, '0');
    const strMinutes = String(minutes).padStart(2, '0');
    return `${day}-${month}-${year}, ${strHours}:${strMinutes} ${ampm}`;
  } catch (e) {
    return '—';
  }
}

/**
 * Computes the current Indian academic session (e.g. "2025-26") so the PDF never shows
 * a stale hardcoded session. Rolls over around October in J&K Kashmir Valley.
 */
function getCurrentAcademicSession() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0 = Jan, 9 = Oct
  // Session rolls over around October (Month index >= 9).
  if (month >= 9) {
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
  const rawDob = studentData["DoB (as per school records)"] || studentData["DoB"] || studentData['dob'] || 'N/A';
  const dob = formatDobDDMMYYYY(rawDob);
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
  const is12th = String(classSought).includes('12');
  const stream12th = studentData["Stream opted in Class 11th"] || studentData["Stream Studied in Class 11th"] || studentData["Stream & Subjects for Class 12th"] || studentData["Stream for Class 12th"];
  const stream11th = studentData["Stream for Class 11th"] || studentData["Stream opted in Class 11th"];
  const stream = (is12th ? (stream12th || stream11th) : stream11th) || studentData["Stream"] || studentData['stream'] || 'General';
  const rawSubjects = studentData["Subjects to be taken in Class 11th"] || studentData["Subjects Studied in Class 11th"] || studentData["Subjects to be taken in Class 10th"] || studentData["Subjects Studied in Class 10th"] || studentData["Subs"] || studentData["Subjects"] || studentData['subjects'] || '';
  const subjects = formatAllSubjects(rawSubjects, classSought, stream) || 'N/A';
  const photoUrl = getStudentPhotoUrl(studentData, '/logo.png');
  const rollNo = studentData["Class Roll No"] || studentData["rollNo"] || studentData["Class R.No."] || '—';
  const admNo = studentData["Admission Number"] || studentData["admNo"] || studentData["Adm No."] || '—';
  const section = studentData["Section"] || studentData['section'] || '—';
  const session = studentData["Session"] || studentData['session'] || getCurrentAcademicSession();
  const aadhaar = studentData["Aadhar No."] || studentData['aadhar'] || studentData['aadhaar'] || 'N/A';
  const fatherAadhaar = studentData["Father's Aadhar No."] || studentData["Father's Aadhaar No."] || studentData['fatherAadhar'] || 'N/A';

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

  const rawSubmDate = 
    studentData["onlineSubmDate"] ||
    studentData["online_subm_date"] ||
    studentData["Online Submission Date"] ||
    studentData["Online Submission"] ||
    studentData["submittedAt"] ||
    studentData["submissionDate"] ||
    studentData["Submission Date"] ||
    studentData["createdAt"] ||
    studentData["created_at"] ||
    studentData["timestamp"] ||
    studentData["Timestamp"] ||
    studentData["Date of Submission"] ||
    studentData["admDate"] ||
    studentData["Admission Date"] ||
    studentData["admissionDate"] ||
    studentData["submDate"] ||
    studentData["updatedAt"];
  const formattedSubmDate = formatDateTimeDDMMMYYYY(rawSubmDate);

  // Generate cryptographically signed verification URL QR Code (ultra-clean, low-density, 100% scannable matrix)
  const regNo = studentData['Board Registration Number'] || studentData['boardRegNo'] || studentData['regNo'] || '—';
  const rollVal = getStudentRollVal(studentData) || rollNo || '—';
  const cleanFNo = String(formNo).replace(/[^0-9]/g, '') || formNo;
  const origin = (typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : 'https://admexamhssshangus.web.app';
  const sig = generateVerificationSignature(regNo, rollVal, cleanFNo);
  const verifyUrl = `${origin}/verify-student?reg=${encodeURIComponent(regNo)}&roll=${encodeURIComponent(rollVal)}&fNo=${encodeURIComponent(cleanFNo)}&sig=${encodeURIComponent(sig)}`;
  
  const qrCodeUrl = createQrSvgDataUri(verifyUrl, 160) || `https://api.qrserver.com/v1/create-qr-code/?size=160x160&margin=2&ecc=M&data=${encodeURIComponent(verifyUrl)}`;

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
          <!-- Dynamic QR Code Column (Left) -->
          <div class="qr-col">
            <div class="qr-box">
              <img src="${qrCodeUrl}" alt="Verification QR Code" class="qr-img" crossorigin="anonymous" onerror="this.style.opacity='0.3';" />
              <span class="qr-lbl">SCAN TO VERIFY</span>
            </div>
          </div>

          <!-- Student Details Table (Center) -->
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
                <td class="lbl blue-lbl">Student / Father Aadhaar:</td>
                <td class="val">${aadhaar} / ${fatherAadhaar}</td>
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

          <!-- Student Passport Photo Column (Right) -->
          <div class="photo-col">
            <div class="photo-box">
              ${photoUrl && photoUrl !== '/logo.png' ? `
                <img src="${photoUrl}" alt="Student Photo" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='flex';" />
                <div class="photo-placeholder-box" style="display:none;">
                  <span>AFFIX RECENT<br/>PASSPORT SIZE<br/>PHOTOGRAPH</span>
                </div>
              ` : `
                <div class="photo-placeholder-box">
                  <span>AFFIX RECENT<br/>PASSPORT SIZE<br/>PHOTOGRAPH</span>
                </div>
              `}
            </div>
          </div>
        </div>

        <!-- Address & Residence -->
        <div class="section-heading">Residential Address & Financial Details</div>
        <table class="grid-table border-table address-fin-table">
          <tr>
            <td class="lbl blue-lbl flex-lbl">House No. /<br/>Address:</td>
            <td class="val address-val">${houseNo}, ${village}</td>
            <td class="lbl blue-lbl flex-lbl">Block &<br/>Tehsil:</td>
            <td class="val address-val">${block}, ${tehsil}</td>
            <td class="lbl blue-lbl flex-lbl">District &<br/>State:</td>
            <td class="val address-val">${district}, ${stateUt} (${pin})</td>
          </tr>
          <tr>
            <td class="lbl blue-lbl flex-lbl">Email / Blood<br/>/ Ht-Wt:</td>
            <td class="val address-val">${email !== 'N/A' ? email : '—'} | ${bloodGroup} | ${height}/${weight}</td>
            <td class="lbl blue-lbl flex-lbl">Bank Account<br/>& IFSC:</td>
            <td class="val bold-mono address-val">${bankAcc} (${bankName} / ${ifsc})</td>
            <td class="lbl blue-lbl flex-lbl">Scholarship /<br/>Disability:</td>
            <td class="val address-val">${scholarPrev === 'Yes' ? `${scholarType} (₹${scholarAmount})` : 'None'} | ${isDiffAbled === 'Yes' ? disabilityType : 'No'}</td>
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
            <td class="lbl blue-lbl" style="width: 12%;">Admission Class:</td>
            <td class="val bold-txt" style="width: 10%;">Class ${classSought}</td>
            <td class="lbl blue-lbl" style="width: 11%;">Stream Opted:</td>
            <td class="val bold-txt" style="width: 12%;">${stream}</td>
            <td class="lbl blue-lbl" style="width: 14%;">Identification Mark:</td>
            <td class="val" style="width: 41%; font-weight: bold;">${idMark}</td>
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
            <td class="lbl blue-lbl" style="width:13%;">Payment Status:</td>
            <td class="val bold-txt teal-txt" style="width:19%;">${paymentStatus}</td>
            <td class="lbl blue-lbl" style="width:16%;">Transaction ID / UTR:</td>
            <td class="val bold-mono blue-txt" style="width:22%;">${txnId}</td>
            <td class="lbl blue-lbl" style="width:11%;">Amount Paid:</td>
            <td class="val bold-txt red-txt" style="width:10%;">${feeAmount !== '—' ? `₹${feeAmount}` : '—'}</td>
          </tr>
          <tr>
            <td class="lbl blue-lbl" style="width:13%;">Payment Date:</td>
            <td class="val" style="width:19%;">${paymentDate}</td>
            <td class="lbl blue-lbl" style="width:16%;">Payment Mode:</td>
            <td class="val" style="width:22%;">${paymentMode}</td>
            <td class="lbl blue-lbl" style="width:11%;">Receipt Ref No:</td>
            <td class="val bold-mono" style="width:10%;">${receiptNo}</td>
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
          <div class="compact-decl-box" style="font-size: 7.8px; line-height: 1.28; padding: 5px 8px; border: 1px solid #cbd5e1; border-radius: 4px; margin-bottom: 4px; color: #1e293b; background: #f8fafc;">
            <div style="font-weight: 800; color: #0f766e; margin-bottom: 1.5px; text-transform: uppercase; font-size: 8px;">
              1. Declaration by Student:
            </div>
            I, <strong>${name}</strong> (Form No: <strong>${formNo}</strong>), declare that all particulars given above are true, correct, and complete. I undertake to strictly obey all rules and regulations of Govt. HSS Shangus and maintain high standards of academic discipline and moral conduct.
            <div style="font-weight: 800; color: #15803d; margin: 3px 0 1.5px 0; text-transform: uppercase; font-size: 8px;">
              2. Declaration by Parent / Guardian:
            </div>
            I, <strong>${fatherName}</strong>, hereby request admission for my ward <strong>${name}</strong>. I take full responsibility for his/her conduct, attendance, and moral behavior both inside and outside the institution, and agree to pay all institutional fees.
            <div style="background: #fff1f2; border: 1px solid #fecdd3; border-left: 3px solid #e11d48; padding: 4px 6px; border-radius: 3px; margin-top: 3px;">
              <div style="font-weight: 800; color: #b91c1c; margin-bottom: 1px; text-transform: uppercase; font-size: 7.8px;">
                3. Anti-Drug, Anti-Smoking & Cell-Phone Ban Undertaking on Oath:
              </div>
              I, <strong>${name}</strong>, do hereby solemnly declare on oath that I shall <strong style="color: #dc2626;">STRICTLY ABSTAIN</strong> from smoking, tobacco, narcotics, illicit drugs, psychotropic substances, or alcohol. Any violation will result in <strong style="color: #dc2626;">IMMEDIATE REVOCATION OF ADMISSION and legal/police proceedings</strong>. Unauthorized <strong style="color: #dc2626;">cell phones are strictly prohibited</strong> on school grounds and will be <strong style="color: #dc2626;">permanently impounded</strong> without return.
            </div>
          </div>

          <div class="signatures-row" style="margin-top: 25px; margin-bottom: 6px;">
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

        <div class="borrower-strip" style="margin-top: 14px; margin-bottom: 12px; padding-top: 8px; border-top: 1px dashed #cbd5e1;">
          <span>Session: <strong>${session}</strong> (Form No.: <strong>${formNo}</strong>)</span>
          <span class="borrower-box">BORROWER CARD NO: _______________________</span>
        </div>

        <h2 class="library-main-title" style="margin-top: 10px; margin-bottom: 12px;">LIBRARY MEMBERSHIP & BOOK ISSUE LEDGER</h2>

        <div class="library-student-card">
          <table class="grid-table border-table">
            <tr>
              <td class="lbl blue-lbl">Student's Name:</td>
              <td class="val bold-txt">${name}</td>
              <td rowspan="5" class="photo-cell">
                <div class="photo-frame-library">
                  ${photoUrl && photoUrl !== '/logo.png' ? `
                    <img src="${photoUrl}" alt="Photo" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='flex';" />
                    <div class="photo-placeholder-box" style="display:none;">
                      <span>AFFIX RECENT<br/>PHOTO</span>
                    </div>
                  ` : `
                    <div class="photo-placeholder-box">
                      <span>AFFIX RECENT<br/>PHOTO</span>
                    </div>
                  `}
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

        <!-- Book Log Table (Spacious 50px cells for manual librarian entry) -->
        <div class="section-heading" style="margin-top: 10px;">Book Issue & Return Log (Librarian Handwriting Register)</div>
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

        <div class="signatures-row" style="margin-top: 34px; margin-bottom: 6px;">
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
          font-size: 10.5px;
          color: #0f172a;
          background: #ffffff;
          margin: 0;
          padding: 0;
          line-height: 1.32;
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
          .grid-table { font-size: 9px !important; }
          .school-title { font-size: 16px !important; }
          .form-title-bar { font-size: 11px !important; }
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
          font-size: 20px;
          font-weight: 900;
          color: #0f766e;
          margin: 0 0 2px 0;
          text-transform: uppercase;
          letter-spacing: 0.4px;
        }
        .font-lg { font-size: 22px !important; }
        .school-sub { display: block; font-size: 11px; font-weight: bold; color: #334155; margin: 0 0 2px 0; }
        .school-badge { display: block; font-size: 10px; color: #475569; margin: 0; }

        .header-meta-col { text-align: right; font-size: 9.5px; }
        .meta-tag { background: #f1f5f9; border: 1px solid #cbd5e1; padding: 1.5px 5px; border-radius: 3px; margin-bottom: 2px; }

        .form-title-bar {
          background: #0f766e;
          color: #ffffff;
          font-weight: 900;
          font-size: 12px;
          text-align: center;
          padding: 4px;
          border-radius: 4px;
          margin-bottom: 6px;
          letter-spacing: 0.4px;
        }

        /* Grid & Table Utility */
        .grid-table { width: 100%; border-collapse: collapse; font-size: 10px; }
        .grid-table td, .grid-table th { padding: 3.5px 5px; border: 1px solid #cbd5e1; vertical-align: middle; }
        
        .lbl { font-weight: bold; color: #002147 !important; background: #f0f4f8 !important; white-space: nowrap; }
        .blue-lbl { background: #eff6ff !important; color: #002147 !important; font-weight: bold; width: 18%; }
        .flex-lbl { white-space: normal !important; word-break: break-word; line-height: 1.12; font-size: 8.5px; width: 10.5% !important; padding: 2.5px 3px !important; color: #002147 !important; background: #eff6ff !important; }
        .address-val { width: 22.8% !important; }
        .val { background: #ffffff; color: #0f172a; }
        .bold-txt { font-weight: 900; color: #000000; }
        .blue-txt { color: #002147; }
        .teal-txt { color: #0f766e; font-weight: 900; }
        .red-txt { color: #b91c1c; }
        .bold-mono { font-family: monospace; font-weight: bold; }

        .top-row-grid { display: flex; gap: 6px; margin-bottom: 4px; align-items: stretch; }
        .qr-col { width: 92px; text-align: center; flex-shrink: 0; }
        .qr-box { width: 90px; height: 115px; border: 1.5px solid #0f766e; border-radius: 4px; padding: 3px 2px; background: #ffffff; display: flex; flex-direction: column; align-items: center; justify-content: space-between; box-sizing: border-box; }
        .qr-img { width: 80px; height: 80px; object-fit: contain; }
        .qr-lbl { font-size: 6.8px; font-weight: 900; color: #0f766e; text-transform: uppercase; letter-spacing: 0.3px; border-top: 1px dashed #cbd5e1; width: 100%; padding-top: 2px; }
        .details-left { flex: 1; }
        .photo-box { width: 92px; height: 115px; border: 2px solid #0f766e; border-radius: 4px; overflow: hidden; background: #f8fafc; position: relative; }
        .photo-box img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .photo-frame-library { width: 90px; height: 110px; border: 1.5px solid #0f766e; overflow: hidden; margin: 0 auto; background: #f8fafc; position: relative; }
        .photo-frame-library img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .photo-placeholder-box {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 6px 4px;
          box-sizing: border-box;
          text-align: center;
          background: #f8fafc;
          border: 1.5px dashed #94a3b8;
          color: #64748b;
          font-size: 7.5px;
          font-weight: 900;
          line-height: 1.25;
          letter-spacing: 0.2px;
          font-family: Arial, sans-serif;
        }

        .section-heading {
          background: #f1f5f9;
          color: #0f766e;
          font-weight: 900;
          font-size: 11px;
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
          gap: 4px;
          font-size: 8.5px;
          font-weight: bold;
          color: #1e293b;
          background: #fafafa;
          border: 1px solid #cbd5e1;
          padding: 5px 8px;
          border-radius: 3.5px;
          margin-bottom: 5px;
          align-items: center;
        }
        .checklist-grid span {
          white-space: nowrap;
        }

        .history-table th { background: #e0f2fe; color: #0369a1; font-weight: bold; text-align: center; font-size: 9.5px; }
        .history-table td { text-align: center; font-size: 9.5px; }
        .highlight-row td { background: #fff; }

        /* Undertaking & Signatures */
        .undertaking-compact { margin-top: 6px; border-top: 1px dashed #94a3b8; padding-top: 4px; }
        .undertaking-txt { font-size: 9.5px; color: #334155; margin: 0 0 8px 0; line-height: 1.3; }
        .signatures-row { display: flex; justify-content: space-between; margin-top: 20px; }
        .sig-block { width: 23%; text-align: center; border-top: 1px dashed #64748b; padding-top: 3px; font-size: 9.5px; font-weight: bold; color: #334155; }

        .page-footer-bar {
          position: absolute;
          bottom: 4px;
          left: 10px;
          right: 10px;
          display: flex;
          justify-content: space-between;
          border-top: 1px solid #cbd5e1;
          padding-top: 2px;
          font-size: 9px;
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

async function generateAndDownloadPdf(bodyHtml, fileName, onProgress) {
  const safeFileName = fileName.toLowerCase().endsWith('.pdf') ? fileName : `${fileName}.pdf`;
  const fullDoc = wrapInPrintDocument(bodyHtml, fileName);

  const prevScrollX = window.scrollX;
  const prevScrollY = window.scrollY;

  try {
    if (onProgress) onProgress(15, 'Loading PDF engine...');
    const html2pdfLib = await loadHtml2Pdf();

    if (onProgress) onProgress(35, 'Formatting pages for direct download...');
    
    // Scroll window to (0,0) so html2canvas captures from origin without offset clipping
    window.scrollTo(0, 0);

    const parsed = new DOMParser().parseFromString(fullDoc, 'text/html');
    const styleText = Array.from(parsed.querySelectorAll('style')).map((s) => s.textContent).join('\n');
    const bodyInnerHtml = parsed.body ? parsed.body.innerHTML : '';

    const container = document.createElement('div');
    container.id = 'pdf-render-capture-root';
    container.style.position = 'absolute';
    container.style.top = '0';
    container.style.left = '0';
    container.style.width = '794px';
    container.style.background = '#ffffff';
    container.style.zIndex = '999999';
    container.style.boxSizing = 'border-box';
    container.style.opacity = '1';
    container.style.visibility = 'visible';

    const styleEl = document.createElement('style');
    // Ensure all print page elements are forced visible under screen capture mode
    const forceVisibleStyle = `${styleText.replace(/@media\s+print\s*\{([\s\S]*?)\}/gi, '$1')}
      .print-page { display: block !important; visibility: visible !important; opacity: 1 !important; background: #ffffff !important; box-shadow: none !important; margin: 0 auto 10px auto !important; position: relative !important; }
      .lbl, .blue-lbl, .flex-lbl { color: #0284c7 !important; background: #f0f9ff !important; font-weight: bold !important; }
    `;
    styleEl.textContent = forceVisibleStyle;
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
      setTimeout(() => waitForImages(), 200);
    });

    try {
      if (onProgress) onProgress(70, 'Saving PDF file to Downloads...');
      const opt = {
        margin: [4, 4, 4, 4],
        filename: safeFileName,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          logging: false,
          scrollX: 0,
          scrollY: 0,
          windowWidth: 800,
          x: 0,
          y: 0
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
      window.scrollTo(prevScrollX, prevScrollY);
    }
  } catch (err) {
    console.error('generateAndDownloadPdf direct download error:', err);
    window.scrollTo(prevScrollX, prevScrollY);
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

  // Guard: ensures executePrint is only called once even if onload + readyState both fire
  let triggered = false;
  const executePrint = () => {
    if (triggered) return;
    triggered = true;
    const doc = iframe.contentWindow.document;
    const images = Array.from(doc.images || []);
    const waitForImages = (attempts = 80) => {
      const allLoaded = images.length === 0 || images.every(img => img.complete && (img.naturalWidth > 0 || img.style.display === 'none'));
      if (allLoaded || attempts <= 0) {
        try {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
        } catch (e) {
          console.error('Print iframe error:', e);
        }
        setTimeout(() => {
          if (document.body.contains(iframe)) document.body.removeChild(iframe);
        }, 5000);
      } else {
        setTimeout(() => waitForImages(attempts - 1), 100);
      }
    };
    waitForImages();
  };

  // Write content first, THEN set onload to avoid race conditions
  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(htmlContent);
  doc.close();

  if (doc.readyState === 'complete') {
    // Synchronously complete — execute immediately
    executePrint();
  } else {
    // Still loading — wait for onload
    iframe.onload = executePrint;
  }
}

/**
 * Generate and print a single student admission form PDF with configurable section options.
 */
export function generateStudentAdmissionPdf(studentData, options = {}) {
  if (!studentData) return;
  const isProvisional = studentData['Admission Type (Class 11th)'] === 'Provisional' ||
    studentData['Admission Type (Class 12th)'] === 'Provisional' ||
    studentData['Admission Type'] === 'Provisional' ||
    Boolean(studentData.isProvisional);

  if (isProvisional && options.forceFullForm !== true) {
    return generateProvisionalAdmissionPdf(studentData);
  }

  const formNo = studentData['Form Number'] || studentData['FormNo'] || studentData['formNo'] || 'Form';
  const rawName = studentData["Student's Name (as per school records)"] || studentData["Student's Name"] || studentData['name'] || 'Student';
  const cleanName = String(rawName).trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
  const docTitle = `Admission_Form_${formNo}_${cleanName}`;

  // Record print event in per-application memory (strictly 3 most recent)
  recordApplicationPrint(studentData, 'Admission Form', 'Printed / Saved PDF', { formNo, studentName: rawName });

  // Auto-archive in Document History
  saveGeneratedDocToHistory({
    docType: 'bonafide',
    title: `Admission Application Form (#${formNo})`,
    refNo: formNo,
    dateStr: new Date().toLocaleDateString('en-GB'),
    recipientOrStudent: rawName,
    bodyHtml: '',
    actionType: 'Printed / Saved PDF',
    templateName: 'Standard Admission Form',
    extraData: { studentData }
  }).catch(() => {});

  const htmlBody = buildStudentFormHtml(studentData, options);
  const fullDocument = wrapInPrintDocument(htmlBody, docTitle);
  
  // Temporarily set document.title so browser print dialog defaults to exact relevant file name
  const originalTitle = document.title;
  try {
    document.title = docTitle;
  } catch (e) {}

  printHtmlViaIframe(fullDocument);
  
  setTimeout(() => {
    try {
      document.title = originalTitle;
    } catch (e) {}
  }, 4000);
}

/**
 * Build compact Provisional Admission Slip HTML — one A4 page,
 * only essential fields, with a prominent PROVISIONAL watermark/badge.
 */
export function buildProvisionalFormHtml(studentData) {
  if (!studentData) return '';

  const formNo = studentData['Form Number'] || studentData['FormNo'] || 'N/A';
  const name = String(studentData["Student's Name (as per school records)"] || studentData['name'] || 'N/A').toUpperCase();
  const fatherName = String(studentData["Father's/Guardian's Name (as per school records)"] || studentData['fatherName'] || 'N/A').toUpperCase();
  const motherName = String(studentData["Mother's Name (as per school records)"] || studentData['motherName'] || 'N/A').toUpperCase();
  const dob = studentData["DoB (as per school records)"] || studentData['dob'] || 'N/A';
  const gender = studentData['Gender'] || studentData['gender'] || 'N/A';
  const mobile = studentData["Mobile No. (with working WhatsApp)"] || studentData['mobile'] || 'N/A';
  const parentMobile = studentData["Parent's Mobile No. (must be working)"] || studentData['parentMobile'] || 'N/A';
  const email = studentData['Email Address'] || studentData['email'] || '—';
  const houseNo = studentData['House No.'] || studentData['houseNo'] || 'N/A';
  const village = studentData["Name of your village"] || studentData['village'] || 'N/A';
  const block = studentData['Block'] || studentData['block'] || 'N/A';
  const tehsil = studentData['Tehsil'] || studentData['tehsil'] || 'N/A';
  const district = studentData['District'] || studentData['district'] || 'N/A';
  const stateUt = studentData['State/UT'] || studentData['State'] || studentData['state'] || 'N/A';
  const pinCode = studentData['PIN code'] || studentData['pincode'] || 'N/A';
  const aadhaar = studentData['Aadhar No.'] || studentData['aadhar'] || 'N/A';
  const fatherAadhaar = studentData["Father's Aadhar No."] || studentData["Father's Aadhaar No."] || studentData['fatherAadhar'] || 'N/A';
  const fatherOcc = studentData["Father's/Guardian's Occupation"] || studentData['occupation'] || 'N/A';

  const classSought = studentData['Admission sought for class'] || studentData['class'] || '11th';
  const classNumber = String(classSought).match(/(9|10|11|12)/)?.[1] || '11';
  const previousClass = classNumber === '12' ? '11th' : classNumber === '11' ? '10th' : classNumber === '10' ? '9th' : '8th';
  const stream = classNumber === '9' || classNumber === '10'
    ? 'General'
    : studentData['Stream for Class 11th'] || studentData['Stream opted in Class 11th'] || studentData['Stream'] || studentData['stream'] || 'N/A';
  const session = studentData['Session'] || studentData['session'] || getCurrentAcademicSession();
  const photoUrl = getStudentPhotoUrl(studentData, '/logo.png');
  const rawSubjects = studentData['Subjects to be taken in Class 9th']
    || studentData['Subjects to be taken in Class 10th']
    || studentData['Subjects to be taken in Class 11th']
    || studentData['Stream & Subjects for Class 12th']
    || studentData['chosenSubjects']
    || '';
  const subjects = formatAllSubjects(rawSubjects, classSought, stream) || '—';

  const provisionReason11 = studentData['Reason for Provisional (Class 11th)'] || studentData['Reason for Provisional Admission (Class 11th)'] || '—';
  const provisionReason12 = studentData['Reason for Provisional (Class 12th)'] || studentData['Reason for Provisional Admission (Class 12th)'] || '—';
  const provisionReason = provisionReason11 !== '—' ? provisionReason11 : (provisionReason12 !== '—' ? provisionReason12 : 'Result Awaited');
  const reappear10 = studentData['Subjects to Reappear (Class 10th)'] || '';
  const reappear11 = studentData['Subjects to Reappear (Class 11th)'] || '';
  const reappearSubs = reappear10 || reappear11 || 'None';

  const rawSubmDate = 
    studentData["onlineSubmDate"] ||
    studentData["online_subm_date"] ||
    studentData["Online Submission Date"] ||
    studentData["Online Submission"] ||
    studentData["submittedAt"] ||
    studentData["submissionDate"] ||
    studentData["Submission Date"] ||
    studentData["createdAt"] ||
    studentData["created_at"] ||
    studentData["timestamp"] ||
    studentData["Timestamp"] ||
    studentData["Date of Submission"] ||
    studentData["admDate"] ||
    studentData["Admission Date"] ||
    studentData["admissionDate"] ||
    studentData["submDate"] ||
    studentData["updatedAt"];
  const formattedSubmDate = formatDateTimeDDMMMYYYY(rawSubmDate);

  const regNo = studentData[`Board Registration No. (Class ${previousClass})`]
    || (previousClass === '8th' ? studentData['DIET Registration No.'] : '')
    || studentData['boardRegNo']
    || 'N/A';
  const rollVal = studentData[`Exam Roll Number of Class ${previousClass}`] || studentData['rollNo'] || 'N/A';
  const prevSession = studentData[`Year of Appearing (Class ${previousClass})`]
    || studentData[`Year of Passing Class ${previousClass}`]
    || 'N/A';
  const schoolName = studentData[`Name of Previous School (Class ${previousClass})`]
    || studentData['Name of Previous School']
    || studentData['Name of your previous school']
    || 'N/A';

  // Generate cryptographically signed verification URL QR Code for Provisional Form
  const cleanFNo = String(formNo).replace(/[^0-9]/g, '') || formNo;
  const origin = (typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : 'https://admexamhssshangus.web.app';
  const sig = generateVerificationSignature(regNo, rollVal, cleanFNo);
  const verifyUrl = `${origin}/verify-student?reg=${encodeURIComponent(regNo)}&roll=${encodeURIComponent(rollVal)}&fNo=${encodeURIComponent(cleanFNo)}&sig=${encodeURIComponent(sig)}`;
  const qrCodeUrl = createQrSvgDataUri(verifyUrl, 160) || `https://api.qrserver.com/v1/create-qr-code/?size=160x160&margin=2&ecc=M&data=${encodeURIComponent(verifyUrl)}`;

  return `
    <!-- PROVISIONAL ADMISSION SLIP — COMPACT SINGLE PAGE -->
    <div class="print-page prov-page" style="padding:16px 22px; font-family:'Times New Roman', Times, serif; color:#000; font-size:10pt; line-height:1.2; box-sizing:border-box; background:#fff; position:relative;">

      <!-- Header with Seal (Left), School Details (Center), and Verification QR Code (Right) -->
      <div style="display:flex; align-items:center; justify-content:space-between; border-bottom:2px solid #881337; padding-bottom:6px; margin-bottom:8px; position:relative; z-index:1;">
        <div style="width:65px; flex-shrink:0;">
          <img src="/logo.png" style="width:60px; height:60px; object-fit:contain;" onerror="this.style.visibility='hidden';" />
        </div>
        <div style="text-align:center; flex:1;">
          <h1 style="margin:0; font-size:16.5pt; font-weight:bold; color:#881337; text-transform:uppercase; letter-spacing:0.5px;">Govt. Higher Secondary School Shangus</h1>
          <p style="margin:2px 0 0 0; font-size:9.5pt; font-weight:bold; color:#1e293b;">Anantnag Kashmir-192201</p>
          <p style="margin:1px 0 0 0; font-size:8.5pt; color:#475569;">Board Reg. No.: <strong>010061</strong> | UDISE code: <strong>01061400618</strong></p>
        </div>
        <div style="width:65px; text-align:center; flex-shrink:0;">
          <div style="border:1px solid #cbd5e1; padding:2px; background:#fff; border-radius:4px; display:inline-block;">
            <img src="${qrCodeUrl}" style="width:52px; height:52px; display:block;" alt="Verification QR Code" />
          </div>
          <span style="display:block; font-size:6pt; font-weight:bold; color:#881337; margin-top:2px; font-family:sans-serif; letter-spacing:0.3px;">SCAN TO VERIFY</span>
        </div>
      </div>

      <div style="margin:-1px 0 7px; padding:4px 8px; border:1.5px solid #d97706; background:#fffbeb; color:#92400e; text-align:center; font:800 9pt Arial,sans-serif; letter-spacing:.35px; position:relative; z-index:1;">
        PROVISIONAL ADMISSION — SUBJECT TO RESULT, ELIGIBILITY &amp; DOCUMENT VERIFICATION
      </div>

      <!-- Top Administrative Office Grid Box -->
      <table style="width:100%; border-collapse:collapse; margin-bottom:8px; font-size:9pt; background:#fff1f2; border:1.5px solid #be123c; border-radius:4px; position:relative; z-index:1;">
        <tr>
          <td style="padding:3px 6px; border:1px solid #fda4af; font-weight:bold; color:#881337; width:15%;">Form No.:</td>
          <td style="padding:3px 6px; border:1px solid #fda4af; font-weight:bold; color:#991b1b; width:35%; font-size:10pt;">${formNo}</td>
          <td style="padding:3px 6px; border:1px solid #fda4af; font-weight:bold; color:#881337; width:20%;">Online subm. date:</td>
          <td style="padding:3px 6px; border:1px solid #fda4af; font-weight:bold; color:#0f766e; width:30%;">${formattedSubmDate}</td>
        </tr>
        <tr>
          <td style="padding:3px 6px; border:1px solid #fda4af; font-weight:bold; color:#881337;">Class admitted to:</td>
          <td style="padding:3px 6px; border:1px solid #fda4af; font-style:italic; color:#475569;">Class ${classSought} (${stream})</td>
          <td style="padding:3px 6px; border:1px solid #fda4af; font-weight:bold; color:#881337;">Roll No.:</td>
          <td style="padding:3px 6px; border:1px solid #fda4af; font-style:italic; color:#cbd5e1; font-size:8pt; opacity:0.6; letter-spacing:0.3px;">[ Office Use ]</td>
        </tr>
        <tr>
          <td style="padding:3px 6px; border:1px solid #fda4af; font-weight:bold; color:#881337;">Adm. No. (Date):</td>
          <td style="padding:3px 6px; border:1px solid #fda4af; font-style:italic; color:#cbd5e1; font-size:8pt; opacity:0.6; letter-spacing:0.3px;">[ Office Use ]</td>
          <td style="padding:3px 6px; border:1px solid #fda4af; font-weight:bold; color:#881337;">Section:</td>
          <td style="padding:3px 6px; border:1px solid #fda4af; font-style:italic; color:#cbd5e1; font-size:8pt; opacity:0.6; letter-spacing:0.3px;">[ Office Use ]</td>
        </tr>
      </table>

      <!-- Session & Title Row with Passport Photo -->
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px; position:relative; z-index:1;">
        <div style="flex:1;">
          <div style="font-size:11pt; font-weight:bold; color:#dc2626; margin-bottom:2px;">Session: <span style="color:#000;">${session}</span></div>
          <h2 style="margin:0; font-size:15pt; font-weight:bold; color:#15803d; font-family:sans-serif;">Admission/Registration</h2>
          <h3 style="margin:2px 0 0 0; font-size:11pt; font-weight:bold; color:#1d4ed8;">Application Form <span style="color:#b91c1c;">(Provisional_${provisionReason})</span></h3>
        </div>
        <div style="width:82px; height:100px; border:1.5px solid #334155; padding:2px; background:#fff; text-align:center; flex-shrink:0; box-sizing:border-box;">
          ${photoUrl && photoUrl !== '/logo.png' ? `
            <img src="${photoUrl}" style="width:100%; height:100%; object-fit:cover;" onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='flex';" />
            <div style="display:none; width:100%; height:100%; border:1px dashed #94a3b8; background:#f8fafc; color:#64748b; font-size:7.5px; font-weight:bold; align-items:center; justify-content:center; text-align:center; box-sizing:border-box;">
              AFFIX PHOTO
            </div>
          ` : `
            <div style="display:flex; width:100%; height:100%; border:1px dashed #94a3b8; background:#f8fafc; color:#64748b; font-size:7.5px; font-weight:bold; align-items:center; justify-content:center; text-align:center; box-sizing:border-box;">
              AFFIX PHOTO
            </div>
          `}
        </div>
      </div>

      <!-- Section 1: Personal Details -->
      <div style="font-weight:bold; color:#991b1b; border-bottom:1.5px solid #991b1b; padding-bottom:2px; margin-bottom:3px; font-size:9.5pt; text-transform:uppercase; position:relative; z-index:1;">Personal Details</div>
      <table style="width:100%; border-collapse:collapse; margin-bottom:6px; font-size:9pt; border:1px solid #cbd5e1; position:relative; z-index:1;">
        <tr>
          <td style="padding:2.5px 5px; border:1px solid #cbd5e1; font-weight:bold; color:#1e3a8a; width:22%;">Student's Name:</td>
          <td style="padding:2.5px 5px; border:1px solid #cbd5e1; font-weight:bold; width:28%;">${name}</td>
          <td style="padding:2.5px 5px; border:1px solid #cbd5e1; font-weight:bold; color:#1e3a8a; width:22%;">Date of Birth:</td>
          <td style="padding:2.5px 5px; border:1px solid #cbd5e1; width:28%;">${dob}</td>
        </tr>
        <tr>
          <td style="padding:2.5px 5px; border:1px solid #cbd5e1; font-weight:bold; color:#1e3a8a;">Father's/Guardian's Name:</td>
          <td style="padding:2.5px 5px; border:1px solid #cbd5e1; font-weight:bold;">${fatherName}</td>
          <td style="padding:2.5px 5px; border:1px solid #cbd5e1; font-weight:bold; color:#1e3a8a;">Father's/Guardian's Occupation:</td>
          <td style="padding:2.5px 5px; border:1px solid #cbd5e1;">${fatherOcc}</td>
        </tr>
        <tr>
          <td style="padding:2.5px 5px; border:1px solid #cbd5e1; font-weight:bold; color:#1e3a8a;">Mother's Name:</td>
          <td style="padding:2.5px 5px; border:1px solid #cbd5e1;">${motherName}</td>
          <td style="padding:2.5px 5px; border:1px solid #cbd5e1; font-weight:bold; color:#1e3a8a;">Gender:</td>
          <td style="padding:2.5px 5px; border:1px solid #cbd5e1; font-weight:bold;">${gender}</td>
        </tr>
        <tr>
          <td style="padding:2.5px 5px; border:1px solid #cbd5e1; font-weight:bold; color:#1e3a8a;">Mobile No. <span style="font-size:7.5pt; font-weight:normal;">(WhatsApp)</span>:</td>
          <td style="padding:2.5px 5px; border:1px solid #cbd5e1; font-weight:bold; color:#0f766e;">${mobile}</td>
          <td style="padding:2.5px 5px; border:1px solid #cbd5e1; font-weight:bold; color:#1e3a8a;">Parent's Contact:</td>
          <td style="padding:2.5px 5px; border:1px solid #cbd5e1;">${parentMobile}</td>
        </tr>
        <tr>
          <td style="padding:2.5px 5px; border:1px solid #cbd5e1; font-weight:bold; color:#1e3a8a;">Student Aadhaar:</td>
          <td style="padding:2.5px 5px; border:1px solid #cbd5e1;">${aadhaar}</td>
          <td style="padding:2.5px 5px; border:1px solid #cbd5e1; font-weight:bold; color:#1e3a8a;">Father's Aadhaar:</td>
          <td style="padding:2.5px 5px; border:1px solid #cbd5e1;">${fatherAadhaar}</td>
        </tr>
      </table>

      <!-- Section 2: Address -->
      <div style="font-weight:bold; color:#991b1b; border-bottom:1.5px solid #991b1b; padding-bottom:2px; margin-bottom:3px; font-size:9.5pt; text-transform:uppercase; position:relative; z-index:1;">Address</div>
      <table style="width:100%; border-collapse:collapse; margin-bottom:6px; font-size:9pt; border:1px solid #cbd5e1; position:relative; z-index:1;">
        <tr>
          <td style="padding:2.5px 5px; border:1px solid #cbd5e1; font-weight:bold; color:#1e3a8a; width:22%;">House No.:</td>
          <td style="padding:2.5px 5px; border:1px solid #cbd5e1; width:28%;">${houseNo}</td>
          <td style="padding:2.5px 5px; border:1px solid #cbd5e1; font-weight:bold; color:#1e3a8a; width:22%;">Village/Town/City:</td>
          <td style="padding:2.5px 5px; border:1px solid #cbd5e1; width:28%;" colspan="3">${village}</td>
        </tr>
        <tr>
          <td style="padding:2.5px 5px; border:1px solid #cbd5e1; font-weight:bold; color:#1e3a8a;">Block / Tehsil:</td>
          <td style="padding:2.5px 5px; border:1px solid #cbd5e1;">${block} / ${tehsil}</td>
          <td style="padding:2.5px 5px; border:1px solid #cbd5e1; font-weight:bold; color:#1e3a8a;">District / State:</td>
          <td style="padding:2.5px 5px; border:1px solid #cbd5e1;" colspan="3">${district} / ${stateUt}</td>
        </tr>
        <tr>
          <td style="padding:2.5px 5px; border:1px solid #cbd5e1; font-weight:bold; color:#1e3a8a;">PIN Code:</td>
          <td style="padding:2.5px 5px; border:1px solid #cbd5e1;">${pinCode}</td>
          <td style="padding:2.5px 5px; border:1px solid #cbd5e1; font-weight:bold; color:#1e3a8a;">E-mail:</td>
          <td style="padding:2.5px 5px; border:1px solid #cbd5e1;" colspan="3">${email}</td>
        </tr>
      </table>

      <!-- Section 3: Academic Details -->
      <div style="font-weight:bold; color:#991b1b; border-bottom:1.5px solid #991b1b; padding-bottom:2px; margin-bottom:3px; font-size:9.5pt; text-transform:uppercase; position:relative; z-index:1;">Academic Details</div>
      <table style="width:100%; border-collapse:collapse; margin-bottom:6px; font-size:9pt; border:1px solid #cbd5e1; position:relative; z-index:1;">
        <tr>
          <td style="padding:2.5px 5px; border:1px solid #cbd5e1; font-weight:bold; color:#1e3a8a; width:22%;">Board Reg. No.:</td>
          <td style="padding:2.5px 5px; border:1px solid #cbd5e1; font-weight:bold; width:28%;">${regNo}</td>
          <td style="padding:2.5px 5px; border:1px solid #cbd5e1; font-weight:bold; color:#1e3a8a; width:22%;">Prev. Year Exam Roll No.:</td>
          <td style="padding:2.5px 5px; border:1px solid #cbd5e1; font-weight:bold; width:28%;">${rollVal}</td>
        </tr>
        <tr>
          <td style="padding:2.5px 5px; border:1px solid #cbd5e1; font-weight:bold; color:#1e3a8a;">Prev. Session:</td>
          <td style="padding:2.5px 5px; border:1px solid #cbd5e1;">${prevSession}</td>
          <td style="padding:2.5px 5px; border:1px solid #cbd5e1; font-weight:bold; color:#1e3a8a;">Subjects Offered:</td>
          <td style="padding:2.5px 5px; border:1px solid #cbd5e1; font-weight:bold; color:#0369a1;">${subjects}</td>
        </tr>
        <tr>
          <td style="padding:2.5px 5px; border:1px solid #cbd5e1; font-weight:bold; color:#1e3a8a;">Class (Prov.):</td>
          <td style="padding:2.5px 5px; border:1px solid #cbd5e1; font-weight:bold; color:#047857;">Class ${classSought}</td>
          <td style="padding:2.5px 5px; border:1px solid #cbd5e1; font-weight:bold; color:#1e3a8a;">Stream (Prov.):</td>
          <td style="padding:2.5px 5px; border:1px solid #cbd5e1; font-weight:bold; color:#047857;">${stream}</td>
        </tr>
        <tr>
          <td style="padding:2.5px 5px; border:1px solid #cbd5e1; font-weight:bold; color:#b91c1c;">Subject/s in which to reappear:</td>
          <td style="padding:2.5px 5px; border:1px solid #cbd5e1; font-weight:bold; color:#b91c1c;" colspan="3">${reappearSubs}</td>
        </tr>
        <tr>
          <td style="padding:2.5px 5px; border:1px solid #cbd5e1; font-weight:bold; color:#1e3a8a;">Name of the Previous School:</td>
          <td style="padding:2.5px 5px; border:1px solid #cbd5e1;" colspan="3">${schoolName}</td>
        </tr>
      </table>

      <!-- Declaration Section -->
      <div style="margin-top:6px; border:1px solid #cbd5e1; padding:6px 10px; background:#f8fafc; font-size:8.5pt; position:relative; z-index:1;">
        <div style="font-weight:bold; color:#1e293b; margin-bottom:2px;">Declaration by the Student:</div>
        <p style="margin:0 0 2px 0; font-style:italic; color:#334155;">
          I, <strong>${name}</strong>, solemnly declare the following:
        </p>
        <ul style="margin:0; padding-left:16px; color:#475569; line-height:1.3;">
          <li>I seek provisional admission until my previous class exam results are released. Failure to pass will invalidate this admission.</li>
          <li>I have carefully reviewed all details in this admission form.</li>
          <li>All information provided in this form is true, correct, and complete to the best of my knowledge.</li>
        </ul>
        <div style="text-align:right; margin-top:10px; font-weight:bold; color:#0f172a;">
          Sig. of Student ________________________
        </div>
      </div>

      <!-- Signatures Footer Row -->
      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:22px; font-size:9.5pt; font-weight:bold; color:#1e293b; position:relative; z-index:1;">
        <div>Sig. of I/C Exam</div>
        <div>Checked by</div>
        <div style="color:#881337;">Principal</div>
      </div>

      <!-- Bottom Tag -->
      <div style="margin-top:12px; border-top:1px solid #be123c; padding-top:2px; font-size:8pt; color:#64748b; font-family:monospace; position:relative; z-index:1;">
        Adm.${session}-HSS.Shangus · Provisional · Page 1/1
      </div>
    </div>
  `;
}

/**
 * Generate and print a compact Provisional Admission Slip PDF (single page, amber-themed).
 */
export function generateProvisionalAdmissionPdf(studentData) {
  if (!studentData) return;
  const formNo = studentData['Form Number'] || studentData['FormNo'] || studentData['formNo'] || 'Form';
  const rawName = studentData["Student's Name (as per school records)"] || studentData["Student's Name"] || studentData['name'] || 'Student';
  const cleanName = String(rawName).trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
  const docTitle = `Provisional_Admission_Slip_${formNo}_${cleanName}`;

  // Record print event in per-application memory (strictly 3 most recent)
  recordApplicationPrint(studentData, 'Provisional Admission Slip', 'Printed / Saved PDF', { formNo, studentName: rawName });

  // Auto-archive in Document History
  saveGeneratedDocToHistory({
    docType: 'bonafide',
    title: `Provisional Admission Slip (#${formNo})`,
    refNo: formNo,
    dateStr: new Date().toLocaleDateString('en-GB'),
    recipientOrStudent: rawName,
    bodyHtml: '',
    actionType: 'Printed / Saved PDF',
    templateName: 'Provisional Admission Slip',
    extraData: { studentData }
  }).catch(() => {});

  const htmlBody = buildProvisionalFormHtml(studentData);
  const provCss = `
    @page { size: A4 portrait; margin: 7mm; }
    .prov-page {
      width: 196mm !important;
      min-height: 277mm !important;
      max-height: 277mm !important;
      overflow: hidden !important;
      page-break-after: avoid !important;
      page-break-inside: avoid !important;
      border-color: #d97706 !important;
      outline-color: #f59e0b !important;
    }
    .prov-title-bar { background: linear-gradient(90deg, #d97706, #b45309) !important; font-size: 11px !important; }
    .prov-watermark {
      position: absolute; top: 50%; left: 50%;
      transform: translate(-50%,-50%) rotate(-35deg);
      font-size: 64px; font-weight: 900;
      color: rgba(217,119,6,0.08);
      pointer-events: none; z-index: 5;
      white-space: nowrap; letter-spacing: 4px;
      font-family: Arial, sans-serif;
    }
  `;

  const fullDocument = wrapInPrintDocument(htmlBody, docTitle).replace(
    '</style>',
    provCss + '</style>'
  );

  const originalTitle = document.title;
  try { document.title = docTitle; } catch (e) {}
  printHtmlViaIframe(fullDocument);
  setTimeout(() => { try { document.title = originalTitle; } catch (e) {} }, 4000);
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
 * Downloads the admission form as a clean PDF file directly to Downloads — no print dialog.
 * Each .print-page is captured individually via html2canvas and placed on its own A4 page
 * in jsPDF, producing crisp text and perfect page boundaries.
 */
export async function downloadStudentAdmissionPdf(studentData, options = {}) {
  if (!studentData) return;
  const formNo = studentData['Form Number'] || studentData['FormNo'] || studentData['formNo'] || 'Form';
  const rawName = studentData["Student's Name (as per school records)"] || studentData["Student's Name"] || studentData['name'] || 'Student';
  const cleanName = String(rawName).trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
  const fileName = `Admission_Form_${formNo}_${cleanName}.pdf`;
  const htmlBody = buildStudentFormHtml(studentData, options);
  const fullDocument = wrapInPrintDocument(htmlBody, fileName);

  const progress = showPdfProgressModal('Generating PDF…', 'Building admission form…');

  // Render iframe positioned above viewport so html2canvas x-coordinates are correct (left: 0)
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:absolute;left:0;top:0;width:794px;height:3500px;border:none;opacity:0;pointer-events:none;z-index:-1;';
  document.body.appendChild(iframe);

  try {
    progress.update(15, 'Rendering form…');

    // Write full document into iframe (its own CSS context — mm units work correctly)
    const iDoc = iframe.contentWindow.document;
    iDoc.open();
    iDoc.write(fullDocument);
    iDoc.close();

    // Wait for iframe fully loaded + all images
    await new Promise(resolve => {
      const check = (attempts = 80) => {
        const imgs = Array.from(iDoc.images || []);
        const allDone = imgs.length === 0 || imgs.every(img => img.complete && img.naturalHeight > 0);
        if (iDoc.readyState === 'complete' && allDone) {
          resolve();
        } else if (attempts <= 0) {
          resolve(); // proceed anyway
        } else {
          setTimeout(() => check(attempts - 1), 120);
        }
      };
      if (iDoc.readyState === 'complete') setTimeout(() => check(), 200);
      else iframe.onload = () => setTimeout(() => check(), 200);
    });

    // Extra paint settle
    await new Promise(r => setTimeout(r, 500));

    progress.update(35, 'Preparing PDF engine…');

    // Find all .print-page elements in the iframe
    const pages = Array.from(iDoc.querySelectorAll('.print-page'));
    if (pages.length === 0) {
      throw new Error('No form pages found to capture');
    }

    progress.update(50, `Capturing ${pages.length} pages…`);

    // A4 dimensions in mm
    const a4W = 210;
    const a4H = 297;
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

    for (let i = 0; i < pages.length; i++) {
      const pageEl = pages[i];
      progress.update(50 + Math.round((i / pages.length) * 40), `Rendering page ${i + 1} of ${pages.length}…`);

      // Ensure table cells are vertically centered for clean capture
      const cells = pageEl.querySelectorAll('td, th');
      cells.forEach(c => { c.style.verticalAlign = 'middle'; });

      // Capture at scale 2 with JPEG for reasonable file size (~2-3 MB)
      const canvas = await html2canvas(pageEl, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 794,
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.92);

      // Fit to full A4 width with small margins, image placed at top of page
      const margin = 3;
      const imgW = a4W - margin * 2;
      const imgH = (canvas.height / canvas.width) * imgW;

      if (i > 0) pdf.addPage();
      pdf.addImage(imgData, 'JPEG', margin, margin, imgW, imgH);
    }

    progress.update(95, 'Saving PDF…');
    pdf.save(fileName);

    progress.update(100, 'Download complete!');
    setTimeout(() => progress.close(), 1200);

  } catch (err) {
    console.error('PDF download error:', err);
    progress.close();
    // Graceful fallback: open print dialog instead
    generateStudentAdmissionPdf(studentData, options);
  } finally {
    if (document.body.contains(iframe)) document.body.removeChild(iframe);
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
  const regNo = regData.examNumber || regData.regNo || regData.rollNo || regData.id || 'N/A';
  const candidateName = (regData.name || regData.candidateName || 'N/A').toUpperCase();
  const fatherName = (regData.fatherName || regData.parentName || 'N/A').toUpperCase();
  const cls = regData.className || regData.class || regData.classGrade || 'N/A';
  const school = regData.school || regData.institution || 'Govt. Higher Secondary School Shangus';
  const category = regData.category || 'General';
  const contact = regData.mobile || regData.contact || 'N/A';
  const examCenter = regData.examCenter || regData.center || regData.venue || 'Govt. Higher Secondary School Shangus';
  const examDate = regData.examDate || 'Sunday, 30th August 2026';
  const examTime = regData.examTime || '11:00 AM – 01:00 PM';
  const examTitle = (regData.examTitle || 'OFFICIAL ADMIT CARD — COMPETITIVE & TALENT SEARCH EXAMINATION').toUpperCase();
  const photoUrl = getStudentPhotoUrl(regData, '/logo.png');

  const instructionsList = Array.isArray(regData.instructions) && regData.instructions.length > 0
    ? regData.instructions
    : [
      'Candidates must produce this printed Admit Card along with a valid Identity Proof at the examination center.',
      'Reporting time at the examination center is 30 minutes prior to commencement of the test.',
      'Electronic devices including cell phones, smart watches, and calculators are strictly banned inside the hall.',
      'Use blue or black ballpoint pen only for writing responses on the answer sheet.'
    ];

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${examTitle} - ${regNo} - ${candidateName}</title>
      <style>
        @page { size: A4 portrait; margin: 0.5cm; }
        body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #0f172a; margin: 0; padding: 0; line-height: 1.4; }
        .admit-card { border: 2px solid #0f766e; padding: 16px; border-radius: 8px; background: #ffffff; width: 100%; box-sizing: border-box; }
        .header { text-align: center; border-bottom: 2px solid #0f766e; padding-bottom: 10px; margin-bottom: 12px; }
        .school-title { font-size: 18px; font-weight: bold; color: #0f766e; text-transform: uppercase; }
        .exam-title { font-size: 13px; font-weight: bold; color: #b91c1c; margin-top: 4px; letter-spacing: 0.5px; }
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
          <div class="school-title">GOVT. HIGHER SECONDARY SCHOOL SHANGUS</div>
          <div class="exam-title">${examTitle}</div>
        </div>

        <div class="info-grid">
          <table class="info-table">
            <tr><td class="lbl">Registration / Exam Roll No:</td><td><strong style="color: #b91c1c; font-size: 13px;">${regNo}</strong></td></tr>
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
          ${instructionsList.map(inst => `<li>${inst}</li>`).join('\n          ')}
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
