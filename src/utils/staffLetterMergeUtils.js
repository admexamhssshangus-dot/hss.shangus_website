// =================================================================
// HSS SHANGUS — Staff Official Letterhead & Mail Merge Utilities
// Comprehensive Mail Merge Engine, Variable Interpolation & Roster Exports
// =================================================================

import * as XLSX from 'xlsx';
import { sanitizeRichHtml } from './sanitizeRichHtml';
import { generateOfficialLetterDocx } from './officialLetterExportUtils';

/**
 * Standard Available Employee Mail Merge Variable Tokens
 */
export const STAFF_MERGE_VARIABLES = [
  { token: '{{name}}', label: 'Employee Name', key: 'name', sample: 'Aijaz Ahmad Wagay' },
  { token: '{{designation}}', label: 'Designation', key: 'designation', sample: 'Principal' },
  { token: '{{cpis}}', label: 'CPIS ID', key: 'cpis', sample: 'SHGEDU00200028' },
  { token: '{{pan}}', label: 'PAN Number', key: 'pan', sample: 'ABBPW3797Q' },
  { token: '{{department}}', label: 'Department / Subject', key: 'department', sample: 'School Administration' },
  { token: '{{cadre}}', label: 'Cadre (Teaching/Non-Teaching)', key: 'cadre', sample: 'Teaching' },
  { token: '{{gross_salary}}', label: 'Annual Gross Salary', key: 'gross_salary', sample: '₹20,96,982' },
  { token: '{{monthly_salary}}', label: 'Monthly Gross Salary', key: 'monthly_salary', sample: '₹1,74,748' },
  { token: '{{bank_account}}', label: 'Bank Account No.', key: 'bank_account', sample: '0234010100012345' },
  { token: '{{bank_name}}', label: 'Bank Name', key: 'bank_name', sample: 'J&K Bank Shangus' },
  { token: '{{ifsc}}', label: 'IFSC Code', key: 'ifsc', sample: 'JAKA0SHNGUS' },
  { token: '{{mobile}}', label: 'Mobile Number', key: 'mobile', sample: '9419000000' },
  { token: '{{email}}', label: 'Email Address', key: 'email', sample: 'teacher@jk.gov.in' },
  { token: '{{parentage}}', label: "Father's / Parent Name", key: 'parentage', sample: 'Ghulam Mohammad' },
  { token: '{{dob}}', label: 'Date of Birth', key: 'dob', sample: '01-03-1980' },
  { token: '{{qualification}}', label: 'Qualifications', key: 'qualification', sample: 'M.Sc, B.Ed, M.Phil' },
  { token: '{{permanent_address}}', label: 'Permanent Address', key: 'permanent_address', sample: 'Shangus, Anantnag' },
  { token: '{{doj}}', label: 'Date of Joining', key: 'doj', sample: '15-04-2012' },
  { token: '{{ref_no}}', label: 'Reference / Dispatch No.', key: 'ref_no', sample: 'HSS/SHG/Estt/2026/042' },
  { token: '{{date}}', label: 'Dispatch Date', key: 'date', sample: new Date().toLocaleDateString('en-GB') },
  { token: '{{academic_session}}', label: 'Academic Session', key: 'session', sample: '2025–26' }
];

/**
 * Standard Columns for Custom Staff Rosters and Registers
 */
export const STANDARD_STAFF_ROSTER_COLUMNS = [
  { key: 'sno', label: 'S.No.', defaultSelected: true, widthPct: 5, align: 'center' },
  { key: 'cpis', label: 'CPIS No.', defaultSelected: true, widthPct: 12, align: 'center' },
  { key: 'name', label: 'Name of Employee', defaultSelected: true, widthPct: 18, align: 'left' },
  { key: 'designation', label: 'Designation', defaultSelected: true, widthPct: 14, align: 'left' },
  { key: 'department', label: 'Subject / Wing', defaultSelected: true, widthPct: 12, align: 'left' },
  { key: 'pan', label: 'PAN', defaultSelected: true, widthPct: 10, align: 'center' },
  { key: 'grossSalary', label: 'Gross Salary (Annual)', defaultSelected: true, widthPct: 13, align: 'right' },
  { key: 'bankAccount', label: 'Bank Account', defaultSelected: false, widthPct: 13, align: 'center' },
  { key: 'phone', label: 'Mobile No.', defaultSelected: false, widthPct: 10, align: 'center' },
  { key: 'remarks', label: 'Remarks', defaultSelected: true, widthPct: 10, align: 'left' }
];

/**
 * All Other Available Columns about Staff (Expandable under "More Columns")
 */
