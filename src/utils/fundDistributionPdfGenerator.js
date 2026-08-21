import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

export const DEFAULT_SUBSIDIARY_ACCOUNTS = [
  { key: 'schoolImprov', name: 'School Improvement Fund', accNo: '0137040500000119', isScienceOnly: false },
  { key: 'redCrossFund', name: 'Red Cross Fund', accNo: '0137040500003430', isScienceOnly: false },
  { key: 'poorFund', name: 'Mutual Benefit (Poor Fund)', accNo: '0137040500000421', isScienceOnly: false },
  { key: 'gamesFund', name: 'Games Fund', accNo: '0137040500000124', isScienceOnly: false },
  { key: 'printingFund', name: 'Printing Fund (Forms & Prospectus)', accNo: '0137040500008527', isScienceOnly: false },
  { key: 'scienceFund', name: 'Science Fund', accNo: '0137040500001072', isScienceOnly: true },
  { key: 'computerFund', name: 'Computer Fund', accNo: '0137040500000001', isScienceOnly: false },
  { key: 'libraryFund', name: 'Library Fund', accNo: '0137040500000133', isScienceOnly: false },
  { key: 'socialActivity', name: 'Social Activity Fund', accNo: '0137040500005504', isScienceOnly: false },
  { key: 'sweepingFund', name: 'Sweeping Fund', accNo: '0137040500011434', isScienceOnly: false },
  { key: 'magazineFund', name: 'Magazine Fund', accNo: '0137040500008522', isScienceOnly: false },
  { key: 'electricityCharges', name: 'Electricity Charges Fund', accNo: '0137040500011674', isScienceOnly: false },
  { key: 'newsFund', name: 'News Fund', accNo: '0137040500000125', isScienceOnly: false },
];

export const SUBSIDIARY_ACCOUNTS = DEFAULT_SUBSIDIARY_ACCOUNTS;

export const CENTRAL_ACCOUNT_NO = '0137040500011642';

function formatCurrency(val) {
  const n = parseFloat(val) || 0;
  return '₹' + n.toLocaleString('en-IN');
}

/**
 * Formats combined Calendar Month/Year and Academic Session
 * Example: "August 2026 (Academic Session: 2025-26)" or "2026 (Session: 2025-26)"
 */
export function getReportPeriodDescription(report) {
  if (!report) return '';
  const month = report.month || '';
  const calYear = report.calendarYear || (report.date ? new Date(report.date).getFullYear() : '');
  const session = report.academicSession || report.session || (report.year && report.year.includes('-') && !report.year.includes('(') ? report.year : '');

  if (month && calYear && session) {
    return `${month} ${calYear} (Academic Session: ${session})`;
  } else if (month && session) {
    return `${month} (Academic Session: ${session})`;
  } else if (month && calYear) {
    return `${month} ${calYear}`;
  } else if (calYear && session) {
    return `${calYear} (Academic Session: ${session})`;
  } else if (report.year) {
    return `${month ? month + ' ' : ''}${report.year}`;
  }
  return month || '—';
}

/**
 * Progress tracker stub (in-modal card spinner handles UI feedback)
 */
export function showFundDistributionProgressModal() {
  const oldModal = document.getElementById('fund-dist-progress-modal');
  if (oldModal && document.body.contains(oldModal)) {
    document.body.removeChild(oldModal);
  }

  return {
    update: () => {},
    close: () => {}
  };
}

/**
 * Build Single Statement Workbook
 */
export function buildFundDistributionWorkbook(report, rates = {}, customAccounts = SUBSIDIARY_ACCOUNTS) {
  const accounts = (Array.isArray(customAccounts) && customAccounts.length > 0) ? customAccounts : SUBSIDIARY_ACCOUNTS;
  const cls = report.class || '11th';
  const classRates = rates[cls] || rates['11th'] || {
    schoolImprov: 175, redCrossFund: 50, poorFund: 50, gamesFund: 100,
    printingFund: 135, scienceFund: 100, computerFund: 150, libraryFund: 105,
    socialActivity: 90, sweepingFund: 80, magazineFund: 150, electricityCharges: 70, newsFund: 70
  };

  const paidCount = parseInt(report.paidStudents || report.onRoll || 0, 10) || 0;
  const sciCount = parseInt(report.scienceStudents || 0, 10) || 0;
  const totalAmount = parseFloat(report.totalAmount || 0) || 0;
  const genDateStr = report.generatedDate || report.date || `${report.month || ''} ${report.year || ''}`.trim() || new Date().toLocaleDateString('en-GB');
  const periodDesc = getReportPeriodDescription(report);

  const rows = [
    ['GOVT. HIGHER SECONDARY SCHOOL SHANGUS, ANANTNAG'],
    ['OFFICIAL J&K BANK FUND TRANSFER STATEMENT'],
    [],
    ['Class:', cls, 'Period / Academic Session:', periodDesc, 'Date:', genDateStr],
    ['Debit Central A/c No.:', CENTRAL_ACCOUNT_NO, 'Branch:', 'J&K Bank Shangus (192201)'],
    ['Paid Students Count:', paidCount, 'Science Students:', sciCount, 'Total Transfer Amount:', totalAmount],
    [],
    [
      'S.No.',
      'Name of Subsidiary Fund Account',
      'Beneficiary Account Number',
      'Debit Central Account Number',
      'Rate Per Student (Rs)',
      'Students',
      'Transfer Amount (Rs)'
    ]
  ];

  accounts.forEach((acc, idx) => {
    const rateVal = classRates[acc.key] || 0;
    const count = acc.isScienceOnly ? sciCount : paidCount;
    const amount = (report[acc.key] !== undefined && report[acc.key] !== null)
      ? parseFloat(report[acc.key]) || (rateVal * count)
      : (rateVal * count);

    rows.push([
      idx + 1,
      acc.name,
      String(acc.accNo),
      String(CENTRAL_ACCOUNT_NO),
      rateVal,
      count,
      amount
    ]);
  });

  rows.push([
    '',
    'GRAND TOTAL',
    '',
    '',
    '',
    paidCount,
    totalAmount
  ]);

  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet['!cols'] = [
    { wch: 8 },  // S.No.
    { wch: 38 }, // Subsidiary Name
    { wch: 24 }, // Beneficiary Acc
    { wch: 24 }, // Debit Acc
    { wch: 18 }, // Rate
    { wch: 14 }, // Students
    { wch: 22 }  // Transfer Amount
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, `Class_${cls}_Transfer`);
  return workbook;
}

/**
 * Export Fund Distribution Report to Excel (.xlsx) file download
 */
export function exportFundDistributionToExcel(report, rates = {}, customAccounts = SUBSIDIARY_ACCOUNTS) {
  const progress = showFundDistributionProgressModal('Exporting Excel...', 'Generating J&K Bank transaction sheet...');
  try {
    progress.update(40, 'Formatting 16-digit account strings & formulas...');
    const workbook = buildFundDistributionWorkbook(report, rates, customAccounts);
    const cls = report.class || '11th';
    const safeMonth = (report.month || 'Statement').replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeYear = (report.year || '').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `JKBank_Fund_Transfer_Class_${cls}_${safeMonth}_${safeYear}.xlsx`;
    progress.update(85, 'Downloading workbook...');
    XLSX.writeFile(workbook, filename);
    progress.update(100, 'Excel downloaded!');
  } finally {
    setTimeout(() => progress.close(), 500);
  }
}

/**
 * Build Consolidated Statements Workbook
 */
