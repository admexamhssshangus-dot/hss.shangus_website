import React, { useState, useEffect, useRef } from 'react';
import { 
  User, BookOpen, Phone, Landmark, Image as ImageIcon, Save, PlusCircle, 
  CheckCircle2, AlertTriangle, RefreshCw, Upload, Trash2, Camera, Sparkles,
  ShieldCheck, ArrowRight
} from 'lucide-react';
import { db } from '../../../services/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { updateCachedItem } from '../../../services/dbCache';
import { logAdminActivity } from '../../../services/adminActivityLogger';
import { compressImageFile } from '../../../utils/imageCompressor';
import { getNextAvailableFormNumber, consumeFormNumber } from '../../../services/formNumberService';
import { toTitleCase } from '../../../utils/textFormatting';

const DEFAULT_STREAMS = ['Science', 'Medical', 'Non-Medical', 'Arts', 'Commerce', 'Humanities', 'General'];
const DEFAULT_CLASSES = ['11th', '12th', '10th', '9th'];
const DEFAULT_SESSIONS = ['2025-26', '2024-25', '2026 APR/BIAN', '2023-24'];

const QUICK_SUBJECTS_BY_STREAM = {
  Science: ['General English', 'Physics', 'Chemistry', 'Biology', 'Mathematics', 'Environmental Science'],
  Medical: ['General English', 'Physics', 'Chemistry', 'Biology', 'Environmental Science'],
  'Non-Medical': ['General English', 'Physics', 'Chemistry', 'Mathematics', 'Environmental Science'],
  Arts: ['General English', 'Political Science', 'History', 'Education', 'Sociology', 'Urdu', 'Economics'],
  Commerce: ['General English', 'Accountancy', 'Business Studies', 'Economics', 'Mathematics'],
  General: ['English', 'Mathematics', 'Science', 'Social Science', 'Urdu']
};