export const MORE_STAFF_ROSTER_COLUMNS = [
  { key: 'parentage', label: "Father's / Parent Name", widthPct: 14, align: 'left' },
  { key: 'dob', label: 'Date of Birth', widthPct: 10, align: 'center' },
  { key: 'gender', label: 'Gender', widthPct: 8, align: 'center' },
  { key: 'category', label: 'Social Category', widthPct: 10, align: 'center' },
  { key: 'email', label: 'Email Address', widthPct: 15, align: 'left' },
  { key: 'gov_mail_id', label: 'Govt. Mail ID', widthPct: 14, align: 'left' },
  { key: 'doj', label: 'Date of 1st Appointment', widthPct: 12, align: 'center' },
  { key: 'designation_at_first_appointment', label: 'Designation at 1st Appt', widthPct: 14, align: 'left' },
  { key: 'stay_period', label: 'Stay Period / From', widthPct: 10, align: 'center' },
  { key: 'cadre', label: 'Service Cadre', widthPct: 10, align: 'center' },
  { key: 'qualification', label: 'Qualifications', widthPct: 13, align: 'left' },
  { key: 'subject_pg', label: 'PG Subject', widthPct: 11, align: 'left' },
  { key: 'bed', label: 'B.Ed Status', widthPct: 9, align: 'center' },
  { key: 'zone_name', label: 'Zone Name', widthPct: 10, align: 'center' },
  { key: 'ddo_code', label: 'UDISE / DDO Code', widthPct: 11, align: 'center' },
  { key: 'monthly_salary', label: 'Monthly Gross Salary', widthPct: 11, align: 'right' },
  { key: 'net_salary', label: 'Net Take-Home Salary', widthPct: 11, align: 'right' },
  { key: 'tds', label: 'TDS Paid', widthPct: 10, align: 'right' },
  { key: 'tax_regime', label: 'Tax Regime', widthPct: 9, align: 'center' },
  { key: 'deduction_80c', label: '80C Deductions', widthPct: 10, align: 'right' },
  { key: 'deduction_80d', label: '80D Deductions', widthPct: 10, align: 'right' },
  { key: 'bank_name', label: 'Bank Name', widthPct: 13, align: 'left' },
  { key: 'ifsc', label: 'IFSC Code', widthPct: 11, align: 'center' },
  { key: 'permanent_address', label: 'Permanent Address', widthPct: 16, align: 'left' },
  { key: 'present_address', label: 'Present Address', widthPct: 16, align: 'left' },
  { key: 'if_deployed', label: 'Deployment Status', widthPct: 10, align: 'center' },
  { key: 'health_issues', label: 'Health / Security Grounds', widthPct: 14, align: 'left' }
];

export const ALL_STAFF_ROSTER_COLUMNS = [
  ...STANDARD_STAFF_ROSTER_COLUMNS,
  ...MORE_STAFF_ROSTER_COLUMNS
];

/**
 * Built-in Staff Letter Templates
 */
