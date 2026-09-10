import { applyRecordPatch, completeMutationJob } from '../../services/recordMutationService';
import React, { useState, useEffect } from 'react';
import { 
  X, AlertTriangle, ShieldAlert, Save, RefreshCw, CheckCircle2, 
  User, BookOpen, Calendar, Award, Phone, Hash, ShieldCheck
} from 'lucide-react';
import { db } from '../../services/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { updateCachedItem, getCachedCollectionSync } from '../../services/dbCache';
import { logAdminActivity } from '../../services/adminActivityLogger';
import { cleanRawSubjectTokens } from './AdvancedReports';

export default function MasterRegisterQuickEditModal({
  isOpen,
  onClose,
  student,
  onSaved
}) {
  const [formData, setFormData] = useState({});
  const [hasAcknowledgedWarning, setHasAcknowledgedWarning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    if (!isOpen || !student) return;
    const initialize = () => {
      return {
      studentName: student.studentName || student["Student's Name (as per school records)"] || student["Student's Name"] || '',
      fatherName: student.fatherName || student["Father's/Guardian's Name (as per school records)"] || student["Father's Name"] || '',
      motherName: student.motherName || student["Mother's Name (as per school records)"] || student["Mother's Name"] || '',
      dob: student.dob || student['DoB (figures)'] || student['DoB (as per school records)'] || '',
      dobWords: student.dobWords || student['DoB (words)'] || '',
      gender: student.gender || student['Gender'] || 'Male',
      stream: student.stream || student['Stream'] || 'Science',
      subjects: student.subs || student.subjects || student['Subjects'] || '',
      boardRegNo: student.boardRegNo || student.regNo || student['Board Registration Number'] || student['Board Reg. No.'] || '',
      admNo: student.admNo || student['Admission No.'] || student['Adm. No.'] || '',
      classRollNo: student.classRollNo || student.rollNo || student['Class Roll No'] || student['Class Roll No.'] || '',
      category: student.category || student['Cat._JKBOSE'] || student['Category'] || 'General'
    };
    };
    setFormData(initialize());
    setHasAcknowledgedWarning(false);
    setErrorMsg(null);
  }, [isOpen, student]);

  if (!isOpen || !student) return null;

  const sessionTag = student.session || student.Session || 'Historical';
  const classTag = student.class || student.Class || '11th';

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!hasAcknowledgedWarning) {
      setErrorMsg('Please review and acknowledge the historical ledger warning before proceeding.');
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);

    try {
      const normalized = (val) => String(val || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const formNo = student.formNo || student['Form Number'] || student['Form No.'] || student.id;
      const regNo = student.boardRegNo || student.regNo || student['Board Registration Number'];
      const studentName = student.studentName || student["Student's Name"];

      const cleanedSubs = cleanRawSubjectTokens(formData.subjects);

      const patch = {
        studentName: String(formData.studentName || '').trim(),
        "Student's Name (as per school records)": String(formData.studentName || '').trim(),
        "Student's Name": String(formData.studentName || '').trim(),
        "Student Name": String(formData.studentName || '').trim(),

        fatherName: formData.fatherName.trim(),
        "Father's/Guardian's Name (as per school records)": formData.fatherName.trim(),
        "Father's Name": formData.fatherName.trim(),

        motherName: formData.motherName.trim(),
        "Mother's Name (as per school records)": formData.motherName.trim(),
        "Mother's Name": formData.motherName.trim(),

        dob: formData.dob.trim(),
        "DoB (figures)": formData.dob.trim(),
        "DoB (as per school records)": formData.dob.trim(),
        dobWords: formData.dobWords.trim(),
        "DoB (words)": formData.dobWords.trim(),

        gender: formData.gender,
        "Gender": formData.gender,

        stream: formData.stream,
        "Stream": formData.stream,

        subjects: cleanedSubs.join(', '),
        subs: cleanedSubs.join(', '),
        "Subjects": cleanedSubs.join(', '),
        "Subs": cleanedSubs.join(', '),
        selectedSubjects: cleanedSubs,

        boardRegNo: formData.boardRegNo.trim(),
        regNo: formData.boardRegNo.trim(),
        "Board Registration Number": formData.boardRegNo.trim(),
        "Board Reg. No.": formData.boardRegNo.trim(),

        admNo: formData.admNo.trim(),
        "Admission No.": formData.admNo.trim(),
        "Adm. No.": formData.admNo.trim(),

        classRollNo: formData.classRollNo.trim(),
        rollNo: formData.classRollNo.trim(),
        "Class Roll No": formData.classRollNo.trim(),
        "Class Roll No.": formData.classRollNo.trim(),

        category: formData.category,
        "Cat._JKBOSE": formData.category,
        "Category": formData.category,

        lastEditedBy: 'Admin (Master Registers Quick Edit Tool)',
        updatedAt: new Date().toISOString()
      };

      // Set individual subject slots
      for (let index = 1; index <= 6; index++) {
        patch[`Subjects${index}`] = '';
        patch[`subject${index}`] = '';
      }
      cleanedSubs.forEach((subName, sIdx) => {
        if (sIdx < 6) {
          patch[`Subjects${sIdx + 1}`] = subName;
          patch[`subject${sIdx + 1}`] = subName;
        }
      });

      const jobId = await applyRecordPatch({ ...student, _source: 'masterRegisters' }, patch);
      await completeMutationJob(jobId);

      // 3. Log Admin Activity
      await logAdminActivity({
        actionType: 'master_register_quick_edit',
        actionTitle: `Historical Ledger Quick Edit: ${formData.studentName}`,
        details: `Modified archived master register entry for ${formData.studentName} (${classTag}, ${sessionTag})`,
        reasonCategory: 'Historical Master Register Correction',
        metadata: {
          studentName: formData.studentName,
          session: sessionTag,
          class: classTag,
          regNo: formData.boardRegNo
        }
      });

      // 4. Notify UI components
      window.dispatchEvent(new CustomEvent('hss-master-register-updated'));
      window.dispatchEvent(new CustomEvent('hss-results-updated'));

      setIsSaving(false);
      if (onSaved) onSaved({ ...student, ...patch });
      onClose();
    } catch (err) {
      console.error('Master register update error:', err);
      setErrorMsg('Failed to update historical record: ' + err.message);
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 overflow-y-auto animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-amber-500/10 via-transparent to-purple-500/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-600 text-white flex items-center justify-center shadow-sm">
              <ShieldAlert size={18} />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>Quick Master Register Editor</span>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-800">
                  {sessionTag} • {classTag}
                </span>
              </h2>
              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                Directly correct verified fields within historical institutional archives
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-5 overflow-y-auto flex-1 custom-scrollbar space-y-4 text-xs">
          
          {/* User-Approved Safety Warning Box */}
          <div className="p-3.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/40 border-2 border-amber-400/80 dark:border-amber-600/80 text-amber-900 dark:text-amber-200 space-y-2">
            <div className="flex items-center gap-2 font-black text-xs">
              <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400 shrink-0" />
              <span>⚠️ Caution: Modifying Permanent Master Ledger</span>
            </div>
            <p className="text-[11px] font-bold leading-relaxed text-amber-800 dark:text-amber-300">
              You are editing an archived record from historical session <strong>{sessionTag}</strong>. Changes made here alter permanent government ledgers, student bonafide verification data, and gazette records.
            </p>
            <label className="flex items-center gap-2 pt-1 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={hasAcknowledgedWarning}
                onChange={(e) => setHasAcknowledgedWarning(e.target.checked)}
                className="rounded border-amber-400 text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer"
              />
              <span className="text-[10.5px] font-black text-amber-950 dark:text-amber-100">
                I acknowledge the institutional impact of modifying this historical master record.
              </span>
            </label>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
              <AlertTriangle size={15} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Form Fields Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Student Name */}
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 mb-1">
                Student Name (Official)
              </label>
              <input
                type="text"
                value={formData.studentName}
                onChange={(e) => handleChange('studentName', e.target.value)}
                required
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-slate-800 dark:text-slate-200"
              />
            </div>

            {/* Father's Name */}
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 mb-1">
                Father's Name
              </label>
              <input
                type="text"
                value={formData.fatherName}
                onChange={(e) => handleChange('fatherName', e.target.value)}
                required
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-slate-800 dark:text-slate-200"
              />
            </div>

            {/* Mother's Name */}
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 mb-1">
                Mother's Name
              </label>
              <input
                type="text"
                value={formData.motherName}
                onChange={(e) => handleChange('motherName', e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-slate-800 dark:text-slate-200"
              />
            </div>

            {/* Date of Birth */}
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 mb-1">
                Date of Birth (DD-MM-YYYY)
              </label>
              <input
                type="text"
                value={formData.dob}
                onChange={(e) => handleChange('dob', e.target.value)}
                placeholder="e.g. 14-09-2009"
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-slate-800 dark:text-slate-200"
              />
            </div>

            {/* Board Reg No */}
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 mb-1">
                Board Registration Number
              </label>
              <input
                type="text"
                value={formData.boardRegNo}
                onChange={(e) => handleChange('boardRegNo', e.target.value)}
                placeholder="e.g. 2301010000900057"
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono font-bold text-slate-800 dark:text-slate-200"
              />
            </div>

            {/* Admission No */}
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 mb-1">
                School Admission Number
              </label>
              <input
                type="text"
                value={formData.admNo}
                onChange={(e) => handleChange('admNo', e.target.value)}
                placeholder="e.g. 5136"
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-slate-800 dark:text-slate-200"
              />
            </div>

            {/* Stream */}
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 mb-1">
                Stream / Faculty
              </label>
              <select
                value={formData.stream}
                onChange={(e) => handleChange('stream', e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-slate-800 dark:text-slate-200"
              >
                <option value="Science">Science</option>
                <option value="Humanities">Humanities (Arts)</option>
                <option value="Commerce">Commerce</option>
                <option value="General">General</option>
              </select>
            </div>

            {/* Gender */}
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 mb-1">
                Gender
              </label>
              <select
                value={formData.gender}
                onChange={(e) => handleChange('gender', e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-slate-800 dark:text-slate-200"
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {/* Subjects (Full Span) */}
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 mb-1">
                Subjects (Comma-separated)
              </label>
              <input
                type="text"
                value={formData.subjects}
                onChange={(e) => handleChange('subjects', e.target.value)}
                placeholder="e.g. General English, Physics, Chemistry, Biology, Environmental Science"
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-slate-800 dark:text-slate-200"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-bold text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSaving || !hasAcknowledgedWarning}
              className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-xs shadow-md flex items-center gap-1.5 cursor-pointer transition-all"
            >
              {isSaving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
              <span>{isSaving ? 'Saving to Archive...' : 'Save Historical Changes'}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
