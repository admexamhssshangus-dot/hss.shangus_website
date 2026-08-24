import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Mail, Send, RefreshCw, AlertCircle, 
  CheckCircle2, Users, SlidersHorizontal, Eye, X, Search, 
  Bold, Italic, Underline, Strikethrough, 
  List, ListOrdered, AlignLeft, AlignCenter, AlignRight, Link2, 
  RemoveFormatting, ShieldAlert, FileText
} from 'lucide-react';
import appsScriptApi from '../../services/appsScriptApi';
import { getCachedCollectionSync, subscribeToCollection, getCachedCollection } from '../../services/dbCache';
import { sanitizeRichHtml } from '../../utils/sanitizeRichHtml';

const DEFAULT_FOOTER = 'Best regards, Admission & Examination Cell, Govt. Higher Secondary School Shangus';

// Robust email extraction across legacy & new form schemas
function extractStudentEmail(app) {
  if (!app || typeof app !== 'object') return '';
  const raw = app['E-mail ID'] || 
              app['Email Address'] || 
              app['email'] || 
              app['Email'] || 
              app['emailNormalized'] || 
              app['Email ID'] || 
              app['Student Email'] || 
              app['emailAddress'] || 
              app['userEmail'] || 
              app['ownerEmail'] || 
              '';
  const str = String(raw || '').trim().toLowerCase();
  
  // Filter out system administrative email addresses if attached as meta
  if (str.includes('admin') || str.includes('hss.shangus@gmail.com') || str.includes('e.educational')) {
    return '';
  }
  const match = str.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return match ? match[0] : '';
}

// Normalize student academic class
function normalizeClass(raw) {
  const s = String(raw || '').toLowerCase().trim();
  if (s.includes('12') || s.includes('xii')) return '12th';
  if (s.includes('11') || s.includes('xi')) return '11th';
  if (s.includes('10') || s.includes('x')) return '10th';
  if (s.includes('9') || s.includes('ix')) return '9th';
  return s || 'Other';
}

// Robust class roll number extraction (Roll No assigned means Approved / Enrolled)
function extractClassRollNo(a) {
  if (!a || typeof a !== 'object') return '';
  const r = a['Class Roll No'] ?? a['Class Roll No.'] ?? a['Class Roll Number'] ?? a['Class R.No.'] ?? a['Class R. No.'] ?? a.classRollNo ?? a.class_roll_no ?? a.rollNo ?? a['Roll No'] ?? a['Roll No.'] ?? '';
  const clean = String(r).trim();
  if (!clean || clean === '—' || clean === 'N/A' || clean === 'null' || clean === 'undefined' || clean === '-') return '';
  return clean;
}

// Helper to extract clean Stream
function extractStream(a) {
  if (!a || typeof a !== 'object') return 'General';
  const s = a['Stream for Class 11th'] || a['Stream opted in Class 11th'] || a['Stream & Subjects for Class 12th'] || a['Stream / Faculty'] || a['Stream'] || a.stream || a.Stream || '';
  const clean = String(s).trim();
  if (!clean || clean === '—' || clean === 'N/A' || clean === 'null' || clean === 'undefined' || clean === '-') {
    return 'General';
  }
  const lower = clean.toLowerCase();
  if (lower.includes('sci') || lower.includes('med')) return 'Science';
  if (lower.includes('hum') || lower.includes('art')) return 'Humanities';
  if (lower.includes('com')) return 'Commerce';
  if (lower.includes('gen')) return 'General';
  return clean;
}

// Student comparator with default natural numeric roll number sorting
function compareStudents(a, b, sortType = 'roll_asc') {
  if (sortType === 'roll_asc' || sortType === 'roll_desc') {
    const asc = sortType === 'roll_asc';
    const rA = String(a.rollNo || '').trim();
    const rB = String(b.rollNo || '').trim();
    const numA = parseInt(rA.replace(/[^0-9]/g, ''), 10);
    const numB = parseInt(rB.replace(/[^0-9]/g, ''), 10);
    const hasA = !isNaN(numA) && numA > 0;
    const hasB = !isNaN(numB) && numB > 0;
    if (hasA && hasB) return asc ? numA - numB : numB - numA;
    if (hasA && !hasB) return -1;
    if (!hasA && hasB) return 1;
    return asc ? rA.localeCompare(rB) : rB.localeCompare(rA);
  }
  if (sortType === 'name_asc') return (a.name || '').localeCompare(b.name || '');
  if (sortType === 'name_desc') return (b.name || '').localeCompare(a.name || '');
  if (sortType === 'form_asc') {
    const numA = parseInt(String(a.formNo).replace(/[^0-9]/g, ''), 10);
    const numB = parseInt(String(b.formNo).replace(/[^0-9]/g, ''), 10);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return String(a.formNo).localeCompare(String(b.formNo));
  }
  if (sortType === 'stream') {
    const strDiff = (a.stream || '').localeCompare(b.stream || '');
    if (strDiff !== 0) return strDiff;
    return compareStudents(a, b, 'roll_asc');
  }
  return 0;
}