export default function ExpressDirectIngestionTab({
  onRecordAdded,
  onClose,
  allStudents = [],
  currentSession = '2025-26',
  showToast
}) {
  const [subTab, setSubTab] = useState('personal'); // 'personal' | 'academic' | 'contact' | 'bank' | 'photo'
  const [isSaving, setIsSaving] = useState(false);
  const [addedCount, setAddedCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);

  const [formData, setFormData] = useState({
    studentName: '',
    fatherName: '',
    motherName: '',
    dob: '',
    gender: 'Male',
    category: 'General',
    religion: 'Islam',
    bloodGroup: '',
    
    // Academic
    class: '11th',
    session: currentSession || '2025-26',
    stream: 'Science',
    classRollNo: '',
    boardRegNo: '',
    admNo: '',
    formNo: '',
    subs: 'General English, Physics, Chemistry, Biology',
    prevSchool: '',
    prevExamRollNo: '',
    prevMarks: '',
    prevMaxMarks: '500',
    prevPercentage: '',

    // Contact
    mobile: '',
    parentMobile: '',
    email: '',
    village: '',
    block: '',
    tehsil: '',
    district: 'Anantnag',
    state: 'Jammu & Kashmir',
    pinCode: '',

    // Bank & ID
    aadhar: '',
    fatherAadhar: '',
    apaarId: '',
    penNo: '',
    bankAccount: '',
    bankName: '',
    ifsc: '',

    // Photo & Status
    photoUrl: '',
    status: 'Approved',
    remarks: 'Express Admin Direct Ingestion'
  });

  const photoInputRef = useRef(null);

  // Auto-generate next form number on mount or after save
  const fetchNextFormNo = async (sess) => {
    try {
      const nextNo = await getNextAvailableFormNumber(sess || formData.session);
      if (nextNo) {
        setFormData(prev => ({ ...prev, formNo: String(nextNo) }));
      }
    } catch (err) {
      console.warn('Could not auto-generate form number:', err);
    }
  };

  useEffect(() => {
    fetchNextFormNo(formData.session);
  }, []);

  const handleChange = (field, value) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      
      // Auto-compute percentage if marks change
      if (field === 'prevMarks' || field === 'prevMaxMarks') {
        const marks = parseFloat(field === 'prevMarks' ? value : prev.prevMarks);
        const max = parseFloat(field === 'prevMaxMarks' ? value : prev.prevMaxMarks);
        if (!isNaN(marks) && !isNaN(max) && max > 0) {
          updated.prevPercentage = ((marks / max) * 100).toFixed(1);
        }
      }

      // Stream change can suggest subjects if empty
      if (field === 'stream' && QUICK_SUBJECTS_BY_STREAM[value]) {
        if (!prev.subs || prev.subs.trim().length === 0) {
          updated.subs = QUICK_SUBJECTS_BY_STREAM[value].join(', ');
        }
      }

      return updated;
    });
  };

  // Handle photo selection & compression
  const handlePhotoSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressed = await compressImageFile(file, { maxWidth: 600, maxHeight: 600, quality: 0.85 });
      setFormData(prev => ({ ...prev, photoUrl: compressed }));
      setPhotoPreview(compressed);
      if (showToast) showToast('✓ Student photo compressed and attached.', 'success');
    } catch (err) {
      console.error('Photo compression error:', err);
      // Fallback direct base64
      const reader = new FileReader();
      reader.onload = (evt) => {
        setFormData(prev => ({ ...prev, photoUrl: evt.target.result }));
        setPhotoPreview(evt.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemovePhoto = () => {
    setFormData(prev => ({ ...prev, photoUrl: '' }));
    setPhotoPreview(null);
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  // Quick subject toggle
  const toggleSubject = (subName) => {
    const currentList = formData.subs ? formData.subs.split(',').map(s => s.trim()).filter(Boolean) : [];
    let updated;
    if (currentList.includes(subName)) {
      updated = currentList.filter(s => s !== subName);
    } else {
      updated = [...currentList, subName];
    }
    setFormData(prev => ({ ...prev, subs: updated.join(', ') }));
  };

  // Validate and save record
  const saveStudentRecord = async (andClose = false) => {
    setErrorMsg(null);
    if (!formData.studentName.trim()) {
      setErrorMsg("Student's Full Name is required to register a record.");
      setSubTab('personal');
      return;
    }

    setIsSaving(true);
    try {
      const docId = `admin_express_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      const cleanFormNo = formData.formNo.trim() || `EXP-${Date.now().toString().slice(-6)}`;

      // Canonical student document payload matching admissions schema
      const payload = {
        id: docId,
        formNo: cleanFormNo,
        'Form Number': cleanFormNo,
        studentName: toTitleCase(formData.studentName.trim()),
        "Student's Name": toTitleCase(formData.studentName.trim()),
        "Student's Name (as per school records)": toTitleCase(formData.studentName.trim()),
        fatherName: toTitleCase(formData.fatherName.trim()),
        "Father's Name": toTitleCase(formData.fatherName.trim()),
        "Father's/Guardian's Name (as per school records)": toTitleCase(formData.fatherName.trim()),
        motherName: toTitleCase(formData.motherName.trim()),
        "Mother's Name": toTitleCase(formData.motherName.trim()),
        dob: formData.dob || '',
        'DoB (figures)': formData.dob || '',
        gender: formData.gender || 'Male',
        category: formData.category || 'General',
        'Social Category': formData.category || 'General',
        religion: formData.religion || 'Islam',
        bloodGroup: formData.bloodGroup || '',

        // Academic
        class: formData.class,
        'Admission sought for class': formData.class,
        session: formData.session,
        'Academic Session': formData.session,
        stream: formData.stream,
        'Stream for Class 11th': formData.stream,
        subs: formData.subs,
        Subjects: formData.subs,
        classRollNo: formData.classRollNo.trim(),
        'Class Roll No': formData.classRollNo.trim(),
        boardRegNo: formData.boardRegNo.trim(),
        'Board Registration Number': formData.boardRegNo.trim(),
        admNo: formData.admNo.trim(),
        'Admission No.': formData.admNo.trim(),
        prevSchool: formData.prevSchool.trim(),
        'Previous School': formData.prevSchool.trim(),
        prevExamRollNo: formData.prevExamRollNo.trim(),
        'Roll No. (Class 10th)': formData.prevExamRollNo.trim(),
        prevMarks: formData.prevMarks,
        'Marks Obtained (Class 10th)': formData.prevMarks,
        prevMaxMarks: formData.prevMaxMarks,
        'Max Marks (Class 10th)': formData.prevMaxMarks,
        prevPercentage: formData.prevPercentage,
        'Percentage (Class 10th)': formData.prevPercentage,

        // Contact
        mobile: formData.mobile.trim(),
        'Mobile No. (with working WhatsApp)': formData.mobile.trim(),
        parentMobile: formData.parentMobile.trim(),
        "Parent's Mobile No.": formData.parentMobile.trim(),
        email: formData.email.trim(),
        village: toTitleCase(formData.village.trim()),
        'Name of your village': toTitleCase(formData.village.trim()),
        block: toTitleCase(formData.block.trim()),
        tehsil: toTitleCase(formData.tehsil.trim()),
        district: formData.district,
        state: formData.state,
        pinCode: formData.pinCode.trim(),

        // Bank & ID
        aadhar: formData.aadhar.trim(),
        'Aadhaar Number (12 Digits)': formData.aadhar.trim(),
        fatherAadhar: formData.fatherAadhar.trim(),
        apaarId: formData.apaarId.trim(),
        'APAAR ID': formData.apaarId.trim(),
        penNo: formData.penNo.trim(),
        'Permanent Education Number (PEN)': formData.penNo.trim(),
        bankAccount: formData.bankAccount.trim(),
        'Bank Account Number': formData.bankAccount.trim(),
        bankName: formData.bankName.trim(),
        ifsc: formData.ifsc.trim(),

        // Photo & Status
        photoUrl: formData.photoUrl || '',
        'Student Photo': formData.photoUrl || '',
        status: formData.status || 'Approved',
        Status: formData.status || 'Approved',
        remarks: formData.remarks,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        ingestionType: 'admin_express_direct'
      };

      // 1. Commit to Firestore
      await setDoc(doc(db, 'admissions', docId), payload);

      // 2. Commit form number sequence consumption
      if (formData.formNo) {
        await consumeFormNumber(formData.formNo, formData.session).catch(() => {});
      }

      // 3. Update local dbCache for instant reflection
      updateCachedItem('admissions', docId, payload);

      // 4. Log Admin Activity
      await logAdminActivity({
        actionType: 'express_student_ingestion',
        actionTitle: 'Express Direct Student Registration',
        details: `Directly registered student "${payload.studentName}" (Form: ${cleanFormNo}, Class: ${formData.class}, Session: ${formData.session}) into live registry.`,
        reasonCategory: 'Express Single Registration',
        metadata: {
          docId,
          formNo: cleanFormNo,
          studentName: payload.studentName,
          class: formData.class,
          session: formData.session
        }
      });

      // 5. Notify system event
      window.dispatchEvent(new CustomEvent('hss-results-updated'));
      window.dispatchEvent(new CustomEvent('hss-admissions-updated'));

      setAddedCount(prev => prev + 1);
      if (showToast) {
        showToast(`🎉 Successfully registered "${payload.studentName}" (Form ${cleanFormNo})!`, 'success');
      }

      if (onRecordAdded) {
        onRecordAdded(payload);
      }

      if (andClose) {
        onClose();
      } else {
        // Reset form for next student while preserving cohort (class, session, stream)
        const preservedClass = formData.class;
        const preservedSession = formData.session;
        const preservedStream = formData.stream;
        setFormData({
          studentName: '',
          fatherName: '',
          motherName: '',
          dob: '',
          gender: 'Male',
          category: 'General',
          religion: 'Islam',
          bloodGroup: '',
          class: preservedClass,
          session: preservedSession,
          stream: preservedStream,
          classRollNo: '',
          boardRegNo: '',
          admNo: '',
          formNo: '',
          subs: QUICK_SUBJECTS_BY_STREAM[preservedStream]?.join(', ') || '',
          prevSchool: '',
          prevExamRollNo: '',
          prevMarks: '',
          prevMaxMarks: '500',
          prevPercentage: '',
          mobile: '',
          parentMobile: '',
          email: '',
          village: '',
          block: '',
          tehsil: '',
          district: 'Anantnag',
          state: 'Jammu & Kashmir',
          pinCode: '',
          aadhar: '',
          fatherAadhar: '',
          apaarId: '',
          penNo: '',
          bankAccount: '',
          bankName: '',
          ifsc: '',
          photoUrl: '',
          status: 'Approved',
          remarks: 'Express Admin Direct Ingestion'
        });
        setPhotoPreview(null);
        setSubTab('personal');
        fetchNextFormNo(preservedSession);
      }
    } catch (err) {
      console.error('Express Ingestion Error:', err);
      setErrorMsg('Failed to save student record: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const subTabs = [
    { id: 'personal', label: 'Personal', icon: User },
    { id: 'academic', label: 'Academic', icon: BookOpen },
    { id: 'contact', label: 'Contact', icon: Phone },
    { id: 'bank', label: 'Bank & ID', icon: Landmark },
    { id: 'photo', label: 'Photo & Status', icon: ImageIcon },
  ];

  return (
    <div className="space-y-4">
      {/* Banner / Title Matching Screenshot */}
      <div className="p-3.5 rounded-2xl bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-950/30 dark:via-indigo-950/20 dark:to-purple-950/30 border border-blue-200 dark:border-blue-900/60 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black shadow-xs">
            <Sparkles size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-black text-slate-900 dark:text-white">
                ⚡ Direct Student Ingestion (Express Admin Entry)
              </h3>
              <span className="text-[9px] px-2 py-0.5 rounded-full font-black bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
                Admin Privileged Ingestion
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              Quickly register and persist verified student records directly into the live admission registry with immediate confirmation.
            </p>
          </div>
        </div>

        {addedCount > 0 && (
          <div className="text-[11px] font-black text-emerald-700 dark:text-emerald-300 bg-emerald-100/70 dark:bg-emerald-950/80 px-3 py-1 rounded-xl border border-emerald-300 dark:border-emerald-800 flex items-center gap-1.5">
            <CheckCircle2 size={13} />
            <span>{addedCount} student(s) added this session</span>
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
          <AlertTriangle size={15} className="shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Subtab Navigation Pills */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/70 rounded-xl overflow-x-auto">
        {subTabs.map(t => {
          const Icon = t.icon;
          const isActive = subTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setSubTab(t.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                isActive
                  ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 shadow-xs font-black'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Icon size={14} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Subtab Contents */}
      <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xs">
        
        {/* 1. PERSONAL DETAILS */}
        {subTab === 'personal' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            <div className="sm:col-span-2 lg:col-span-1">
              <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-1">
                Student's Full Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={formData.studentName}
                onChange={(e) => handleChange('studentName', e.target.value)}
                placeholder="e.g. Danish Ahmad Bhat"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-1">
                Father's / Guardian's Name
              </label>
              <input
                type="text"
                value={formData.fatherName}
                onChange={(e) => handleChange('fatherName', e.target.value)}
                placeholder="e.g. Ghulam Hassan Bhat"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-1">
                Mother's Name
              </label>
              <input
                type="text"
                value={formData.motherName}
                onChange={(e) => handleChange('motherName', e.target.value)}
                placeholder="e.g. Naseema Banoo"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-1">
                Date of Birth (DoB)
              </label>
              <input
                type="date"
                value={formData.dob}
                onChange={(e) => handleChange('dob', e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-1">
                Gender
              </label>
              <select
                value={formData.gender}
                onChange={(e) => handleChange('gender', e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-1">
                Social Category
              </label>
              <select
                value={formData.category}
                onChange={(e) => handleChange('category', e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
              >
                <option value="General">General / OM</option>
                <option value="RBA">RBA</option>
                <option value="SC">SC</option>
                <option value="ST">ST</option>
                <option value="OBC">OBC</option>
                <option value="EWS">EWS</option>
                <option value="PSP">PSP</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-1">
                Religion
              </label>
              <input
                type="text"
                value={formData.religion}
                onChange={(e) => handleChange('religion', e.target.value)}
                placeholder="Islam / Hinduism / etc."
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-1">
                Blood Group
              </label>
              <input
                type="text"
                value={formData.bloodGroup}
                onChange={(e) => handleChange('bloodGroup', e.target.value)}
                placeholder="e.g. O+, B+, A+"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>
        )}

        {/* 2. ACADEMIC DETAILS */}
        {subTab === 'academic' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div>
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-1">
                  Admission Class
                </label>
                <select
                  value={formData.class}
                  onChange={(e) => handleChange('class', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
                >
                  {DEFAULT_CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-1">
                  Academic Session
                </label>
                <select
                  value={formData.session}
                  onChange={(e) => {
                    handleChange('session', e.target.value);
                    fetchNextFormNo(e.target.value);
                  }}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
                >
                  {DEFAULT_SESSIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-1">
                  Stream / Faculty
                </label>
                <select
                  value={formData.stream}
                  onChange={(e) => handleChange('stream', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
                >
                  {DEFAULT_STREAMS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-1">
                  Form Number
                </label>
                <input
                  type="text"
                  value={formData.formNo}
                  onChange={(e) => handleChange('formNo', e.target.value)}
                  placeholder="Auto-generated"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-1">
                  Class Roll No.
                </label>
                <input
                  type="text"
                  value={formData.classRollNo}
                  onChange={(e) => handleChange('classRollNo', e.target.value)}
                  placeholder="e.g. 101"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-1">
                  Board Reg. No. (JKBOSE)
                </label>
                <input
                  type="text"
                  value={formData.boardRegNo}
                  onChange={(e) => handleChange('boardRegNo', e.target.value)}
                  placeholder="e.g. 2161234-2024-0012"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-emerald-800 dark:text-emerald-300 focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-1">
                  Admission No. (Adm No.)
                </label>
                <input
                  type="text"
                  value={formData.admNo}
                  onChange={(e) => handleChange('admNo', e.target.value)}
                  placeholder="e.g. ADM-842"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-1">
                  Previous School
                </label>
                <input
                  type="text"
                  value={formData.prevSchool}
                  onChange={(e) => handleChange('prevSchool', e.target.value)}
                  placeholder="e.g. BHS Shangus"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            {/* Subjects Offered */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-black text-slate-700 dark:text-slate-300">
                  Subjects Offered / Combination
                </label>
                <span className="text-[10px] text-slate-400">Click tags below or type directly</span>
              </div>

              <input
                type="text"
                value={formData.subs}
                onChange={(e) => handleChange('subs', e.target.value)}
                placeholder="Comma-separated subjects"
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              />

              {/* Quick Subject Tags */}
              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                {(QUICK_SUBJECTS_BY_STREAM[formData.stream] || QUICK_SUBJECTS_BY_STREAM['Science']).map(s => {
                  const isSelected = formData.subs?.toLowerCase().includes(s.toLowerCase());
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleSubject(s)}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:border-blue-400'
                      }`}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Previous Qualifying Exam Results */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-1">
                  10th Roll No.
                </label>
                <input
                  type="text"
                  value={formData.prevExamRollNo}
                  onChange={(e) => handleChange('prevExamRollNo', e.target.value)}
                  placeholder="e.g. 21612450"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-1">
                  Marks Obtained
                </label>
                <input
                  type="number"
                  value={formData.prevMarks}
                  onChange={(e) => handleChange('prevMarks', e.target.value)}
                  placeholder="e.g. 430"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-1">
                  Maximum Marks
                </label>
                <input
                  type="number"
                  value={formData.prevMaxMarks}
                  onChange={(e) => handleChange('prevMaxMarks', e.target.value)}
                  placeholder="500"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-1">
                  Percentage (%)
                </label>
                <input
                  type="text"
                  readOnly
                  value={formData.prevPercentage ? `${formData.prevPercentage}%` : ''}
                  placeholder="Auto-calculated"
                  className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* 3. CONTACT & RESIDENCE */}
        {subTab === 'contact' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            <div>
              <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-1">
                Student Mobile No. (WhatsApp)
              </label>
              <input
                type="text"
                value={formData.mobile}
                onChange={(e) => handleChange('mobile', e.target.value)}
                placeholder="10-digit mobile number"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-1">
                Parent's Contact No.
              </label>
              <input
                type="text"
                value={formData.parentMobile}
                onChange={(e) => handleChange('parentMobile', e.target.value)}
                placeholder="Father/Guardian Mobile"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                placeholder="student@example.com"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-1">
                Permanent Village / Town Address
              </label>
              <input
                type="text"
                value={formData.village}
                onChange={(e) => handleChange('village', e.target.value)}
                placeholder="e.g. Shangus, Nowgam, Chittergul"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-1">
                Tehsil
              </label>
              <input
                type="text"
                value={formData.tehsil}
                onChange={(e) => handleChange('tehsil', e.target.value)}
                placeholder="e.g. Shangus"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-1">
                District
              </label>
              <input
                type="text"
                value={formData.district}
                onChange={(e) => handleChange('district', e.target.value)}
                placeholder="Anantnag"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-1">
                PIN Code
              </label>
              <input
                type="text"
                value={formData.pinCode}
                onChange={(e) => handleChange('pinCode', e.target.value)}
                placeholder="192201"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>
        )}

        {/* 4. BANK & OFFICIAL IDS */}
        {subTab === 'bank' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            <div>
              <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-1">
                Aadhaar Number (12 Digits)
              </label>
              <input
                type="text"
                maxLength={14}
                value={formData.aadhar}
                onChange={(e) => handleChange('aadhar', e.target.value)}
                placeholder="xxxx-xxxx-xxxx"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-1">
                Father's Aadhaar No.
              </label>
              <input
                type="text"
                maxLength={14}
                value={formData.fatherAadhar}
                onChange={(e) => handleChange('fatherAadhar', e.target.value)}
                placeholder="xxxx-xxxx-xxxx"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-1">
                APAAR ID (12 Digits)
              </label>
              <input
                type="text"
                maxLength={12}
                value={formData.apaarId}
                onChange={(e) => handleChange('apaarId', e.target.value)}
                placeholder="12-digit APAAR"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-1">
                Student PEN No. (Permanent Education Number)
              </label>
              <input
                type="text"
                value={formData.penNo}
                onChange={(e) => handleChange('penNo', e.target.value)}
                placeholder="11-digit PEN"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-1">
                Bank Account Number
              </label>
              <input
                type="text"
                value={formData.bankAccount}
                onChange={(e) => handleChange('bankAccount', e.target.value)}
                placeholder="e.g. 0244040100012345"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-1">
                Bank Name & Branch
              </label>
              <input
                type="text"
                value={formData.bankName}
                onChange={(e) => handleChange('bankName', e.target.value)}
                placeholder="e.g. J&K Bank Shangus"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-1">
                IFSC Code
              </label>
              <input
                type="text"
                value={formData.ifsc}
                onChange={(e) => handleChange('ifsc', e.target.value.toUpperCase())}
                placeholder="JAKA0SHANGU"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>
        )}

        {/* 5. PHOTO & REGISTRY STATUS */}
        {subTab === 'photo' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
            {/* Photo Dropzone */}
            <div className="p-4 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 text-center space-y-3 bg-slate-50/50 dark:bg-slate-800/30">
              <label className="block text-xs font-black text-slate-700 dark:text-slate-300">
                Passport Size Photograph
              </label>

              {photoPreview ? (
                <div className="flex flex-col items-center gap-2">
                  <img 
                    src={photoPreview} 
                    alt="Student Preview" 
                    className="w-24 h-28 object-cover rounded-lg border-2 border-emerald-500 shadow-md"
                  />
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 size={12} />
                    <span>Remove Photo</span>
                  </button>
                </div>
              ) : (
                <div 
                  onClick={() => photoInputRef.current?.click()}
                  className="cursor-pointer py-4 flex flex-col items-center justify-center space-y-1 hover:text-blue-600 transition-colors"
                >
                  <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                    <Camera size={22} />
                  </div>
                  <span className="text-xs font-bold">Click to upload photo</span>
                  <span className="text-[10px] text-slate-400">Auto-compressed JPG/PNG under 100KB</span>
                </div>
              )}

              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoSelect}
                className="hidden"
              />
            </div>

            {/* Status & Remarks */}
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-1">
                  Admission Registry Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => handleChange('status', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
                >
                  <option value="Approved">Approved (Confirmed Student)</option>
                  <option value="Provisional">Provisional Admission</option>
                  <option value="Pending">Pending Verification</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-1">
                  Registry Remarks
                </label>
                <textarea
                  rows={3}
                  value={formData.remarks}
                  onChange={(e) => handleChange('remarks', e.target.value)}
                  placeholder="Additional notes, board documents submitted, or admission details"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons Matching Screenshot */}
      <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-xs cursor-pointer transition-colors"
        >
          Cancel
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={isSaving}
            onClick={() => saveStudentRecord(false)}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs shadow-md flex items-center gap-1.5 cursor-pointer transition-all disabled:opacity-50 active:scale-98"
          >
            {isSaving ? <RefreshCw size={13} className="animate-spin" /> : <PlusCircle size={14} />}
            <span>Save & Add Another</span>
          </button>

          <button
            type="button"
            disabled={isSaving}
            onClick={() => saveStudentRecord(true)}
            className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-black text-xs shadow-md flex items-center gap-1.5 cursor-pointer transition-all disabled:opacity-50 active:scale-98"
          >
            {isSaving ? <RefreshCw size={13} className="animate-spin" /> : <CheckCircle2 size={14} />}
            <span>Save & Close</span>
          </button>
        </div>
      </div>
    </div>
  );
}