export function buildConsolidatedWorkbook(reports = [], rates = {}, customAccounts = SUBSIDIARY_ACCOUNTS) {
  const accounts = (Array.isArray(customAccounts) && customAccounts.length > 0) ? customAccounts : SUBSIDIARY_ACCOUNTS;
  const totalStudentsAll = reports.reduce((sum, r) => sum + (parseInt(r.paidStudents || r.onRoll || 0, 10) || 0), 0);
  const totalAmountAll = reports.reduce((sum, r) => sum + (parseFloat(r.totalAmount || 0) || 0), 0);
  const classesList = [...new Set(reports.map(r => r.class))].join(', ');
  const sessionsList = [...new Set(reports.map(r => getReportPeriodDescription(r)))].join('; ');
  const genDateStr = new Date().toLocaleDateString('en-GB');

  const summaryRows = [
    ['GOVT. HIGHER SECONDARY SCHOOL SHANGUS, ANANTNAG'],
    ['CONSOLIDATED J&K BANK FUND TRANSFER STATEMENT'],
    [],
    ['Selected Statements Count:', reports.length, 'Classes Included:', classesList, 'Date:', genDateStr],
    ['Periods / Academic Sessions:', sessionsList, 'Debit Central A/c:', CENTRAL_ACCOUNT_NO],
    ['Total Students (All Classes):', totalStudentsAll, 'Consolidated Grand Total:', totalAmountAll],
    [],
    [
      'S.No.',
      'Subsidiary Fund Account Name',
      'Beneficiary Account Number',
      'Debit Central Account Number',
      ...reports.map(r => `${r.class} (${getReportPeriodDescription(r)})`),
      'Consolidated Transfer Amount (Rs)'
    ]
  ];

  accounts.forEach((acc, idx) => {
    let accConsolidatedTotal = 0;
    const classAmounts = reports.map(r => {
      const cls = r.class || '11th';
      const cRates = rates[cls] || rates['11th'] || {};
      const rateVal = cRates[acc.key] || 0;
      const count = acc.isScienceOnly
        ? (parseInt(r.scienceStudents || 0, 10) || 0)
        : (parseInt(r.paidStudents || r.onRoll || 0, 10) || 0);
      const amt = (r[acc.key] !== undefined && r[acc.key] !== null)
        ? parseFloat(r[acc.key]) || (rateVal * count)
        : (rateVal * count);
      accConsolidatedTotal += amt;
      return amt;
    });

    summaryRows.push([
      idx + 1,
      acc.name,
      String(acc.accNo),
      String(CENTRAL_ACCOUNT_NO),
      ...classAmounts,
      accConsolidatedTotal
    ]);
  });

  summaryRows.push([
    '',
    'CONSOLIDATED GRAND TOTAL',
    '',
    '',
    ...reports.map(r => parseFloat(r.totalAmount || 0) || 0),
    totalAmountAll
  ]);

  const worksheet = XLSX.utils.aoa_to_sheet(summaryRows);
  worksheet['!cols'] = [
    { wch: 8 },
    { wch: 38 },
    { wch: 24 },
    { wch: 24 },
    ...reports.map(() => ({ wch: 18 })),
    { wch: 24 }
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Consolidated Transfer');

  reports.forEach((r, idx) => {
    const sheet = buildFundDistributionWorkbook(r, rates, accounts).Sheets[`Class_${r.class || '11th'}_Transfer`];
    if (sheet) {
      const sheetName = `Cls_${r.class}_${(r.month || '').slice(0, 3)}_${r.id ? r.id.slice(-4) : idx}`;
      XLSX.utils.book_append_sheet(workbook, sheet, sheetName.slice(0, 31));
    }
  });

  return workbook;
}

/**
 * Export Multiple Selected Reports into a Consolidated Excel Sheet file download
 */
export function exportConsolidatedFundDistributionToExcel(reports = [], rates = {}, customAccounts = SUBSIDIARY_ACCOUNTS) {
  const accounts = (Array.isArray(customAccounts) && customAccounts.length > 0) ? customAccounts : SUBSIDIARY_ACCOUNTS;
  if (!reports || reports.length === 0) return;
  const progress = showFundDistributionProgressModal('Exporting Consolidated Excel...', `Compiling ${reports.length} statements...`);
  try {
    progress.update(45, 'Aggregating multi-class accounts...');
    const workbook = buildConsolidatedWorkbook(reports, rates, accounts);
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `JKBank_Consolidated_Transfer_${reports.length}_Reports_${dateStr}.xlsx`;
    progress.update(85, 'Downloading workbook...');
    XLSX.writeFile(workbook, filename);
    progress.update(100, 'Excel downloaded!');
  } finally {
    setTimeout(() => progress.close(), 500);
  }
}

/**
 * Get Letter HTML Template
 */
export function getFundDistributionLetterHtml(report, rates = {}, customAccounts = SUBSIDIARY_ACCOUNTS) {
  const accounts = (Array.isArray(customAccounts) && customAccounts.length > 0) ? customAccounts : SUBSIDIARY_ACCOUNTS;
  const cls = report.class || '11th';
  const classRates = rates[cls] || rates['11th'] || {
    schoolImprov: 175, redCrossFund: 50, poorFund: 50, gamesFund: 100,
    printingFund: 135, scienceFund: 100, computerFund: 150, libraryFund: 105,
    socialActivity: 90, sweepingFund: 80, magazineFund: 150, electricityCharges: 70, newsFund: 70
  };

  const paidCount = parseInt(report.paidStudents || report.onRoll || 0, 10) || 0;
  const sciCount = parseInt(report.scienceStudents || 0, 10) || 0;
  const totalAmount = parseFloat(report.totalAmount || 0) || 0;
  const genDateStr = report.generatedDate || report.date || `${report.month || ''} ${report.year || ''}`.trim() || new Date().toLocaleDateString('en-GB');
  const periodDesc = getReportPeriodDescription(report);
  const refSuffix = (report.month || 'Statement').replace(/[^a-zA-Z0-9]/g, '');

  let rowsHtml = '';
  accounts.forEach((acc, idx) => {
    const rateVal = classRates[acc.key] || 0;
    const count = acc.isScienceOnly ? sciCount : paidCount;
    const amount = (report[acc.key] !== undefined && report[acc.key] !== null)
      ? parseFloat(report[acc.key]) || (rateVal * count)
      : (rateVal * count);

    const isZebra = idx % 2 === 1;

    rowsHtml += `
      <tr style="background-color: ${isZebra ? '#f8fafc' : '#ffffff'};">
        <td style="text-align: center; font-weight: 700; border: 1px solid #cbd5e1; padding: 4.5px 6px; vertical-align: middle; line-height: 1.3;">${idx + 1}</td>
        <td style="font-weight: 600; border: 1px solid #cbd5e1; padding: 4.5px 8px; color: #1e293b; vertical-align: middle; line-height: 1.3;">${acc.name}</td>
        <td style="font-family: 'Consolas', 'Courier New', monospace; font-weight: 700; letter-spacing: 0.8px; text-align: center; border: 1px solid #cbd5e1; padding: 4.5px 6px; color: #0f172a; vertical-align: middle; line-height: 1.3;">${acc.accNo}</td>
        <td style="text-align: center; font-family: 'Consolas', 'Courier New', monospace; font-weight: 600; border: 1px solid #cbd5e1; padding: 4.5px 6px; vertical-align: middle; line-height: 1.3;">₹${rateVal}</td>
        <td style="text-align: center; font-weight: 700; border: 1px solid #cbd5e1; padding: 4.5px 6px; vertical-align: middle; line-height: 1.3;">${count}</td>
        <td style="text-align: right; font-family: 'Consolas', 'Courier New', monospace; font-weight: 700; border: 1px solid #cbd5e1; padding: 4.5px 8px; vertical-align: middle; line-height: 1.3;">${formatCurrency(amount)}</td>
      </tr>
    `;
  });

  return `
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@700;800;900&family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&family=JetBrains+Mono:wght@600;700&display=swap');
      table { border-collapse: collapse !important; width: 100% !important; }
      th, td { vertical-align: middle !important; line-height: 1.3 !important; }
    </style>
    <div style="font-family: 'Plus Jakarta Sans', Arial, Helvetica, sans-serif; font-size: 9.5pt; line-height: 1.45; color: #0f172a; background: #ffffff; padding: 0; margin: 0; min-height: 285mm; display: flex; flex-direction: column; justify-content: space-between; box-sizing: border-box;">
      <div>
        <!-- Full-Width Header Banner with Centered Logo & Horizontal Separator Line -->
        <div style="width: 100%; background: #f0f9ff; padding: 18px 0.5in 14px 0.5in; border-bottom: 2px solid #991b1b; text-align: center;">
          <div style="margin-bottom: 6px;">
            <img src="/logo192.png" alt="HSS Logo" style="width: 52px; height: 52px; object-fit: contain; display: inline-block;" onerror="this.style.display='none'" />
          </div>
          <div style="color: #991b1b; font-size: 8.5pt; font-weight: 800; letter-spacing: 2.2px; text-transform: uppercase;">OFFICE OF THE PRINCIPAL</div>
          <div style="font-family: 'Cinzel', 'Times New Roman', Georgia, serif; font-size: 16.5pt; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: 1px; margin: 5px 0 3px 0; line-height: 1.2;">GOVT. HIGHER SECONDARY SCHOOL SHANGUS</div>
          <div style="font-size: 9pt; font-weight: 600; color: #475569; letter-spacing: 0.3px; margin-top: 3px;">Anantnag, Kashmir — 192201 (J&K)</div>
        </div>

        <!-- Main Body Container with 0.5 inch page margins -->
        <div style="padding: 16px 0.5in 0 0.5in;">
          <!-- Ref & Date -->
          <table style="width: 100%; border-collapse: collapse; font-size: 9pt; font-weight: 700; color: #991b1b; margin-bottom: 14px;">
            <tr>
              <td style="text-align: left; vertical-align: middle;">Ref. No.: <span style="font-weight: 600; color: #0f172a;">HSS/SHG/Fee-Dist/${cls}/${refSuffix}</span></td>
              <td style="text-align: right; vertical-align: middle;">Date: <span style="font-weight: 600; color: #0f172a;">${genDateStr}</span></td>
            </tr>
          </table>

          <!-- Recipient Block with Increased Top Spacing -->
          <div style="font-size: 9.5pt; line-height: 1.45; margin-top: 22px; margin-bottom: 16px; color: #0f172a;">
            <div style="font-weight: 800;">The Branch Manager,</div>
            <div style="font-weight: 500;">Jammu & Kashmir Bank Ltd.</div>
            <div style="font-weight: 500;">Branch Shangus, Anantnag.</div>
          </div>

          <!-- Subject -->
          <div style="font-weight: 800; font-size: 9.5pt; margin: 14px 0; color: #0f172a; border-left: 3.5px solid #1e3a8a; padding: 3px 0 3px 10px; line-height: 1.35;">
            Subject: Request for Transfer / Allocation of School Funds for Class ${cls} [${report.month || 'Statement'}] amounting to <u style="font-family: 'Consolas', 'Courier New', monospace; font-weight: 800;">${formatCurrency(totalAmount)}</u>
          </div>

          <!-- Salutation & Body -->
          <div style="font-weight: 700; font-size: 9.5pt; margin-bottom: 6px; color: #0f172a;">Sir/Madam,</div>
          <div style="text-align: justify; font-size: 9.5pt; line-height: 1.6; margin-bottom: 12px; color: #1e293b;">
            We kindly request you to debit a total sum of <b style="font-family: 'Consolas', 'Courier New', monospace; color: #0f172a;">${formatCurrency(totalAmount)}</b> from our Central Institutional Bank Account No. <b style="font-family: 'Consolas', 'Courier New', monospace; color: #0f172a;">${CENTRAL_ACCOUNT_NO}</b> (HSS Shangus) and transfer the corresponding amounts into the respective subsidiary accounts as per the detailed schedule below:
          </div>

          <!-- Distribution Table -->
          <table style="width: 100%; border-collapse: collapse; font-size: 8.5pt; margin: 10px 0 14px 0;">
            <thead>
              <tr style="background-color: #f1f5f9; color: #0f172a; font-weight: 800;">
                <th style="width: 5%; border: 1px solid #cbd5e1; padding: 5px 4px; text-align: center; vertical-align: middle; line-height: 1.3;">S.No.</th>
                <th style="width: 35%; text-align: left; padding: 5px 8px; border: 1px solid #cbd5e1; vertical-align: middle; line-height: 1.3;">Name of the Subsidiary Fund A/c</th>
                <th style="width: 24%; border: 1px solid #cbd5e1; padding: 5px 4px; text-align: center; vertical-align: middle; line-height: 1.3;">Account Number</th>
                <th style="width: 10%; border: 1px solid #cbd5e1; padding: 5px 4px; text-align: center; vertical-align: middle; line-height: 1.3;">Rate</th>
                <th style="width: 8%; border: 1px solid #cbd5e1; padding: 5px 4px; text-align: center; vertical-align: middle; line-height: 1.3;">Std</th>
                <th style="width: 18%; text-align: right; padding: 5px 8px; border: 1px solid #cbd5e1; vertical-align: middle; line-height: 1.3;">Total Amount</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
              <tr style="background-color: #e2e8f0; color: #0f172a; font-weight: 800; border-top: 2px solid #0f172a; border-bottom: 2px solid #0f172a; font-size: 9pt;">
                <td colspan="5" style="text-align: right; padding: 6px 12px; border: 1px solid #cbd5e1; vertical-align: middle; line-height: 1.3;">GRAND TOTAL:</td>
                <td style="text-align: right; padding: 6px 8px; font-family: 'Consolas', 'Courier New', monospace; font-weight: 800; border: 1px solid #cbd5e1; vertical-align: middle; line-height: 1.3;">${formatCurrency(totalAmount)}</td>
              </tr>
            </tbody>
          </table>

          <!-- Sign-off Block with Increased Space for Official Stamp & Signature -->
          <div style="display: flex; justify-content: flex-end; margin-top: 36px;">
            <div style="text-align: center; min-width: 180px;">
              <div style="height: 52px;"></div>
              <div style="font-size: 10.5pt; font-weight: 800; color: #0f172a;">Principal</div>
              <div style="font-size: 8.5pt; color: #334155; font-weight: 700; margin-top: 2px;">Govt. Hr Sec. School Shangus</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Pinned Page Footer at Bottom -->
      <div style="padding: 10px 0.5in 16px 0.5in; margin-top: auto;">
        <div style="border-top: 1px solid #cbd5e1; padding-top: 6px; font-size: 8pt; color: #64748b; font-weight: 600; display: flex; justify-content: space-between; align-items: center;">
          <span>Class ${cls} • ${periodDesc} • Students: ${paidCount} • <b style="color: #0f172a; font-family: 'Consolas', monospace;">Total: ${formatCurrency(totalAmount)}</b></span>
          <span style="letter-spacing: 0.3px;">Official Institutional Bank Transfer Record</span>
        </div>
      </div>
    </div>
  `;
}

/**
 * Get Consolidated Letter HTML Template
 */
export function getConsolidatedFundDistributionHtml(reports = [], rates = {}, customAccounts = SUBSIDIARY_ACCOUNTS) {
  const accounts = (Array.isArray(customAccounts) && customAccounts.length > 0) ? customAccounts : SUBSIDIARY_ACCOUNTS;
  const totalStudentsAll = reports.reduce((sum, r) => sum + (parseInt(r.paidStudents || r.onRoll || 0, 10) || 0), 0);
  const totalAmountAll = reports.reduce((sum, r) => sum + (parseFloat(r.totalAmount || 0) || 0), 0);
  const classesList = [...new Set(reports.map(r => r.class))].join(', ');
  const genDateStr = new Date().toLocaleDateString('en-GB');

  let rowsHtml = '';
  accounts.forEach((acc, idx) => {
    let accTotal = 0;
    reports.forEach(r => {
      const cls = r.class || '11th';
      const cRates = rates[cls] || rates['11th'] || {};
      const rateVal = cRates[acc.key] || 0;
      const count = acc.isScienceOnly
        ? (parseInt(r.scienceStudents || 0, 10) || 0)
        : (parseInt(r.paidStudents || r.onRoll || 0, 10) || 0);
      const amt = (r[acc.key] !== undefined && r[acc.key] !== null)
        ? parseFloat(r[acc.key]) || (rateVal * count)
        : (rateVal * count);
      accTotal += amt;
    });

    const isZebra = idx % 2 === 1;
    rowsHtml += `
      <tr style="background-color: ${isZebra ? '#f8fafc' : '#ffffff'};">
        <td style="text-align: center; font-weight: 700; border: 1px solid #cbd5e1; padding: 4.5px 6px; vertical-align: middle; line-height: 1.3;">${idx + 1}</td>
        <td style="font-weight: 600; border: 1px solid #cbd5e1; padding: 4.5px 8px; color: #1e293b; vertical-align: middle; line-height: 1.3;">${acc.name}</td>
        <td style="font-family: 'Consolas', 'Courier New', monospace; font-weight: 700; letter-spacing: 0.5px; text-align: center; border: 1px solid #cbd5e1; padding: 4.5px 6px; color: #0f172a; vertical-align: middle; line-height: 1.3;">${acc.accNo}</td>
        <td style="text-align: center; font-family: 'Consolas', 'Courier New', monospace; font-weight: 600; border: 1px solid #cbd5e1; padding: 4.5px 6px; vertical-align: middle; line-height: 1.3;">Various</td>
        <td style="text-align: center; font-weight: 700; border: 1px solid #cbd5e1; padding: 4.5px 6px; vertical-align: middle; line-height: 1.3;">${totalStudentsAll}</td>
        <td style="text-align: right; font-family: 'Consolas', 'Courier New', monospace; font-weight: 700; border: 1px solid #cbd5e1; padding: 4.5px 8px; vertical-align: middle; line-height: 1.3;">${formatCurrency(accTotal)}</td>
      </tr>
    `;
  });

  return `
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@700;800;900&family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&family=JetBrains+Mono:wght@600;700&display=swap');
      table { border-collapse: collapse !important; width: 100% !important; }
      th, td { vertical-align: middle !important; line-height: 1.3 !important; }
    </style>
    <div style="font-family: 'Plus Jakarta Sans', Arial, Helvetica, sans-serif; font-size: 9.5pt; line-height: 1.45; color: #0f172a; background: #ffffff; padding: 0; margin: 0; min-height: 285mm; display: flex; flex-direction: column; justify-content: space-between; box-sizing: border-box;">
      <div>
        <!-- Full-Width Header Banner with Centered Logo & Horizontal Separator Line -->
        <div style="width: 100%; background: #f0f9ff; padding: 18px 0.5in 14px 0.5in; border-bottom: 2px solid #991b1b; text-align: center;">
          <div style="margin-bottom: 6px;">
            <img src="/logo192.png" alt="HSS Logo" style="width: 52px; height: 52px; object-fit: contain; display: inline-block;" onerror="this.style.display='none'" />
          </div>
          <div style="color: #991b1b; font-size: 8.5pt; font-weight: 800; letter-spacing: 2.2px; text-transform: uppercase;">OFFICE OF THE PRINCIPAL</div>
          <div style="font-family: 'Cinzel', 'Times New Roman', Georgia, serif; font-size: 16.5pt; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: 1px; margin: 5px 0 3px 0; line-height: 1.2;">GOVT. HIGHER SECONDARY SCHOOL SHANGUS</div>
          <div style="font-size: 9pt; font-weight: 600; color: #475569; letter-spacing: 0.3px; margin-top: 3px;">Anantnag, Kashmir — 192201 (J&K)</div>
        </div>

        <!-- Main Body Container with 0.5 inch page margins -->
        <div style="padding: 16px 0.5in 0 0.5in;">
          <!-- Ref & Date -->
          <table style="width: 100%; border-collapse: collapse; font-size: 9pt; font-weight: 700; color: #991b1b; margin-bottom: 14px;">
            <tr>
              <td style="text-align: left; vertical-align: middle;">Ref. No.: <span style="font-weight: 600; color: #0f172a;">HSS/SHG/Fee-Dist/Consolidated/${reports.length}-Statements</span></td>
              <td style="text-align: right; vertical-align: middle;">Date: <span style="font-weight: 600; color: #0f172a;">${genDateStr}</span></td>
            </tr>
          </table>

          <!-- Recipient Block with Increased Top Spacing -->
          <div style="font-size: 9.5pt; line-height: 1.45; margin-top: 22px; margin-bottom: 16px; color: #0f172a;">
            <div style="font-weight: 800;">The Branch Manager,</div>
            <div style="font-weight: 500;">Jammu & Kashmir Bank Ltd.</div>
            <div style="font-weight: 500;">Branch Shangus, Anantnag.</div>
          </div>

          <!-- Subject -->
          <div style="font-weight: 800; font-size: 9.5pt; margin: 14px 0; color: #0f172a; border-left: 3.5px solid #1e3a8a; padding: 3px 0 3px 10px; line-height: 1.35;">
            Subject: Request for Consolidated Transfer of School Funds (${reports.length} Statements: ${[...new Set(reports.map(r => r.month || r.period))].filter(Boolean).join(', ') || 'Various'}) amounting to <u style="font-family: 'Consolas', 'Courier New', monospace; font-weight: 800;">${formatCurrency(totalAmountAll)}</u>
          </div>

          <!-- Salutation & Body -->
          <div style="font-weight: 700; font-size: 9.5pt; margin-bottom: 6px; color: #0f172a;">Sir/Madam,</div>
          <div style="text-align: justify; font-size: 9.5pt; line-height: 1.6; margin-bottom: 12px; color: #1e293b;">
            We kindly request you to debit a consolidated total sum of <b style="font-family: 'Consolas', 'Courier New', monospace; color: #0f172a;">${formatCurrency(totalAmountAll)}</b> from our Central Institutional Bank Account No. <b style="font-family: 'Consolas', 'Courier New', monospace; color: #0f172a;">${CENTRAL_ACCOUNT_NO}</b> (HSS Shangus) representing <b>${reports.length} statement records</b> (Classes: ${classesList}) and transfer the allocated amounts into the respective subsidiary fund accounts as per the consolidated schedule below:
          </div>

          <!-- Distribution Table -->
          <table style="width: 100%; border-collapse: collapse; font-size: 8.5pt; margin: 10px 0 14px 0;">
            <thead>
              <tr style="background-color: #f1f5f9; color: #0f172a; font-weight: 800;">
                <th style="width: 5%; border: 1px solid #cbd5e1; padding: 5px 4px; text-align: center; vertical-align: middle; line-height: 1.3;">S.No.</th>
                <th style="width: 35%; text-align: left; padding: 5px 8px; border: 1px solid #cbd5e1; vertical-align: middle; line-height: 1.3;">Name of the Subsidiary Fund A/c</th>
                <th style="width: 24%; border: 1px solid #cbd5e1; padding: 5px 4px; text-align: center; vertical-align: middle; line-height: 1.3;">Account Number</th>
                <th style="width: 10%; border: 1px solid #cbd5e1; padding: 5px 4px; text-align: center; vertical-align: middle; line-height: 1.3;">Rate</th>
                <th style="width: 8%; border: 1px solid #cbd5e1; padding: 5px 4px; text-align: center; vertical-align: middle; line-height: 1.3;">Std</th>
                <th style="width: 18%; text-align: right; padding: 5px 8px; border: 1px solid #cbd5e1; vertical-align: middle; line-height: 1.3;">Total Amount</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
              <tr style="background-color: #e2e8f0; color: #0f172a; font-weight: 800; border-top: 2px solid #0f172a; border-bottom: 2px solid #0f172a; font-size: 9pt;">
                <td colspan="5" style="text-align: right; padding: 6px 12px; border: 1px solid #cbd5e1; vertical-align: middle; line-height: 1.3;">GRAND TOTAL:</td>
                <td style="text-align: right; padding: 6px 8px; font-family: 'Consolas', 'Courier New', monospace; font-weight: 800; border: 1px solid #cbd5e1; vertical-align: middle; line-height: 1.3;">${formatCurrency(totalAmountAll)}</td>
              </tr>
            </tbody>
          </table>

          <!-- Sign-off Block with Increased Space for Official Stamp & Signature -->
          <div style="display: flex; justify-content: flex-end; margin-top: 36px;">
            <div style="text-align: center; min-width: 180px;">
              <div style="height: 52px;"></div>
              <div style="font-size: 10.5pt; font-weight: 800; color: #0f172a;">Principal</div>
              <div style="font-size: 8.5pt; color: #334155; font-weight: 700; margin-top: 2px;">Govt. Hr Sec. School Shangus</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Pinned Page Footer at Bottom -->
      <div style="padding: 10px 0.5in 16px 0.5in; margin-top: auto;">
        <div style="border-top: 1px solid #cbd5e1; padding-top: 6px; font-size: 8pt; color: #64748b; font-weight: 600; display: flex; justify-content: space-between; align-items: center;">
          <span>Consolidated Statements (${reports.length}) • Total Students: ${totalStudentsAll} • <b style="color: #0f172a; font-family: 'Consolas', monospace;">Total Amount: ${formatCurrency(totalAmountAll)}</b></span>
          <span style="letter-spacing: 0.3px;">Official Institutional Bank Transfer Record</span>
        </div>
      </div>
    </div>
  `;
}

/**
 * Print Single Report Official Letter via Iframe
 */
export function printFundDistributionLetter(report, rates = {}, customAccounts = SUBSIDIARY_ACCOUNTS) {
  const innerHtml = getFundDistributionLetterHtml(report, rates, customAccounts);
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Fund Distribution Statement - HSS Shangus</title>
        <style>
          @page { size: A4 portrait; margin: 0; }
          * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          body { margin: 0; padding: 0; background: #ffffff; }
        </style>
      </head>
      <body>${innerHtml}</body>
    </html>
  `;

  let printFrame = document.getElementById('fund-distribution-print-frame');
  if (!printFrame) {
    printFrame = document.createElement('iframe');
    printFrame.id = 'fund-distribution-print-frame';
    printFrame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    document.body.appendChild(printFrame);
  }

  const frameDoc = printFrame.contentWindow || printFrame.contentDocument.document || printFrame.contentDocument;
  frameDoc.document.open();
  frameDoc.document.write(html);
  frameDoc.document.close();

  setTimeout(() => {
    try {
      printFrame.contentWindow.focus();
      printFrame.contentWindow.print();
    } catch (e) {
      console.warn('Iframe print fallback triggered:', e);
    }
  }, 300);
}

/**
 * Print Consolidated Report Official Letter via Iframe
 */
export function printConsolidatedFundDistributionLetter(reports = [], rates = {}, customAccounts = SUBSIDIARY_ACCOUNTS) {
  if (!reports || reports.length === 0) return;
  const innerHtml = getConsolidatedFundDistributionHtml(reports, rates, customAccounts);
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Consolidated J&K Bank Transfer Schedule - HSS Shangus</title>
        <style>
          @page { size: A4 portrait; margin: 0; }
          * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          body { margin: 0; padding: 0; background: #ffffff; }
        </style>
      </head>
      <body>${innerHtml}</body>
    </html>
  `;

  let printFrame = document.getElementById('fund-distribution-print-frame');
  if (!printFrame) {
    printFrame = document.createElement('iframe');
    printFrame.id = 'fund-distribution-print-frame';
    printFrame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    document.body.appendChild(printFrame);
  }

  const frameDoc = printFrame.contentWindow || printFrame.contentDocument.document || printFrame.contentDocument;
  frameDoc.document.open();
  frameDoc.document.write(html);
  frameDoc.document.close();

  setTimeout(() => {
    try {
      printFrame.contentWindow.focus();
      printFrame.contentWindow.print();
    } catch (e) {
      console.warn('Iframe print fallback triggered:', e);
    }
  }, 300);
}

/**
 * Generate PDF Blob for a Single Statement
 */
export async function generateFundDistributionPdfBlob(report, rates = {}, onProgress = null, customAccounts = SUBSIDIARY_ACCOUNTS) {
  if (onProgress) onProgress(20, 'Preparing document canvas...');
  const html = getFundDistributionLetterHtml(report, rates, customAccounts);
  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;left:0;top:0;width:794px;background:#ffffff;padding:0;margin:0;z-index:-99999;pointer-events:none;';
  container.innerHTML = html;
  document.body.appendChild(container);

  // Force explicit vertical centering across all cells for canvas capture
  const cells = container.querySelectorAll('td, th');
  cells.forEach(c => {
    c.style.verticalAlign = 'middle';
    c.style.lineHeight = '1.3';
  });

  // Small delay for DOM layout settle
  await new Promise(r => setTimeout(r, 120));

  try {
    if (onProgress) onProgress(50, 'Capturing high-resolution letterhead...');
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      windowWidth: 794
    });
    
    if (onProgress) onProgress(80, 'Encoding crisp vector PDF...');
    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const a4W = 210;
    const imgH = (canvas.height / canvas.width) * a4W;
    pdf.addImage(imgData, 'JPEG', 0, 0, a4W, imgH);
    
    if (onProgress) onProgress(95, 'Finalizing PDF output...');
    return pdf.output('blob');
  } finally {
    if (container.parentElement) {
      document.body.removeChild(container);
    }
  }
}