export const BUILTIN_STAFF_LETTER_TEMPLATES = [
  {
    id: 'salary_service_certificate',
    name: 'Salary & Service Certificate',
    category: 'Accounts & Verification',
    desc: 'Official certificate for bank loan, visa, or departmental verification',
    refNo: 'HSS/SHG/Sal-Cert/2026/',
    subject: 'Salary and Service Certificate in respect of {{name}}, {{designation}}.',
    bodyHtml: `
<p style="text-align: center; font-size: 15px; font-weight: 800; letter-spacing: 0.5px; text-decoration: underline; margin-bottom: 14px;">TO WHOM IT MAY CONCERN</p>

<p>This is to certify that <strong>{{name}}</strong>, holding CPIS No. <strong>{{cpis}}</strong> and Permanent Account Number (PAN) <strong>{{pan}}</strong>, is a bonafide and permanent employee of the School Education Department, Government of Jammu & Kashmir, presently posted and discharging official duties as <strong>{{designation}}</strong> in the Department of <strong>{{department}}</strong> at <strong>Govt. Higher Secondary School Shangus</strong>.</p>

<p>As per the official establishment registers and pay bills maintained in this office for the Financial Year <strong>2025–26</strong>, the remuneration and service particulars of the official are certified as under:</p>

<table style="width: 100%; border-collapse: collapse; margin: 14px 0;">
  <tbody>
    <tr style="background-color: #f8fafc;">
      <td style="border: 1px solid #64748b; padding: 6px 10px; font-weight: 700; width: 40%;">Name & Designation</td>
      <td style="border: 1px solid #64748b; padding: 6px 10px;">{{name}} ({{designation}})</td>
    </tr>
    <tr>
      <td style="border: 1px solid #64748b; padding: 6px 10px; font-weight: 700;">CPIS ID / Computer Code</td>
      <td style="border: 1px solid #64748b; padding: 6px 10px;">{{cpis}}</td>
    </tr>
    <tr style="background-color: #f8fafc;">
      <td style="border: 1px solid #64748b; padding: 6px 10px; font-weight: 700;">PAN Card Number</td>
      <td style="border: 1px solid #64748b; padding: 6px 10px;">{{pan}}</td>
    </tr>
    <tr>
      <td style="border: 1px solid #64748b; padding: 6px 10px; font-weight: 700;">Annual Gross Remuneration</td>
      <td style="border: 1px solid #64748b; padding: 6px 10px; font-weight: 800; color: #0f172a;">{{gross_salary}}</td>
    </tr>
    <tr style="background-color: #f8fafc;">
      <td style="border: 1px solid #64748b; padding: 6px 10px; font-weight: 700;">Approx. Monthly Gross Salary</td>
      <td style="border: 1px solid #64748b; padding: 6px 10px; font-weight: 700;">{{monthly_salary}}</td>
    </tr>
    <tr>
      <td style="border: 1px solid #64748b; padding: 6px 10px; font-weight: 700;">Salary Bank Account & IFSC</td>
      <td style="border: 1px solid #64748b; padding: 6px 10px;">{{bank_account}} (IFSC: {{ifsc}}) — {{bank_name}}</td>
    </tr>
  </tbody>
</table>

<p>The official is drawing salary regularly through the treasury against sanctioned establishment post. His/her character, conduct, and official integrity have remained satisfactory during the tenure in this institution.</p>

<p>This certificate is issued upon the request of the official for official / banking verification purposes without any financial liability on the part of the issuing authority.</p>
    `
  },
  {
    id: 'noc_certificate',
    name: 'No Objection Certificate (NOC)',
    category: 'Establishment & Orders',
    desc: 'NOC for higher education, passport, or departmental tests',
    refNo: 'HSS/SHG/NOC/2026/',
    subject: 'Grant of No Objection Certificate in favor of {{name}}, {{designation}}.',
    bodyHtml: `
<p style="text-align: center; font-size: 15px; font-weight: 800; letter-spacing: 0.5px; text-decoration: underline; margin-bottom: 14px;">NO OBJECTION CERTIFICATE</p>

<p>This office has <strong>No Objection</strong> if <strong>{{name}}</strong>, <strong>{{designation}}</strong>, bearing CPIS ID <strong>{{cpis}}</strong> and PAN <strong>{{pan}}</strong>, currently serving at Govt. Higher Secondary School Shangus, applies for / participates in official examinations, higher qualification enhancement, or passport issuance as per government service rules.</p>

<p>It is further certified that:</p>
<ol style="margin-left: 20px; line-height: 1.8;">
  <li>No departmental enquiry, vigilance case, or disciplinary proceeding is pending or contemplated against the said official.</li>
  <li>The official is permanent and regular in his/her service duties.</li>
  <li>There are no institutional outstanding dues or audit recoveries pending against the official.</li>
</ol>

<p>This certificate is issued for official submission to the competent authorities.</p>
    `
  },
  {
    id: 'duty_relieving_order',
    name: 'Duty Assignment & Relieving Order',
    category: 'Orders & Deputation',
    desc: 'Official order for examination duty, election, or institutional assignment',
    refNo: 'HSS/SHG/Order/2026/',
    subject: 'Institutional Duty Assignment & Relieving Order in respect of {{name}}.',
    bodyHtml: `
<p style="text-align: center; font-size: 15px; font-weight: 800; letter-spacing: 0.5px; text-decoration: underline; margin-bottom: 14px;">OFFICE ORDER</p>

<p>In the interest of smooth public administration and institutional governance, <strong>{{name}}</strong>, <strong>{{designation}}</strong> (CPIS: <strong>{{cpis}}</strong>), of Govt. Higher Secondary School Shangus is hereby assigned official duty / relieved to report for official duty with immediate effect.</p>

<p>The official shall hand over any pending charge of registers and official assets to the designated dealing assistant before reporting to the assigned desk.</p>

<p>All concerned shall record compliance in the attendance and service register.</p>
    `
  },
  {
    id: 'experience_certificate',
    name: 'Experience & Conduct Certificate',
    category: 'Service Records',
    desc: 'Official certificate verifying length of service and satisfactory conduct',
    refNo: 'HSS/SHG/Exp/2026/',
    subject: 'Experience and Conduct Certificate in respect of {{name}}.',
    bodyHtml: `
<p style="text-align: center; font-size: 15px; font-weight: 800; letter-spacing: 0.5px; text-decoration: underline; margin-bottom: 14px;">EXPERIENCE & CONDUCT CERTIFICATE</p>

<p>This is to certify that <strong>{{name}}</strong>, <strong>{{designation}}</strong>, bearing CPIS ID <strong>{{cpis}}</strong>, has been serving in this institution in the department of <strong>{{department}}</strong>.</p>

<p>During his/her tenure, the official has discharged all assigned academic, clerical, and administrative responsibilities with high sincerity, diligence, and upright conduct. The official maintains an exemplary service track record.</p>

<p>We wish the official continued success in all future professional endeavors.</p>
    `
  },
  {
    id: 'blank_staff_letterhead',
    name: 'Blank Institutional Letterhead',
    category: 'General Correspondence',
    desc: 'Fresh blank letterhead canvas with official headers and signatures',
    refNo: 'HSS/SHG/Gen/2026/',
    subject: 'Official Communication regarding ...',
    bodyHtml: `
<p><strong>To,</strong><br/>
{{name}},<br/>
{{designation}} (CPIS: {{cpis}}),<br/>
Govt. Higher Secondary School Shangus.</p>

<p><strong>Subject:</strong> <u>Official communication regarding institutional matters.</u></p>

<p>Sir / Madam,</p>

<p>With reference to the subject cited above, it is hereby communicated that...</p>

<p>Yours faithfully,</p>
    `
  }
];

