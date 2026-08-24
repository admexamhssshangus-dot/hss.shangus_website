import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Mail, Send, RefreshCw, AlertCircle, 
  CheckCircle2, Users, SlidersHorizontal, Eye, X, Search, 
  Bold, Italic, Underline, Strikethrough, 
  List, ListOrdered, AlignLeft, AlignCenter, AlignRight, Link2, 
  RemoveFormatting, ShieldAlert, FileText, Filter
} from 'lucide-react';
import appsScriptApi from '../../services/appsScriptApi';
import { getCachedCollectionSync, subscribeToCollection, getCachedCollection } from '../../services/dbCache';

const DEFAULT_FOOTER = 'Best regards,\nAdmission & Examination Cell\nGovt. Higher Secondary School Shangus';

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

// Normalize admission status
function normalizeStatus(raw) {
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
    
    const seenEmails = new Set();
    const list = [];

    for (const app of rawList) {
      const email = extractStudentEmail(app);
      if (!email || seenEmails.has(email)) continue;
      seenEmails.add(email);

      const name = String(
        app["Student's Name (as per school records)"] || 
        app["Student's Name"] || 
        app.name || 
        app.studentName || 
        'Student'
      ).trim();

      const rawCls = app["Admission sought for class"] || app.class || app.Class || app.className || '';
      const cls = normalizeClass(rawCls);

      const rawSession = app['Academic Session'] || app.Session || app.session || '2025-26';
      const session = String(rawSession).trim();

      const rawStatus = app.Status || app.status || 'Submitted';
      const status = normalizeStatus(rawStatus);

      const formNo = String(app['Form Number'] || app.formNo || app.FormNo || app.id || '').trim();
      const rollNo = String(app['Class Roll No.'] || app.classRollNo || app.rollNo || '').trim();

      list.push({
        email,
        name,
        class: cls,
        session,
        status,
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

  // Filtered pool matching toolbar dropdowns
  const matchedRecipients = useMemo(() => {
    return allParsedRecipients.filter(r => {
      // 1. Status filter
      if (targetStatus !== 'All') {
        if (r.status !== targetStatus) return false;
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
  }, [allParsedRecipients, targetStatus, targetClass, targetSession]);

  // Final selected recipients (accounting for manual exclusions)
  const finalRecipients = useMemo(() => {
    if (testMode) {
      return [{ email: adminEmail, name: 'Administrator (Test Flight)', class: 'Admin', status: 'Test' }];
    }
    return matchedRecipients.filter(r => !excludedEmails.has(r.email));
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
    <div className="space-y-5 text-xs text-slate-900 dark:text-slate-100 animate-fadeIn">
      
      {/* Alert Notification */}
      {alert && (
        <div className={`p-4 rounded-2xl font-bold flex items-start gap-3 shadow-md transition-all ${
          alert.type === 'error' 
            ? 'bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300' 
            : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
        }`}>
          {alert.type === 'error' ? <AlertCircle size={18} className="flex-shrink-0 mt-0.5" /> : <CheckCircle2 size={18} className="flex-shrink-0 mt-0.5" />}
          <div className="flex-1">
            <span className="block text-xs sm:text-sm font-extrabold">{alert.text}</span>
          </div>
          <button type="button" onClick={() => setAlert(null)} className="opacity-60 hover:opacity-100 p-1 cursor-pointer">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Full-Width Group Email Composer Card */}
      <div className="w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 sm:p-6 space-y-4">
        
        {/* Header Title Bar */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
              <Mail size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white uppercase tracking-tight">
                Group Email Composer
              </h2>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Broadcast notices, admission announcements, circulars &amp; official updates ({allParsedRecipients.length} total verified student emails in DB)
              </p>
            </div>
          </div>

          {/* Quick Status Pill */}
          {testMode ? (
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 animate-pulse">
              <ShieldAlert size={14} /> Test Flight Mode
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20">
              <Users size={14} /> Mass Broadcast Mode
            </span>
          )}
        </div>

        {/* ======================================================================= */}
        {/* 1. TOP RECIPIENT TOOLBAR (Compact Single Row Filter Suite) */}
        {/* ======================================================================= */}
        <div className="p-3 sm:p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/80 dark:bg-slate-950/60 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            
            {/* Left Side: Filter Dropdowns */}
            <div className="flex flex-wrap items-center gap-2.5">
              
              {/* To / Status Selector */}
              <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-2xs">
                <span className="text-xs font-bold text-slate-400 uppercase">To:</span>
                <select
                  value={targetStatus}
                  onChange={(e) => {
                    setTargetStatus(e.target.value);
                    setExcludedEmails(new Set());
                  }}
                  className="bg-transparent font-extrabold text-xs text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer pr-1"
                >
                  <option value="All">Every Applicant (All Statuses)</option>
                  <option value="Submitted">Submitted Applications</option>
                  <option value="Approved">Approved / Enrolled</option>
                  <option value="Draft">Draft Applications</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>

              {/* Class Filter */}
              <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-2xs">
                <span className="text-xs font-bold text-slate-400 uppercase">Class:</span>
                <select
                  value={targetClass}
                  onChange={(e) => {
                    setTargetClass(e.target.value);
                    setExcludedEmails(new Set());
                  }}
                  className="bg-transparent font-extrabold text-xs text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer pr-1"
                >
                  <option value="All">All Classes</option>
                  <option value="12th">12th Class</option>
                  <option value="11th">11th Class</option>
                  <option value="10th">10th Class</option>
                  <option value="9th">9th Class</option>
                </select>
              </div>

              {/* Session Filter */}
              <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-2xs">
                <span className="text-xs font-bold text-slate-400 uppercase">Session:</span>
                <select
                  value={targetSession}
                  onChange={(e) => {
                    setTargetSession(e.target.value);
                    setExcludedEmails(new Set());
                  }}
                  className="bg-transparent font-extrabold text-xs text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer pr-1"
                >
                  <option value="All">All Sessions</option>
                  {availableSessions.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Live Count Badge */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-500/10 text-teal-700 dark:text-teal-300 font-extrabold text-xs border border-teal-500/20 shadow-2xs">
                <Users size={14} />
                <span>
                  {testMode ? '1 Test Recipient' : `${finalRecipients.length} recipients`}
                </span>
                {excludedEmails.size > 0 && !testMode && (
                  <span className="text-[10px] text-rose-500 font-bold ml-0.5">
                    ({excludedEmails.size} excluded)
                  </span>
                )}
              </div>

              {/* Micro-Selection / Manage Button */}
              {!testMode && matchedRecipients.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowManageModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs border border-slate-200 dark:border-slate-700 shadow-2xs transition-all cursor-pointer"
                  title="Select or exclude specific individual students"
                >
                  <SlidersHorizontal size={14} className="text-teal-600 dark:text-teal-400" />
                  <span>Manage</span>
                </button>
              )}

            </div>

            {/* Right Side: Test To Admin Checkbox */}
            <div className="flex items-center gap-2 pl-2">
              <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={testMode}
                  onChange={(e) => setTestMode(e.target.checked)}
                  className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 w-4 h-4 cursor-pointer"
                />
                <span>Test to admin</span>
                <span className="text-xs text-slate-400 font-mono hidden sm:inline">
                  ({adminEmail})
                </span>
              </label>
            </div>

          </div>
        </div>

        {/* ======================================================================= */}
        {/* 2. EMAIL SUBJECT LINE */}
        {/* ======================================================================= */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 tracking-tight">
            Email Subject Line <span className="text-rose-500 font-bold">*</span>
          </label>
          <input
            type="text"
            required
            placeholder="e.g. Important Notice Regarding Class 11th Admission Verification & Document Submission"
            value={emailSubject}
            onChange={(e) => setEmailSubject(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 shadow-2xs hover:border-slate-300 dark:hover:border-slate-600 focus:outline-none focus:border-teal-600 focus:ring-3 focus:ring-teal-500/15 transition-all"
          />
        </div>

        {/* ======================================================================= */}
        {/* 3. RICH TEXT WYSIWYG TOOLBAR & CANVAS */}
        {/* ======================================================================= */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 tracking-tight">
            Email Announcement Message Body <span className="text-rose-500 font-bold">*</span>
          </label>

          <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-2xs bg-white dark:bg-slate-950">
            
            {/* Formatting Toolbar Row */}
            <div className="flex items-center gap-1.5 p-2 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 overflow-x-auto select-none">
              
              {/* Bold */}
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); executeCmd('bold'); }}
                className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-black cursor-pointer"
                title="Bold (Ctrl+B)"
              >
                <Bold size={15} />
              </button>

              {/* Italic */}
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); executeCmd('italic'); }}
                className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-black cursor-pointer"
                title="Italic (Ctrl+I)"
              >
                <Italic size={15} />
              </button>

              {/* Underline */}
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); executeCmd('underline'); }}
                className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-black cursor-pointer"
                title="Underline (Ctrl+U)"
              >
                <Underline size={15} />
              </button>

              {/* Strikethrough */}
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); executeCmd('strikeThrough'); }}
                className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-black cursor-pointer"
                title="Strikethrough"
              >
                <Strikethrough size={15} />
              </button>

              <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-1" />

              {/* Bullet List */}
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); executeCmd('insertUnorderedList'); }}
                className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-black cursor-pointer"
                title="Bullet List"
              >
                <List size={15} />
              </button>

              {/* Numbered List */}
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); executeCmd('insertOrderedList'); }}
                className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-black cursor-pointer"
                title="Numbered List"
              >
                <ListOrdered size={15} />
              </button>

              <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-1" />

              {/* Align Left */}
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); executeCmd('justifyLeft'); }}
                className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-black cursor-pointer"
                title="Align Left"
              >
                <AlignLeft size={15} />
              </button>

              {/* Align Center */}
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); executeCmd('justifyCenter'); }}
                className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-black cursor-pointer"
                title="Align Center"
              >
                <AlignCenter size={15} />
              </button>

              {/* Align Right */}
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); executeCmd('justifyRight'); }}
                className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-black cursor-pointer"
                title="Align Right"
              >
                <AlignRight size={15} />
              </button>

              <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-1" />

              {/* Heading Format */}
              <select
                onChange={(e) => {
                  executeCmd('formatBlock', e.target.value);
                  e.target.value = '';
                }}
                defaultValue=""
                className="px-2.5 py-1 rounded-md text-xs font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
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
                className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-black cursor-pointer ml-auto"
                title="Insert Hyperlink"
              >
                <Link2 size={15} />
              </button>

              {/* Clear Format */}
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); handleClearFormat(); }}
                className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-black cursor-pointer"
                title="Clear All Formatting"
              >
                <RemoveFormatting size={15} />
              </button>

            </div>

            {/* Editable Body Canvas */}
            <div
              ref={editorRef}
              contentEditable
              onInput={handleEditorInput}
              onBlur={handleEditorInput}
              className="w-full min-h-[220px] max-h-[420px] overflow-y-auto p-4 text-xs sm:text-sm leading-relaxed text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-0"
              style={{ minHeight: '220px' }}
              data-placeholder="Type your email announcement message here..."
            />

          </div>
        </div>

        {/* ======================================================================= */}
        {/* 4. EMAIL FOOTER & SIGNATURE SECTION */}
        {/* ======================================================================= */}
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 space-y-2">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
              <FileText size={15} className="text-teal-600" />
              <span>Institutional Email Signature / Footer</span>
            </span>

            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isCustomFooter}
                onChange={(e) => setIsCustomFooter(e.target.checked)}
                className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 w-3.5 h-3.5 cursor-pointer"
              />
              <span>Edit Custom Footer</span>
            </label>
          </div>

          {isCustomFooter ? (
            <textarea
              rows={2}
              value={customFooter}
              onChange={(e) => setCustomFooter(e.target.value)}
              placeholder="Enter custom sign-off footer..."
              className="w-full p-2.5 rounded-lg text-xs font-mono font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-teal-600"
            />
          ) : (
            <div className="text-xs italic font-medium text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200/60 dark:border-slate-800">
              {DEFAULT_FOOTER}
            </div>
          )}
        </div>

        {/* ======================================================================= */}
        {/* 5. BOTTOM ACTION BAR (Preview + Dispatch) */}
        {/* ======================================================================= */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          
          {/* Preview Button */}
          <button
            type="button"
            onClick={() => setShowPreviewModal(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 shadow-2xs transition-all cursor-pointer"
          >
            <Eye size={16} className="text-teal-600 dark:text-teal-400" />
            <span>Preview Email</span>
          </button>

          {/* Main Dispatch CTA Button */}
          <button
            type="button"
            onClick={handleSendBulkEmail}
            disabled={sendingEmail || finalRecipients.length === 0}
            className={`inline-flex items-center justify-center gap-2 px-7 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white shadow-md transition-all cursor-pointer disabled:opacity-50 active:scale-[0.99] ${
              testMode
                ? 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 shadow-amber-600/20'
                : 'bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 shadow-teal-700/20'
            }`}
          >
            {sendingEmail ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                <span>Dispatching {testMode ? 'Test Email' : 'Bulk Queue'}...</span>
              </>
            ) : (
              <>
                <Send size={16} />
                <span>
                  {testMode ? `Send Test Flight (${adminEmail})` : `Dispatch to ${finalRecipients.length} Students`}
                </span>
              </>
            )}
          </button>

        </div>

        {/* Last Operation Audit Badge */}
        {lastDispatchLog && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-center justify-between text-xs font-bold">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={15} />
              <span>Last Dispatched: &ldquo;{lastDispatchLog.subject}&rdquo; to {lastDispatchLog.count} recipients at {lastDispatchLog.timestamp}</span>
            </span>
            <span>{lastDispatchLog.testMode ? '(Test Mode)' : '(Live Broadcast)'}</span>
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
                <div className="flex items-center gap-2">
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
                      const all = new Set(matchedRecipients.map(r => r.email));
                      setExcludedEmails(all);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-[11px] transition-all cursor-pointer"
                  >
                    Deselect All
                  </button>
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
                    r.email.toLowerCase().includes(query) ||
                    r.class.toLowerCase().includes(query) ||
                    r.formNo.toLowerCase().includes(query)
                  );
                })
                .map((student) => {
                  const isChecked = !excludedEmails.has(student.email);
                  return (
                    <label
                      key={student.email}
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
                              next.delete(student.email);
                            } else {
                              next.add(student.email);
                            }
                            setExcludedEmails(next);
                          }}
                          className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 w-4 h-4 cursor-pointer"
                        />
                        <div className="min-w-0">
                          <div className="font-extrabold text-xs text-slate-900 dark:text-white truncate">
                            {student.name}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate">
                            {student.email}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0 text-[10.5px]">
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
                          <span className="px-2 py-0.5 rounded-md font-bold font-mono bg-indigo-500/10 text-indigo-700 dark:text-indigo-300">
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
                      __html: emailBodyHtml || '<p class="text-slate-400 italic">No message content entered yet...</p>' 
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
