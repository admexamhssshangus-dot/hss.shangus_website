// =================================================================
// HSS SHANGUS — Official Document Catalog & Despatch Register View
// Multi-module classified & chronological register for all issued
// Official Letters, Certificates, Sanction Orders & ID Cards.
// =================================================================

import React, { useState, useMemo, useRef } from 'react';
import {
  BookOpen, Calendar, Printer, FileSpreadsheet, Search, Filter,
  ArrowUpDown, ChevronDown, CheckCircle2, Award, FileText,
  CreditCard, Contact, RotateCcw, X, Eye, Download, IndianRupee,
  Layers, Check, ExternalLink, RefreshCw, FileBadge, User, Hash,
  Clock, ShieldAlert, Sparkles, Building2, HelpCircle
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { showToast } from '../../components/common/GlobalToast';
import {
  isDischargeDoc,
  isLetterDoc,
  isAdmissionFormDoc,
  isBonafideDoc,
  resolveRecordSubject,
  resolveRecordRecipient
} from './DocumentHistoryModal';

// ─── Classification Helper: Recognizes all 4 modules + admissions ───
export const isSanctionOrderDoc = (r) => {
  if (!r) return false;
  const dt = (r.docType || '').toLowerCase();
  if (dt === 'sanction_order' || dt === 'sanction' || dt === 'beneficiary') return true;
  const titleLower = (r.title || '').toLowerCase();
  const subLower = (r.subject || '').toLowerCase();
  return titleLower.includes('mutual benefit') ||
         titleLower.includes('sanction') ||
         titleLower.includes('beneficiar') ||
         subLower.includes('mutual benefit') ||
         subLower.includes('sanction order');
};

export const isIdCardDoc = (r) => {
  if (!r) return false;
  const dt = (r.docType || '').toLowerCase();
  if (dt === 'id_card' || dt === 'idcard') return true;
  const titleLower = (r.title || '').toLowerCase();
  return titleLower.includes('id card') ||
         titleLower.includes('identity card') ||
         titleLower.includes('student badge');
};

/**
 * Returns canonical module classification metadata
 */
export const getRecordClassification = (r) => {
  if (isIdCardDoc(r)) {
    return {
      key: 'idcard',
      label: 'Student ID Cards',
      shortLabel: 'ID Cards',
      code: 'IDC',
      color: 'purple',
      badgeBg: 'bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border-purple-300 dark:border-purple-800',
      icon: Contact
    };
  }
  if (isSanctionOrderDoc(r)) {
    return {
      key: 'sanction',
      label: 'Mutual Benefit & Sanction Orders',
      shortLabel: 'Sanction Orders',
      code: 'MBF',
      color: 'emerald',
      badgeBg: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
      icon: CreditCard
    };
  }
  if (isDischargeDoc(r)) {
    return {
      key: 'discharge',
      label: 'Discharge / Transfer Certificates',
      shortLabel: 'Discharge/TC',
      code: 'DTC',
      color: 'rose',
      badgeBg: 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800',
      icon: FileBadge
    };
  }
  if (isBonafideDoc(r)) {
    return {
      key: 'bonafide',
      label: 'Student Bonafides & Certificates',
      shortLabel: 'Bonafides',
      code: 'BON',
      color: 'amber',
      badgeBg: 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800',
      icon: Award
    };
  }
  if (isLetterDoc(r)) {
    return {
      key: 'letter',
      label: 'Official Institutional Letters',
      shortLabel: 'Letters',
      code: 'LTR',
      color: 'blue',
      badgeBg: 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-800',
      icon: FileText
    };
  }
  if (isAdmissionFormDoc(r)) {
    return {
      key: 'admission',
      label: 'Admission Application Forms',
      shortLabel: 'Admissions',
      code: 'ADM',
      color: 'indigo',
      badgeBg: 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800',
      icon: Layers
    };
  }
  return {
    key: 'other',
    label: 'Official Document',
    shortLabel: 'Other',
    code: 'DOC',
    color: 'slate',
    badgeBg: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700',
    icon: FileText
  };
};

/**
 * Universal Date Parser supporting DD-MM-YYYY, DD/MM/YYYY, ISO 8601, and English dates
 */
export const parseRecordDate = (rec) => {
  if (!rec) return new Date(0);
  if (rec.createdAt) {
    const d = new Date(rec.createdAt);
    if (!isNaN(d.getTime())) return d;
  }
  if (rec.dateStr) {
    const s = String(rec.dateStr).trim();
    // Try DD-MM-YYYY or DD/MM/YYYY
    const parts = s.split(/[-/.]/);
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        // YYYY-MM-DD
        const d = new Date(`${parts[0]}-${parts[1]}-${parts[2]}`);
        if (!isNaN(d.getTime())) return d;
      } else {
        // DD-MM-YYYY
        const d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
        if (!isNaN(d.getTime())) return d;
      }
    }
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d;
  }
  return new Date(0);
};