/**
 * Format currency amount cleanly with Indian rupee notation.
 */
export function formatCurrencyInr(val) {
  const num = Number(val) || 0;
  if (!num) return '₹0';
  return '₹' + num.toLocaleString('en-IN');
}

/**
 * Extract clean employee merge variables map from an employee record.
 */
export function getEmployeeVariablesMap(emp = {}, extraContext = {}) {
  const name = emp.name || emp.fullName || 'Official';
  const designation = emp.designation || 'Staff Member';
  const cpis = emp.cpis_no || emp.cpis || emp.computer_code || '—';
  const pan = emp.pan || emp.panNo || '—';
  const department = emp.department || emp.subject || emp.stream || 'General';
  
  const isNonTeaching = () => {
    const d = (emp.designation || '').toLowerCase();
    const dept = (emp.department || '').toLowerCase();
    return dept === 'mts' || d.includes('mts') || d.includes('lab assistant') ||
      d.includes('bearer') || d.includes('peon') || d.includes('chowkidar') ||
      d.includes('safaiwalla') || d.includes('class iv') || d.includes('driver');
  };

  const cadre = emp.cadre || (isNonTeaching() ? 'Non-Teaching Staff' : 'Teaching Faculty');
  
  const grossNum = parseFloat(emp.grossSalary) ||
    parseFloat(emp.customFields?.['Gross Salary']) ||
    parseFloat(emp.customFields?.grossSalary) || 0;
  
  const monthlyNum = grossNum > 0 ? Math.round(grossNum / 12) : 0;
  const netNum = parseFloat(emp.netSalary) || 0;

  const bankAccount = emp.bank_account || emp.accountNo || emp.bankAccount || emp.account_no || emp.customFields?.['Bank Account'] || '—';
  const bankName = emp.bank_name || emp.bank || emp.customFields?.['Bank Name'] || 'J&K Bank Shangus';
  const ifsc = emp.ifsc || emp.ifscCode || emp.customFields?.['IFSC Code'] || 'JAKA0SHNGUS';
  const mobile = emp.phone || emp.mobile || emp.contact || emp.customFields?.['Mobile No.'] || '—';
  const doj = emp.date_of_first_appointment || emp.doj || emp.dateOfJoining || emp.joiningDate || emp.customFields?.['Date of 1st Appointment'] || '—';
  const parentage = emp.parentage || emp.fatherName || emp.father_name || emp.customFields?.["Father's Name"] || '—';
  const dob = emp.dob || emp.dateOfBirth || emp.customFields?.['Date of Birth'] || '—';
  const gender = emp.gender || emp.customFields?.Gender || '—';
  const email = emp.email || emp.customFields?.['Email Address'] || '—';
  const gov_mail_id = emp.gov_mail_id || emp.govEmail || emp.customFields?.['Govt. Mail ID'] || '—';
  const stay_period = emp.stay_period || emp.stayFrom || emp.customFields?.['Stay Period'] || '—';
  const qualification = emp.qualification || emp.qualifications || emp.customFields?.Qualifications || '—';
  const permanent_address = emp.permanent_address || emp.address || emp.customFields?.['Permanent Address'] || '—';
  const present_address = emp.present_address || emp.customFields?.['Present Address'] || '—';
  const if_deployed = emp.if_deployed || emp.customFields?.['If Deployed'] || 'No';
  const health_issues = emp.health_issues || emp.customFields?.['Health/Security Grounds'] || '—';
  const tax_regime = (emp.taxRegime || emp.customFields?.['Tax Regime'] || 'new').toUpperCase();
  const rawTds = parseFloat(emp.tds) || parseFloat(emp.customFields?.TDS) || parseFloat(emp.customFields?.tds) || 0;
  const tds = rawTds > 0 ? formatCurrencyInr(rawTds) : '—';

  const category = emp.category || emp.social_category || emp.customFields?.Category || '—';
  const designation_at_first_appointment = emp.designation_at_first_appointment || emp.firstDesignation || emp.customFields?.['Designation at 1st Appt'] || '—';
  const subject_pg = emp.subject_pg || emp.subject || emp.customFields?.['PG Subject'] || '—';
  const bed = emp.bed || emp.customFields?.['B.ED'] || emp.customFields?.bed || '—';
  const zone_name = emp.zone_name || emp.zone || 'Shangus';
  const ddo_code = emp.ddo_code || emp.udise_code || '1061400618';
  const raw80c = parseFloat(emp.deduction_80c) || parseFloat(emp.tax80C) || parseFloat(emp.customFields?.['80C']) || 0;
  const deduction_80c = raw80c > 0 ? formatCurrencyInr(raw80c) : '—';
  const raw80d = parseFloat(emp.deduction_80d) || parseFloat(emp.tax80D) || parseFloat(emp.customFields?.['80D']) || 0;
  const deduction_80d = raw80d > 0 ? formatCurrencyInr(raw80d) : '—';

  return {
    name,
    designation,
    cpis,
    pan,
    department,
    cadre,
    gross_salary: formatCurrencyInr(grossNum),
    grossSalaryRaw: grossNum,
    monthly_salary: formatCurrencyInr(monthlyNum),
    net_salary: netNum > 0 ? formatCurrencyInr(netNum) : '—',
    bank_account: bankAccount,
    bank_name: bankName,
    ifsc,
    mobile,
    phone: mobile,
    email,
    parentage,
    dob,
    gender,
    category,
    gov_mail_id,
    doj,
    designation_at_first_appointment,
    stay_period,
    qualification,
    subject_pg,
    bed,
    zone_name,
    ddo_code,
    permanent_address,
    present_address,
    if_deployed,
    health_issues,
    tax_regime,
    tds,
    deduction_80c,
    deduction_80d,
    ref_no: extraContext.refNo || 'HSS/SHG/Estt/2026/___',
    date: extraContext.dateStr || new Date().toLocaleDateString('en-GB'),
    academic_session: extraContext.session || '2025–26'
  };
}