/**
 * Generate PDF Blob for Consolidated Statements
 */
export async function generateConsolidatedPdfBlob(reports = [], rates = {}, onProgress = null, customAccounts = SUBSIDIARY_ACCOUNTS) {
  if (onProgress) onProgress(20, 'Compiling consolidated statements...');
  const html = getConsolidatedFundDistributionHtml(reports, rates, customAccounts);
  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;left:0;top:0;width:794px;background:#ffffff;padding:0;margin:0;z-index:-99999;pointer-events:none;';
  container.innerHTML = html;
  document.body.appendChild(container);

  // Force explicit vertical centering across all cells for canvas capture
  const cells = container.querySelectorAll('td, th');
  cells.forEach(c => {
    c.style.verticalAlign = 'middle';
    c.style.lineHeight = '1.3';
  });

  // Small delay for DOM layout settle
  await new Promise(r => setTimeout(r, 120));

  try {
    if (onProgress) onProgress(50, 'Capturing high-resolution consolidated layout...');
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      windowWidth: 794
    });
    
    if (onProgress) onProgress(80, 'Encoding crisp vector PDF...');
    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const a4W = 210;
    const imgH = (canvas.height / canvas.width) * a4W;
    pdf.addImage(imgData, 'JPEG', 0, 0, a4W, imgH);
    
    if (onProgress) onProgress(95, 'Finalizing Consolidated PDF...');
    return pdf.output('blob');
  } finally {
    if (container.parentElement) {
      document.body.removeChild(container);
    }
  }
}