/**
 * Format a Date object into standard display string (DD-MM-YYYY)
 */
export const formatDisplayDate = (d) => {
  if (!d || isNaN(d.getTime())) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
};

/**
 * Extract clean, high-value identifying info across all 4 module document types
 */
export const extractIdentifyingInfo = (rec) => {
  if (!rec) return { primary: '—', secondary: '' };
  
  // 1. Student Certificates & Bonafides
  if (rec.studentDetails) {
    const sd = rec.studentDetails;
    const name = sd.name || rec.recipientOrStudent || 'Student';
    const parent = sd.father || sd.parentage || '';
    const cls = sd.cls || sd.className || '';
    const roll = sd.rollNo ? `Roll: ${sd.rollNo}` : '';
    const reg = sd.regNo ? `Reg: ${sd.regNo}` : '';
    const subParts = [parent ? `S/o or D/o ${parent}` : '', cls ? `Class: ${cls}` : '', roll, reg].filter(Boolean);
    return {
      primary: name,
      secondary: subParts.join(' • ')
    };
  }

  // 2. Sanction Orders & Mutual Benefit Fund
  if (isSanctionOrderDoc(rec)) {
    const count = rec.extraData?.beneficiaryCount;
    const total = rec.extraData?.totalAmount;
    const countStr = count ? `${count} Beneficiaries` : '';
    const totalStr = total ? `Total Sanction: ₹${total}` : '';
    const primary = rec.recipientOrStudent || (countStr ? `${countStr} ${totalStr}` : 'Beneficiary Sanction');
    const secondary = [countStr, totalStr, rec.extraData?.selectedSession ? `Session: ${rec.extraData.selectedSession}` : ''].filter(Boolean).join(' • ');
    return {
      primary,
      secondary
    };
  }

  // 3. Student ID Cards Batch
  if (isIdCardDoc(rec)) {
    const cardCount = rec.extraData?.cardCount;
    const cls = rec.extraData?.selectedClass;
    return {
      primary: rec.recipientOrStudent || (cardCount ? `${cardCount} Student ID Cards` : 'ID Card Batch'),
      secondary: [cls ? `Cohort: Class ${cls}` : '', cardCount ? `Cards: ${cardCount}` : '', rec.dateStr ? `Issue: ${rec.dateStr}` : ''].filter(Boolean).join(' • ')
    };
  }

  // 4. Official Letters & Office Orders
  const recipient = resolveRecordRecipient(rec) || rec.recipientOrStudent || '';
  const secondary = rec.templateName ? `Template: ${rec.templateName}` : '';
  return {
    primary: recipient || 'The Designated Authority',
    secondary
  };
};