/**
 * Standard Cell Resolver for any staff column (Standard or More Columns)
 */
export function resolveStaffColumnValue(col, emp = {}, idx = 0, vars = null, isPrint = false) {
  if (!vars) vars = getEmployeeVariablesMap(emp);
  const key = col.key;

  if (key === 'sno') return idx + 1;
  if (key === 'cpis') return vars.cpis;
  if (key === 'name') return isPrint ? `<strong>${vars.name}</strong>` : vars.name;
  if (key === 'designation') return vars.designation;
  if (key === 'department') return vars.department;
  if (key === 'pan') return vars.pan;
  if (key === 'grossSalary') return vars.gross_salary;
  if (key === 'bankAccount') return vars.bank_account;
  if (key === 'phone' || key === 'mobile') return vars.mobile;
  if (key === 'remarks') return emp.remarks || '—';

  // More Staff Columns
  if (key === 'parentage') return vars.parentage;
  if (key === 'dob') return vars.dob;
  if (key === 'gender') return vars.gender;
  if (key === 'category') return vars.category;
  if (key === 'email') return vars.email;
  if (key === 'gov_mail_id') return vars.gov_mail_id;
  if (key === 'doj') return vars.doj;
  if (key === 'designation_at_first_appointment') return vars.designation_at_first_appointment;
  if (key === 'stay_period') return vars.stay_period;
  if (key === 'cadre') return vars.cadre;
  if (key === 'qualification') return vars.qualification;
  if (key === 'subject_pg') return vars.subject_pg;
  if (key === 'bed') return vars.bed;
  if (key === 'zone_name') return vars.zone_name;
  if (key === 'ddo_code') return vars.ddo_code;
  if (key === 'monthly_salary') return vars.monthly_salary;
  if (key === 'net_salary') return vars.net_salary;
  if (key === 'tds') return vars.tds;
  if (key === 'tax_regime') return vars.tax_regime;
  if (key === 'deduction_80c') return vars.deduction_80c;
  if (key === 'deduction_80d') return vars.deduction_80d;
  if (key === 'bank_name') return vars.bank_name;
  if (key === 'ifsc') return vars.ifsc;
  if (key === 'permanent_address') return vars.permanent_address;
  if (key === 'present_address') return vars.present_address;
  if (key === 'if_deployed') return vars.if_deployed;
  if (key === 'health_issues') return vars.health_issues;

  if (col.isCustom) return isPrint ? '&nbsp;' : '';
  return vars[key] || emp[key] || emp.customFields?.[key] || emp.customFields?.[col.label] || '—';
}

/**
 * Interpolate all `{{variable_name}}` tokens in HTML text with real employee values.
 */
export function interpolateStaffVariables(htmlTemplate = '', emp = {}, extraContext = {}) {
  if (!htmlTemplate) return '';
  const varsMap = getEmployeeVariablesMap(emp, extraContext);

  return htmlTemplate.replace(/\{\{\s*([a-zA-Z0-9_-]+)\s*\}\}/g, (match, tokenKey) => {
    const key = tokenKey.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(varsMap, key)) {
      return String(varsMap[key] ?? '');
    }
    // Also try without underscores
    const altKey = key.replace(/_/g, '');
    for (const [k, v] of Object.entries(varsMap)) {
      if (k.replace(/_/g, '') === altKey) {
        return String(v ?? '');
      }
    }
    return match;
  });
}