/**
 * Direct Download Single Statement PDF
 */
export async function downloadFundDistributionPdf(report, rates = {}, customAccounts = SUBSIDIARY_ACCOUNTS) {
  const progress = showFundDistributionProgressModal('Generating PDF...', 'Building official letterhead...');
  try {
    const cls = report.class || '11th';
    const safeMonth = (report.month || 'Statement').replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeYear = (report.year || '').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `JKBank_Fund_Transfer_Class_${cls}_${safeMonth}_${safeYear}.pdf`;

    const blob = await generateFundDistributionPdfBlob(report, rates, (p, m) => progress.update(p, m), customAccounts);
    
    progress.update(98, 'Saving file to Downloads...');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    progress.update(100, 'Download complete!');
  } finally {
    setTimeout(() => progress.close(), 400);
  }
}

/**
 * Direct Download Consolidated Statement PDF
 */
export async function downloadConsolidatedFundDistributionPdf(reports = [], rates = {}, customAccounts = SUBSIDIARY_ACCOUNTS) {
  if (!reports || reports.length === 0) return;
  const progress = showFundDistributionProgressModal('Generating Consolidated PDF...', `Combining ${reports.length} statements...`);
  try {
    const filename = `JKBank_Consolidated_Transfer_${reports.length}_Reports.pdf`;
    const blob = await generateConsolidatedPdfBlob(reports, rates, (p, m) => progress.update(p, m), customAccounts);
    
    progress.update(98, 'Saving file to Downloads...');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    progress.update(100, 'Download complete!');
  } finally {
    setTimeout(() => progress.close(), 400);
  }
}

