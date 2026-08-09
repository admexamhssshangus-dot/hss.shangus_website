import React, { useState, useEffect, useCallback } from 'react';
import { 
  Settings, ClipboardCheck, Printer, Save, RefreshCw, CheckCircle2, AlertCircle,
  Layers, Award, AlertTriangle, X, Sliders, Users, Mail, ChevronDown, ChevronUp, ToggleLeft, ToggleRight,
  MessageCircle, Send, Activity
} from 'lucide-react';
import { db, functions } from '../../services/firebase';
import { collection, getDocs, doc, getDoc, setDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import ModernLoader from '../../components/ModernLoader';
import { getCachedCollection } from '../../services/dbCache';
import { 
  printIndividualAwardRoll, 
  printIndividualWorkSheet, 
  printConsolidatedAwardRoll, 
  printAttendanceSheet, 
  printFailList,
  PRACTICAL_SUBJECT_DEFS 
} from '../../utils/practicalsPdfGenerator';
import { syncCleanPracticalsToFirestore } from '../../utils/cleanPracticalsMigrator';
import { toTitleCase } from '../../utils/textFormatting';

const CODES = ['EN', 'PH', 'CH', 'MA', 'UR', 'ED', 'HT', 'PS', 'EC', 'ES', 'PD', 'HTC', 'ITE', 'BI', 'BO', 'ZO'];
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

const DEFAULT_MX11 = { BI: 20, BO: 5, CH: 10, EC: 20, ED: 20, EN: 20, ES: 10, HT: 20, MA: 20, PD: 15, PH: 10, PS: 20, UR: 20, ZO: 5, HTC: 50, ITE: 50 };
const DEFAULT_MX12 = { BI: 20, BO: 5, CH: 10, EC: 20, ED: 20, EN: 20, ES: 10, HT: 20, MA: 20, PD: 15, PH: 10, PS: 20, UR: 20, ZO: 5, HTC: 50, ITE: 50 };

export const isClassMatch = (stc, trc) => {
  if (!stc) return false;
  const s = String(stc).toLowerCase().trim();
  const t = String(trc || '').toLowerCase().replace('th', '').trim(); // "11" or "12"
  return (
    s.includes(t) || 
    s.includes(String(trc).toLowerCase()) || 
    (t === '11' && (s.includes('xi') || s.includes('eleven'))) || 
    (t === '12' && (s.includes('xii') || s.includes('twelve')))
  );
};

export const getRollNo = (st) => {
  if (!st) return '';
  return String(
    st['Class Roll No'] || 
    st['Class Roll No.'] || 
    st.classRollNo || 
    st['Class Roll'] || 
    st.rollNo || 
    st.roll_no || 
    st.roll || 
    st['Roll No'] || 
    st['Roll No.'] || 
    st.ClassRoll || 
    ''
  ).trim();
};

export function getStudentSession(st) {
  if (!st) return '';
  const keys = ['Session', 'session', 'Academic Session', 'sessionYear', 'yearSuffix', 'Session/Year'];
  for (const k of keys) {
    if (st[k] !== undefined && st[k] !== null) {
      const v = String(st[k]).trim();
      if (v && v !== '—' && v !== 'N/A') return v;
    }
  }
  return '';
}

export function isSessionMatch(sessStr, targetSession) {
  if (!targetSession || targetSession === 'all') return true;
  if (!sessStr || typeof sessStr !== 'string' || !sessStr.trim()) {
    // If student record doesn't specify a session, default them to current 2025-26
    return targetSession === '2025-26' || targetSession === '2025-2026';
  }

  const s = sessStr.toLowerCase().trim();
  const target = targetSession.toLowerCase().trim();

  // 1. Current Session 2025-26
  if (target === '2025-26' || target === '2025-2026') {
    if (s.includes('2024') || s.includes('2023')) return false;
    return s.includes('2025-26') || s.includes('2025-2026') || s.includes('2025') || s.includes('2026') || s.includes('current');
  }

  // 2. Primary Historical Session 2024-25 (Oct-Nov / Revised)
  if (target === '2024-25_revised' || target === '2024-25 (revised)' || target === '2024-25') {
    if (s.includes('2025') || s.includes('2023')) return false;
    return s.includes('2024-25') || s.includes('2024-2025') || s.includes('2024') || s.includes('24-25');
  }

  // 3. Regular Session 2024-25 (Mar-Apr)
  if (target === '2024-25_regular' || target === '2024-25 (regular)') {
    if (s.includes('2025') || s.includes('2023')) return false;
    const is2024 = s.includes('2024-25') || s.includes('2024-2025') || s.includes('2024');
    const isExplicitRevised = s.includes('revised') || s.includes('oct') || s.includes('nov') || s.includes('autumn');
    return is2024 && !isExplicitRevised;
  }

  // 4. Session 2023-24
  if (target === '2023-24' || target === '2023-2024') {
    return s.includes('2023-24') || s.includes('2023-2024') || (s.includes('2023') && s.includes('24'));
  }

  return s.includes(target);
}

export function checkStudentApprovalState(st) {
  if (!st) return { isRejected: false, isApproved: false, isPending: true, hasValidRoll: false };
  const stStatus = String(st.Status || st.status || st['Lock Status'] || st['Admission Status'] || st['Payment Status'] || '').toLowerCase().trim();
  const rawRoll = getRollNo(st);
  const hasValidRoll = rawRoll !== '' && rawRoll !== '-' && rawRoll !== '—' && rawRoll !== 'N/A' && rawRoll !== 'null' && rawRoll !== 'undefined';

  const isRejected = stStatus.includes('reject') || stStatus.includes('cancel') || stStatus.includes('withdraw') || stStatus.includes('deleted');
  if (isRejected) return { isRejected: true, isApproved: false, isPending: false, hasValidRoll };

  // Any candidate with an assigned Class Roll No OR explicit approval/master register is Approved
  const isApproved = hasValidRoll || stStatus.includes('appr') || stStatus.includes('admit') || stStatus.includes('verifi') || stStatus === 'full' || st._source === 'masterRegisters' || st['isApproved'] === true;
  const isPending = !isApproved;

  return { isRejected, isApproved, isPending, hasValidRoll };
}

export default function AdminPracticals() {
  const [tab, setTab] = useState('class11');
  const [subTab, setSubTab] = useState('status');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alertMsg, setAlertMsg] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [selSub, setSelSub] = useState(null);
  const [expSub, setExpSub] = useState(null);
  const [emailSt, setEmailSt] = useState({});

  // Global Portal Settings
  const [settings, setSettings] = useState({
    permissions: [],
    statusControls: { class11_internal: false, class12_internal: false },
    currentYearSuffix: '26',
    currentPracticalType: 'internal',
    centerName: '',
    absentMarker: 'A',
    nonPractical11: 'HTC,ITE',
    nonPractical12: 'HTC,ITE',
    hiddenCentres11: '',
    hiddenCentres12: '',
    maxMarks11: { ...DEFAULT_MX11 },
    maxMarks12: { ...DEFAULT_MX12 },
    printDetails: {
      '11th': {
        instName: 'Govt. Higher Secondary School Shangus',
        instContact: '7006912918',
        sessionText: 'Annual Regular 2025',
        inchargeName: 'Mr. Majid Hassan Najar',
        inchargeCpis: 'SHGEDU00220017',
        inchargeMobile: '7006537425'
      },
      '12th': {
        instName: 'Govt. Higher Secondary School Shangus',
        instContact: '7006912918',
        sessionText: 'Annual Regular 2025',
        inchargeName: 'Mr. Bilal Ahmad Khandy',
        inchargeCpis: 'KGLEDU00120015',
        inchargeMobile: '9596165142'
      }
    }
  });

  const [grantEmail, setGrantEmail] = useState('');
  const [grantClass, setGrantClass] = useState('11th');
  const [grantSubject, setGrantSubject] = useState('Physics');

  const showAlert = (type, text) => { 
    setAlertMsg({ type, text }); 
    setTimeout(() => setAlertMsg(null), 3000); 
  };

  const loadData = useCallback(async (force = false, forceResyncPracticals = false) => {
    setLoading(true);
    try {
      if (forceResyncPracticals) {
        await syncCleanPracticalsToFirestore();
      }

      const sd = await getDoc(doc(db, 'adminPracticalsSettings', 'config'));
      if (sd.exists()) {
        const d = sd.data();
        setSettings(p => ({
          ...p,
          ...d,
          maxMarks11: { ...DEFAULT_MX11, ...(d.maxMarks11 || {}) },
          maxMarks12: { ...DEFAULT_MX12, ...(d.maxMarks12 || {}) },
          printDetails: {
            '11th': { ...p.printDetails['11th'], ...(d.printDetails?.['11th'] || {}) },
            '12th': { ...p.printDetails['12th'], ...(d.printDetails?.['12th'] || {}) }
          }
        }));
      }

      // Fetch student data from BOTH admissions and masterRegisters
      const admissionsData = await getCachedCollection('admissions', force).catch(() => []);
      const masterData = await getCachedCollection('masterRegisters', force).catch(() => []);

      const combinedMap = new Map();
      (masterData || []).forEach(st => {
        const key = String(st.id || st['Form No.'] || st['Class Roll No'] || st.rollNo || st.examRollNo || '').trim();
        if (key && key !== '—' && key !== 'N/A') {
          combinedMap.set(key, { _source: 'masterRegisters', ...st });
        }
      });
      (admissionsData || []).forEach(st => {
        const key = String(st.id || st['Form No.'] || st['Class Roll No'] || st.rollNo || st.examRollNo || '').trim();
        if (key && key !== '—' && key !== 'N/A') {
          const existing = combinedMap.get(key);
          combinedMap.set(key, existing ? { ...existing, ...st } : { _source: 'admissions', ...st });
        } else {
          combinedMap.set(st.id || `adm_${Math.random()}`, { _source: 'admissions', ...st });
        }
      });

      setStudents(Array.from(combinedMap.values()));

      let ss = await getDocs(collection(db, 'practicalsData'));
      
      // Auto-migrate clean Excel data if collection is empty
      if (ss.docs.length === 0) {
        await syncCleanPracticalsToFirestore();
        ss = await getDocs(collection(db, 'practicalsData'));
      }

      const parsedSubmissions = ss.docs.map(d => {
        const data = d.data();
        let parsedRecords = data.records || [];
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
      setTeachers(
        ts.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(u => {
            const r = String(u.role || '').toLowerCase();
            return r === 'teacher' || r === 'faculty' || r === 'examiner' || r === 'staff' || r === 'admin';
          })
      );
    } catch (e) { 
      console.error(e); 
      showAlert('error', 'Failed to load practicals data.'); 
    } finally { 
      setLoading(false); 
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const saveSettingsDoc = async (keyName, updatedSettings) => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'adminPracticalsSettings', 'config'), updatedSettings, { merge: true });
      setSettings(updatedSettings);
      showAlert('success', `${keyName} saved successfully.`);
    } catch (e) {
      console.error(e);
      showAlert('error', `Failed to save ${keyName}.`);
    } fontFinally: { setSaving(false); }
  };

  const grantPerm = async (e) => {
    e.preventDefault();
    if (!grantEmail.trim()) { showAlert('error', 'Teacher email required.'); return; }
    const np = { email: grantEmail.trim().toLowerCase(), className: grantClass, subject: grantSubject, grantedAt: new Date().toLocaleDateString() };
    const upd = [...(settings.permissions || []), np];
    const newSt = { ...settings, permissions: upd };
    await saveSettingsDoc('Permissions', newSt);
    setGrantEmail('');
  };

  const revokePerm = async (idx) => {
    const upd = [...(settings.permissions || [])];
    upd.splice(idx, 1);
    const newSt = { ...settings, permissions: upd };
    await saveSettingsDoc('Permission Revoked', newSt);
  };

  const noPrac = (cls) => ((cls === '11th' ? settings.nonPractical11 : settings.nonPractical12) || '').split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
  const getPD = (cls) => settings.printDetails?.[cls] || {};

  const computeStatus = (cls) => {
    const curSessSuffix = settings.currentYearSuffix || '26';

    const cSts = students.filter(st => {
      const classMatch = isClassMatch(st.class || st.className || st.admittedClass || st['Admission sought for class'], cls);
      if (!classMatch) return false;

      const { isRejected, isApproved } = checkStudentApprovalState(st);
      if (isRejected || !isApproved) return false;

      const sess = String(st.Session || st.session || st.sessionYear || st.yearSuffix || '').trim();
      if (sess) {
        const matchesSession = isSessionMatch(sess, '2025-26');
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

      const sd = submissions.find(s => {
        const matchClass = isClassMatch(s.className || s.Class, cls);
        if (!matchClass) return false;
        const subjStr = String(s.subjectCode || s.subject || s.Subject || '').toUpperCase();
        return subjStr.includes(code) || String(s.subject || s.Subject || '').toUpperCase().includes((NAMES[code] || '').toUpperCase());
      });

      const recs = sd?.records || [];
      const isSubmitted = !!sd && recs.length > 0;

      const compRecs = recs.filter(r => { const v = String(r.totalMarks ?? r.practicalMarks ?? '').trim().toUpperCase(); return v !== '' && v !== '0' && v !== 'N/A' && v !== absMk && v !== 'AB'; });
      const absRecs = recs.filter(r => { const v = String(r.totalMarks ?? r.practicalMarks ?? '').trim().toUpperCase(); return v === absMk || v === 'AB'; });
      
      const cCount = compRecs.length;
      const aCount = absRecs.length;
      const pend = isSubmitted ? Math.max(0, total - cCount - aCount) : (isPrac ? (total > 0 ? total : 0) : 0);
      
      if (isPrac && isSubmitted && pend === 0) compSubs++;
      
      evalTotal += cCount;
      absTotal += aCount;
      if (isSubmitted) pendTotal += pend;

      return {
        subjectCode: code,
        subjectName: NAMES[code],
        isPractical: isPrac,
        teacher: toTitleCase(sd?.teacherName || sd?.['Teacher Name'] || '-'),
        teacherEmail: sd?.teacherEmail || sd?.Email,
        isSubmitted,
        completed: cCount,
        absent: aCount,
        pending: pend,
        completedStudents: compRecs,
        absentStudents: absRecs,
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

  const handleWhatsAppShare = (phone, text) => {
    let cleanPhone = String(phone || '').replace(/\D/g, '');
    if (!cleanPhone) {
      const input = prompt('Enter WhatsApp Mobile Number (10 digits):');
      if (!input) return;
      cleanPhone = String(input).replace(/\D/g, '');
    }
    const targetPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const waUrl = targetPhone 
      ? `https://api.whatsapp.com/send?phone=${targetPhone}&text=${encodeURIComponent(text)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
  };

  const handleEmailShare = (email, subject, bodyText) => {
    let targetEmail = email;
    if (!targetEmail) {
      const input = prompt('Enter Recipient Email Address:');
      if (!input) return;
      targetEmail = input.trim();
    }
    const mailtoUrl = `mailto:${targetEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`;
    window.open(mailtoUrl, '_blank');
  };

  const sendEmail = async (row, cls) => {
    if (!row.teacherEmail) { showAlert('error', 'No email address found for this teacher.'); return; }
    const k = cls + '_' + row.subjectCode;
    setEmailSt(p => ({ ...p, [k]: 'sending' }));
    try {
      const sendPracticalsEmail = httpsCallable(functions, 'sendPracticalsEmail');
      await sendPracticalsEmail({
        to: row.teacherEmail,
        subject: `Assessment Submission Report: ${row.subjectName} (${cls})`,
        htmlBody: `<h3>Assessment Submission: ${row.subjectName} (${cls})</h3><p>Evaluated: ${row.completed}, Absent: ${row.absent}, Pending: ${row.pending}</p>`
      });
      setEmailSt(p => ({ ...p, [k]: 'sent' }));
      showAlert('success', 'Email report sent.');
    } catch (e) {
      console.error(e);
      setEmailSt(p => ({ ...p, [k]: '' }));
      showAlert('error', 'Failed to send email.');
    }
  };

  if (loading) return <ModernLoader text="Loading Practicals & Awards Suite" subtext="Fetching evaluation records, permissions, and configuration..." />;

  const Tb = ({ id, label, icon, onClick }) => (
    <button onClick={onClick} className={'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ' + (tab === id ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700')}>
      {icon}<span>{label}</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-3 md:p-6 font-sans">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Sleek Combined Header & Navigation Bar */}
        <div className="bg-white dark:bg-slate-900 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-xs">
              <Sliders size={16} strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-sm font-black text-slate-900 dark:text-white leading-tight">Practicals Portal Admin</h1>
              <p className="text-[10px] font-semibold text-slate-500">Evaluations, prints, permissions & security rules.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
            <Tb id="class11" label="Class 11th" icon={<Award size={13}/>} onClick={() => setTab('class11')} />
            <Tb id="class12" label="Class 12th" icon={<Award size={13}/>} onClick={() => setTab('class12')} />
            <Tb id="teachers" label="Teachers Roster" icon={<Users size={13}/>} onClick={() => setTab('teachers')} />
            <Tb id="settings" label="Settings & Permissions" icon={<Settings size={13}/>} onClick={() => setTab('settings')} />
            <button onClick={() => loadData(true)} className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer">
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Sync
            </button>
          </div>
        </div>

        {alertMsg && (
          <div className={'p-3 rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs ' + (alertMsg.type === 'error' ? 'bg-rose-50 text-rose-700 border border-rose-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100')}>
            {alertMsg.type === 'error' ? <AlertCircle size={15} /> : <CheckCircle2 size={15} />} {alertMsg.text}
          </div>
        )}

        {/* Content Area */}
        <div className="min-h-[500px] space-y-3">
          {tab === 'class11' && (
            <AwardsSummaryView 
              cls="11th" 
              students={students} 
              submissions={submissions} 
              getPD={getPD} 
              settings={settings} 
            />
          )}

          {tab === 'class12' && (
            <AwardsSummaryView 
              cls="12th" 
              students={students} 
              submissions={submissions} 
              getPD={getPD} 
              settings={settings} 
            />
          )}

          {tab === 'teachers' && (
            <TeachersView 
              teachers={teachers} 
              submissions={submissions} 
              sendEmail={sendEmail} 
              emailSt={emailSt} 
              handleWhatsAppShare={handleWhatsAppShare} 
              handleEmailShare={handleEmailShare} 
            />
          )}
          {tab === 'settings' && (
            <SettingsPermissionsView 
              settings={settings} 
              setSettings={setSettings} 
              saveSettingsDoc={saveSettingsDoc}
              saving={saving}
              grantEmail={grantEmail}
              setGrantEmail={setGrantEmail}
              grantClass={grantClass}
              setGrantClass={setGrantClass}
              grantSubject={grantSubject}
              setGrantSubject={setGrantSubject}
              grantPerm={grantPerm}
              revokePerm={revokePerm}
            />
          )}
        </div>

        {/* Selected Subject DataGrid Modal */}
        {selSub && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">
              <div className="flex items-center justify-between mb-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">{selSub.className || selSub.Class} - {selSub.subjectName || selSub.Subject}</h3>
                  <p className="text-xs font-bold text-slate-500">Submitted by: <span className="text-indigo-600">{toTitleCase(selSub.teacherName || selSub['Teacher Name'] || '')}</span> • {selSub.records?.length || 0} Records</p>
                </div>
                <button onClick={() => setSelSub(null)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer text-slate-400">
                  <X size={18} />
                </button>
              </div>
              <div className="flex-1 overflow-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-900 text-[10px] uppercase font-black text-slate-500 sticky top-0">
                    <tr>
                      <th className="py-2.5 px-3">Roll No</th>
                      <th className="py-2.5 px-3">Student Name</th>
                      <th className="py-2.5 px-3 text-center">Marks (Prac/Viva)</th>
                      <th className="py-2.5 px-3 text-right">Total Marks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-semibold bg-white dark:bg-slate-900">
                    {(selSub.records || []).map((r, i) => (
                      <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                        <td className="py-2 px-3 font-mono font-bold text-indigo-600">{r.rollNo || '-'}</td>
                        <td className="py-2 px-3">{toTitleCase(r.name || '-')}</td>
                        <td className="py-2 px-3 text-center">{r.practicalMarks ?? '-'}</td>
                        <td className="py-2 px-3 text-right font-black text-emerald-600">{r.totalMarks ?? r.practicalMarks ?? '-'}</td>
                      </tr>
                    ))}
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

// ──────── STATUS DASHBOARD COMPONENT ────────
function StatusDashboardView({ cls, sts, students, submissions, getPD, sendEmail, emailSt, setSelSub, expSub, setExpSub, handleWhatsAppShare, handleEmailShare }) {
  const getSubjectReportText = (row) => {
    const teacher = toTitleCase(row.teacher || 'Faculty Member');
    const subj = row.subjectName || row.subjectCode;
    const statusStr = row.isSubmitted ? 'Submitted ✅' : 'Pending ⏳';
    return `*Govt. Higher Secondary School Shangus*\n*Practicals Evaluation Status Report*\n\nRespected ${teacher},\n\nEvaluation status for your subject:\n• *Class:* Class ${cls}\n• *Subject:* ${subj}\n• *Status:* ${statusStr}\n• *Evaluated Students:* ${row.completed}\n• *Absent Students:* ${row.absent}\n• *Pending Evaluation:* ${row.pending}\n\n${row.pending > 0 ? 'Kindly log in to the Practicals Portal to complete the pending evaluations.' : 'Thank you for completing and submitting the practical evaluation awards.'}\n\n*Portal Link:* https://admexamhssshangus.web.app\n\nRegards,\nPrincipal / Admin, Govt. HSS Shangus`;
  };

  return (
    <div className="space-y-3 animate-in fade-in duration-300">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-xs flex items-center justify-between">
          <div><p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Total Subjects</p><h3 className="text-xl font-black text-indigo-600">{sts.total}</h3></div>
          <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg text-indigo-600"><Layers size={16} /></div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-xs flex items-center justify-between">
          <div><p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Completed Lists</p><h3 className="text-xl font-black text-emerald-600">{sts.completed}</h3></div>
          <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg text-emerald-600"><CheckCircle2 size={16} /></div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-xs flex items-center justify-between">
          <div><p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Records Evaluated</p><h3 className="text-xl font-black text-blue-600">{sts.aggregate.evalTotal}</h3></div>
          <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600"><Users size={16} /></div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-xs flex items-center justify-between">
          <div><p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Pending Students</p><h3 className="text-xl font-black text-rose-600">{sts.aggregate.pendTotal}</h3></div>
          <div className="p-2 bg-rose-50 dark:bg-rose-900/20 rounded-lg text-rose-600"><AlertCircle size={16} /></div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
        <div className="p-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900">
          <div className="flex items-center gap-2">
            <ClipboardCheck size={15} className="text-indigo-500" />
            <h3 className="text-xs font-black text-slate-800 dark:text-white">Subject-wise Evaluation Progress</h3>
            <span className="px-2 py-0.5 bg-slate-200 dark:bg-slate-800 rounded-full text-[9.5px] font-bold text-slate-600 dark:text-slate-400">Class {cls}</span>
          </div>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
          {sts.rows.map(row => (
            <div key={row.subjectCode} className="group flex flex-col sm:flex-row sm:items-center justify-between py-2 px-3 hover:bg-slate-50 dark:hover:bg-slate-950/50 transition-colors gap-2">
              <div className="flex-1 flex items-center gap-2.5">
                <div className={'w-2 h-2 rounded-full shrink-0 ' + (row.isSubmitted ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse')} />
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">{row.subjectName}</h4>
                  <p className="text-[10px] font-semibold text-slate-500">Faculty: <span className="text-indigo-600 font-bold">{row.teacher}</span></p>
                </div>
              </div>
              
              <div className="flex flex-wrap items-center gap-3 text-[11px] font-black">
                <div className="flex items-center gap-1"><span className="text-slate-400 text-[9px] uppercase">Eval:</span><span className="text-emerald-600">{row.completed}</span></div>
                <div className="flex items-center gap-1"><span className="text-slate-400 text-[9px] uppercase">Abs:</span><span className="text-amber-500">{row.absent}</span></div>
                <div className="flex items-center gap-1 pr-3 border-r border-slate-200 dark:border-slate-800"><span className="text-slate-400 text-[9px] uppercase">Pend:</span><span className="text-rose-500">{row.pending}</span></div>

                <div className="flex items-center gap-1.5">
                  <button 
                    type="button"
                    onClick={() => {
                      const text = getSubjectReportText(row);
                      const phone = row.teacherPhone || row.data?.teacherMobile || row.data?.phone || row.data?.mobile;
                      handleWhatsAppShare(phone, text);
                    }}
                    className="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 transition-colors flex items-center gap-1 text-[10.5px] font-bold cursor-pointer"
                    title="Send pre-filled status report via WhatsApp"
                  >
                    <MessageCircle size={11} /> WhatsApp
                  </button>

                  <button 
                    type="button"
                    onClick={() => {
                      const text = getSubjectReportText(row);
                      const subj = `Practicals Evaluation Status: ${row.subjectName} (Class ${cls})`;
                      handleEmailShare(row.teacherEmail || row.data?.teacherEmail || row.data?.Email, subj, text);
                    }}
                    className="px-2 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 transition-colors flex items-center gap-1 text-[10.5px] font-bold cursor-pointer"
                    title="Send pre-filled status report via Email"
                  >
                    <Mail size={11} /> Email
                  </button>

                  {row.isSubmitted ? (
                    <div className="relative">
                      <button 
                        onClick={() => setExpSub(expSub === row.subjectCode ? null : row.subjectCode)}
                        className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors flex items-center gap-1 text-[11px] font-bold cursor-pointer"
                      >
                        <Printer size={11} /> Actions <ChevronDown size={11} className={'transition-transform ' + (expSub === row.subjectCode ? 'rotate-180' : '')}/>
                      </button>
                      {expSub === row.subjectCode && (
                        <div className="absolute right-0 top-full mt-1 w-52 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl p-1 z-20 flex flex-col gap-0.5">
                          <button onClick={() => { setExpSub(null); setSelSub(row.data); }} className="w-full text-left px-2.5 py-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 rounded-lg cursor-pointer">View Data Grid</button>
                          <button onClick={() => { setExpSub(null); printIndividualAwardRoll({ subjectCode: row.subjectCode, subjectName: row.subjectName, className: cls, session: getPD(cls).sessionText || 'Annual Regular 2025', records: row.data?.records || [], isExternal: false, maxMarks: 10 }); }} className="w-full text-left px-2.5 py-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 rounded-lg cursor-pointer">Print Award Roll (Internal)</button>
                          <button onClick={() => { setExpSub(null); printIndividualAwardRoll({ subjectCode: row.subjectCode, subjectName: row.subjectName, className: cls, session: getPD(cls).sessionText || 'Annual Regular 2025', records: row.data?.records || [], isExternal: true, maxMarks: 10 }); }} className="w-full text-left px-2.5 py-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 rounded-lg cursor-pointer">Print Award Roll (External)</button>
                          <button onClick={() => { setExpSub(null); printIndividualWorkSheet({ subjectCode: row.subjectCode, subjectName: row.subjectName, className: cls, session: getPD(cls).sessionText || 'Annual Regular 2025', records: row.data?.records || [] }); }} className="w-full text-left px-2.5 py-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 rounded-lg cursor-pointer">Print Subject Work Sheet</button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-[9.5px] text-slate-400 font-bold px-2 py-1 bg-slate-50 rounded-lg border border-dashed border-slate-200">No Data</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ──────── AWARDS SUMMARY COMPONENT (Screenshot 1 Format) ────────
function AwardsSummaryView({ cls, students, submissions, getPD, settings }) {
  const [selectedSubCodes, setSelectedSubCodes] = useState(CODES);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSession, setSelectedSession] = useState('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('approved');
  const [selectedRolls, setSelectedRolls] = useState(new Set());
  const [sortField, setSortField] = useState('roll');
  const [sortDirection, setSortDirection] = useState('asc');
  const [showOptsModal, setShowOptsModal] = useState(false);
  const [localPrintOpts, setLocalPrintOpts] = useState({
    sessionText: getPD(cls).sessionText || 'Annual Regular 2025',
    instName: getPD(cls).instName || 'Govt. Higher Secondary School Shangus',
    inchargeName: getPD(cls).inchargeName || 'Mr. Sheikh Gulfam',
    inchargeCpis: getPD(cls).inchargeCpis || 'GRZEDU00060041',
    inchargeMobile: getPD(cls).inchargeMobile || '9682547458',
    practicalType: settings.currentPracticalType || 'internal',
    absentMarker: settings.absentMarker || 'A'
  });

  const cSts = students.filter(st => {
    const classMatch = isClassMatch(st.class || st.className || st.admittedClass || st['Admission sought for class'], cls);
    if (!classMatch) return false;

    const { isRejected, isApproved, isPending } = checkStudentApprovalState(st);
    if (isRejected) return false;

    if (selectedStatusFilter === 'approved' && !isApproved) return false;
    if (selectedStatusFilter === 'pending' && !isPending) return false;

    if (selectedSession !== 'all') {
      const sess = getStudentSession(st);
      const matchesSess = isSessionMatch(sess, selectedSession);
      if (!matchesSess) return false;
    }
    return true;
  });

  useEffect(() => {
    if (cSts.length > 0) {
      const initialRolls = new Set(cSts.map((st, i) => getRollNo(st) || st['Board Registration Number'] || st.examRollNo || `20100${2000 + i}`));
      setSelectedRolls(initialRolls);
    } else {
      setSelectedRolls(new Set());
    }
  }, [cSts.length, selectedSession, selectedStatusFilter]);

  const filteredStudents = cSts.filter(st => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const name = String(st["Student's Name (as per school records)"] || st["Student's Name"] || st.studentName || st.name || '').toLowerCase();
    const father = String(st["Father's/Guardian's Name (as per school records)"] || st["Father's Name"] || st.fatherName || '').toLowerCase();
    const roll = String(getRollNo(st) || st.examRollNo || '').toLowerCase();
    return name.includes(term) || father.includes(term) || roll.includes(term);
  });

  const getStudentHashTotal = (st, idx) => {
    const rollNo = getRollNo(st) || st['Board Registration Number'] || st.examRollNo || `20100${2000 + idx}`;
    const examRoll = st['Board Registration Number'] || st.examRollNo || '';
    const stName = toTitleCase(st["Student's Name (as per school records)"] || st["Student's Name"] || st.studentName || st.name || '').trim().toLowerCase();

    let total = 0;
    CODES.forEach(subCode => {
      if (!selectedSubCodes.includes(subCode)) return;
      const subDoc = submissions.find(s => {
        const matchClass = isClassMatch(s.className || s.Class || s.class, cls);
        if (!matchClass) return false;

        const subSess = s.sessionText || s.SessionText || s.session || s.Session || '';
        if (selectedSession !== 'all' && subSess) {
          const matchSess = isSessionMatch(subSess, selectedSession);
          if (!matchSess) return false;
        }

        const codeStr = String(s.subjectCode || s.subject || s.Subject || '').toUpperCase();
        return codeStr === subCode || codeStr.includes(subCode) || (NAMES[subCode] && codeStr.includes(NAMES[subCode].toUpperCase()));
      });
      const rec = subDoc?.records?.find(r => {
        const rRoll = String(r.rollNo || r.ClassRollNo || r.classRollNo || r['Class Roll No'] || '').trim();
        const rExam = String(r.examRollNo || r.boardRegNo || '').trim();
        const rName = toTitleCase(r.name || r.studentName || '').trim().toLowerCase();

        return (
          (rRoll && rRoll === String(rollNo).trim()) ||
          (examRoll && rExam && rExam === String(examRoll).trim()) ||
          (stName && rName && stName === rName)
        );
      });
      if (rec) {
        const rawMark = String(rec.totalMarks ?? rec.practicalMarks ?? '').trim();
        const numVal = parseInt(rawMark, 10);
        if (!isNaN(numVal)) total += numVal;
      }
    });
    return total;
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedStudents = [...filteredStudents].sort((a, b) => {
    let aVal, bVal;
    if (sortField === 'roll') {
      const rA = parseInt(getRollNo(a) || a.examRollNo || 0, 10);
      const rB = parseInt(getRollNo(b) || b.examRollNo || 0, 10);
      aVal = isNaN(rA) ? 0 : rA;
      bVal = isNaN(rB) ? 0 : rB;
    } else if (sortField === 'name') {
      aVal = String(a["Student's Name (as per school records)"] || a["Student's Name"] || a.studentName || a.name || '').toLowerCase();
      bVal = String(b["Student's Name (as per school records)"] || b["Student's Name"] || b.studentName || b.name || '').toLowerCase();
    } else if (sortField === 'father') {
      aVal = String(a["Father's/Guardian's Name (as per school records)"] || a["Father's Name"] || a.fatherName || '').toLowerCase();
      bVal = String(b["Father's/Guardian's Name (as per school records)"] || b["Father's Name"] || b.fatherName || '').toLowerCase();
    } else if (sortField === 'stream') {
      aVal = String(a['Stream for Class 11th'] || a['Stream'] || a.stream || '').toLowerCase();
      bVal = String(b['Stream for Class 11th'] || b['Stream'] || b.stream || '').toLowerCase();
    } else if (sortField === 'examRoll') {
      aVal = String(a['Board Registration Number'] || a.examRollNo || '').toLowerCase();
      bVal = String(b['Board Registration Number'] || b.examRollNo || '').toLowerCase();
    } else if (sortField === 'hashTotal') {
      aVal = getStudentHashTotal(a, 0);
      bVal = getStudentHashTotal(b, 0);
    } else {
      aVal = 0; bVal = 0;
    }

    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const selectedStudentsList = selectedRolls.size > 0 
    ? sortedStudents.filter(st => {
        const roll = getRollNo(st) || st['Board Registration Number'] || st.examRollNo || `20100${2000 + cSts.indexOf(st)}`;
        return selectedRolls.has(roll);
      })
    : sortedStudents;

  const toggleSubject = (code) => {
    if (selectedSubCodes.includes(code)) setSelectedSubCodes(selectedSubCodes.filter(c => c !== code));
    else setSelectedSubCodes([...selectedSubCodes, code]);
  };

  const toggleAllStudents = () => {
    if (selectedRolls.size === sortedStudents.length) setSelectedRolls(new Set());
    else setSelectedRolls(new Set(sortedStudents.map((st, i) => getRollNo(st) || st['Board Registration Number'] || st.examRollNo || `20100${2000 + i}`)));
  };

  const toggleStudentRoll = (roll) => {
    const next = new Set(selectedRolls);
    if (next.has(roll)) next.delete(roll); else next.add(roll);
    setSelectedRolls(next);
  };

  const activeSubjects = CODES.filter(c => selectedSubCodes.includes(c));

  return (
    <div className="space-y-3 animate-in fade-in duration-300">
      {/* Unified Minimal Control Panel Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3 shadow-xs space-y-2.5">
        {/* Header Title + Stats + Action Buttons */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800/80 pb-2.5">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-black text-slate-900 dark:text-white tracking-tight">
              Class {cls} - Awards Summary
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10.5px] font-bold text-slate-500 dark:text-slate-400">
              <strong className="text-indigo-600 dark:text-indigo-400">{selectedStudentsList.length}</strong> / {cSts.length} Students • <strong className="text-emerald-600">{activeSubjects.length}</strong> / {CODES.length} Subs Active
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button onClick={() => setShowOptsModal(true)} className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-bold cursor-pointer flex items-center gap-1"><Settings size={12} /> Options</button>
            <button 
              onClick={() => {
                const listToPrint = selectedStudentsList.length > 0 ? selectedStudentsList : sortedStudents;
                if (!listToPrint || listToPrint.length === 0) {
                  alert(`No student records available to print for Class ${cls}. Please check session or status filters.`);
                  return;
                }
                printConsolidatedAwardRoll({ 
                  className: cls, 
                  session: localPrintOpts.sessionText, 
                  students: listToPrint, 
                  submissions, 
                  isExternal: localPrintOpts.practicalType === 'external', 
                  selectedSubjectCodes: activeSubjects,
                  printDetails: localPrintOpts
                });
              }} 
              className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold cursor-pointer flex items-center gap-1 shadow-xs"
            >
              <Printer size={12} /> Print Awards
            </button>
            <button 
              onClick={() => {
                const listToPrint = selectedStudentsList.length > 0 ? selectedStudentsList : sortedStudents;
                if (!listToPrint || listToPrint.length === 0) {
                  alert(`No student records available to print for Class ${cls}. Please check session or status filters.`);
                  return;
                }
                printAttendanceSheet({ 
                  className: cls, 
                  session: localPrintOpts.sessionText, 
                  students: listToPrint 
                });
              }} 
              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold cursor-pointer flex items-center gap-1 shadow-xs"
            >
              <ClipboardCheck size={12} /> Print Attendance
            </button>
            <button 
              onClick={() => {
                const listToPrint = selectedStudentsList.length > 0 ? selectedStudentsList : sortedStudents;
                if (!listToPrint || listToPrint.length === 0) {
                  alert(`No student records available to print for Class ${cls}. Please check session or status filters.`);
                  return;
                }
                printFailList({ 
                  className: cls, 
                  session: localPrintOpts.sessionText, 
                  students: listToPrint, 
                  submissions, 
                  selectedSubjectCodes: activeSubjects 
                });
              }} 
              className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold cursor-pointer flex items-center gap-1 shadow-xs"
            >
              <AlertTriangle size={12} /> Print Fail List
            </button>
          </div>
        </div>

        {/* Search Input, Session & Status Filters + Select All */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto flex-1">
            <input type="text" placeholder="Search student name, roll no, father name..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold outline-none w-64 focus:ring-1 focus:ring-indigo-500" />
            <select value={selectedSession} onChange={e => setSelectedSession(e.target.value)} className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold outline-none cursor-pointer">
              <option value="all">All Sessions (Show All Students)</option>
              <option value="2025-26">Session 2025–26 (Oct-Nov / Current)</option>
              <option value="2024-25_revised">Session 2024–25 (Oct-Nov / Revised)</option>
              <option value="2024-25_regular">Session 2024–25 (Mar-Apr / Regular)</option>
              <option value="2023-24">Session 2023–24</option>
            </select>
            <select value={selectedStatusFilter} onChange={e => setSelectedStatusFilter(e.target.value)} className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold outline-none cursor-pointer">
              <option value="all">All Statuses (Show All Students)</option>
              <option value="approved">Approved & Roll Assigned Only</option>
              <option value="pending">Pending Approval / Roll Assignment Only</option>
            </select>
          </div>
          <label className="flex items-center gap-1.5 cursor-pointer font-bold text-slate-600 dark:text-slate-400 shrink-0 text-xs select-none">
            <input type="checkbox" checked={selectedRolls.size === sortedStudents.length && sortedStudents.length > 0} onChange={toggleAllStudents} className="w-3.5 h-3.5 rounded text-indigo-600 cursor-pointer" />
            <span>Select / Skip All ({sortedStudents.length})</span>
          </label>
        </div>

        {/* Compact Active Subjects Bar */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 text-[10.5px]">
          <div className="flex flex-wrap items-center gap-1">
            <span className="font-black text-slate-400 uppercase text-[9px] mr-1">Active Subjects:</span>
            {CODES.map(code => (
              <button key={code} onClick={() => toggleSubject(code)} className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer border transition-all ${selectedSubCodes.includes(code) ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs' : 'bg-slate-50 dark:bg-slate-950 text-slate-400 border-slate-200 dark:border-slate-800 line-through opacity-50'}`}>{code}</button>
            ))}
          </div>
          <div className="flex items-center gap-2 font-bold text-[10px] shrink-0">
            <button onClick={() => setSelectedSubCodes(CODES)} className="text-indigo-600 hover:underline cursor-pointer">Select All</button>
            <span className="text-slate-300">|</span>
            <button onClick={() => setSelectedSubCodes([])} className="text-rose-600 hover:underline cursor-pointer">Unselect All</button>
          </div>
        </div>
      </div>

      {/* Data Grid Table (Clean Column Separation + Clickable Header Sort) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs overflow-x-auto">
        <table className="w-full text-left text-[11px] border-collapse">
          <thead className="bg-sky-50 dark:bg-slate-950 text-[10px] uppercase font-black text-slate-700 dark:text-slate-300 border-b border-sky-100">
            <tr>
              <th className="py-2 px-2 text-center">#</th>
              <th className="py-2 px-2 text-center">
                <input type="checkbox" checked={selectedRolls.size === sortedStudents.length && sortedStudents.length > 0} onChange={toggleAllStudents} className="w-3 h-3 text-indigo-600 cursor-pointer" />
              </th>
              <th onClick={() => handleSort('roll')} className="py-2 px-2 cursor-pointer hover:bg-sky-100 dark:hover:bg-slate-800 select-none">
                CLASS ROLL {sortField === 'roll' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th onClick={() => handleSort('name')} className="py-2 px-2 cursor-pointer hover:bg-sky-100 dark:hover:bg-slate-800 select-none">
                STUDENT NAME {sortField === 'name' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th onClick={() => handleSort('father')} className="py-2 px-2 cursor-pointer hover:bg-sky-100 dark:hover:bg-slate-800 select-none">
                FATHER NAME {sortField === 'father' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th onClick={() => handleSort('stream')} className="py-2 px-2 cursor-pointer hover:bg-sky-100 dark:hover:bg-slate-800 select-none">
                STREAM {sortField === 'stream' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th onClick={() => handleSort('examRoll')} className="py-2 px-2 cursor-pointer hover:bg-sky-100 dark:hover:bg-slate-800 select-none">
                EXAM ROLL {sortField === 'examRoll' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
              </th>
              {activeSubjects.map(code => <th key={code} className="py-2 px-1 text-center">{code}</th>)}
              <th onClick={() => handleSort('hashTotal')} className="py-2 px-2 text-center font-black cursor-pointer hover:bg-sky-100 dark:hover:bg-slate-800 select-none">
                HASH TOTAL {sortField === 'hashTotal' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-semibold bg-white dark:bg-slate-900">
            {sortedStudents.map((st, idx) => {
              const rollNo = String(st['Class Roll No'] || st.rollNo || st.classRollNo || st['Class Roll'] || '—').trim();
              const rawName = st["Student's Name (as per school records)"] || st["Student's Name"] || st.studentName || st.name || '—';
              const rawFather = st["Father's/Guardian's Name (as per school records)"] || st["Father's Name"] || st.fatherName || '—';
              const name = toTitleCase(rawName);
              const father = toTitleCase(rawFather);
              const stream = st['Stream for Class 11th'] || st['Stream'] || st.stream || 'Humanities';
              const examRoll = st['Board Registration Number'] || st.examRollNo || 'NA';
              const isSelected = selectedRolls.has(rollNo);
              const stSubsStr = String(st['Subjects to be taken in Class 11th'] || st['Subjects'] || st.subjects || '').toLowerCase();
              let rowHashTotal = 0;

              return (
                <tr key={idx} className={`hover:bg-slate-50 transition-colors ${!isSelected ? 'opacity-40 bg-slate-50/50' : ''}`}>
                  <td className="py-1.5 px-2 text-center text-slate-400 font-mono text-[10px]">{idx + 1}</td>
                  <td className="py-1.5 px-2 text-center">
                    <input type="checkbox" checked={isSelected} onChange={() => toggleStudentRoll(rollNo)} className="w-3 h-3 text-indigo-600 cursor-pointer" />
                  </td>
                  <td className="py-1.5 px-2 font-mono font-bold text-indigo-600">{rollNo}</td>
                  <td className="py-1.5 px-2 font-bold text-slate-900 dark:text-slate-100">{name}</td>
                  <td className="py-1.5 px-2 font-semibold text-slate-600 dark:text-slate-400">{father}</td>
                  <td className="py-1.5 px-2 text-slate-500">{stream}</td>
                  <td className="py-1.5 px-2 font-mono text-slate-500">{examRoll}</td>
                  {activeSubjects.map(subCode => {
                    const subDef = PRACTICAL_SUBJECT_DEFS.find(s => s.code === subCode);
                    const isEnrolled = subDef?.keywords.some(kw => stSubsStr.includes(kw));
                    const stReg = String(st['Board Registration Number'] || st['Registration No.'] || st.regNo || st.registrationNo || '').trim().toUpperCase();
                    const stName = toTitleCase(st["Student's Name (as per school records)"] || st["Student's Name"] || st.studentName || st.name || '').trim().toLowerCase();

                    const subDoc = submissions.find(s => {
                      const matchClass = isClassMatch(s.className || s.Class || s.class, cls);
                      if (!matchClass) return false;

                      const subSess = s.sessionText || s.SessionText || s.session || s.Session || '';
                      if (selectedSession !== 'all' && subSess) {
                        const matchSess = isSessionMatch(subSess, selectedSession);
                        if (!matchSess) return false;
                      }

                      const codeStr = String(s.subjectCode || s.subject || s.Subject || '').toUpperCase();
                      return codeStr === subCode || codeStr.includes(subCode) || (NAMES[subCode] && codeStr.includes(NAMES[subCode].toUpperCase()));
                    });

                    const rec = subDoc?.records?.find(r => {
                      const rRoll = String(r.rollNo || r.examRollNo || r.ClassRollNo || '').trim().toUpperCase();
                      const rReg = String(r.regNo || r['Registration No.'] || r['Board Registration Number'] || '').trim().toUpperCase();
                      const rExam = String(r.examRollNo || r.boardRegNo || '').trim().toUpperCase();
                      const rName = toTitleCase(r.name || r.studentName || '').trim().toLowerCase();

                      return (
                        (stReg && rReg && stReg === rReg) ||
                        (stReg && rRoll && stReg === rRoll) ||
                        (rRoll && rRoll === String(rollNo).trim().toUpperCase()) ||
                        (examRoll !== 'NA' && rExam && rExam === String(examRoll).trim().toUpperCase()) ||
                        (stName && rName && stName === rName)
                      );
                    });

                    if (rec) {
                      const rawMark = String(rec.totalMarks ?? rec.practicalMarks ?? '').trim();
                      const numVal = parseInt(rawMark, 10);
                      if (!isNaN(numVal)) { rowHashTotal += numVal; return <td key={subCode} className="py-1.5 px-1 text-center font-bold text-blue-700">{numVal}</td>; }
                      else if (rawMark.toUpperCase() === 'AB') { return <td key={subCode} className="py-1.5 px-1 text-center font-bold text-rose-600">AB</td>; }
                    }
                    if (isEnrolled) return <td key={subCode} className="py-1.5 px-1 text-center text-slate-400 font-bold">—</td>;
                    return <td key={subCode} className="py-1.5 px-1 text-center text-slate-400 font-normal">x</td>;
                  })}
                  <td className="py-1.5 px-2 text-center font-black text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-950">{rowHashTotal > 0 ? rowHashTotal : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Options Config Modal */}
      {showOptsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-3 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <h3 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-1.5"><Settings size={16} className="text-sky-600" /> Print & Certificate Options</h3>
              <button onClick={() => setShowOptsModal(false)} className="p-1 hover:bg-slate-100 rounded-lg cursor-pointer text-slate-400"><X size={16} /></button>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Academic Session Text</label>
              <input type="text" value={localPrintOpts.sessionText} onChange={e => setLocalPrintOpts({ ...localPrintOpts, sessionText: e.target.value })} className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Evaluation Type</label>
                <select value={localPrintOpts.practicalType} onChange={e => setLocalPrintOpts({ ...localPrintOpts, practicalType: e.target.value })} className="w-full px-2 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold">
                  <option value="internal">Internal Assessment</option>
                  <option value="external">External Practical</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Absent Marker</label>
                <input type="text" value={localPrintOpts.absentMarker} onChange={e => setLocalPrintOpts({ ...localPrintOpts, absentMarker: e.target.value })} className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold" />
              </div>
            </div>
            <div className="pt-2 flex justify-end">
              <button onClick={() => setShowOptsModal(false)} className="px-4 py-1.5 bg-indigo-600 text-white rounded-xl font-bold cursor-pointer">Apply</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ──────── TEACHERS VIEW COMPONENT ────────
function TeachersView({ teachers, submissions, sendEmail, emailSt, handleWhatsAppShare, handleEmailShare }) {
  const [expandedEmails, setExpandedEmails] = useState(new Set());

  const facultyMembers = teachers.filter(t => {
    const r = String(t.role || '').toLowerCase();
    return r === 'teacher' || r === 'faculty' || r === 'examiner' || r === 'staff' || r === 'admin';
  });

  const getFacultyNoticeText = (t) => {
    const name = toTitleCase(t.name || t.displayName || t.email?.split('@')[0] || 'Faculty Member');
    const role = t.role ? toTitleCase(t.role) : 'Teacher';
    return `*Govt. Higher Secondary School Shangus*\n*Portal Administrative Notice*\n\nRespected ${name} (${role}),\n\nKindly check your Practicals Portal account for assigned practical evaluation awards and institution updates.\n\n*Portal Link:* https://admexamhssshangus.web.app\n\nRegards,\nPrincipal / Admin, Govt. HSS Shangus`;
  };

  const getTeacherSubmissions = (t) => {
    const tEm = String(t.email || '').toLowerCase().trim();
    const tNm = String(t.name || t.displayName || '').toLowerCase().trim();
    return submissions.filter(s => {
      const em = String(s.teacherEmail || s.Email || s.email || '').toLowerCase().trim();
      const nm = String(s.teacherName || s['Teacher Name'] || s.name || '').toLowerCase().trim();
      return (tEm && em === tEm) || (tNm && nm.includes(tNm));
    });
  };

  const toggleExpand = (email) => {
    const next = new Set(expandedEmails);
    if (next.has(email)) next.delete(email);
    else next.add(email);
    setExpandedEmails(next);
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs p-4 space-y-3">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1">
        <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
          <Users size={16} className="text-indigo-500" /> Faculty & Examiner Roster ({facultyMembers.length})
        </h3>
        <span className="text-[11px] font-bold text-slate-400">
          Click <strong className="text-indigo-600 dark:text-indigo-400 font-black">Activity</strong> to view/hide teacher evaluation progress
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-100 dark:bg-slate-950 text-[10px] uppercase font-black text-slate-500">
            <tr>
              <th className="py-2 px-3">Faculty Name</th>
              <th className="py-2 px-3">Email Address</th>
              <th className="py-2 px-3">Role</th>
              <th className="py-2 px-3 text-right">Actions & Activity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-semibold">
            {facultyMembers.map((t, idx) => {
              const teacherSubs = getTeacherSubmissions(t);
              const isExpanded = expandedEmails.has(t.email);
              const totalEvaluated = teacherSubs.reduce((acc, s) => acc + (s.records?.length || s.recordsCount || 0), 0);

              return (
                <React.Fragment key={idx}>
                  <tr className={`hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${isExpanded ? 'bg-indigo-50/40 dark:bg-slate-800/60' : ''}`}>
                    <td className="py-2 px-3 font-bold text-slate-900 dark:text-white">
                      {toTitleCase(t.name || t.displayName || t.email?.split('@')[0])}
                    </td>
                    <td className="py-2 px-3 text-slate-500">{t.email}</td>
                    <td className="py-2 px-3 font-mono text-[10px] text-indigo-600 dark:text-indigo-400 uppercase font-black">
                      {t.role || 'Teacher'}
                    </td>
                    <td className="py-2 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => toggleExpand(t.email)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer transition-all ${
                            isExpanded
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <Activity size={12} />
                          <span>{isExpanded ? 'Hide' : 'Activity'}</span>
                          {teacherSubs.length > 0 && (
                            <span className={`px-1.5 py-0.2 rounded-full text-[9.5px] font-black ${isExpanded ? 'bg-white/20 text-white' : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'}`}>
                              {teacherSubs.length}
                            </span>
                          )}
                          {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const msg = getFacultyNoticeText(t);
                            const phone = t.mobile || t.phone || t.mobileNo || t.contactNo || t.whatsapp || t.phoneNumber;
                            handleWhatsAppShare(phone, msg);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer transition-colors"
                          title="Send pre-filled WhatsApp notice"
                        >
                          <MessageCircle size={11} /> WhatsApp
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const msg = getFacultyNoticeText(t);
                            const subj = `Govt. HSS Shangus - Practicals Portal Notice`;
                            handleEmailShare(t.email, subj, msg);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer transition-colors"
                          title="Send pre-filled Email notice"
                        >
                          <Mail size={11} /> Email
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Expandable Activity & Progress Card Grid */}
                  {isExpanded && (
                    <tr className="bg-slate-50/80 dark:bg-slate-950/60 border-b border-indigo-100 dark:border-slate-800">
                      <td colSpan={4} className="p-3">
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-1.5">
                            <h4 className="text-[11px] font-black uppercase text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                              <Activity size={14} /> Evaluation Activity & Progress Panel — {toTitleCase(t.name || t.displayName || t.email?.split('@')[0])}
                            </h4>
                            <span className="text-[10.5px] font-bold text-slate-500">
                              Total Evaluated Candidates: <strong className="text-emerald-600 dark:text-emerald-400 font-black">{totalEvaluated}</strong>
                            </span>
                          </div>

                          {teacherSubs.length === 0 ? (
                            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-400 text-[11px] font-bold text-center">
                              No practical evaluation submissions recorded for this faculty member yet.
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                              {teacherSubs.map((sub, sIdx) => {
                                const recCount = sub.records?.length || sub.recordsCount || 0;
                                const isDone = recCount > 0;
                                const typeLabel = (sub.practicalType || sub.PracticalType || 'internal').toUpperCase();
                                const clsLabel = sub.className || sub.Class || '11th';
                                const subName = sub.subjectName || sub.Subject || sub.subject || 'Subject';
                                const subCode = sub.subjectCode || 'SUB';

                                return (
                                  <div key={sIdx} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2.5 rounded-xl space-y-1.5 shadow-2xs">
                                    <div className="flex items-center justify-between text-xs">
                                      <span className="font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                                        <span className="px-1.5 py-0.5 rounded text-[9.5px] font-black bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                                          Class {clsLabel}
                                        </span>
                                        <span>{subName} ({subCode})</span>
                                      </span>
                                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${typeLabel === 'EXTERNAL' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200' : 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200'}`}>
                                        {typeLabel}
                                      </span>
                                    </div>

                                    <div className="flex items-center justify-between text-[11px]">
                                      <span className="text-slate-500 font-medium">Evaluated Candidates:</span>
                                      <span className="font-black text-emerald-600 dark:text-emerald-400">{recCount} Students</span>
                                    </div>

                                    <div className="flex items-center justify-between text-[11px]">
                                      <span className="text-slate-500 font-medium">Progress Status:</span>
                                      <span className={`font-bold flex items-center gap-1 text-[10.5px] ${isDone ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-500'}`}>
                                        <CheckCircle2 size={12} /> {isDone ? 'Completed' : 'In Progress'}
                                      </span>
                                    </div>

                                    <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-1 text-[10px]">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          printIndividualAwardRoll({
                                            className: clsLabel,
                                            subjectCode: subCode,
                                            subjectName: subName,
                                            teacherName: sub.teacherName || sub['Teacher Name'] || t.name,
                                            teacherEmail: sub.teacherEmail || t.email,
                                            practicalType: sub.practicalType || 'internal',
                                            sessionText: sub.sessionText || 'Annual Regular 2025',
                                            records: sub.records || [],
                                            maxMarks: sub.maxMarks || 20
                                          });
                                        }}
                                        className="px-2 py-0.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 font-bold flex items-center gap-1 cursor-pointer"
                                      >
                                        <Printer size={10} /> Print Roll
                                      </button>
                                      <span className="text-slate-400 font-mono text-[9px]">{sub.id}</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
            {facultyMembers.length === 0 && (
              <tr>
                <td colSpan={4} className="p-6 text-center text-slate-400 font-bold">No faculty or examiner user accounts found in registry.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ──────── SETTINGS & PERMISSIONS VIEW (Exact layout from Screenshots 2, 3, & 4) ────────
function SettingsPermissionsView({
  settings,
  setSettings,
  saveSettingsDoc,
  saving,
  grantEmail,
  setGrantEmail,
  grantClass,
  setGrantClass,
  grantSubject,
  setGrantSubject,
  grantPerm,
  revokePerm
}) {
  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* 1. Portal Submission Status (Screenshot 2 Top) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        <h3 className="font-black text-sm text-indigo-600 flex items-center gap-2">Portal Submission Status</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700">Class 11th (Internal): <strong className={settings.statusControls?.class11_internal ? 'text-emerald-600' : 'text-rose-600'}>{settings.statusControls?.class11_internal ? 'ENABLED' : 'DISABLED'}</strong></span>
            <button onClick={() => saveSettingsDoc('Submission Control 11th', { ...settings, statusControls: { ...settings.statusControls, class11_internal: !settings.statusControls?.class11_internal } })} className="cursor-pointer">
              {settings.statusControls?.class11_internal ? <ToggleRight size={28} className="text-emerald-600" /> : <ToggleLeft size={28} className="text-slate-400" />}
            </button>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700">Class 12th (Internal): <strong className={settings.statusControls?.class12_internal ? 'text-emerald-600' : 'text-rose-600'}>{settings.statusControls?.class12_internal ? 'ENABLED' : 'DISABLED'}</strong></span>
            <button onClick={() => saveSettingsDoc('Submission Control 12th', { ...settings, statusControls: { ...settings.statusControls, class12_internal: !settings.statusControls?.class12_internal } })} className="cursor-pointer">
              {settings.statusControls?.class12_internal ? <ToggleRight size={28} className="text-emerald-600" /> : <ToggleLeft size={28} className="text-slate-400" />}
            </button>
          </div>
        </div>
      </div>

      {/* 2. Current Session & Type (Screenshot 2 Middle) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        <h3 className="font-black text-sm text-indigo-600">Current Session & Type</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div>
            <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Year Suffix (e.g., 25)</label>
            <input type="text" value={settings.currentYearSuffix || '26'} onChange={e => setSettings({ ...settings, currentYearSuffix: e.target.value })} className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 font-bold" />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Practical Type</label>
            <select value={settings.currentPracticalType || 'internal'} onChange={e => setSettings({ ...settings, currentPracticalType: e.target.value })} className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 font-bold">
              <option value="internal">Internal</option>
              <option value="external">External</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Center Name</label>
            <input type="text" value={settings.centerName || ''} onChange={e => setSettings({ ...settings, centerName: e.target.value })} className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 font-bold" />
          </div>
        </div>
        <button onClick={() => saveSettingsDoc('Session & Type Settings', settings)} disabled={saving} className="px-4 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-black cursor-pointer shadow-xs">Apply Session & Type</button>
      </div>

      {/* 3. Validation & Data Rules (Screenshot 2 Middle) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        <h3 className="font-black text-sm text-indigo-600">Validation & Data Rules</h3>
        <p className="text-xs text-slate-500 font-semibold">Set portal-wide absent marker and define non-practical subjects.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div>
            <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Absent Marker (e.g., A or AB)</label>
            <input type="text" value={settings.absentMarker || 'A'} onChange={e => setSettings({ ...settings, absentMarker: e.target.value })} className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 font-bold" />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Class 11th Non-Practical</label>
            <input type="text" value={settings.nonPractical11 || ''} onChange={e => setSettings({ ...settings, nonPractical11: e.target.value })} className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 font-bold" />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Class 12th Non-Practical</label>
            <input type="text" value={settings.nonPractical12 || ''} onChange={e => setSettings({ ...settings, nonPractical12: e.target.value })} className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 font-bold" />
          </div>
        </div>
        <button onClick={() => saveSettingsDoc('Validation Rules', settings)} disabled={saving} className="px-4 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-black cursor-pointer shadow-xs">Save Validation Rules</button>
      </div>

      {/* 4. Per-Subject Max Marks (Screenshot 3 Top) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        <h3 className="font-black text-sm text-indigo-600">Per-Subject Max Marks (INTERNAL)</h3>
        <p className="text-xs text-slate-500 font-semibold">Set the default maximum marks for each subject for the selected practical type.</p>
        <div className="space-y-3">
          <div>
            <span className="text-[10px] font-black uppercase text-slate-500 block mb-1">Class 11th Max Marks</span>
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 text-xs">
              {Object.keys(settings.maxMarks11 || DEFAULT_MX11).map(code => (
                <div key={code} className="flex items-center gap-1 p-1 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-[10px] font-black text-slate-600 w-6">{code}</span>
                  <input type="number" value={settings.maxMarks11?.[code] ?? 20} onChange={e => setSettings({ ...settings, maxMarks11: { ...settings.maxMarks11, [code]: Number(e.target.value) } })} className="w-full text-center bg-white rounded border border-slate-200 font-bold py-0.5" />
                </div>
              ))}
            </div>
          </div>
          <div>
            <span className="text-[10px] font-black uppercase text-slate-500 block mb-1">Class 12th Max Marks</span>
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 text-xs">
              {Object.keys(settings.maxMarks12 || DEFAULT_MX12).map(code => (
                <div key={code} className="flex items-center gap-1 p-1 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-[10px] font-black text-slate-600 w-6">{code}</span>
                  <input type="number" value={settings.maxMarks12?.[code] ?? 20} onChange={e => setSettings({ ...settings, maxMarks12: { ...settings.maxMarks12, [code]: Number(e.target.value) } })} className="w-full text-center bg-white rounded border border-slate-200 font-bold py-0.5" />
                </div>
              ))}
            </div>
          </div>
        </div>
        <button onClick={() => saveSettingsDoc('Max Marks Settings', settings)} disabled={saving} className="px-4 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-black cursor-pointer shadow-xs">Save Max Marks Settings</button>
      </div>

      {/* 5. Class 11th & 12th Print Details (Screenshots 3 & 4) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {['11th', '12th'].map(c => (
          <div key={c} className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
            <h3 className="font-black text-sm text-indigo-600">Class {c} - Institution & Print Details</h3>
            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div><label className="text-[9.5px] font-black text-slate-500 uppercase block mb-0.5">Institution Name</label><input type="text" value={settings.printDetails?.[c]?.instName || ''} onChange={e => setSettings(s => ({ ...s, printDetails: { ...s.printDetails, [c]: { ...s.printDetails?.[c], instName: e.target.value } } }))} className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 font-semibold" /></div>
              <div><label className="text-[9.5px] font-black text-slate-500 uppercase block mb-0.5">Institution Contact</label><input type="text" value={settings.printDetails?.[c]?.instContact || ''} onChange={e => setSettings(s => ({ ...s, printDetails: { ...s.printDetails, [c]: { ...s.printDetails?.[c], instContact: e.target.value } } }))} className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 font-semibold" /></div>
              <div><label className="text-[9.5px] font-black text-slate-500 uppercase block mb-0.5">Academic Session Text</label><input type="text" value={settings.printDetails?.[c]?.sessionText || ''} onChange={e => setSettings(s => ({ ...s, printDetails: { ...s.printDetails, [c]: { ...s.printDetails?.[c], sessionText: e.target.value } } }))} className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 font-semibold" /></div>
              <div><label className="text-[9.5px] font-black text-slate-500 uppercase block mb-0.5">Incharge Name</label><input type="text" value={settings.printDetails?.[c]?.inchargeName || ''} onChange={e => setSettings(s => ({ ...s, printDetails: { ...s.printDetails, [c]: { ...s.printDetails?.[c], inchargeName: e.target.value } } }))} className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 font-semibold" /></div>
              <div><label className="text-[9.5px] font-black text-slate-500 uppercase block mb-0.5">Incharge CPIS</label><input type="text" value={settings.printDetails?.[c]?.inchargeCpis || ''} onChange={e => setSettings(s => ({ ...s, printDetails: { ...s.printDetails, [c]: { ...s.printDetails?.[c], inchargeCpis: e.target.value } } }))} className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 font-semibold" /></div>
              <div><label className="text-[9.5px] font-black text-slate-500 uppercase block mb-0.5">Incharge Mobile</label><input type="text" value={settings.printDetails?.[c]?.inchargeMobile || ''} onChange={e => setSettings(s => ({ ...s, printDetails: { ...s.printDetails, [c]: { ...s.printDetails?.[c], inchargeMobile: e.target.value } } }))} className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 font-semibold" /></div>
            </div>
            <button onClick={() => saveSettingsDoc(`Class ${c} Print Details`, settings)} disabled={saving} className="px-3.5 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-black cursor-pointer shadow-xs">Save Class {c} Print Details</button>
          </div>
        ))}
      </div>

      {/* 6. Grant New Permission & Current Permissions (Screenshot 4 Bottom) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <h3 className="font-black text-sm text-indigo-600">Grant New Permission</h3>
        <form onSubmit={grantPerm} className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
          <input type="email" placeholder="Select or type teacher email" value={grantEmail} onChange={e => setGrantEmail(e.target.value)} className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 font-bold col-span-2" />
          <select value={grantClass} onChange={e => setGrantClass(e.target.value)} className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 font-bold"><option value="11th">11th Class</option><option value="12th">12th Class</option></select>
          <button type="submit" className="px-4 py-1.5 bg-indigo-600 text-white rounded-xl font-black cursor-pointer shadow-xs">Grant Permission</button>
        </form>

        <div className="pt-2">
          <h4 className="text-xs font-black text-slate-700 dark:text-slate-300 mb-2">Current Permissions</h4>
          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full text-left text-xs">
              <thead className="bg-sky-50 text-[10px] font-black uppercase text-slate-600">
                <tr><th className="py-2 px-3">EMAIL</th><th className="py-2 px-3">CLASS</th><th className="py-2 px-3">SUBJECT</th><th className="py-2 px-3">DATE GRANTED</th><th className="py-2 px-3 text-right">ACTION</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
                {(settings.permissions || []).map((p, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="py-2 px-3 font-bold">{p.email}</td>
                    <td className="py-2 px-3">{p.className}</td>
                    <td className="py-2 px-3">{p.subject}</td>
                    <td className="py-2 px-3 text-slate-500">{p.grantedAt || '—'}</td>
                    <td className="py-2 px-3 text-right"><button onClick={() => revokePerm(idx)} className="text-rose-600 hover:underline font-bold text-[11px]">Revoke</button></td>
                  </tr>
                ))}
                {(!settings.permissions || settings.permissions.length === 0) && (
                  <tr><td colSpan={5} className="p-4 text-center text-slate-400 font-bold">No permissions granted.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