/**
 * Print batch merged staff letters with standard institutional letterhead and automatic CSS page breaks.
 */
export function printMergedStaffLetters({
  templateHtml = '',
  selectedEmployees = [],
  extraContext = {},
  officeTitle = 'OFFICE OF THE PRINCIPAL',
  institutionName = 'GOVT. HIGHER SECONDARY SCHOOL SHANGUS',
  institutionAddress = 'Anantnag, Kashmir — 192201 (J&K)',
  signatoryName = 'Principal / DDO',
  signatoryDesignation = 'Govt. Higher Secondary School Shangus',
  clerkSignatory = 'Dealing Assistant / Accounts Clerk'
}) {
  if (!selectedEmployees || selectedEmployees.length === 0) return;

  const dateStr = extraContext.dateStr || new Date().toLocaleDateString('en-GB');
  const refNo = extraContext.refNo || 'HSS/SHG/Estt/2026/___';

  const pagesHtml = selectedEmployees.map((emp, index) => {
    const interpolatedBody = sanitizeRichHtml(interpolateStaffVariables(templateHtml, emp, extraContext));
    const empRef = interpolateStaffVariables(refNo, emp, extraContext);

    return `
      <div class="letter-page ${index < selectedEmployees.length - 1 ? 'page-break' : ''}">
        <!-- Official Letterhead Header Banner -->
        <div class="letterhead-banner">
          <img src="/logo192.png" alt="School Seal" class="school-logo" onerror="this.src='/logo.png'; this.onerror=null;" />
          <div class="office-title">${officeTitle}</div>
          <div class="inst-title">${institutionName}</div>
          <div class="inst-address">${institutionAddress}</div>
        </div>

        <!-- Ref & Date -->
        <div class="ref-date-bar">
          <div><span class="ref-label">Ref. No.:</span> ${empRef}</div>
          <div><span class="date-label">Date:</span> ${dateStr}</div>
        </div>

        <!-- Body -->
        <div class="letter-body">
          ${interpolatedBody}
        </div>

        <!-- Signatories Footer -->
        <div class="signatories-block">
          <div class="sig-box left-sig">
            <div class="sig-line"></div>
            <div class="sig-title">${clerkSignatory}</div>
            <div class="sig-inst">Accounts Section, HSS Shangus</div>
          </div>
          <div class="sig-box right-sig">
            <div class="sig-line"></div>
            <div class="sig-title">${signatoryName}</div>
            <div class="sig-inst">${signatoryDesignation}</div>
          </div>
        </div>

        <!-- Institutional Footer Watermark -->
        <div class="inst-page-footer">
          <span>Official Dispatch Record • Govt HSS Shangus (AISHE: S-12345 • U-DISE: 01070800101)</span>
          <span>Page ${index + 1} of ${selectedEmployees.length}</span>
        </div>
      </div>
    `;
  }).join('');

  const fullPrintHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Official Letters - HSS Shangus (${selectedEmployees.length} Staff)</title>
      <meta charset="utf-8" />
      <style>
        @page {
          size: A4 portrait;
          margin: 0.5in 0.5in 0.4in 0.5in;
        }
        * {
          box-sizing: border-box;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        html, body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          color: #0f172a;
          background: #ffffff;
          margin: 0;
          padding: 0;
          width: 100%;
          font-size: 12px;
          line-height: 1.5;
        }
        .letter-page {
          width: 100%;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          min-height: 960px;
          box-sizing: border-box;
          padding-bottom: 10px;
        }
        .page-break {
          page-break-after: always !important;
          break-after: page !important;
        }
        .letterhead-banner {
          background-color: #f0f8ff !important;
          border-bottom: 2.5px solid #800000;
          padding: 10px 14px 8px 14px;
          text-align: center;
          margin: 0 0 10px 0;
          border-radius: 4px;
        }
        .school-logo {
          width: 44px;
          height: 44px;
          object-fit: contain;
          display: block;
          margin: 0 auto 4px auto;
        }
        .office-title {
          font-size: 10.5px;
          font-weight: 800;
          color: #800000;
          text-transform: uppercase;
          letter-spacing: 1.2px;
          margin: 0 0 2px 0;
        }
        .inst-title {
          font-size: 16px;
          font-weight: 900;
          color: #0a192f;
          letter-spacing: 0.3px;
          margin: 0 0 2px 0;
          text-transform: uppercase;
          font-family: Georgia, serif, -apple-system, sans-serif;
        }
        .inst-address {
          font-size: 10px;
          color: #334155;
          font-weight: 600;
          margin: 0;
        }
        .ref-date-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 11px;
          margin-bottom: 14px;
          font-weight: 600;
          padding: 0 4px;
        }
        .ref-label, .date-label {
          color: #800000;
          font-weight: 800;
        }
        .letter-body {
          font-size: 12.5px;
          color: #0f172a;
          line-height: 1.6;
          text-align: justify;
          flex: 1 1 auto;
        }
        .letter-body p {
          margin: 0 0 10px 0;
        }
        .letter-body table {
          width: 100%;
          border-collapse: collapse;
          margin: 10px 0;
        }
        .letter-body th, .letter-body td {
          border: 1px solid #64748b;
          padding: 5px 8px;
          font-size: 11.5px;
        }
        .signatories-block {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-top: 30px;
          padding-top: 10px;
          page-break-inside: avoid;
        }
        .sig-box {
          text-align: center;
          min-width: 180px;
        }
        .sig-line {
          height: 1px;
          width: 140px;
          background: #475569;
          margin: 0 auto 6px auto;
        }
        .sig-title {
          font-size: 11.5px;
          font-weight: 800;
          color: #0a192f;
        }
        .sig-inst {
          font-size: 10px;
          font-weight: 600;
          color: #475569;
        }
        .inst-page-footer {
          margin-top: 16px;
          padding-top: 6px;
          border-top: 1px dashed #cbd5e1;
          display: flex;
          justify-content: space-between;
          font-size: 8.5px;
          color: #64748b;
          font-family: monospace;
          page-break-inside: avoid;
        }
        @media print {
          html, body {
            padding: 0;
            margin: 0;
            width: 100%;
          }
          .letter-page {
            min-height: auto;
          }
        }
      </style>
    </head>
    <body>
      ${pagesHtml}
    </body>
    </html>
  `;

  executePrintIframe(fullPrintHtml, `Letters_${selectedEmployees.length}_Staff`);
}

/**
 * Print Custom Staff Roster with Header, Total Aggregates & Signatures.
 */
export function printCustomStaffRoster({
  title = 'GOVERNMENT HIGHER SECONDARY SCHOOL SHANGUS',
  subtitle = 'STAFF MASTER REGISTER & EMPLOYEE ROSTER',
  columns = [],
  rows = [],
  orientation = 'portrait',
  extraCustomColumns = [],
  clerkSignatory = 'Dealing Assistant / Clerk',
  principalSignatory = 'Principal / DDO'
}) {
  const isLandscape = orientation === 'landscape';
  const allCols = [...columns, ...extraCustomColumns];
  const totalPct = allCols.reduce((acc, c) => acc + (Number(c.widthPct) || 10), 0);

  const tableHeaders = allCols.map(col => {
    const w = totalPct > 0 ? ((Number(col.widthPct) || 10) / totalPct) * 100 : (100 / allCols.length);
    return `<th style="width: ${w.toFixed(1)}%; text-align: ${col.align || 'left'};">${col.label || col.key}</th>`;
  }).join('');

  let totalGross = 0;

  const tableRows = rows.map((emp, idx) => {
    const vars = getEmployeeVariablesMap(emp);
    totalGross += (vars.grossSalaryRaw || 0);

    const cells = allCols.map(col => {
      const val = resolveStaffColumnValue(col, emp, idx, vars, true);
      return `<td style="text-align: ${col.align || 'left'};">${val}</td>`;
    }).join('');

    return `<tr>${cells}</tr>`;
  }).join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title} - ${subtitle}</title>
      <meta charset="utf-8" />
      <style>
        @page {
          size: A4 ${isLandscape ? 'landscape' : 'portrait'};
          margin: 0.4in;
        }
        * {
          box-sizing: border-box;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
          margin: 0;
          padding: 0;
          font-size: ${isLandscape ? '9pt' : '8.5pt'};
          color: #0f172a;
        }
        .header {
          text-align: center;
          border-bottom: 2px solid #800000;
          padding-bottom: 6px;
          margin-bottom: 8px;
        }
        .header h1 {
          margin: 0;
          font-size: ${isLandscape ? '14pt' : '13pt'};
          font-weight: 900;
          color: #0a192f;
          text-transform: uppercase;
        }
        .header h2 {
          margin: 2px 0 0 0;
          font-size: ${isLandscape ? '10pt' : '9.5pt'};
          font-weight: 800;
          color: #800000;
        }
        .meta-bar {
          display: flex;
          justify-content: space-between;
          font-size: 8pt;
          font-weight: 600;
          color: #475569;
          margin-bottom: 8px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 12px;
        }
        th, td {
          border: 1px solid #475569;
          padding: 4px 5px;
          line-height: 1.3;
        }
        th {
          background-color: #f1f5f9;
          font-weight: 800;
          color: #0f172a;
          text-transform: uppercase;
          font-size: 7.5pt;
        }
        thead {
          display: table-header-group;
        }
        tr {
          page-break-inside: avoid;
        }
        .summary-row {
          background-color: #f8fafc;
          font-weight: 800;
        }
        .sig-block {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-top: 24px;
          padding-top: 8px;
          page-break-inside: avoid;
        }
        .sig-box {
          text-align: center;
          min-width: 150px;
        }
        .sig-line {
          height: 1px;
          width: 120px;
          background: #334155;
          margin: 0 auto 4px auto;
        }
        .sig-text {
          font-size: 8.5pt;
          font-weight: 800;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${title}</h1>
        <h2>${subtitle}</h2>
      </div>

      <div class="meta-bar">
        <span>Total Staff Enlisted: <strong>${rows.length}</strong></span>
        <span>Date: <strong>${new Date().toLocaleDateString('en-GB')}</strong></span>
        <span>AISHE: S-12345 • U-DISE: 01070800101</span>
      </div>

      <table>
        <thead>
          <tr>${tableHeaders}</tr>
        </thead>
        <tbody>
          ${tableRows}
          <tr class="summary-row">
            <td colspan="4" style="text-align: right; padding-right: 10px;">TOTAL (ALL ENLISTED STAFF):</td>
            <td colspan="${allCols.length - 4}" style="text-align: left;">
              Staff Count: <strong>${rows.length}</strong>
              ${totalGross > 0 ? ` &bull; Total Gross Remuneration: <strong>${formatCurrencyInr(totalGross)}</strong>` : ''}
            </td>
          </tr>
        </tbody>
      </table>

      <div class="sig-block">
        <div class="sig-box">
          <div class="sig-line"></div>
          <div class="sig-text">${clerkSignatory}</div>
          <div style="font-size:7pt; color:#64748b;">Dealing Assistant / Accounts</div>
        </div>
        <div class="sig-box">
          <div class="sig-line"></div>
          <div class="sig-text">${principalSignatory}</div>
          <div style="font-size:7pt; color:#64748b;">Govt. Higher Secondary School Shangus</div>
        </div>
      </div>
    </body>
    </html>
  `;

  executePrintIframe(html, title);
}