/**
 * Build Full Transaction Analysis & Account Ledger Workbook (Excel)
 */
export function buildTransactionAnalysisWorkbook(reports = [], filters = {}, rates = {}, customAccounts = SUBSIDIARY_ACCOUNTS) {
  const accounts = (Array.isArray(customAccounts) && customAccounts.length > 0) ? customAccounts : SUBSIDIARY_ACCOUNTS;
  const totalStudentsAll = reports.reduce((sum, r) => sum + (parseInt(r.paidStudents || r.onRoll || 0, 10) || 0), 0);
  const totalSciStudentsAll = reports.reduce((sum, r) => sum + (parseInt(r.scienceStudents || 0, 10) || 0), 0);
  const totalAmountAll = reports.reduce((sum, r) => sum + (parseFloat(r.totalAmount || 0) || 0), 0);
  const genDateStr = new Date().toLocaleDateString('en-GB');

  const sessionDesc = filters.sessions && filters.sessions.length > 0 ? filters.sessions.join(', ') : 'All Sessions';
  const classDesc = filters.classes && filters.classes.length > 0 ? filters.classes.join(', ') : 'All Classes';
  const monthDesc = filters.months && filters.months.length > 0 ? filters.months.join(', ') : 'All Months';

  // ──── SHEET 1: EXECUTIVE ACCOUNT ALLOCATION SUMMARY ────
  const sheet1Rows = [
    ['GOVT. HIGHER SECONDARY SCHOOL SHANGUS, ANANTNAG'],
    ['TRANSACTION AUDIT & SUBSIDIARY ACCOUNT ALLOCATION LEDGER'],
    [],
    ['Filter Criteria:', `Sessions: ${sessionDesc} | Classes: ${classDesc} | Months: ${monthDesc}`],
    ['Report Date:', genDateStr, 'Debit Central A/c:', CENTRAL_ACCOUNT_NO, 'Branch:', 'J&K Bank Shangus (192201)'],
    ['Total Statements:', reports.length, 'Total Paid Students:', totalStudentsAll, 'Total Science Students:', totalSciStudentsAll, 'Grand Total Disbursed:', totalAmountAll],
    [],
    [
      'S.No.',
      'Subsidiary Fund Account Name',
      'Beneficiary Account Number',
      'Class 9th (Rs)',
      'Class 10th (Rs)',
      'Class 11th (Rs)',
      'Class 12th (Rs)',
      'Total Amount Transferred (Rs)',
      '% Share of Total'
    ]
  ];

  const classTotals9 = reports.filter(r => r.class === '9th').reduce((s, r) => s + (parseFloat(r.totalAmount || 0) || 0), 0);
  const classTotals10 = reports.filter(r => r.class === '10th').reduce((s, r) => s + (parseFloat(r.totalAmount || 0) || 0), 0);
  const classTotals11 = reports.filter(r => r.class === '11th').reduce((s, r) => s + (parseFloat(r.totalAmount || 0) || 0), 0);
  const classTotals12 = reports.filter(r => r.class === '12th').reduce((s, r) => s + (parseFloat(r.totalAmount || 0) || 0), 0);

  accounts.forEach((acc, idx) => {
    const classTotals = { '9th': 0, '10th': 0, '11th': 0, '12th': 0 };
    let accTotal = 0;

    reports.forEach(r => {
      const cls = r.class || '11th';
      const cRates = rates[cls] || rates['11th'] || {};
      const rateVal = cRates[acc.key] || 0;
      const count = acc.isScienceOnly
        ? (parseInt(r.scienceStudents || 0, 10) || 0)
        : (parseInt(r.paidStudents || r.onRoll || 0, 10) || 0);
      const amt = (r[acc.key] !== undefined && r[acc.key] !== null)
        ? parseFloat(r[acc.key]) || (rateVal * count)
        : (rateVal * count);

      if (classTotals[cls] !== undefined) {
        classTotals[cls] += amt;
      }
      accTotal += amt;
    });

    const share = totalAmountAll > 0 ? ((accTotal / totalAmountAll) * 100).toFixed(2) + '%' : '0.00%';

    sheet1Rows.push([
      idx + 1,
      acc.name,
      String(acc.accNo),
      classTotals['9th'],
      classTotals['10th'],
      classTotals['11th'],
      classTotals['12th'],
      accTotal,
      share
    ]);
  });

  sheet1Rows.push([
    '',
    'GRAND TOTAL',
    '',
    classTotals9,
    classTotals10,
    classTotals11,
    classTotals12,
    totalAmountAll,
    '100.00%'
  ]);

  // ──── SHEET 2: MONTHLY & YEARLY DISBURSAL MATRIX ────
  const sheet2Rows = [
    ['GOVT. HIGHER SECONDARY SCHOOL SHANGUS — MONTHLY DISBURSAL MATRIX'],
    ['Filter Criteria:', `Sessions: ${sessionDesc} | Classes: ${classDesc} | Months: ${monthDesc}`],
    [],
    [
      'Period / Month',
      'Session',
      'Class',
      'Paid Students',
      'Science Students',
      ...accounts.map(a => a.name),
      'Statement Total (Rs)'
    ]
  ];

  reports.forEach(r => {
    const cls = r.class || '11th';
    const cRates = rates[cls] || rates['11th'] || {};
    const paid = parseInt(r.paidStudents || r.onRoll || 0, 10) || 0;
    const sci = parseInt(r.scienceStudents || 0, 10) || 0;

    const accValues = accounts.map(acc => {
      const rateVal = cRates[acc.key] || 0;
      const count = acc.isScienceOnly ? sci : paid;
      return (r[acc.key] !== undefined && r[acc.key] !== null)
        ? parseFloat(r[acc.key]) || (rateVal * count)
        : (rateVal * count);
    });

    sheet2Rows.push([
      r.month || r.year || '—',
      r.session || r.academicSession || '—',
      cls,
      paid,
      sci,
      ...accValues,
      parseFloat(r.totalAmount || 0) || 0
    ]);
  });

  // ──── SHEET 3: RAW TRANSACTION LOGS ────
  const sheet3Rows = [
    ['GOVT. HIGHER SECONDARY SCHOOL SHANGUS — RAW TRANSACTION LOGS'],
    ['Generated On:', genDateStr],
    [],
    [
      'S.No.',
      'Ref Number',
      'Academic Session',
      'Class',
      'Period / Month',
      'Transaction Date',
      'Debit Central A/c',
      'Paid Students',
      'Science Students',
      'Grand Total Disbursed (Rs)',
      ...accounts.map(a => `${a.name} (${a.accNo.slice(-6)})`)
    ]
  ];

  reports.forEach((r, idx) => {
    const cls = r.class || '11th';
    const cRates = rates[cls] || rates['11th'] || {};
    const paid = parseInt(r.paidStudents || r.onRoll || 0, 10) || 0;
    const sci = parseInt(r.scienceStudents || 0, 10) || 0;
    const ref = r.refNo || `HSS/SHG/Fee-Dist/${cls}/${r.month || ''}${r.year ? '-' + r.year : ''}`;

    const accCols = accounts.map(acc => {
      const rateVal = cRates[acc.key] || 0;
      const count = acc.isScienceOnly ? sci : paid;
      return (r[acc.key] !== undefined && r[acc.key] !== null)
        ? parseFloat(r[acc.key]) || (rateVal * count)
        : (rateVal * count);
    });

    sheet3Rows.push([
      idx + 1,
      ref,
      r.session || r.academicSession || '—',
      cls,
      r.month || r.year || '—',
      r.generatedDate || r.date || '—',
      CENTRAL_ACCOUNT_NO,
      paid,
      sci,
      parseFloat(r.totalAmount || 0) || 0,
      ...accCols
    ]);
  });

  const workbook = XLSX.utils.book_new();

  const ws1 = XLSX.utils.aoa_to_sheet(sheet1Rows);
  ws1['!cols'] = [
    { wch: 8 },  // S.No.
    { wch: 38 }, // Subsidiary Name
    { wch: 24 }, // Beneficiary Acc
    { wch: 16 }, // 9th
    { wch: 16 }, // 10th
    { wch: 16 }, // 11th
    { wch: 16 }, // 12th
    { wch: 24 }, // Total
    { wch: 16 }  // % Share
  ];
  XLSX.utils.book_append_sheet(workbook, ws1, 'Account_Summary');

  const ws2 = XLSX.utils.aoa_to_sheet(sheet2Rows);
  XLSX.utils.book_append_sheet(workbook, ws2, 'Monthly_Ledger');

  const ws3 = XLSX.utils.aoa_to_sheet(sheet3Rows);
  XLSX.utils.book_append_sheet(workbook, ws3, 'Transaction_Logs');

  return workbook;
}