// Normalize admission status
function normalizeStatus(raw, rollNo = '') {
  if (rollNo) return 'Approved';
  const s = String(raw || '').toLowerCase().trim();
  if (s.includes('approv') || s.includes('confirm') || s.includes('enrol') || s.includes('admit')) return 'Approved';
  if (s.includes('submit')) return 'Submitted';
  if (s.includes('draft') || s.includes('provis')) return 'Draft';
  if (s.includes('reject')) return 'Rejected';
  return 'Submitted';
}

export default function AutomationsPage({ applications: propApps = [], user = null }) {
  // Local admissions state with multi-tier cache & fallback hydration
  const [localApps, setLocalApps] = useState(() => {
    if (Array.isArray(propApps) && propApps.length > 0) return propApps;
    return getCachedCollectionSync('admissions') || [];
  });

  // Sync prop changes or subscribe to real-time updates
  useEffect(() => {
    if (Array.isArray(propApps) && propApps.length > 0) {
      setLocalApps(propApps);
      return;
    }
    const cached = getCachedCollectionSync('admissions');
    if (cached && cached.length > 0) {
      setLocalApps(cached);
    } else {
      getCachedCollection('admissions', false).then((data) => {
        if (Array.isArray(data) && data.length > 0) setLocalApps(data);
      });
    }

    if (typeof subscribeToCollection === 'function') {
      const unsub = subscribeToCollection('admissions', (live) => {
        if (Array.isArray(live) && live.length > 0) {
          setLocalApps(live);
        }
      });
      return () => { if (typeof unsub === 'function') unsub(); };
    }
  }, [propApps]);

  // ---------------------------------------------------------------------------
  // Recipient Filters & Selection State
  // ---------------------------------------------------------------------------
  const [targetStatus, setTargetStatus] = useState('All'); // 'All' | 'Submitted' | 'Approved' | 'Draft' | 'Rejected'
  const [targetClass, setTargetClass] = useState('All');   // 'All' | '12th' | '11th' | '10th' | '9th'
  const [targetSession, setTargetSession] = useState('All'); // 'All' | '2025-26' | '2024-25'
  const [sortBy, setSortBy] = useState('roll_asc'); // 'roll_asc' | 'roll_desc' | 'name_asc' | 'name_desc' | 'form_asc' | 'stream'
  const [testMode, setTestMode] = useState(false);
  const [excludedEmails, setExcludedEmails] = useState(new Set());
  const [showManageModal, setShowManageModal] = useState(false);
  const [manageSearch, setManageSearch] = useState('');

  // ---------------------------------------------------------------------------
  // Email Content State
  // ---------------------------------------------------------------------------
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBodyHtml, setEmailBodyHtml] = useState('');
  const [customFooter, setCustomFooter] = useState(DEFAULT_FOOTER);
  const [isCustomFooter, setIsCustomFooter] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // ---------------------------------------------------------------------------
  // Sending & Log State
  // ---------------------------------------------------------------------------
  const [sendingEmail, setSendingEmail] = useState(false);
  const [alert, setAlert] = useState(null);
  const [lastDispatchLog, setLastDispatchLog] = useState(null);

  const editorRef = useRef(null);
  const adminEmail = user?.email || 'adm.exam.hss.shangus@gmail.com';

  // ---------------------------------------------------------------------------
  // Parse all applications into structured recipient records
  // ---------------------------------------------------------------------------
  const allParsedRecipients = useMemo(() => {
    const rawList = Array.isArray(localApps) && localApps.length > 0 ? localApps : propApps;
    if (!Array.isArray(rawList) || rawList.length === 0) return [];
    
    const seenStudentKeys = new Set();
    const list = [];

    for (const app of rawList) {
      const email = extractStudentEmail(app);
      if (!email) continue;

      const name = String(
        app["Student's Name (as per school records)"] || 
        app["Student's Name"] || 
        app.name || 
        app.studentName || 
        'Student'
      ).trim();

      const fatherName = String(
        app["Father's/Guardian's Name (as per school records)"] || 
        app["Father's Name"] || 
        app.fatherName || 
        app.father || 
        ''
      ).trim();

      const stream = extractStream(app);

      const rawCls = app["Admission sought for class"] || app.class || app.Class || app.className || '';
      const cls = normalizeClass(rawCls);

      const rawSession = app['Academic Session'] || app.Session || app.session || '2025-26';
      const session = String(rawSession).trim();

      const rollNo = extractClassRollNo(app);
      const isApproved = !!rollNo || String(app.Status || app.status || '').toLowerCase().includes('approv');
      const rawStatus = app.Status || app.status || 'Submitted';
      const status = isApproved ? 'Approved' : normalizeStatus(rawStatus, rollNo);

      const formNo = String(app['Form Number'] || app.formNo || app.FormNo || app.id || '').trim();

      // Unique student key to deduplicate duplicate raw submissions of the exact same student form
      const studentKey = String(app.id || formNo || `${cls}_${rollNo || name}`).trim().toLowerCase();
      if (seenStudentKeys.has(studentKey)) continue;
      seenStudentKeys.add(studentKey);

      list.push({
        id: studentKey,
        email,
        name,
        fatherName,
        stream,
        class: cls,
        session,
        status,
        isApproved,
        formNo,
        rollNo,
      });
    }

    return list;
  }, [localApps, propApps]);

  // Available sessions in current dataset
  const availableSessions = useMemo(() => {
    const set = new Set();
    allParsedRecipients.forEach(r => { if (r.session) set.add(r.session); });
    const list = Array.from(set).filter(Boolean).sort().reverse();
    return list.length > 0 ? list : ['2025-26', '2024-25'];
  }, [allParsedRecipients]);

  // Filtered pool matching toolbar dropdowns (Default sorted by Class Roll No)
  const matchedRecipients = useMemo(() => {
    const filtered = allParsedRecipients.filter(r => {
      // 1. Status filter (Class Roll No assigned means Approved / Enrolled)
      if (targetStatus !== 'All') {
        if (targetStatus === 'Approved') {
          if (!r.isApproved) return false;
        } else if (targetStatus === 'Submitted') {
          if (r.status === 'Draft' || r.status === 'Rejected') return false;
        } else if (targetStatus === 'Draft') {
          if (r.isApproved || r.status !== 'Draft') return false;
        } else if (targetStatus === 'Rejected') {
          if (r.status !== 'Rejected') return false;
        }
      }

      // 2. Class filter
      if (targetClass !== 'All') {
        if (r.class !== targetClass) return false;
      }

      // 3. Session filter
      if (targetSession !== 'All') {
        if (!r.session.includes(targetSession)) return false;
      }

      return true;
    });

    // Default: Sort by Class Roll Number ascending (1 → 999) or selected sort order
    return [...filtered].sort((a, b) => compareStudents(a, b, sortBy));
  }, [allParsedRecipients, targetStatus, targetClass, targetSession, sortBy]);

  // Final selected recipients (accounting for manual exclusions)
  const finalRecipients = useMemo(() => {
    if (testMode) {
      return [{ id: 'admin_test', email: adminEmail, name: 'Administrator (Test Flight)', class: 'Admin', status: 'Test' }];
    }
    return matchedRecipients.filter(r => !excludedEmails.has(r.id) && !excludedEmails.has(r.email));
  }, [matchedRecipients, excludedEmails, testMode, adminEmail]);

  // ---------------------------------------------------------------------------
  // Rich Text Editor Commands (document.execCommand with focus preservation)
  // ---------------------------------------------------------------------------
  const executeCmd = (command, value = null) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    document.execCommand(command, false, value);
    handleEditorInput();
  };

  const handleEditorInput = () => {
    if (editorRef.current) {
      setEmailBodyHtml(editorRef.current.innerHTML);
    }
  };

  const handleInsertLink = () => {
    const url = prompt('Enter URL address (e.g. https://example.com):', 'https://');
    if (url && url !== 'https://') {
      executeCmd('createLink', url);
    }
  };

  const handleClearFormat = () => {
    executeCmd('removeFormat');
    executeCmd('formatBlock', '<p>');
  };

  // ---------------------------------------------------------------------------
  // Send Bulk Email Dispatcher
  // ---------------------------------------------------------------------------
  const handleSendBulkEmail = async (e) => {
    if (e) e.preventDefault();

    const cleanSubject = emailSubject.trim();
    const cleanBody = emailBodyHtml.trim();

    if (!cleanSubject) {
      setAlert({ type: 'error', text: 'Please enter an email subject line.' });
      return;
    }
    if (!cleanBody || cleanBody === '<p><br></p>' || cleanBody === '<br>') {
      setAlert({ type: 'error', text: 'Please write your email message body before dispatching.' });
      return;
    }
    if (finalRecipients.length === 0) {
      setAlert({ type: 'error', text: 'No recipients selected. Please adjust your filters or inclusion list.' });
      return;
    }

    const effectiveFooter = isCustomFooter ? customFooter.trim() : DEFAULT_FOOTER;

    // Safety Confirmation
    const confirmMsg = testMode 
      ? `Send Test Email to ${adminEmail}?`
      : `Are you sure you want to dispatch this email to ${finalRecipients.length} recipients?`;

    if (!window.confirm(confirmMsg)) return;

    setSendingEmail(true);
    setAlert(null);
    setLastDispatchLog(null);

    try {
      const recipientEmails = finalRecipients.map(r => r.email);

      const payload = {
        subject: cleanSubject,
        body: cleanBody,
        htmlBody: cleanBody,
        className: targetClass,
        session: targetSession,
        status: targetStatus,
        recipients: recipientEmails,
        testMode: testMode,
        testEmail: adminEmail,
        customFooter: effectiveFooter,
      };

      const res = await appsScriptApi.call('sendBulkEmail', payload);

      if (res && res.success !== false) {
        setAlert({ 
          type: 'success', 
          text: testMode 
            ? `Test email sent successfully to ${adminEmail}!` 
            : `Bulk email successfully dispatched to ${finalRecipients.length} recipients!`
        });

        setLastDispatchLog({
          timestamp: new Date().toLocaleTimeString(),
          count: finalRecipients.length,
          subject: cleanSubject,
          testMode,
          status: 'Dispatched Successfully'
        });

        // Reset composer if not in test mode
        if (!testMode) {
          setEmailSubject('');
          setEmailBodyHtml('');
          if (editorRef.current) editorRef.current.innerHTML = '';
        }
      } else {
        setAlert({ type: 'error', text: res?.message || 'Failed to dispatch bulk email.' });
      }
    } catch (err) {
      console.error('Bulk email dispatch error:', err);
      setAlert({ type: 'error', text: err.userMessage || err.message || 'Failed to send bulk email. Check connection or SMTP.' });
    } finally {
      setSendingEmail(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-2 text-xs text-slate-900 dark:text-slate-100 animate-fadeIn">
      
      {/* Alert Notification */}
      {alert && (
        <div className={`py-2 px-3.5 rounded-xl font-bold flex items-center justify-between gap-2 shadow-xs transition-all ${
          alert.type === 'error' 
            ? 'bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300' 
            : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
        }`}>
          <div className="flex items-center gap-2">
            {alert.type === 'error' ? <AlertCircle size={15} className="flex-shrink-0" /> : <CheckCircle2 size={15} className="flex-shrink-0" />}
            <span className="text-xs font-bold">{alert.text}</span>
          </div>
          <button type="button" onClick={() => setAlert(null)} className="opacity-60 hover:opacity-100 p-0.5 cursor-pointer">
            <X size={13} />
          </button>
        </div>
      )}

      {/* Ultra-Compact Group Email Composer Card */}
      <div className="w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-3 sm:p-4 space-y-2.5">
        
        {/* ======================================================================= */}
        {/* 1. TOP UNIFIED RECIPIENT TOOLBAR */}
        {/* ======================================================================= */}
        <div className="p-2 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-950/70">
          <div className="flex flex-wrap items-center justify-between gap-2">
            
            {/* Left Filter Controls */}
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              
              {/* Status / To Selector */}
              <div className="flex items-center gap-1 bg-white dark:bg-slate-900 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 shadow-2xs">
                <span className="text-[11px] font-bold text-slate-400 uppercase">To:</span>
                <select
                  value={targetStatus}
                  onChange={(e) => {
                    setTargetStatus(e.target.value);
                    setExcludedEmails(new Set());
                  }}
                  className="bg-transparent font-bold text-xs text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
                >
                  <option value="All">Every Applicant</option>
                  <option value="Submitted">Submitted Forms</option>
                  <option value="Approved">Approved / Enrolled</option>
                  <option value="Draft">Draft Forms</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>

              {/* Class Filter */}
              <div className="flex items-center gap-1 bg-white dark:bg-slate-900 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 shadow-2xs">
                <span className="text-[11px] font-bold text-slate-400 uppercase">Class:</span>
                <select
                  value={targetClass}
                  onChange={(e) => {
                    setTargetClass(e.target.value);
                    setExcludedEmails(new Set());
                  }}
                  className="bg-transparent font-bold text-xs text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
                >
                  <option value="All">All Classes</option>
                  <option value="12th">12th Class</option>
                  <option value="11th">11th Class</option>
                  <option value="10th">10th Class</option>
                  <option value="9th">9th Class</option>
                </select>
              </div>

              {/* Session Filter */}
              <div className="flex items-center gap-1 bg-white dark:bg-slate-900 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 shadow-2xs">
                <span className="text-[11px] font-bold text-slate-400 uppercase">Session:</span>
                <select
                  value={targetSession}
                  onChange={(e) => {
                    setTargetSession(e.target.value);
                    setExcludedEmails(new Set());
                  }}
                  className="bg-transparent font-bold text-xs text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
                >
                  <option value="All">All Sessions</option>
                  {availableSessions.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Live Count Pill */}
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-teal-500/10 text-teal-700 dark:text-teal-300 font-extrabold text-xs border border-teal-500/20 shadow-2xs">
                <Users size={13} />
                <span>
                  {testMode ? '1 Test Flight' : `${finalRecipients.length} recipients`}
                </span>
                {excludedEmails.size > 0 && !testMode && (
                  <span className="text-[10px] text-rose-500 font-bold ml-0.5">
                    ({excludedEmails.size} excl.)
                  </span>
                )}
              </div>

              {/* Manage Selection Button */}
              {!testMode && matchedRecipients.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowManageModal(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs border border-slate-200 dark:border-slate-700 shadow-2xs transition-all cursor-pointer"
                  title="Select or exclude individual students"
                >
                  <SlidersHorizontal size={12} className="text-teal-600 dark:text-teal-400" />
                  <span>Manage</span>
                </button>
              )}

            </div>

            {/* Right Test Flight Checkbox */}
            <div className="flex items-center gap-1.5 pr-1">
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={testMode}
                  onChange={(e) => setTestMode(e.target.checked)}
                  className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 w-3.5 h-3.5 cursor-pointer"
                />
                <span>Test to admin</span>
                <span className="text-[11px] text-slate-400 font-mono hidden md:inline">
                  ({adminEmail})
                </span>
              </label>
            </div>

          </div>
        </div>

        {/* ======================================================================= */}
        {/* 2. COMPACT EMAIL SUBJECT LINE */}
        {/* ======================================================================= */}
        <div>
          <input
            type="text"
            required
            placeholder="Enter Email Subject (e.g. Important Notice Regarding Class 11th Admission Verification)..."
            value={emailSubject}
            onChange={(e) => setEmailSubject(e.target.value)}
            className="w-full px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 shadow-2xs hover:border-slate-300 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/15 transition-all"
          />
        </div>

        {/* ======================================================================= */}
        {/* 3. RICH TEXT WYSIWYG TOOLBAR & CANVAS */}
        {/* ======================================================================= */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-2xs bg-white dark:bg-slate-950">
          
          {/* Formatting Toolbar Row */}
          <div className="flex items-center gap-1 p-1 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 overflow-x-auto select-none">
            
            {/* Bold */}
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); executeCmd('bold'); }}
              className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-black cursor-pointer"
              title="Bold (Ctrl+B)"
            >
              <Bold size={13} />
            </button>

            {/* Italic */}
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); executeCmd('italic'); }}
              className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-black cursor-pointer"
              title="Italic (Ctrl+I)"
            >
              <Italic size={13} />
            </button>

            {/* Underline */}
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); executeCmd('underline'); }}
              className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-black cursor-pointer"
              title="Underline (Ctrl+U)"
            >
              <Underline size={13} />
            </button>

            {/* Strikethrough */}
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); executeCmd('strikeThrough'); }}
              className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-black cursor-pointer"
              title="Strikethrough"
            >
              <Strikethrough size={13} />
            </button>

            <div className="h-3.5 w-px bg-slate-300 dark:bg-slate-700 mx-0.5" />

            {/* Bullet List */}
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); executeCmd('insertUnorderedList'); }}
              className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-black cursor-pointer"
              title="Bullet List"
            >
              <List size={13} />
            </button>

            {/* Numbered List */}
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); executeCmd('insertOrderedList'); }}
              className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-black cursor-pointer"
              title="Numbered List"
            >
              <ListOrdered size={13} />
            </button>

            <div className="h-3.5 w-px bg-slate-300 dark:bg-slate-700 mx-0.5" />

            {/* Align Left */}
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); executeCmd('justifyLeft'); }}
              className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-black cursor-pointer"
              title="Align Left"
            >
              <AlignLeft size={13} />
            </button>

            {/* Align Center */}
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); executeCmd('justifyCenter'); }}
              className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-black cursor-pointer"
              title="Align Center"
            >
              <AlignCenter size={13} />
            </button>

            {/* Align Right */}
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); executeCmd('justifyRight'); }}
              className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-black cursor-pointer"
              title="Align Right"
            >
              <AlignRight size={13} />
            </button>

            <div className="h-3.5 w-px bg-slate-300 dark:bg-slate-700 mx-0.5" />

            {/* Heading Format */}
            <select
              onChange={(e) => {
                executeCmd('formatBlock', e.target.value);
                e.target.value = '';
              }}
              defaultValue=""
              className="px-2 py-0.5 rounded text-[11px] font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
            >
              <option value="" disabled>Format / Heading</option>
              <option value="<p>">Normal Paragraph</option>
              <option value="<h2>">Major Heading (H2)</option>
              <option value="<h3>">Sub Heading (H3)</option>
              <option value="<blockquote>">Quote / Callout</option>
            </select>

            {/* Insert Link */}
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); handleInsertLink(); }}
              className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-black cursor-pointer ml-auto"
              title="Insert Hyperlink"
            >
              <Link2 size={13} />
            </button>

            {/* Clear Format */}
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); handleClearFormat(); }}
              className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-black cursor-pointer"
              title="Clear All Formatting"
            >
              <RemoveFormatting size={13} />
            </button>

          </div>

          {/* Editable Body Canvas with Compact Height */}
          <div
            ref={editorRef}
            contentEditable
            onInput={handleEditorInput}
            onBlur={handleEditorInput}
            className="w-full min-h-[140px] max-h-[220px] overflow-y-auto p-3 text-xs leading-relaxed text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-0"
            style={{ minHeight: '140px' }}
            data-placeholder="Type your email announcement message here..."
          />

        </div>

        {/* ======================================================================= */}
        {/* 4. COMPACT FOOTER & ACTION BAR (Single Row Two-Column Grid) */}
        {/* ======================================================================= */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center pt-0.5">
          
          {/* Left Column: Email Footer (8 cols) */}
          <div className="md:col-span-8 p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <FileText size={13} className="text-teal-600 flex-shrink-0" />
              {isCustomFooter ? (
                <input
                  type="text"
                  value={customFooter}
                  onChange={(e) => setCustomFooter(e.target.value)}
                  placeholder="Custom email signature..."
                  className="w-full px-2 py-0.5 rounded text-[11px] font-mono border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-teal-600"
                />
              ) : (
                <span className="text-[11px] italic text-slate-500 dark:text-slate-400 truncate">
                  {DEFAULT_FOOTER}
                </span>
              )}
            </div>

            <label className="flex items-center gap-1 text-[11px] font-bold text-slate-600 dark:text-slate-400 cursor-pointer select-none flex-shrink-0">
              <input
                type="checkbox"
                checked={isCustomFooter}
                onChange={(e) => setIsCustomFooter(e.target.checked)}
                className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 w-3 h-3 cursor-pointer"
              />
              <span>Edit Custom Footer</span>
            </label>
          </div>

          {/* Right Column: Actions (4 cols) */}
          <div className="md:col-span-4 flex items-center gap-2 justify-end">
            
            {/* Preview Button */}
            <button
              type="button"
              onClick={() => setShowPreviewModal(true)}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-xl font-bold text-xs text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 shadow-2xs transition-all cursor-pointer"
            >
              <Eye size={14} className="text-teal-600" />
              <span>Preview</span>
            </button>

            {/* Send Bulk Emails Primary CTA */}
            <button
              type="button"
              onClick={handleSendBulkEmail}
              disabled={sendingEmail || finalRecipients.length === 0}
              className={`inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl font-bold text-xs text-white shadow-sm transition-all cursor-pointer disabled:opacity-50 active:scale-[0.99] flex-1 ${
                testMode
                  ? 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500'
                  : 'bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500'
              }`}
            >
              {sendingEmail ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Sending...</span>
                </>
              ) : (
                <>
                  <Send size={14} />
                  <span>
                    {testMode ? 'Send Test' : `Send Bulk (${finalRecipients.length})`}
                  </span>
                </>
              )}
            </button>

          </div>

        </div>

        {/* Last Operation Audit Badge (Inline Compact) */}
        {lastDispatchLog && (
          <div className="p-1.5 px-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-center justify-between text-[11px] font-bold">
            <span className="flex items-center gap-1.5 truncate">
              <CheckCircle2 size={13} className="flex-shrink-0" />
              <span className="truncate">Last Dispatched: &ldquo;{lastDispatchLog.subject}&rdquo; to {lastDispatchLog.count} recipients at {lastDispatchLog.timestamp}</span>
            </span>
            <span className="flex-shrink-0 ml-2">{lastDispatchLog.testMode ? '(Test Mode)' : '(Live Broadcast)'}</span>
          </div>
        )}

      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: MANAGE RECIPIENTS (Micro-Selection & Exclusion) */}
      {/* ========================================================================= */}
      {showManageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-scaleUp">
            
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white uppercase tracking-tight">
                  Manage Recipient Selection
                </h3>
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Select or exclude individual students from this specific dispatch
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowManageModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Search & Bulk Action Bar */}
            <div className="p-3 sm:p-4 bg-slate-50 dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800 space-y-2.5">
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by student name, email, class, or form number..."
                  value={manageSearch}
                  onChange={(e) => setManageSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-teal-600"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setExcludedEmails(new Set())}
                    className="px-2.5 py-1 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 text-teal-700 dark:text-teal-300 font-bold text-[11px] transition-all cursor-pointer"
                  >
                    Select All ({matchedRecipients.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const all = new Set(matchedRecipients.map(r => r.id));
                      setExcludedEmails(all);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-[11px] transition-all cursor-pointer"
                  >
                    Deselect All
                  </button>

                  {/* Order / Sort Selector */}
                  <div className="flex items-center gap-1 bg-white dark:bg-slate-900 px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-2xs">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Order:</span>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="bg-transparent font-bold text-[11px] text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
                    >
                      <option value="roll_asc">Roll No: 1 → 999 (Default)</option>
                      <option value="roll_desc">Roll No: 999 → 1</option>
                      <option value="name_asc">Name: A → Z</option>
                      <option value="name_desc">Name: Z → A</option>
                      <option value="form_asc">Form No: Low → High</option>
                      <option value="stream">Stream / Faculty</option>
                    </select>
                  </div>
                </div>

                <div className="text-[11px] font-bold text-slate-500">
                  Selected: <span className="text-teal-600 dark:text-teal-400 font-extrabold">{finalRecipients.length}</span> / {matchedRecipients.length}
                </div>
              </div>
            </div>

            {/* Recipient List */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-1.5">
              {matchedRecipients
                .filter(r => {
                  if (!manageSearch.trim()) return true;
                  const query = manageSearch.toLowerCase();
                  return (
                    r.name.toLowerCase().includes(query) ||
                    (r.fatherName && r.fatherName.toLowerCase().includes(query)) ||
                    r.email.toLowerCase().includes(query) ||
                    r.class.toLowerCase().includes(query) ||
                    (r.stream && r.stream.toLowerCase().includes(query)) ||
                    r.formNo.toLowerCase().includes(query) ||
                    r.rollNo.toLowerCase().includes(query)
                  );
                })
                .map((student) => {
                  const isChecked = !excludedEmails.has(student.id) && !excludedEmails.has(student.email);
                  return (
                    <label
                      key={student.id}
                      className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-all ${
                        isChecked 
                          ? 'bg-teal-500/5 border-teal-500/30' 
                          : 'bg-slate-50/50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            const next = new Set(excludedEmails);
                            if (e.target.checked) {
                              next.delete(student.id);
                              next.delete(student.email);
                            } else {
                              next.add(student.id);
                            }
                            setExcludedEmails(next);
                          }}
                          className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 w-4 h-4 cursor-pointer flex-shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-extrabold text-xs text-slate-900 dark:text-white truncate">
                              {student.name}
                            </span>
                            {student.fatherName && (
                              <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium truncate">
                                (S/O {student.fatherName})
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate">
                            {student.email}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0 text-[10.5px]">
                        {student.rollNo ? (
                          <span className="px-2 py-0.5 rounded-md font-extrabold bg-teal-500/15 text-teal-700 dark:text-teal-300 border border-teal-500/30 shadow-2xs">
                            Roll: {student.rollNo}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md font-bold bg-slate-100 dark:bg-slate-800 text-slate-400">
                            No Roll
                          </span>
                        )}
                        {student.stream && student.stream !== 'General' && (
                          <span className="px-2 py-0.5 rounded-md font-bold bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20">
                            {student.stream}
                          </span>
                        )}
                        {student.class && (
                          <span className="px-2 py-0.5 rounded-md font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {student.class}
                          </span>
                        )}
                        {student.status && (
                          <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                            student.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-600' :
                            student.status === 'Submitted' ? 'bg-teal-500/10 text-teal-600' :
                            student.status === 'Draft' ? 'bg-amber-500/10 text-amber-600' :
                            'bg-slate-100 dark:bg-slate-800 text-slate-600'
                          }`}>
                            {student.status}
                          </span>
                        )}
                        {student.formNo && (
                          <span className="px-2 py-0.5 rounded-md font-bold font-mono bg-slate-100 dark:bg-slate-800 text-slate-500">
                            #{student.formNo}
                          </span>
                        )}
                      </div>
                    </label>
                  );
                })}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setShowManageModal(false)}
                className="px-5 py-2 rounded-xl font-bold text-xs text-white bg-teal-600 hover:bg-teal-500 shadow-sm cursor-pointer"
              >
                Apply Selection ({finalRecipients.length} Included)
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: LIVE EMAIL PREVIEW MODAL */}
      {/* ========================================================================= */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-scaleUp">
            
            {/* Modal Top Bar */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye size={16} className="text-teal-600" />
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-tight">
                  Email Message Preview
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Mock Email Client Container */}
            <div className="p-4 sm:p-6 bg-slate-100 dark:bg-slate-950 overflow-y-auto flex-1">
              
              {/* Mock Header Info */}
              <div className="bg-white dark:bg-slate-900 rounded-xl p-3.5 border border-slate-200 dark:border-slate-800 shadow-xs mb-4 space-y-1 text-xs">
                <div>
                  <span className="font-bold text-slate-400">From: </span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    Govt HSS Shangus &lt;adm.exam.hss.shangus@gmail.com&gt;
                  </span>
                </div>
                <div>
                  <span className="font-bold text-slate-400">To: </span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {testMode ? `Administrator <${adminEmail}>` : `[Target Audience: ${finalRecipients.length} Students]`}
                  </span>
                </div>
                <div>
                  <span className="font-bold text-slate-400">Subject: </span>
                  <span className="font-extrabold text-slate-900 dark:text-white">
                    {emailSubject || '(No Subject Line Entered)'}
                  </span>
                </div>
              </div>

              {/* Realistic Email Frame */}
              <div className="max-w-lg mx-auto bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-md overflow-hidden text-slate-800 dark:text-slate-200">
                
                {/* School Banner */}
                <div className="bg-gradient-to-r from-teal-800 to-teal-600 p-4 text-center text-white">
                  <h1 className="font-extrabold text-sm uppercase tracking-wide">
                    Govt. Higher Secondary School Shangus
                  </h1>
                  <p className="text-[11px] text-teal-100 font-medium mt-0.5">
                    Official Student &amp; Examination Announcement
                  </p>
                </div>

                {/* Formatted Message Body */}
                <div className="p-5 space-y-3 text-xs sm:text-sm leading-relaxed">
                  <p className="font-semibold text-slate-500 dark:text-slate-400 text-xs">
                    Dear Student,
                  </p>

                  <div 
                    className="prose prose-sm dark:prose-invert max-w-none"
                    dangerouslySetInnerHTML={{ 
                      __html: sanitizeRichHtml(emailBodyHtml || '<p>No message content entered yet...</p>')
                    }} 
                  />
                </div>

                {/* Footer Signature */}
                <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 text-center text-[11px] text-slate-500 whitespace-pre-line leading-relaxed font-medium">
                  {isCustomFooter ? customFooter : DEFAULT_FOOTER}
                </div>

              </div>

            </div>

            {/* Modal Bottom Controls */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                className="px-4 py-2 rounded-xl font-bold text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Back to Editing
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowPreviewModal(false);
                  handleSendBulkEmail();
                }}
                disabled={sendingEmail || finalRecipients.length === 0}
                className="px-5 py-2 rounded-xl font-bold text-xs text-white bg-teal-600 hover:bg-teal-500 shadow-md cursor-pointer flex items-center gap-1.5"
              >
                <Send size={14} />
                <span>Confirm &amp; Dispatch ({finalRecipients.length})</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