/**
 * Export Custom Staff Roster to Excel (.xlsx) file.
 */
export function exportStaffRosterExcel({ columns = [], rows = [], extraCustomColumns = [], filename = 'HSS_Staff_Roster.xlsx' }) {
  const allCols = [...columns, ...extraCustomColumns];
  const data = rows.map((emp, idx) => {
    const vars = getEmployeeVariablesMap(emp);
    const rowObj = {};
    allCols.forEach(col => {
      if (col.key === 'grossSalary') {
        rowObj[col.label] = vars.grossSalaryRaw || vars.gross_salary;
      } else {
        rowObj[col.label] = resolveStaffColumnValue(col, emp, idx, vars, false);
      }
    });
    return rowObj;
  });

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Staff Roster');
  XLSX.writeFile(wb, filename);
}

/**
 * Export Custom Staff Roster to CSV file.
 */
export function exportStaffRosterCsv({ columns = [], rows = [], extraCustomColumns = [], filename = 'HSS_Staff_Roster.csv' }) {
  const allCols = [...columns, ...extraCustomColumns];
  const headers = allCols.map(c => `"${c.label}"`).join(',');
  const lines = rows.map((emp, idx) => {
    const vars = getEmployeeVariablesMap(emp);
    return allCols.map(col => {
      const val = resolveStaffColumnValue(col, emp, idx, vars, false);
      return `"${String(val).replace(/"/g, '""')}"`;
    }).join(',');
  });

  const csvContent = [headers, ...lines].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Execute hidden print iframe helper.
 */
function executePrintIframe(htmlContent, title = 'Document') {
  const existing = document.getElementById('staff-letter-print-frame');
  if (existing) existing.remove();

  const iframe = document.createElement('iframe');
  iframe.id = 'staff-letter-print-frame';
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

  iframe.contentWindow.focus();
  setTimeout(() => {
    try {
      iframe.contentWindow.print();
    } catch (e) {
      console.error('Print trigger error:', e);
    }
  }, 400);
}

/**
 * Export a single or merged staff letter to Word (.docx) file.
 */
export async function generateStaffLetterDocx({
  bodyHtml = '',
  employee = {},
  extraContext = {},
  officeTitle = 'OFFICE OF THE PRINCIPAL',
  institutionName = 'GOVT. HIGHER SECONDARY SCHOOL SHANGUS',
  institutionAddress = 'Anantnag, Kashmir — 192201 (J&K)',
  signatoryDesignation = 'Principal / DDO'
}) {
  const interpolatedHtml = interpolateStaffVariables(bodyHtml, employee, extraContext);
  const refNo = interpolateStaffVariables(extraContext.refNo || 'HSS/SHG/Estt/2026/___', employee, extraContext);
  const dateStr = extraContext.dateStr || new Date().toLocaleDateString('en-GB');

  return generateOfficialLetterDocx({
    officeTitle,
    institutionName,
    institutionAddress,
    refNo,
    dateStr,
    bodyHtml: interpolatedHtml,
    signatoryDesignation,
    signatoryInstitution: 'Govt. Hr. Sec. School Shangus'
  });
}