/**
 * Export Full Transaction Analysis to Multi-Sheet Excel (.xlsx)
 */
export function exportTransactionAnalysisToExcel(reports = [], filters = {}, rates = {}, customAccounts = SUBSIDIARY_ACCOUNTS) {
  if (!reports || reports.length === 0) return;
  const progress = showFundDistributionProgressModal('Exporting Full Audit Analysis...', `Processing ${reports.length} transaction statements across 3 sheets...`);
  try {
    progress.update(35, 'Generating 3-Sheet Ledger Matrix & Raw Logs...');
    const workbook = buildTransactionAnalysisWorkbook(reports, filters, rates, customAccounts);
    const filename = `JKBank_Fund_Transaction_Analysis_${reports.length}_Statements.xlsx`;
    progress.update(85, 'Downloading Excel workbook...');
    XLSX.writeFile(workbook, filename);
    progress.update(100, 'Excel downloaded!');
  } finally {
    setTimeout(() => progress.close(), 500);
  }
}

/**
 * Get Transaction Analysis Letter HTML Template (for PDF and print)
 */
export function getTransactionAnalysisHtml(reports = [], filters = {}, rates = {}, customAccounts = SUBSIDIARY_ACCOUNTS) {
  const accounts = (Array.isArray(customAccounts) && customAccounts.length > 0) ? customAccounts : SUBSIDIARY_ACCOUNTS;
  const totalStudentsAll = reports.reduce((sum, r) => sum + (parseInt(r.paidStudents || r.onRoll || 0, 10) || 0), 0);
  const totalSciStudentsAll = reports.reduce((sum, r) => sum + (parseInt(r.scienceStudents || 0, 10) || 0), 0);
  const totalAmountAll = reports.reduce((sum, r) => sum + (parseFloat(r.totalAmount || 0) || 0), 0);
  const genDateStr = new Date().toLocaleDateString('en-GB');

  const sessionDesc = filters.sessions && filters.sessions.length > 0 ? filters.sessions.join(', ') : 'All Sessions';
  const classDesc = filters.classes && filters.classes.length > 0 ? filters.classes.join(', ') : 'All Classes';
  const monthDesc = filters.months && filters.months.length > 0 ? filters.months.join(', ') : 'All Months';

  const classTotals9 = reports.filter(r => r.class === '9th').reduce((s, r) => s + (parseFloat(r.totalAmount || 0) || 0), 0);
  const classTotals10 = reports.filter(r => r.class === '10th').reduce((s, r) => s + (parseFloat(r.totalAmount || 0) || 0), 0);
  const classTotals11 = reports.filter(r => r.class === '11th').reduce((s, r) => s + (parseFloat(r.totalAmount || 0) || 0), 0);
  const classTotals12 = reports.filter(r => r.class === '12th').reduce((s, r) => s + (parseFloat(r.totalAmount || 0) || 0), 0);

  let accountRowsHtml = '';
  accounts.forEach((acc, idx) => {
    const classTotals = { '9th': 0, '10th': 0, '11th': 0, '12th': 0 };
    let accTotal = 0;

    reports.forEach(r => {
      const cls = r.class || '11th';
      const cRates = rates[cls] || rates['11th'] || {};
      const rateVal = cRates[acc.key] || 0;
      const count = acc.isScienceOnly
        ? (parseInt(r.scienceStudents || 0, 10) || 0)
        : (parseInt(r.paidStudents || r.onRoll || 0, 10) || 0);
      const amt = (r[acc.key] !== undefined && r[acc.key] !== null)
        ? parseFloat(r[acc.key]) || (rateVal * count)
        : (rateVal * count);

      if (classTotals[cls] !== undefined) {
        classTotals[cls] += amt;
      }
      accTotal += amt;
    });

    const share = totalAmountAll > 0 ? ((accTotal / totalAmountAll) * 100).toFixed(1) + '%' : '0.0%';
    const isZebra = idx % 2 === 1;

    accountRowsHtml += `
      <tr style="background-color: ${isZebra ? '#f8fafc' : '#ffffff'};">
        <td style="text-align: center; font-weight: 700; border: 1px solid #cbd5e1; padding: 4px; vertical-align: middle; line-height: 1.3;">${idx + 1}</td>
        <td style="font-weight: 600; border: 1px solid #cbd5e1; padding: 4px 6px; color: #0f172a; vertical-align: middle; line-height: 1.3;">${acc.name}</td>
        <td style="font-family: 'Consolas', 'Courier New', monospace; font-weight: 700; text-align: center; border: 1px solid #cbd5e1; padding: 4px; color: #1e3a8a; vertical-align: middle; line-height: 1.3;">${acc.accNo}</td>
        <td style="text-align: right; font-family: 'Consolas', 'Courier New', monospace; font-weight: 600; border: 1px solid #cbd5e1; padding: 4px 6px; vertical-align: middle; line-height: 1.3;">${formatCurrency(classTotals['9th'])}</td>
        <td style="text-align: right; font-family: 'Consolas', 'Courier New', monospace; font-weight: 600; border: 1px solid #cbd5e1; padding: 4px 6px; vertical-align: middle; line-height: 1.3;">${formatCurrency(classTotals['10th'])}</td>
        <td style="text-align: right; font-family: 'Consolas', 'Courier New', monospace; font-weight: 600; border: 1px solid #cbd5e1; padding: 4px 6px; vertical-align: middle; line-height: 1.3;">${formatCurrency(classTotals['11th'])}</td>
        <td style="text-align: right; font-family: 'Consolas', 'Courier New', monospace; font-weight: 600; border: 1px solid #cbd5e1; padding: 4px 6px; vertical-align: middle; line-height: 1.3;">${formatCurrency(classTotals['12th'])}</td>
        <td style="text-align: right; font-family: 'Consolas', 'Courier New', monospace; font-weight: 800; border: 1px solid #cbd5e1; padding: 4px 6px; color: #0f172a; vertical-align: middle; line-height: 1.3;">${formatCurrency(accTotal)}</td>
        <td style="text-align: center; font-weight: 700; border: 1px solid #cbd5e1; padding: 4px; color: #047857; vertical-align: middle; line-height: 1.3;">${share}</td>
      </tr>
    `;
  });

  return `
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@700;800;900&family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&family=JetBrains+Mono:wght@600;700&display=swap');
      * { box-sizing: border-box !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      table { border-collapse: collapse !important; width: 100% !important; }
      th, td { vertical-align: middle !important; line-height: 1.3 !important; }
    </style>
    <div style="font-family: 'Plus Jakarta Sans', Arial, Helvetica, sans-serif; font-size: 9pt; line-height: 1.4; color: #0f172a; background: #ffffff; padding: 0; margin: 0; min-height: 285mm; width: 100%; display: flex; flex-direction: column; justify-content: space-between; box-sizing: border-box;">
      <div style="width: 100%; box-sizing: border-box;">
        <!-- Full-Width Header Banner -->
        <div style="width: 100%; box-sizing: border-box; background: #f0fdf4; padding: 16px 0.5in 12px 0.5in; border-bottom: 2px solid #16a34a; text-align: center;">
          <div style="margin-bottom: 5px; text-align: center;">
            <img src="/logo192.png" alt="HSS Logo" style="width: 48px; height: 48px; object-fit: contain; display: inline-block;" onerror="this.style.display='none'" />
          </div>
          <div style="color: #15803d; font-size: 8.5pt; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; text-align: center;">OFFICE OF THE PRINCIPAL</div>
          <div style="font-family: 'Cinzel', 'Times New Roman', Georgia, serif; font-size: 15.5pt; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: 0.8px; margin: 4px 0 2px 0; line-height: 1.2; text-align: center;">GOVT. HIGHER SECONDARY SCHOOL SHANGUS</div>
          <div style="font-size: 8.5pt; font-weight: 600; color: #475569; letter-spacing: 0.3px; text-align: center;">Anantnag, Kashmir — 192201 (J&K)</div>
          <div style="margin-top: 6px; display: inline-block; background: #166534; color: #ffffff; font-size: 8pt; font-weight: 800; padding: 2px 10px; border-radius: 9999px; letter-spacing: 1px;">
            TRANSACTION AUDIT & SUBSIDIARY FUND ALLOCATION REPORT
          </div>
        </div>

        <!-- Main Body Container -->
        <div style="padding: 14px 0.5in 0 0.5in;">
          <!-- Filter Summary & Metadata Header -->
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 12px; margin-bottom: 12px; font-size: 8.5pt;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
              <div><b>Audit Scope / Sessions:</b> <span style="color: #1e3a8a;">${sessionDesc}</span></div>
              <div><b>Date Generated:</b> <span>${genDateStr}</span></div>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <div><b>Classes Included:</b> <span style="color: #047857;">${classDesc}</span> | <b>Months / Period:</b> <span>${monthDesc}</span></div>
              <div><b>Debit Central A/c:</b> <span style="font-family: 'Consolas', monospace; font-weight: bold;">${CENTRAL_ACCOUNT_NO}</span></div>
            </div>
          </div>

          <!-- 4 KPI Summary Cards -->
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 12px;">
            <div style="border: 1px solid #cbd5e1; border-left: 3px solid #2563eb; background: #ffffff; padding: 6px 8px; border-radius: 4px;">
              <div style="font-size: 7.5pt; font-weight: bold; color: #64748b; text-transform: uppercase;">Total Disbursed</div>
              <div style="font-size: 11pt; font-weight: 800; font-family: 'Consolas', monospace; color: #1e3a8a;">${formatCurrency(totalAmountAll)}</div>
            </div>
            <div style="border: 1px solid #cbd5e1; border-left: 3px solid #16a34a; background: #ffffff; padding: 6px 8px; border-radius: 4px;">
              <div style="font-size: 7.5pt; font-weight: bold; color: #64748b; text-transform: uppercase;">Statements</div>
              <div style="font-size: 11pt; font-weight: 800; color: #047857;">${reports.length} Records</div>
            </div>
            <div style="border: 1px solid #cbd5e1; border-left: 3px solid #d97706; background: #ffffff; padding: 6px 8px; border-radius: 4px;">
              <div style="font-size: 7.5pt; font-weight: bold; color: #64748b; text-transform: uppercase;">Beneficiary Std.</div>
              <div style="font-size: 11pt; font-weight: 800; color: #b45309;">${totalStudentsAll} (${totalSciStudentsAll} Sci)</div>
            </div>
            <div style="border: 1px solid #cbd5e1; border-left: 3px solid #7c3aed; background: #ffffff; padding: 6px 8px; border-radius: 4px;">
              <div style="font-size: 7.5pt; font-weight: bold; color: #64748b; text-transform: uppercase;">Target Bank</div>
              <div style="font-size: 10pt; font-weight: 800; color: #5b21b6;">J&K Bank Shangus</div>
            </div>
          </div>

          <!-- Section Title -->
          <div style="font-weight: 800; font-size: 9pt; color: #0f172a; margin-bottom: 6px; border-bottom: 1.5px solid #cbd5e1; padding-bottom: 3px;">
            SUBSIDIARY ACCOUNT ALLOCATION MATRIX (${accounts.length} INSTITUTIONAL HEADS)
          </div>

          <!-- Account Ledger Table -->
          <table style="width: 100%; border-collapse: collapse; font-size: 8pt; margin-bottom: 14px;">
            <thead>
              <tr style="background-color: #f1f5f9; color: #0f172a; font-weight: 800;">
                <th style="width: 4%; border: 1px solid #cbd5e1; padding: 4px; text-align: center;">#</th>
                <th style="width: 28%; text-align: left; padding: 4px 6px; border: 1px solid #cbd5e1;">Subsidiary Fund Account</th>
                <th style="width: 18%; border: 1px solid #cbd5e1; padding: 4px; text-align: center;">Beneficiary A/c No.</th>
                <th style="width: 8%; border: 1px solid #cbd5e1; padding: 4px; text-align: right;">9th</th>
                <th style="width: 8%; border: 1px solid #cbd5e1; padding: 4px; text-align: right;">10th</th>
                <th style="width: 8%; border: 1px solid #cbd5e1; padding: 4px; text-align: right;">11th</th>
                <th style="width: 8%; border: 1px solid #cbd5e1; padding: 4px; text-align: right;">12th</th>
                <th style="width: 12%; border: 1px solid #cbd5e1; padding: 4px 6px; text-align: right;">Total (Rs)</th>
                <th style="width: 6%; border: 1px solid #cbd5e1; padding: 4px; text-align: center;">Share</th>
              </tr>
            </thead>
            <tbody>
              ${accountRowsHtml}
              <tr style="background-color: #e2e8f0; color: #0f172a; font-weight: 800; border-top: 2px solid #0f172a; border-bottom: 2px solid #0f172a; font-size: 8.5pt;">
                <td colspan="3" style="text-align: right; padding: 5px 8px; border: 1px solid #cbd5e1;">GRAND TOTAL ALLOCATION:</td>
                <td style="text-align: right; padding: 5px 6px; font-family: 'Consolas', monospace; border: 1px solid #cbd5e1;">${formatCurrency(classTotals9)}</td>
                <td style="text-align: right; padding: 5px 6px; font-family: 'Consolas', monospace; border: 1px solid #cbd5e1;">${formatCurrency(classTotals10)}</td>
                <td style="text-align: right; padding: 5px 6px; font-family: 'Consolas', monospace; border: 1px solid #cbd5e1;">${formatCurrency(classTotals11)}</td>
                <td style="text-align: right; padding: 5px 6px; font-family: 'Consolas', monospace; border: 1px solid #cbd5e1;">${formatCurrency(classTotals12)}</td>
                <td style="text-align: right; padding: 5px 6px; font-family: 'Consolas', monospace; font-weight: 800; border: 1px solid #cbd5e1; color: #0f172a;">${formatCurrency(totalAmountAll)}</td>
                <td style="text-align: center; border: 1px solid #cbd5e1;">100%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Institutional Sign-off Footer -->
      <div style="padding: 0 0.5in 24px 0.5in;">
        <div style="display: flex; justify-content: space-between; align-items: flex-end; border-top: 1px dashed #cbd5e1; padding-top: 18px; margin-top: 12px;">
          <div style="text-align: center; width: 28%;">
            <div style="height: 38px;"></div>
            <div style="font-weight: 700; color: #475569; font-size: 8.5pt; border-top: 1px solid #94a3b8; padding-top: 4px;">Dealing Assistant (Accounts)</div>
          </div>
          <div style="text-align: center; width: 28%;">
            <div style="height: 38px;"></div>
            <div style="font-weight: 700; color: #475569; font-size: 8.5pt; border-top: 1px solid #94a3b8; padding-top: 4px;">I/C Fund & Audit</div>
          </div>
          <div style="text-align: center; width: 32%;">
            <div style="height: 38px;"></div>
            <div style="font-weight: 800; color: #0f172a; font-size: 9.5pt; border-top: 1px solid #0f172a; padding-top: 4px;">Principal</div>
            <div style="font-size: 7.5pt; color: #475569;">Govt. Hr. Sec. School Shangus</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Generate PDF Blob for Full Transaction Analysis
 */
export async function generateTransactionAnalysisPdfBlob(reports = [], filters = {}, rates = {}, onProgress = null, customAccounts = SUBSIDIARY_ACCOUNTS) {
  if (onProgress) onProgress(20, 'Compiling transaction audit canvas...');
  const html = getTransactionAnalysisHtml(reports, filters, rates, customAccounts);
  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;left:0;top:0;width:794px;background:#ffffff;padding:0;margin:0;z-index:-99999;pointer-events:none;';
  container.innerHTML = html;
  document.body.appendChild(container);

  const cells = container.querySelectorAll('td, th');
  cells.forEach(c => {
    c.style.verticalAlign = 'middle';
    c.style.lineHeight = '1.3';
  });

  await new Promise(r => setTimeout(r, 120));

  try {
    if (onProgress) onProgress(50, 'Capturing high-resolution audit statement...');
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      windowWidth: 794
    });
    
    if (onProgress) onProgress(80, 'Encoding crisp vector PDF...');
    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const a4W = 210;
    const imgH = (canvas.height / canvas.width) * a4W;
    pdf.addImage(imgData, 'JPEG', 0, 0, a4W, imgH);
    
    if (onProgress) onProgress(95, 'Finalizing PDF output...');
    return pdf.output('blob');
  } finally {
    if (container.parentElement) {
      document.body.removeChild(container);
    }
  }
}

/**
 * Direct Download Full Transaction Analysis PDF
 */
export async function downloadTransactionAnalysisPdf(reports = [], filters = {}, rates = {}, customAccounts = SUBSIDIARY_ACCOUNTS) {
  if (!reports || reports.length === 0) return;
  const progress = showFundDistributionProgressModal('Generating Audit Report PDF...', `Compiling ${reports.length} statements...`);
  try {
    const filename = `JKBank_Fund_Audit_Analysis_${reports.length}_Statements.pdf`;
    const blob = await generateTransactionAnalysisPdfBlob(reports, filters, rates, (p, m) => progress.update(p, m), customAccounts);
    
    progress.update(98, 'Saving file to Downloads...');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    progress.update(100, 'Download complete!');
  } finally {
    setTimeout(() => progress.close(), 400);
  }
}

/**
 * Print Transaction Analysis Letter
 */
export function printTransactionAnalysisLetter(reports = [], filters = {}, rates = {}, customAccounts = SUBSIDIARY_ACCOUNTS) {
  if (!reports || reports.length === 0) return;
  const htmlBody = getTransactionAnalysisHtml(reports, filters, rates, customAccounts);
  const docTitle = `JKBank_Fund_Audit_Report_${reports.length}_Statements`;
  const fullDocument = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${docTitle}</title>
        <style>
          @page { size: A4 portrait; margin: 0; }
          * { box-sizing: border-box !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body { margin: 0; padding: 0; background: #ffffff; }
        </style>
      </head>
      <body>
        ${htmlBody}
      </body>
    </html>
  `;

  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(fullDocument);
  doc.close();

  setTimeout(() => {
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } catch (e) {
      console.error('Print iframe error:', e);
    }
    setTimeout(() => {
      if (document.body.contains(iframe)) document.body.removeChild(iframe);
    }, 5000);
  }, 400);
}