export default function OfficialDocumentCatalogView({
  records = [],
  onClose = null,
  onPreviewRecord = null,
  onRefresh = null,
  isLoading = false
}) {
  // ─── Filter & View States ───
  const [timeRange, setTimeRange] = useState('academic_2025_26'); // academic_2025_26 | academic_2024_25 | year_2026 | year_2025 | last_365 | last_180 | last_30 | custom | all
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [moduleFilter, setModuleFilter] = useState('all'); // all | letter | cert | sanction | idcard | admission
  const [sortOrder, setSortOrder] = useState('desc'); // 'desc' (newest first) | 'asc' (chronological serial)
  const [groupMode, setGroupMode] = useState('flat'); // 'flat' (continuous chronological ledger) | 'classified' (grouped by module)
  const [searchQuery, setSearchQuery] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  // ─── Time Range Calculations ───
  const rangeBounds = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();

    switch (timeRange) {
      case 'academic_2025_26':
        return {
          start: new Date(2025, 3, 1, 0, 0, 0), // 01-Apr-2025
          end: new Date(2026, 2, 31, 23, 59, 59), // 31-Mar-2026
          label: 'Academic Session 2025–26 (01 Apr 2025 – 31 Mar 2026)'
        };
      case 'academic_2024_25':
        return {
          start: new Date(2024, 3, 1, 0, 0, 0),
          end: new Date(2025, 2, 31, 23, 59, 59),
          label: 'Academic Session 2024–25 (01 Apr 2024 – 31 Mar 2025)'
        };
      case 'year_2026':
        return {
          start: new Date(2026, 0, 1, 0, 0, 0),
          end: new Date(2026, 11, 31, 23, 59, 59),
          label: 'Calendar Year 2026 (01 Jan 2026 – 31 Dec 2026)'
        };
      case 'year_2025':
        return {
          start: new Date(2025, 0, 1, 0, 0, 0),
          end: new Date(2025, 11, 31, 23, 59, 59),
          label: 'Calendar Year 2025 (01 Jan 2025 – 31 Dec 2025)'
        };
      case 'last_365': {
        const start = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        return {
          start,
          end: now,
          label: `Past 1 Year (${formatDisplayDate(start)} to ${formatDisplayDate(now)})`
        };
      }
      case 'last_180': {
        const start = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
        return {
          start,
          end: now,
          label: `Past 6 Months (${formatDisplayDate(start)} to ${formatDisplayDate(now)})`
        };
      }
      case 'last_30': {
        const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return {
          start,
          end: now,
          label: `Past 30 Days (${formatDisplayDate(start)} to ${formatDisplayDate(now)})`
        };
      }
      case 'custom': {
        const start = customStartDate ? new Date(`${customStartDate}T00:00:00`) : new Date(0);
        const end = customEndDate ? new Date(`${customEndDate}T23:59:59`) : new Date(8640000000000000);
        return {
          start,
          end,
          label: `Custom Range (${customStartDate || 'Start'} to ${customEndDate || 'Present'})`
        };
      }
      case 'all':
      default:
        return {
          start: new Date(0),
          end: new Date(8640000000000000),
          label: 'All-Time Historical Register'
        };
    }
  }, [timeRange, customStartDate, customEndDate]);

  // ─── Filtered and Chronologically Sorted Records ───
  const { catalogRecords, stats } = useMemo(() => {
    let list = Array.isArray(records) ? records : [];

    // 1. Time Range Filter
    const { start, end } = rangeBounds;
    list = list.filter(r => {
      const d = parseRecordDate(r);
      const t = d.getTime();
      return t >= start.getTime() && t <= end.getTime();
    });

    // Compute metrics across the filtered time period (before module filter)
    let totalCount = list.length;
    let letterCount = 0;
    let certCount = 0;
    let sanctionCount = 0;
    let idCardCount = 0;
    let admissionCount = 0;
    let totalSanctionAmount = 0;

    list.forEach(r => {
      const cls = getRecordClassification(r);
      if (cls.key === 'letter') letterCount++;
      else if (cls.key === 'bonafide' || cls.key === 'discharge') certCount++;
      else if (cls.key === 'sanction') {
        sanctionCount++;
        const amt = parseFloat(r.extraData?.totalAmount || 0);
        if (!isNaN(amt)) totalSanctionAmount += amt;
      } else if (cls.key === 'idcard') idCardCount++;
      else if (cls.key === 'admission') admissionCount++;
    });

    // 2. Module / Classification Filter
    if (moduleFilter === 'letter') {
      list = list.filter(r => getRecordClassification(r).key === 'letter');
    } else if (moduleFilter === 'cert') {
      list = list.filter(r => {
        const k = getRecordClassification(r).key;
        return k === 'bonafide' || k === 'discharge';
      });
    } else if (moduleFilter === 'sanction') {
      list = list.filter(r => getRecordClassification(r).key === 'sanction');
    } else if (moduleFilter === 'idcard') {
      list = list.filter(r => getRecordClassification(r).key === 'idcard');
    } else if (moduleFilter === 'admission') {
      list = list.filter(r => getRecordClassification(r).key === 'admission');
    }

    // 3. Search Query Filter
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(r => {
        const ref = (r.refNo || '').toLowerCase();
        const title = (r.title || '').toLowerCase();
        const subject = resolveRecordSubject(r).toLowerCase();
        const recipient = resolveRecordRecipient(r).toLowerCase();
        const info = extractIdentifyingInfo(r);
        const infoStr = `${info.primary} ${info.secondary}`.toLowerCase();
        const date = (r.dateStr || '').toLowerCase();
        const action = (r.actionType || '').toLowerCase();

        return ref.includes(q) ||
               title.includes(q) ||
               subject.includes(q) ||
               recipient.includes(q) ||
               infoStr.includes(q) ||
               date.includes(q) ||
               action.includes(q);
      });
    }

    // 4. Chronological Sorting
    list = [...list].sort((a, b) => {
      const timeA = parseRecordDate(a).getTime();
      const timeB = parseRecordDate(b).getTime();
      return sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
    });

    return {
      catalogRecords: list,
      stats: {
        total: totalCount,
        letters: letterCount,
        certs: certCount,
        sanctions: sanctionCount,
        idCards: idCardCount,
        admissions: admissionCount,
        totalSanctionAmount
      }
    };
  }, [records, rangeBounds, moduleFilter, searchQuery, sortOrder]);

  // ─── Grouped by Classification (when groupMode === 'classified') ───
  const classifiedGroups = useMemo(() => {
    if (groupMode !== 'classified') return null;
    const groups = {
      letter: { label: 'Official Institutional Letters & Orders', records: [] },
      bonafide: { label: 'Student Bonafides & Certificates', records: [] },
      discharge: { label: 'Discharge / Transfer Certificates', records: [] },
      sanction: { label: 'Mutual Benefit Fund & Sanction Orders', records: [] },
      idcard: { label: 'Student Identity Card Batches', records: [] },
      admission: { label: 'Admission Applications', records: [] },
      other: { label: 'Other Documents', records: [] }
    };

    catalogRecords.forEach(r => {
      const cls = getRecordClassification(r);
      if (groups[cls.key]) {
        groups[cls.key].records.push(r);
      } else {
        groups.other.records.push(r);
      }
    });

    return Object.entries(groups).filter(([_, g]) => g.records.length > 0);
  }, [catalogRecords, groupMode]);

  // ─── Action: Print Official Despatch Register / PDF ───
  const handlePrintCatalog = () => {
    if (catalogRecords.length === 0) {
      showToast('No documents match current filters to print', 'warning');
      return;
    }

    const printWin = window.open('', '_blank');
    if (!printWin) {
      showToast('Please allow popups to open print preview', 'error');
      return;
    }

    const tableRowsHtml = catalogRecords.map((r, idx) => {
      const cls = getRecordClassification(r);
      const parsedDate = parseRecordDate(r);
      const dateText = formatDisplayDate(parsedDate);
      const refText = r.refNo || '—';
      const subjectText = resolveRecordSubject(r) || r.title || 'Official Document';
      const info = extractIdentifyingInfo(r);
      const actionText = r.actionType || 'Recorded';

      return `
        <tr>
          <td style="text-align: center; font-weight: bold;">${idx + 1}</td>
          <td style="text-align: center; white-space: nowrap; font-family: monospace;">${dateText}</td>
          <td style="font-weight: bold; font-family: monospace; font-size: 11px;">${refText}</td>
          <td style="font-size: 11px;">
            <span style="font-weight: bold; text-transform: uppercase; font-size: 10px;">${cls.code}</span> - ${cls.shortLabel}
          </td>
          <td style="font-size: 11px; line-height: 1.3;">
            <div style="font-weight: bold;">${subjectText}</div>
            ${r.title && r.title !== subjectText ? `<div style="font-size: 9.5px; color: #555;">Title: ${r.title}</div>` : ''}
          </td>
          <td style="font-size: 11px; line-height: 1.3;">
            <div style="font-weight: bold;">${info.primary}</div>
            ${info.secondary ? `<div style="font-size: 9.5px; color: #444;">${info.secondary}</div>` : ''}
          </td>
          <td style="text-align: center; font-size: 10px;">${actionText}</td>
          <td style="font-size: 10px; color: #777;"></td>
        </tr>
      `;
    }).join('');

    const formattedAmount = stats.totalSanctionAmount > 0 
      ? ` | Total Sanction Amount: ₹${stats.totalSanctionAmount.toLocaleString('en-IN')}`
      : '';

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Official Despatch & Document Issue Register — HSS Shangus</title>
        <meta charset="utf-8" />
        <style>
          @page {
            size: A4 landscape;
            margin: 10mm 12mm 12mm 12mm;
          }
          body {
            font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
            color: #000;
            background: #fff;
            margin: 0;
            padding: 0;
            font-size: 11px;
            line-height: 1.3;
          }
          .header {
            text-align: center;
            border-bottom: 2px solid #0f172a;
            padding-bottom: 8px;
            margin-bottom: 10px;
          }
          .office-title {
            font-size: 12px;
            font-weight: bold;
            color: #dc2626;
            letter-spacing: 0.5px;
            text-transform: uppercase;
          }
          .inst-name {
            font-size: 18px;
            font-weight: 900;
            color: #0f172a;
            letter-spacing: 0.5px;
            text-transform: uppercase;
            margin: 2px 0;
          }
          .inst-meta {
            font-size: 10px;
            color: #475569;
          }
          .register-banner {
            background: #f1f5f9;
            border: 1px solid #cbd5e1;
            padding: 6px 10px;
            margin: 8px 0 12px 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .register-title {
            font-size: 13px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #0f172a;
          }
          .register-meta {
            font-size: 10px;
            font-weight: bold;
            color: #334155;
          }
          .summary-kpi {
            display: flex;
            gap: 15px;
            font-size: 10px;
            margin-bottom: 8px;
            padding: 4px 8px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
          }
          .kpi-item {
            font-weight: bold;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
          }
          th, td {
            border: 1px solid #64748b;
            padding: 5px 6px;
            vertical-align: middle;
          }
          th {
            background-color: #e2e8f0;
            font-weight: bold;
            text-transform: uppercase;
            font-size: 10px;
            letter-spacing: 0.3px;
          }
          tr:nth-child(even) {
            background-color: #f8fafc;
          }
          .certification {
            margin-top: 15px;
            font-size: 10.5px;
            font-style: italic;
            color: #1e293b;
            border-top: 1px dashed #cbd5e1;
            padding-top: 8px;
          }
          .sign-grid {
            margin-top: 40px;
            display: flex;
            justify-content: space-between;
            padding: 0 20px;
          }
          .sign-block {
            text-align: center;
            width: 200px;
          }
          .sign-line {
            border-top: 1px solid #000;
            margin-bottom: 4px;
          }
          .sign-title {
            font-size: 10px;
            font-weight: bold;
          }
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="office-title">OFFICE OF THE PRINCIPAL</div>
          <div class="inst-name">GOVT. HIGHER SECONDARY SCHOOL SHANGUS</div>
          <div class="inst-meta">Anantnag, Kashmir — 192201 (J&K) | UDISE: 01061400618 | Email: ghssshangus74@gmail.com</div>
        </div>

        <div class="register-banner">
          <div class="register-title">OFFICIAL DESPATCH & DOCUMENT ISSUE REGISTER</div>
          <div class="register-meta">Range: ${rangeBounds.label} | Total Records: ${catalogRecords.length}</div>
        </div>

        <div class="summary-kpi">
          <div class="kpi-item">Letters & Orders: ${stats.letters}</div>
          <div class="kpi-item">Certificates & Bonafides: ${stats.certs}</div>
          <div class="kpi-item">Sanction Orders: ${stats.sanctions}${formattedAmount}</div>
          <div class="kpi-item">ID Card Batches: ${stats.idCards}</div>
          <div class="kpi-item">Generated On: ${new Date().toLocaleString('en-GB')}</div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 4%;">S.No</th>
              <th style="width: 9%;">Date</th>
              <th style="width: 14%;">Ref. / Despatch No</th>
              <th style="width: 14%;">Classification</th>
              <th style="width: 25%;">Subject / Purpose / Title</th>
              <th style="width: 22%;">Issued To / Student / Addressee</th>
              <th style="width: 6%;">Status</th>
              <th style="width: 6%;">Initials</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
          </tbody>
        </table>

        <div class="certification">
          Certified that the above entries from S.No. 1 to ${catalogRecords.length} represent the authentic official record of letters, certificates, sanction orders, and identity documents issued by Govt. Higher Secondary School Shangus during the specified period.
        </div>

        <div class="sign-grid">
          <div class="sign-block">
            <div class="sign-line"></div>
            <div class="sign-title">Dealing Assistant / Clerk</div>
          </div>
          <div class="sign-block">
            <div class="sign-line"></div>
            <div class="sign-title">Incharge Records & Despatch</div>
          </div>
          <div class="sign-block">
            <div class="sign-line"></div>
            <div class="sign-title">Principal<br>Govt. Higher Secondary School Shangus</div>
          </div>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          };
        </script>
      </body>
      </html>
    `;

    printWin.document.write(htmlContent);
    printWin.document.close();
  };

  // ─── Action: Export Official Despatch Register to Excel (.xlsx) ───
  const handleExportExcel = () => {
    if (catalogRecords.length === 0) {
      showToast('No records available to export', 'warning');
      return;
    }

    try {
      setIsExporting(true);
      const wb = XLSX.utils.book_new();

      // Sheet 1: Detailed Master Register
      const rows = [];
      // Title rows
      rows.push(['GOVT. HIGHER SECONDARY SCHOOL SHANGUS']);
      rows.push(['OFFICE OF THE PRINCIPAL — OFFICIAL DESPATCH & DOCUMENT REGISTER']);
      rows.push([`Time Range: ${rangeBounds.label}`]);
      rows.push([`Generated On: ${new Date().toLocaleString('en-GB')}`, '', '', `Total Documents: ${catalogRecords.length}`]);
      rows.push([]); // blank

      // Column Headers
      rows.push([
        'S.No.',
        'Issue Date',
        'Ref. / Despatch No.',
        'Classification Code',
        'Module / Document Type',
        'Subject / Purpose',
        'Document Title',
        'Issued To / Recipient',
        'Identifying Details (Student / Beneficiaries / Cohort)',
        'Class Cohort',
        'Action Type',
        'Internal Document ID',
        'System Timestamp'
      ]);

      catalogRecords.forEach((r, idx) => {
        const cls = getRecordClassification(r);
        const parsedDate = parseRecordDate(r);
        const dateText = formatDisplayDate(parsedDate);
        const refText = r.refNo || '—';
        const subjectText = resolveRecordSubject(r) || r.title || 'Official Document';
        const info = extractIdentifyingInfo(r);

        rows.push([
          idx + 1,
          dateText,
          refText,
          cls.code,
          cls.label,
          subjectText,
          r.title || '',
          info.primary,
          info.secondary,
          r.studentDetails?.cls || r.extraData?.selectedClass || '',
          r.actionType || 'Recorded',
          r.id || '',
          r.createdAt || ''
        ]);
      });

      const wsRegister = XLSX.utils.aoa_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, wsRegister, 'Despatch Register');

      // Sheet 2: Classified Summary Statistics
      const summaryRows = [
        ['GOVT. HIGHER SECONDARY SCHOOL SHANGUS — SUMMARY CLASSIFICATION'],
        [`Period: ${rangeBounds.label}`],
        [],
        ['Document Classification', 'Code', 'Count', 'Percentage (%)', 'Financial Sanctions (₹)'],
        ['Official Institutional Letters & Orders', 'LTR', stats.letters, stats.total > 0 ? ((stats.letters / stats.total) * 100).toFixed(1) + '%' : '0%', '—'],
        ['Student Bonafides & Certificates', 'BON/DTC', stats.certs, stats.total > 0 ? ((stats.certs / stats.total) * 100).toFixed(1) + '%' : '0%', '—'],
        ['Mutual Benefit Fund & Sanction Orders', 'MBF', stats.sanctions, stats.total > 0 ? ((stats.sanctions / stats.total) * 100).toFixed(1) + '%' : '0%', `₹ ${stats.totalSanctionAmount.toLocaleString('en-IN')}`],
        ['Student Identity Cards Batches', 'IDC', stats.idCards, stats.total > 0 ? ((stats.idCards / stats.total) * 100).toFixed(1) + '%' : '0%', '—'],
        ['Admission Application Forms', 'ADM', stats.admissions, stats.total > 0 ? ((stats.admissions / stats.total) * 100).toFixed(1) + '%' : '0%', '—'],
        [],
        ['TOTAL DOCUMENTS ISSUED', 'ALL', stats.total, '100%', stats.totalSanctionAmount > 0 ? `₹ ${stats.totalSanctionAmount.toLocaleString('en-IN')}` : '—']
      ];

      const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary Statistics');

      const fileName = `HSS_Shangus_Despatch_Register_${timeRange}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, fileName);
      showToast(`Exported ${fileName} successfully!`, 'success');
    } catch (err) {
      console.error('Excel catalog export failed:', err);
      showToast('Failed to export catalog spreadsheet: ' + err.message, 'error');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 overflow-hidden font-sans">
      
      {/* ─── TOOLBAR & CONTROL PANEL ─── */}
      <div className="flex-none p-3 bg-slate-50 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 space-y-2.5">
        
        {/* Top Control Bar: Time Range Selector, Module Filter & Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          
          {/* Time Range Selector */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-1">
              <Calendar size={13} className="text-teal-600" />
              Time Range:
            </span>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="h-7 text-xs font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-teal-500 shadow-2xs cursor-pointer"
            >
              <option value="academic_2025_26">Academic Year 2025–26 (01 Apr 2025 – 31 Mar 2026)</option>
              <option value="academic_2024_25">Academic Year 2024–25 (01 Apr 2024 – 31 Mar 2025)</option>
              <option value="year_2026">Calendar Year 2026</option>
              <option value="year_2025">Calendar Year 2025</option>
              <option value="last_365">Past 1 Year (365 Days)</option>
              <option value="last_180">Past 6 Months</option>
              <option value="last_30">Past 30 Days</option>
              <option value="custom">Custom Date Range...</option>
              <option value="all">All Records (All-Time Archive)</option>
            </select>

            {/* Custom Date Pickers */}
            {timeRange === 'custom' && (
              <div className="flex items-center gap-1">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="h-7 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-1.5 text-slate-700 dark:text-slate-200"
                  title="From Date"
                />
                <span className="text-xs text-slate-400">to</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="h-7 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-1.5 text-slate-700 dark:text-slate-200"
                  title="To Date"
                />
              </div>
            )}
          </div>

          {/* Action Buttons: Print Register & Export Excel */}
          <div className="flex items-center gap-1.5 ml-auto">
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                disabled={isLoading}
                className="h-7 px-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer shadow-2xs"
                title="Refresh from Cloud"
              >
                <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleExportExcel}
              disabled={isExporting || catalogRecords.length === 0}
              className="h-7 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer shadow-2xs transition-all active:scale-98"
              title="Export complete Despatch Register to Excel"
            >
              <FileSpreadsheet size={13} />
              <span>Export Excel</span>
            </button>

            <button
              type="button"
              onClick={handlePrintCatalog}
              disabled={catalogRecords.length === 0}
              className="h-7 px-3 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs transition-all active:scale-98"
              title="Print official letterhead issue register / save PDF"
            >
              <Printer size={13} />
              <span>Print Catalog / PDF</span>
            </button>
          </div>
        </div>

        {/* Second Row: Module Tabs, Sort Toggle, Search Box */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200 dark:border-slate-800">
          
          {/* Module Filter Tabs */}
          <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-0.5 rounded-xl border border-slate-200 dark:border-slate-800 flex-wrap">
            <button
              type="button"
              onClick={() => setModuleFilter('all')}
              className={`px-2 py-0.8 rounded-lg text-[10.5px] font-black cursor-pointer transition-all ${
                moduleFilter === 'all'
                  ? 'bg-teal-700 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              All 4 Modules ({stats.total})
            </button>

            <button
              type="button"
              onClick={() => setModuleFilter('letter')}
              className={`px-2 py-0.8 rounded-lg text-[10.5px] font-black cursor-pointer transition-all flex items-center gap-1 ${
                moduleFilter === 'letter'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <FileText size={11} />
              <span>Letters ({stats.letters})</span>
            </button>

            <button
              type="button"
              onClick={() => setModuleFilter('cert')}
              className={`px-2 py-0.8 rounded-lg text-[10.5px] font-black cursor-pointer transition-all flex items-center gap-1 ${
                moduleFilter === 'cert'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Award size={11} />
              <span>Certificates ({stats.certs})</span>
            </button>

            <button
              type="button"
              onClick={() => setModuleFilter('sanction')}
              className={`px-2 py-0.8 rounded-lg text-[10.5px] font-black cursor-pointer transition-all flex items-center gap-1 ${
                moduleFilter === 'sanction'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <CreditCard size={11} />
              <span>Sanction Orders ({stats.sanctions})</span>
            </button>

            <button
              type="button"
              onClick={() => setModuleFilter('idcard')}
              className={`px-2 py-0.8 rounded-lg text-[10.5px] font-black cursor-pointer transition-all flex items-center gap-1 ${
                moduleFilter === 'idcard'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Contact size={11} />
              <span>ID Cards ({stats.idCards})</span>
            </button>
          </div>

          {/* Grouping & Sort Controls */}
          <div className="flex items-center gap-1.5">
            {/* View Layout Toggle */}
            <div className="flex items-center bg-white dark:bg-slate-900 rounded-lg border border-slate-300 dark:border-slate-700 p-0.5 text-[10px]">
              <button
                type="button"
                onClick={() => setGroupMode('flat')}
                className={`px-2 py-0.5 rounded font-bold transition-all ${
                  groupMode === 'flat'
                    ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
                title="Continuous Chronological Ledger"
              >
                Chronological
              </button>
              <button
                type="button"
                onClick={() => setGroupMode('classified')}
                className={`px-2 py-0.5 rounded font-bold transition-all ${
                  groupMode === 'classified'
                    ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
                title="Grouped by Module Classification"
              >
                Classified Groups
              </button>
            </div>

            {/* Sort Order Button */}
            <button
              type="button"
              onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
              className="h-7 px-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-[10.5px] font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1 cursor-pointer shadow-2xs"
              title="Toggle date sorting order"
            >
              <ArrowUpDown size={11} />
              <span>{sortOrder === 'desc' ? 'Newest First' : 'Oldest First (1..N)'}</span>
            </button>

            {/* Search Box */}
            <div className="relative min-w-[180px] sm:min-w-[220px]">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search ref no, student, subject..."
                className="w-full h-7 pl-7 pr-6 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={11} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Third Row: KPI Summary Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 pt-1 border-t border-slate-200 dark:border-slate-800">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-1.5 flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-teal-100 dark:bg-teal-950/60 text-teal-700 dark:text-teal-400 flex items-center justify-center shrink-0">
              <BookOpen size={14} />
            </div>
            <div className="min-w-0">
              <div className="text-[9px] uppercase font-bold text-slate-500">Period Total</div>
              <div className="text-xs font-black text-slate-800 dark:text-slate-100">{stats.total} Documents</div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-1.5 flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 flex items-center justify-center shrink-0">
              <FileText size={14} />
            </div>
            <div className="min-w-0">
              <div className="text-[9px] uppercase font-bold text-slate-500">Letters Issued</div>
              <div className="text-xs font-black text-blue-600 dark:text-blue-400">{stats.letters} Letters</div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-1.5 flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Award size={14} />
            </div>
            <div className="min-w-0">
              <div className="text-[9px] uppercase font-bold text-slate-500">Certificates</div>
              <div className="text-xs font-black text-amber-600 dark:text-amber-400">{stats.certs} Issued</div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-1.5 flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <CreditCard size={14} />
            </div>
            <div className="min-w-0">
              <div className="text-[9px] uppercase font-bold text-slate-500">Sanctions & MBF</div>
              <div className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                {stats.sanctions} Orders {stats.totalSanctionAmount > 0 ? `(₹${stats.totalSanctionAmount.toLocaleString('en-IN')})` : ''}
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-1.5 flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400 flex items-center justify-center shrink-0">
              <Contact size={14} />
            </div>
            <div className="min-w-0">
              <div className="text-[9px] uppercase font-bold text-slate-500">ID Card Batches</div>
              <div className="text-xs font-black text-purple-600 dark:text-purple-400">{stats.idCards} Batches</div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── DESPATCH & ISSUE REGISTER TABLE ─── */}
      <div className="flex-1 overflow-y-auto p-2 sm:p-3">
        {catalogRecords.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-400 p-6 text-center space-y-2">
            <BookOpen size={36} className="text-slate-300 dark:text-slate-600" />
            <div className="font-bold text-sm text-slate-600 dark:text-slate-300">
              No Issued Documents in this Time Range
            </div>
            <p className="text-xs max-w-md text-slate-500">
              No official letters, certificates, sanction orders, or ID card batches found for the selected period ({rangeBounds.label}). Adjust the time range or filters above.
            </p>
          </div>
        ) : groupMode === 'classified' && classifiedGroups ? (
          /* Classified Grouped Sections */
          <div className="space-y-4">
            {classifiedGroups.map(([catKey, group]) => (
              <div key={catKey} className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-2xs">
                <div className="bg-slate-100 dark:bg-slate-800 px-3 py-1.5 flex items-center justify-between border-b border-slate-200 dark:border-slate-700">
                  <div className="font-black text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <span>{group.label}</span>
                    <span className="text-[10px] bg-slate-200 dark:bg-slate-700 px-1.5 py-0.2 rounded-full font-bold">
                      {group.records.length}
                    </span>
                  </div>
                </div>

                <RegisterTable
                  records={group.records}
                  onPreviewRecord={onPreviewRecord}
                />
              </div>
            ))}
          </div>
        ) : (
          /* Continuous Master Chronological Register */
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-2xs">
            <RegisterTable
              records={catalogRecords}
              onPreviewRecord={onPreviewRecord}
            />
          </div>
        )}
      </div>

      {/* ─── FOOTER BAR: SUMMARY METRICS & INSTRUCTIONS ─── */}
      <div className="flex-none bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 px-3 py-1.5 flex items-center justify-between text-[11px] text-slate-500 font-medium">
        <div className="flex items-center gap-2">
          <span>Showing <strong>{catalogRecords.length}</strong> of {stats.total} total documents</span>
          <span>•</span>
          <span className="font-mono text-[10px]">{rangeBounds.label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline">Official Despatch Register • Govt. Higher Secondary School Shangus</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Standard Register Data Table component
 */
function RegisterTable({ records, onPreviewRecord }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs border-collapse">
        <thead>
          <tr className="bg-slate-100/80 dark:bg-slate-800/80 text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
            <th className="py-2 px-2.5 w-10 text-center">S.No</th>
            <th className="py-2 px-2.5 w-24 text-center">Date</th>
            <th className="py-2 px-2.5 w-40">Ref. / Despatch No</th>
            <th className="py-2 px-2.5 w-32">Classification</th>
            <th className="py-2 px-3">Subject / Purpose / Title</th>
            <th className="py-2 px-3">Issued To / Student / Addressee</th>
            <th className="py-2 px-2.5 w-20 text-center">Status</th>
            <th className="py-2 px-2 w-14 text-center">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-sans">
          {records.map((rec, idx) => {
            const cls = getRecordClassification(rec);
            const parsedDate = parseRecordDate(rec);
            const dateText = formatDisplayDate(parsedDate);
            const refText = rec.refNo || '—';
            const subjectText = resolveRecordSubject(rec) || rec.title || 'Official Document';
            const info = extractIdentifyingInfo(rec);
            const Icon = cls.icon;

            return (
              <tr
                key={rec.id || idx}
                onClick={() => onPreviewRecord?.(rec)}
                className="hover:bg-teal-50/40 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
              >
                {/* S.No */}
                <td className="py-2 px-2.5 text-center font-bold text-slate-500 text-[11px]">
                  {idx + 1}
                </td>

                {/* Date */}
                <td className="py-2 px-2.5 text-center font-mono text-[11px] font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                  {dateText}
                </td>

                {/* Ref / Despatch No */}
                <td className="py-2 px-2.5">
                  <div className="font-mono text-[11px] font-bold text-slate-900 dark:text-slate-100 break-all">
                    {refText !== '—' ? (
                      <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                        {refText}
                      </span>
                    ) : (
                      <span className="text-slate-400 italic">Unassigned Draft</span>
                    )}
                  </div>
                </td>

                {/* Classification Badge */}
                <td className="py-2 px-2.5 whitespace-nowrap">
                  <span className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-1.5 py-0.5 rounded-md border ${cls.badgeBg}`}>
                    <Icon size={10} className="shrink-0" />
                    <span>{cls.shortLabel}</span>
                  </span>
                </td>

                {/* Subject / Purpose / Title */}
                <td className="py-2 px-3">
                  <div className="font-bold text-slate-900 dark:text-slate-100 text-xs line-clamp-1">
                    {subjectText}
                  </div>
                  {rec.title && rec.title !== subjectText && (
                    <div className="text-[10px] text-slate-500 line-clamp-1">
                      {rec.title}
                    </div>
                  )}
                </td>

                {/* Issued To / Student / Addressee */}
                <td className="py-2 px-3">
                  <div className="font-semibold text-slate-800 dark:text-slate-200 text-xs">
                    {info.primary}
                  </div>
                  {info.secondary && (
                    <div className="text-[10px] text-slate-500 font-mono">
                      {info.secondary}
                    </div>
                  )}
                </td>

                {/* Status */}
                <td className="py-2 px-2.5 text-center whitespace-nowrap">
                  <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                    {rec.actionType || 'Recorded'}
                  </span>
                </td>

                {/* Action */}
                <td className="py-2 px-2 text-center" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => onPreviewRecord?.(rec)}
                    className="p-1 rounded hover:bg-teal-100 dark:hover:bg-slate-700 text-teal-700 dark:text-teal-300 transition-colors"
                    title="View Document Snapshot"
                  >
                    <Eye size={13} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
