import React, { useState, useEffect, useCallback } from 'react';
import { 
  Settings, ClipboardCheck, Printer, Save, RefreshCw, CheckCircle2, AlertCircle,
  Layers, Plus, Award, FileSpreadsheet, AlertTriangle, X, Sliders, Users, Mail,
  ChevronDown, ChevronRight
} from 'lucide-react';
import { db, functions } from '../../services/firebase';
import { collection, getDocs, doc, getDoc, setDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import ModernLoader from '../../components/ModernLoader';
import { getCachedCollection } from '../../services/dbCache';

const CODES = ['BO', 'CH', 'EC', 'ED', 'ES', 'EN', 'HTC', 'HT', 'ITE', 'MA', 'PD', 'PH', 'PS', 'UR', 'ZO'];
const NAMES = { 
  BO: 'Botany', 
  CH: 'Chemistry', 
  EC: 'Economics', 
  ED: 'Education', 
  ES: 'Environmental Science', 
  EN: 'General English', 
  HTC: 'Healthcare', 
  HT: 'History', 
  ITE: 'IT and ITES', 
  MA: 'Mathematics', 
  PD: 'Physical Education', 
  PH: 'Physics', 
  PS: 'Political Science', 
  UR: 'Urdu', 
  ZO: 'Zoology',
  BI: 'Biology (Botany & Zoology)'
};
const mx11 = { PH: 10, CH: 10, BO: 10, ZO: 10, BI: 20, PD: 10, ES: 10, HTC: 14, ITE: 14 };
const mx12 = { PH: 30, CH: 30, BO: 15, ZO: 15, BI: 30, PD: 30, ES: 30, HTC: 40, ITE: 40 };

const PRINT_CSS = `
  @media print {
    body * { visibility: hidden; }
    #print-root, #print-root * { visibility: visible; }
    #print-root { position: absolute; left: 0; top: 0; width: 100%; padding: 0 !important; margin: 0 !important; }
    .page-break { page-break-after: always; clear: both; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13pt; }
    th, td { border: 1px solid #000; padding: 6px; text-align: center; }
    th { font-weight: bold; background-color: #f0f0f0 !important; -webkit-print-color-adjust: exact; }
    .t-left { text-align: left; }
    h2, h3, h4, p { margin: 4px 0; text-align: center; color: #000; }
    .header-block { margin-bottom: 20px; text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; }
    .sig-box { margin-top: 40px; display: flex; justify-content: space-between; }
    .sig-line { border-top: 1px solid #000; width: 200px; text-align: center; padding-top: 5px; font-weight: bold; }
    .empty-cell { height: 25px; }
  }
`;

export default function AdminPracticals() {
  const [tab, setTab] = useState('class11_status');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alertMsg, setAlertMsg] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [selSub, setSelSub] = useState(null);
  const [stModal, setStModal] = useState(null);
  const [printOpts, setPrintOpts] = useState(null);
  const [settings, setSettings] = useState({ permissions: [], statusControls: {} });
  const [grantEmail, setGrantEmail] = useState('');
  const [grantClass, setGrantClass] = useState('11th');
  const [grantSubject, setGrantSubject] = useState('Physics');
  const [emailSt, setEmailSt] = useState({});
  const [expSub, setExpSub] = useState(null);

  const showAlert = (type, text) => { setAlertMsg({ type, text }); setTimeout(() => setAlertMsg(null), 3000); };
  const isClassMatch = (stc, trc) => String(stc).includes(trc.replace('th', ''));

  const loadData = useCallback(async (force = false) => {
    setLoading(true);
    try {
      const sd = await getDoc(doc(db, 'adminPracticalsSettings', 'config'));
      if (sd.exists()) setSettings(p => ({ ...p, ...sd.data() }));
      
      // Implement caching for students to reduce reads
      const raw = await getCachedCollection('admissions', force);
      setStudents(raw || []);

      const ss = await getDocs(collection(db, 'practicalsData'));
      const parsedSubmissions = ss.docs.map(d => {
        const data = d.data();
        let parsedRecords = data.records || [];
        
        // Legacy data normalizer
        if (!data.records) {
          Object.keys(data).forEach(k => {
            const match = k.match(/^\d+\/(\d+)\.\s(.+?)(?:\s\((.+)\))?$/);
            if (match) {
              parsedRecords.push({
                rollNo: match[1],
                name: match[2].trim(),
                parentName: match[3] ? match[3].trim() : '',
                practicalMarks: data[k],
                totalMarks: data[k]
              });
            }
          });
        }
        return { id: d.id, ...data, records: parsedRecords };
      });
      setSubmissions(parsedSubmissions);

      const ts = await getDocs(collection(db, 'users'));
      setTeachers(ts.docs.map(d => ({ id: d.id, ...d.data() })).filter(u => u.role === 'teacher' || u.role === 'faculty' || u.email));
      
      const lp = localStorage.getItem('adminPrintPrefs');
      if (lp) setPrintOpts(JSON.parse(lp));
    } catch (e) { 
      console.error(e); 
      showAlert('error', 'Failed to load data.'); 
    } finally { 
      setLoading(false); 
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const saveSection = async name => {
    setSaving(true);
    try { await setDoc(doc(db, 'adminPracticalsSettings', 'config'), settings, { merge: true }); showAlert('success', name + ' saved.'); }
    catch (e) { showAlert('error', 'Failed to save ' + name); } finally { setSaving(false); }
  };

  const toggleStatus = async (cls, type) => {
    const k = cls + '_' + type, v = !settings.statusControls?.[k];
    const upd = { ...settings, statusControls: { ...settings.statusControls, [k]: v } };
    setSettings(upd);
    try {
      await setDoc(doc(db, 'adminPracticalsSettings', 'config'), { statusControls: upd.statusControls }, { merge: true });
      showAlert('success', 'Class ' + cls + ' ' + type + ' submissions ' + (v ? 'enabled' : 'disabled') + '.');
    } catch (e) { showAlert('error', 'Failed to update status.'); }
  };

  const grantPerm = async e => {
    e.preventDefault();
    if (!grantEmail.trim()) { showAlert('error', 'Email required.'); return; }
    const np = { email: grantEmail.trim().toLowerCase(), className: grantClass, subject: grantSubject, grantedAt: new Date().toLocaleDateString() };
    const upd = [...(settings.permissions || []), np];
    setSettings(s => ({ ...s, permissions: upd }));
    await setDoc(doc(db, 'adminPracticalsSettings', 'config'), { permissions: upd }, { merge: true });
    setGrantEmail(''); showAlert('success', 'Permission granted.');
  };

  const revokePerm = async i => {
    const upd = [...(settings.permissions || [])]; upd.splice(i, 1);
    setSettings(s => ({ ...s, permissions: upd }));
    await setDoc(doc(db, 'adminPracticalsSettings', 'config'), { permissions: upd }, { merge: true });
    showAlert('success', 'Permission revoked.');
  };

  const noPrac = cls => ((cls === '11th' ? settings.nonPractical11 : settings.nonPractical12) || '').split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
  const getVis = cls => CODES.filter(c => !noPrac(cls).includes(c));
  const getPD = cls => settings.printDetails?.[cls] || {};

  const computeStatus = cls => {
    const curSessSuffix = settings.currentYearSuffix || '26';

    // 1. Filter students strictly for current session & active (non-rejected) status
    const cSts = students.filter(st => {
      const classMatch = isClassMatch(st.class || st.className || st.admittedClass || st['Admission sought for class'], cls);
      if (!classMatch) return false;

      const stStatus = String(st.Status || st.status || st['Lock Status'] || '').toLowerCase();
      if (stStatus.includes('reject') || stStatus.includes('cancel') || stStatus.includes('withdraw')) return false;

      const sess = String(st.Session || st.session || st.sessionYear || st.yearSuffix || '').trim();
      if (sess) {
        const matchesSession = sess.includes(curSessSuffix) ||
                               sess.includes('2025-26') ||
                               sess.includes('2026') ||
                               sess.includes('2025') ||
                               sess.includes('25-26') ||
                               sess.includes('26-27');
        if (!matchesSession) return false;
      }
      return true;
    });

    const total = cSts.length || 0;
    const np = noPrac(cls);
    const absMk = settings.absentMarker || 'A';

    let totSubs = 0, compSubs = 0, pendTotal = 0, evalTotal = 0, absTotal = 0;
    
    const rows = CODES.map(code => {
      const isPrac = !np.includes(code);
      if (isPrac) totSubs++;

      // Match submissions for this subject, including Botany (BO) / Zoology (ZO) / Biology (BI) splits
      const sd = submissions.find(s => {
        const matchClass = isClassMatch(s.className || s.Class, cls);
        if (!matchClass) return false;

        const subjStr = String(s.subjectCode || s.subject || s.Subject || '').toUpperCase();
        const teacherSubj = String(s.teacherSubject || '').toUpperCase();

        if (code === 'BO') {
          return subjStr.includes('BO') || subjStr.includes('BOTANY') || subjStr.includes('BI') || subjStr.includes('BIOLOGY') || teacherSubj.includes('BOTANY');
        }
        if (code === 'ZO') {
          return subjStr.includes('ZO') || subjStr.includes('ZOOLOGY') || subjStr.includes('BI') || subjStr.includes('BIOLOGY') || teacherSubj.includes('ZOOLOGY');
        }
        return subjStr.includes(code) || String(s.subject || s.Subject || '').toUpperCase().includes((NAMES[code] || '').toUpperCase());
      });

      const recs = sd?.records || [];
      const isSubmitted = !!sd && recs.length > 0;

      const compRecs = recs.filter(r => { const v = String(r.totalMarks ?? r.practicalMarks ?? '').trim().toUpperCase(); return v !== '' && v !== '0' && v !== 'N/A' && v !== absMk && v !== 'AB'; });
      const absRecs = recs.filter(r => { const v = String(r.totalMarks ?? r.practicalMarks ?? '').trim().toUpperCase(); return v === absMk || v === 'AB'; });
      
      const cCount = compRecs.length;
      const aCount = absRecs.length;
      
      // Calculate pending only when submitted or active to avoid artificial multiplication
      const pend = isSubmitted ? Math.max(0, total - cCount - aCount) : (isPrac ? (total > 0 ? total : 0) : 0);
      
      if (isPrac && isSubmitted && pend === 0) compSubs++;
      
      evalTotal += cCount;
      absTotal += aCount;
      if (isSubmitted) pendTotal += pend;

      return {
        subjectCode: code,
        subjectName: NAMES[code],
        isPractical: isPrac,
        teacher: sd?.teacherName || sd?.['Teacher Name'] || '-',
        teacherEmail: sd?.teacherEmail || sd?.Email,
        isSubmitted,
        completed: cCount,
        absent: aCount,
        pending: pend,
        completedStudents: compRecs,
        absentStudents: absRecs,
        emailSentAt: sd?.emailSentAt || null,
        data: sd
      };
    }).filter(r => r && r.isPractical);

    return { 
      rows, 
      totalStudents: total, 
      progress: Math.round((compSubs / (totSubs || 1)) * 100), 
      completed: compSubs, 
      total: rows.length,
      aggregate: { evalTotal, absTotal, pendTotal }
    };
  };

  const sendEmail = async (row, cls) => {
    if (!row.teacherEmail) {
      showAlert('error', 'No email address found for this teacher.');
      return;
    }
    const k = cls + '_' + row.subjectCode;
    setEmailSt(p => ({ ...p, [k]: 'sending' }));
    try {
      const sendPracticalsEmail = httpsCallable(functions, 'sendPracticalsEmail');
      const htmlBody = `<div style="font-family:sans-serif;color:#333;">
        <h2 style="color:#4f46e5;">HSS Shangus Assessment Portal</h2>
        <p>Dear <b>${row.teacher}</b>,</p>
        <p>This is a summary of your recent assessment submission for <b>${row.subjectName} (Class ${cls})</b>.</p>
        <table style="border-collapse:collapse;width:100%;max-width:400px;margin:20px 0;">
          <tr><td style="border:1px solid #ccc;padding:8px;">Total Students</td><td style="border:1px solid #ccc;padding:8px;font-weight:bold;">${row.completed + row.absent + row.pending}</td></tr>
          <tr><td style="border:1px solid #ccc;padding:8px;">Evaluated</td><td style="border:1px solid #ccc;padding:8px;font-weight:bold;color:green;">${row.completed}</td></tr>
          <tr><td style="border:1px solid #ccc;padding:8px;">Absent</td><td style="border:1px solid #ccc;padding:8px;font-weight:bold;color:orange;">${row.absent}</td></tr>
          <tr><td style="border:1px solid #ccc;padding:8px;">Pending</td><td style="border:1px solid #ccc;padding:8px;font-weight:bold;color:red;">${row.pending}</td></tr>
        </table>
        <p>Thank you for submitting on time.</p>
        <p style="font-size:12px;color:#666;margin-top:30px;">— Adms & Exams Team, HSS Shangus</p>
      </div>`;
      
      await sendPracticalsEmail({
        to: row.teacherEmail,
        subject: `Assessment Submission Report: ${row.subjectName} (${cls})`,
        htmlBody,
        plainTextBody: `Subject: ${row.subjectName}\nClass: ${cls}\nEvaluated: ${row.completed}\nAbsent: ${row.absent}\nPending: ${row.pending}\n\nThank you for submitting.`
      });
      
      setEmailSt(p => ({ ...p, [k]: 'sent' }));
      showAlert('success', 'Email sent to ' + row.teacher + '.');
    } catch (e) {
      console.error('Email send failed:', e);
      setEmailSt(p => ({ ...p, [k]: '' }));
      showAlert('error', 'Failed to send email. Check logs.');
    }
  };

  const doPrint = (contentHTML) => {
    const pwin = window.open('', '_blank');
    pwin.document.write(`<html><head><title>Print Report</title><style>${PRINT_CSS}</style></head><body><div id="print-root">${contentHTML}</div><script>window.onload=function(){window.print();window.close();}</script></body></html>`);
    pwin.document.close();
  };

  const printAwards = (sd, cls, maxMks, pDetails, isExt) => {
    if (!sd || !sd.records || !sd.records.length) return showAlert('error', 'No data to print.');
    const dts = getPD(cls);
    const yr = settings.currentYearSuffix || new Date().getFullYear().toString().slice(-2);
    const sn = dts.sessionText || 'Annual Regular ' + (2000 + parseInt(yr));
    
    let html = '';
    const chunk = 35;
    for (let i = 0; i < sd.records.length; i += chunk) {
      const page = sd.records.slice(i, i + chunk);
      html += `<div class="page-break"><div class="header-block">
        <h2 style="text-transform:uppercase;">${dts.instName || 'Govt. Higher Secondary School'}</h2>
        <h3>${isExt ? 'EXTERNAL' : 'INTERNAL'} PRACTICAL AWARDS (${sn})</h3>
        <p><b>Class:</b> ${cls} &nbsp;&nbsp;&nbsp; <b>Subject:</b> ${sd.subjectName || sd.Subject}</p>
        <p><b>Max Marks:</b> ${maxMks} &nbsp;&nbsp;&nbsp; <b>Min Pass:</b> ${Math.ceil(maxMks * 0.33)}</p>
      </div><table><thead><tr><th>S.No</th><th class="t-left">Roll No</th><th class="t-left">Student Name</th><th>Marks Obtained</th></tr></thead><tbody>`;
      page.forEach((r, idx) => {
        const absMk = settings.absentMarker || 'A';
        const v = String(r.totalMarks ?? r.practicalMarks ?? '');
        const isAbs = v.toUpperCase() === absMk || v.toUpperCase() === 'AB';
        html += `<tr><td>${i + idx + 1}</td><td class="t-left">${r.rollNo}</td><td class="t-left">${r.name}</td><td>${isAbs ? absMk : v}</td></tr>`;
      });
      html += `</tbody></table><div class="sig-box">
        <div class="sig-line">Internal Examiner<br><span style="font-size:10pt;font-weight:normal">${sd.teacherName || sd['Teacher Name'] || '________________'}</span></div>
        <div class="sig-line">External Examiner<br><span style="font-size:10pt;font-weight:normal">________________</span></div>
        <div class="sig-line">Principal / Chief Secrecy<br><span style="font-size:10pt;font-weight:normal">${dts.inchargeName || '________________'}</span></div>
      </div></div>`;
    }
    doPrint(html);
  };

  if (loading) return <ModernLoader text="Loading Administrative Portal" subtext="Fetching controls, evaluation status, and award lists..." />;

  const Tb = ({ id, label, icon, onClick }) => (
    <button onClick={onClick} className={'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ' + (tab === id ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700')}>
      {icon}<span>{label}</span>
    </button>
  );

  const StatusDashboard = ({ cls }) => {
    const sts = computeStatus(cls);
    return (
      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-center justify-between">
            <div><p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Total Subjects</p><h3 className="text-2xl font-black text-indigo-600">{sts.total}</h3></div>
            <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl text-indigo-600"><Layers size={20} /></div>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-center justify-between">
            <div><p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Completed Lists</p><h3 className="text-2xl font-black text-emerald-600">{sts.completed}</h3></div>
            <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl text-emerald-600"><CheckCircle2 size={20} /></div>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-center justify-between">
            <div><p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Records Evaluated</p><h3 className="text-2xl font-black text-blue-600">{sts.aggregate.evalTotal}</h3></div>
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-blue-600"><Users size={20} /></div>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-center justify-between">
            <div><p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Pending Students</p><h3 className="text-2xl font-black text-rose-600">{sts.aggregate.pendTotal}</h3></div>
            <div className="p-3 bg-rose-50 dark:bg-rose-900/20 rounded-xl text-rose-600"><AlertCircle size={20} /></div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900">
            <h3 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2">
              <ClipboardCheck size={16} className="text-indigo-500" /> Subject-wise Progress
            </h3>
            <span className="px-2.5 py-1 bg-slate-200 dark:bg-slate-800 rounded-full text-[10px] font-bold text-slate-600 dark:text-slate-400">Class {cls}</span>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
            {sts.rows.map(row => (
              <div key={row.subjectCode} className="group flex flex-col sm:flex-row sm:items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-950/50 transition-colors gap-4">
                <div className="flex-1 flex items-start gap-3">
                  <div className={'w-2 h-2 mt-1.5 rounded-full shrink-0 ' + (row.isSubmitted ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse')} />
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">{row.subjectName}</h4>
                    <p className="text-[10.5px] font-semibold text-slate-500 mt-0.5">Faculty: <span className="text-indigo-600 dark:text-indigo-400 font-bold">{row.teacher}</span></p>
                  </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-4 text-[11px] font-black">
                  <div className="flex flex-col items-center">
                    <span className="text-slate-400 text-[9px] uppercase">Evaluated</span>
                    <span className="text-emerald-600">{row.completed}</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-slate-400 text-[9px] uppercase">Absent</span>
                    <span className="text-amber-500">{row.absent}</span>
                  </div>
                  <div className="flex flex-col items-center pr-4 border-r border-slate-200 dark:border-slate-800">
                    <span className="text-slate-400 text-[9px] uppercase">Pending</span>
                    <span className="text-rose-500">{row.pending}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {row.isSubmitted && row.teacherEmail && (
                      <button 
                        onClick={() => sendEmail(row, cls)} 
                        disabled={emailSt[cls + '_' + row.subjectCode] === 'sending'}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-indigo-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-indigo-600 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <Mail size={12} /> {emailSt[cls + '_' + row.subjectCode] === 'sent' ? 'Sent' : 'Email Rep'}
                      </button>
                    )}
                    
                    {row.isSubmitted ? (
                      <div className="relative">
                        <button 
                          onClick={() => setExpSub(expSub === row.subjectCode ? null : row.subjectCode)}
                          className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm shadow-indigo-200 dark:shadow-none"
                        >
                          <Printer size={12} /> Actions <ChevronDown size={12} className={'transition-transform ' + (expSub === row.subjectCode ? 'rotate-180' : '')}/>
                        </button>
                        {expSub === row.subjectCode && (
                          <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl p-1.5 z-20 flex flex-col gap-1">
                            <button onClick={() => { setExpSub(null); setSelSub(row.data); }} className="w-full text-left px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer">View Data Grid</button>
                            <button onClick={() => { setExpSub(null); printAwards(row.data, cls, cls==='11th'?mx11[row.subjectCode]:mx12[row.subjectCode], getPD(cls), false); }} className="w-full text-left px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer">Print Awards (Int)</button>
                            <button onClick={() => { setExpSub(null); printAwards(row.data, cls, cls==='11th'?mx11[row.subjectCode]:mx12[row.subjectCode], getPD(cls), true); }} className="w-full text-left px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer">Print Awards (Ext)</button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-[10px] text-slate-400 font-bold px-3 py-1.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">No Data</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-6 lg:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
              <Sliders size={24} strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Practicals Portal Admin</h1>
              <p className="text-xs font-bold text-slate-500 mt-0.5">Manage evaluations, prints, and security.</p>
            </div>
          </div>
          <button onClick={() => loadData(true)} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-black transition-colors flex items-center gap-2 cursor-pointer">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Sync Data
          </button>
        </div>

        {alertMsg && (
          <div className={'p-4 rounded-2xl text-sm font-bold flex items-center gap-3 shadow-sm ' + (alertMsg.type === 'error' ? 'bg-rose-50 text-rose-700 border border-rose-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100')}>
            {alertMsg.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />} {alertMsg.text}
          </div>
        )}

        {/* Tabs */}
        <div className="flex flex-wrap items-center gap-2 p-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-x-auto shadow-sm">
          <Tb id="class11_status" label="11th Status" icon={<ClipboardCheck size={14}/>} onClick={() => setTab('class11_status')} />
          <Tb id="class12_status" label="12th Status" icon={<ClipboardCheck size={14}/>} onClick={() => setTab('class12_status')} />
          <Tb id="settings" label="Settings & Rules" icon={<Settings size={14}/>} onClick={() => setTab('settings')} />
        </div>

        {/* Content Area */}
        <div className="min-h-[500px]">
          {tab === 'class11_status' && <StatusDashboard cls="11th" />}
          {tab === 'class12_status' && <StatusDashboard cls="12th" />}
          
          {tab === 'settings' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-500">
              <div className="space-y-6">
                {/* Global Settings */}
                <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
                  <h3 className="font-black text-sm text-slate-900 dark:text-white mb-4 flex items-center gap-2"><Settings size={16} className="text-indigo-500"/> Portal Configuration</h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Session Suffix (e.g. 26)</label>
                        <input type="text" value={settings.currentYearSuffix || ''} onChange={e => setSettings({...settings, currentYearSuffix: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none" />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Practical Type</label>
                        <select value={settings.currentPracticalType || 'internal'} onChange={e => setSettings({...settings, currentPracticalType: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none">
                          <option value="internal">Internal</option>
                          <option value="external">External</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Global Absent Marker (e.g. AB)</label>
                      <input type="text" value={settings.absentMarker || 'AB'} onChange={e => setSettings({...settings, absentMarker: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Class 11th Non-Practical (Comma Separated)</label>
                      <input type="text" value={settings.nonPractical11 || ''} onChange={e => setSettings({...settings, nonPractical11: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Class 12th Non-Practical (Comma Separated)</label>
                      <input type="text" value={settings.nonPractical12 || ''} onChange={e => setSettings({...settings, nonPractical12: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none" />
                    </div>
                    <button onClick={() => saveSection('Global Configuration')} disabled={saving} className="px-4 py-2.5 w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs rounded-xl cursor-pointer flex items-center justify-center gap-2"><Save size={14} /> Save Configuration</button>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                {/* Print Configuration */}
                <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
                  <h3 className="font-black text-sm text-slate-900 dark:text-white mb-4 flex items-center gap-2"><Printer size={16} className="text-emerald-500"/> Print Document Settings</h3>
                  {['11th', '12th'].map(c => (
                    <div key={c} className="mb-4 last:mb-0 p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800">
                      <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 mb-3">{c} Class Headers</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input type="text" placeholder="Institution Name" value={settings.printDetails?.[c]?.instName || ''} onChange={e => setSettings(s => ({ ...s, printDetails: { ...s.printDetails, [c]: { ...s.printDetails?.[c], instName: e.target.value } } }))} className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold" />
                        <input type="text" placeholder="Session Text (e.g. Annual Regular 2025)" value={settings.printDetails?.[c]?.sessionText || ''} onChange={e => setSettings(s => ({ ...s, printDetails: { ...s.printDetails, [c]: { ...s.printDetails?.[c], sessionText: e.target.value } } }))} className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold" />
                        <input type="text" placeholder="Principal Name" value={settings.printDetails?.[c]?.inchargeName || ''} onChange={e => setSettings(s => ({ ...s, printDetails: { ...s.printDetails, [c]: { ...s.printDetails?.[c], inchargeName: e.target.value } } }))} className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold" />
                      </div>
                    </div>
                  ))}
                  <button onClick={() => saveSection('Print Settings')} disabled={saving} className="px-4 py-2.5 w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl cursor-pointer flex items-center justify-center gap-2 mt-4"><Save size={14} /> Save Print Defaults</button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Selected Subject DataGrid Modal */}
        {selSub && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">
              <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white">{selSub.className || selSub.Class} - {selSub.subjectName || selSub.Subject}</h3>
                  <p className="text-xs font-bold text-slate-500 mt-1">Submitted by: <span className="text-indigo-600">{selSub.teacherName || selSub['Teacher Name']}</span> • {selSub.records?.length || 0} Records</p>
                </div>
                <button onClick={() => setSelSub(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer text-slate-400 hover:text-slate-600">
                  <X size={20} />
                </button>
              </div>
              <div className="flex-1 overflow-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-100 dark:bg-slate-900 text-[10px] uppercase font-black tracking-wider text-slate-500 sticky top-0 shadow-sm">
                    <tr>
                      <th className="py-3 px-4">Roll No</th>
                      <th className="py-3 px-4">Student Name</th>
                      <th className="py-3 px-4 text-center">Marks Obt. (Prac/Assignment&Viva)</th>
                      <th className="py-3 px-4 text-right">Total Marks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-semibold bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300">
                    {(selSub.records || []).map((r, i) => {
                      const v = String(r.totalMarks ?? r.practicalMarks ?? '').toUpperCase();
                      const isAbs = v === (settings.absentMarker || 'A') || v === 'AB';
                      return (
                        <tr key={i} className={'hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ' + (isAbs ? 'bg-rose-50/50 dark:bg-rose-950/20' : '')}>
                          <td className="py-2.5 px-4 font-mono font-bold text-indigo-600 dark:text-indigo-400">{r.rollNo || '-'}</td>
                          <td className="py-2.5 px-4">{r.name || '-'}</td>
                          <td className="py-2.5 px-4 text-center">{r.practicalMarks ?? '-'}</td>
                          <td className={'py-2.5 px-4 text-right font-black ' + (isAbs ? 'text-rose-600' : 'text-emerald-600')}>{r.totalMarks ?? r.practicalMarks ?? '-'}</td>
                        </tr>
                      );
                    })}
                    {!(selSub.records?.length) && (
                      <tr><td colSpan={4} className="p-8 text-center text-slate-400 font-bold">No records found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
