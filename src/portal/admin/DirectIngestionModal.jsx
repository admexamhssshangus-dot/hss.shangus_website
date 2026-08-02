import React, { useState } from 'react';
import { X, Save, PlusCircle, CheckCircle2, ShieldCheck, User, BookOpen, Phone, Landmark, Image as ImageIcon, RefreshCw, Download, FileSpreadsheet, History, Info, Upload, Trash2, Edit3 } from 'lucide-react';
import { db } from '../../services/firebase';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { updateCachedItem } from '../../services/dbCache';
import { compressImageFile } from '../../utils/imageCompressor';
import ConfirmDialogModal from '../components/ConfirmDialogModal';
import { logAdminActivity } from '../../services/adminActivityLogger';

/**
 * DirectIngestionModal — Express Admin Ingestion & CSV Import Component
 * Grants admins special privileges to insert new student records directly into the database
 * with ZERO mandatory field requirements, bulk CSV import, CSV template download, and photo guidance.
 */
export default function DirectIngestionModal({ isOpen, onClose, onRecordAdded }) {
  const [formData, setFormData] = useState({
    formNo: '',
    classRollNo: '',
    admNo: '',
    boardRegNo: '',
    studentName: '',
    fatherName: '',
    motherName: '',
    dob: '',
    gender: 'Male',
    category: 'General',
    religion: 'Islam',
    class: '11th',
    stream: 'Science',
    subs: 'English, Physics, Chemistry, Biology',
    session: '2025-26',
    mobile: '',
    village: '',
    residence: '',
    block: '',
    tehsil: '',
    district: 'Anantnag',
    pinCode: '',
    state: 'Jammu & Kashmir',
    aadhar: '',
    apaarId: '',
    penNo: '',
    bankAccount: '',
    bankName: '',
    ifsc: '',
    boardName: 'JKBOSE',
    prevSchool: '',
    remarks: 'Direct Ingestion (Admin Express)',
    status: 'Approved',
    photoUrl: ''
  });

  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('personal'); // 'personal' | 'academic' | 'contact' | 'bank' | 'other' | 'csv' | 'history'
  const [successToast, setSuccessToast] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [csvImporting, setCsvImporting] = useState(false);
  const [confirmModalConfig, setConfirmModalConfig] = useState(null);
  const [historyList, setHistoryList] = useState(() => {
    try {
      const saved = localStorage.getItem('hss_admin_direct_ingestion_history_v1');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [];
  });

  if (!isOpen) return null;

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setConfirmModalConfig({
      isOpen: true,
      type: 'info',
      title: 'Student Photo Import',
      message: `Upload and compress photo "${file.name}" for ${formData.studentName || 'Student'}?`,
      consequence: 'The image will be auto-compressed to < 20KB before attaching to the record.',
      confirmText: '📷 Confirm & Upload Photo',
      cancelText: 'Cancel',
      onConfirm: async ({ reasonCategory, customReason } = {}) => {
        setConfirmModalConfig(null);
        try {
          const compressed = await compressImageFile(file, 250, 300, 0.7);
          setFormData(prev => ({ ...prev, photoUrl: compressed }));
          setPhotoPreview(compressed);

          await logAdminActivity({
            actionType: 'photo_upload',
            actionTitle: 'Uploaded Student Photo',
            details: `Uploaded and compressed photo for "${formData.studentName || 'Student'}"`,
            reasonCategory,
            customReason,
            metadata: { filename: file.name }
          });
        } catch (err) {
          console.warn('Photo compression fallback:', err);
          const reader = new FileReader();
          reader.onload = async (event) => {
            setFormData(prev => ({ ...prev, photoUrl: event.target.result }));
            setPhotoPreview(event.target.result);

            await logAdminActivity({
              actionType: 'photo_upload',
              actionTitle: 'Uploaded Student Photo',
              details: `Uploaded photo for "${formData.studentName || 'Student'}"`,
              reasonCategory,
              customReason,
              metadata: { filename: file.name }
            });
          };
          reader.readAsDataURL(file);
        }
      }
    });
  };

  const handleDownloadCsvTemplate = () => {
    const headers = [
      'Form Number',
      'Class Roll No',
      'Adm. No.',
      'Board Registration Number',
      'Student Name',
      'Father Name',
      'Mother Name',
      'DoB (YYYY-MM-DD)',
      'Gender',
      'Class',
      'Stream',
      'Subjects',
      'Session',
      'Mobile No.',
      'Category',
      'Village',
      'District',
      'PIN Code',
      'Aadhaar No.',
      'Bank Account No.',
      'Name of Bank',
      'IFSC Code',
      'Status'
    ];

    const sampleRow = [
      'HSS/ADM/2025/EXPRESS_001',
      '501',
      '5480',
      '23901002001',
      'Shahid Mushtaq Padder',
      'Mushtaq Ahmad Padder',
      'Raja Begum',
      '2007-04-12',
      'Male',
      '11th',
      'Medical',
      'English, Physics, Chemistry, Biology',
      '2025-26',
      '9876543210',
      'General',
      'Shangus',
      'Anantnag',
      '192201',
      '123456789012',
      '0123040100099',
      'J&K Bank',
      'JAKA0SHANGU',
      'Approved'
    ];

    const csvContent = [headers.join(','), sampleRow.map(val => `"${val}"`).join(',')].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'HSS_Direct_Student_Import_Template.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCsvFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setConfirmModalConfig({
      isOpen: true,
      type: 'warning',
      title: 'Bulk CSV Student Import',
      message: `Are you sure you want to bulk import student records from file "${file.name}"?`,
      consequence: 'Parsed student rows will be committed directly to database registers and table view.',
      confirmText: '📄 Confirm & Process CSV Import',
      cancelText: 'Cancel',
      onConfirm: async ({ reasonCategory, customReason } = {}) => {
        setConfirmModalConfig(null);
        setCsvImporting(true);
        setSuccessToast(null);

        try {
          const text = await file.text();
          const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);

          if (lines.length < 2) {
            alert('CSV file is empty or missing data rows.');
            return;
          }

          // Simple CSV row parser handling quotes
          const parseCsvLine = (line) => {
            const result = [];
            let cur = '';
            let inQuotes = false;
            for (let i = 0; i < line.length; i++) {
              const char = line[i];
              if (char === '"') {
                inQuotes = !inQuotes;
              } else if (char === ',' && !inQuotes) {
                result.push(cur.trim());
                cur = '';
              } else {
                cur += char;
              }
            }
            result.push(cur.trim());
            return result;
          };

          const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
          let importedCount = 0;

          for (let i = 1; i < lines.length; i++) {
            const row = parseCsvLine(lines[i]);
            if (!row.length || row.every(val => val === '')) continue;

            const rowObj = {};
            headers.forEach((h, idx) => {
              rowObj[h] = row[idx] ? row[idx].replace(/^"|"$/g, '') : '';
            });

            const studentName = rowObj['studentname'] || rowObj['name'] || `Student ${i}`;
            const formNo = rowObj['formnumber'] || rowObj['formno'] || `HSS/ADM/CSV_${Date.now()}_${i}`;
            const docId = formNo.replace(/[\/\s]/g, '_').toLowerCase();

            const payload = {
              id: docId,
              _isCurrentScope: true,
              _isDirectIngested: true,
              formNo: formNo,
              'Form Number': formNo,
              status: rowObj['status'] || 'Approved',
              'Status': rowObj['status'] || 'Approved',
              classRollNo: rowObj['classrollno'] || rowObj['rollno'] || '',
              'Class Roll No': rowObj['classrollno'] || rowObj['rollno'] || '',
              admNo: rowObj['admno'] || rowObj['admissionno'] || '',
              'Adm. No.': rowObj['admno'] || rowObj['admissionno'] || '',
              class: rowObj['class'] || '11th',
              'Class': rowObj['class'] || '11th',
              session: rowObj['session'] || '2025-26',
              'Session': rowObj['session'] || '2025-26',
              boardRegNo: rowObj['boardregistrationnumber'] || rowObj['boardregno'] || '',
              'Board Registration Number': rowObj['boardregistrationnumber'] || rowObj['boardregno'] || '',
              studentName: studentName,
              "Student's Name (as per school records)": studentName,
              fatherName: rowObj['fathername'] || '',
              "Father's/Guardian's Name (as per school records)": rowObj['fathername'] || '',
              motherName: rowObj['mothername'] || '',
              "Mother's Name (as per school records)": rowObj['mothername'] || '',
              dob: rowObj['dob'] || rowObj['dateofbirth'] || '',
              'DoB (as per school records)': rowObj['dob'] || rowObj['dateofbirth'] || '',
              gender: rowObj['gender'] || 'Male',
              'Gender': rowObj['gender'] || 'Male',
              stream: rowObj['stream'] || 'Science',
              'Stream': rowObj['stream'] || 'Science',
              subs: rowObj['subjects'] || rowObj['subs'] || '',
              'Subjects (Stream)': rowObj['subjects'] || rowObj['subs'] || '',
              mobile: rowObj['mobileno'] || rowObj['mobile'] || '',
              'Mobile No. (with working WhatsApp)': rowObj['mobileno'] || rowObj['mobile'] || '',
              category: rowObj['category'] || 'General',
              'Cat._JKBOSE': rowObj['category'] || 'General',
              village: rowObj['village'] || '',
              'Name of your village': rowObj['village'] || '',
              district: rowObj['district'] || 'Anantnag',
              'District': rowObj['district'] || 'Anantnag',
              pinCode: rowObj['pincode'] || '',
              'PIN code': rowObj['pincode'] || '',
              onlineSubmDate: new Date().toISOString().split('T')[0],
              'Online Subm. Date': new Date().toISOString().split('T')[0],
              admDate: new Date().toISOString().split('T')[0],
              'Adm. Date': new Date().toISOString().split('T')[0],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              lastEditedBy: 'Admin (CSV Bulk Import)'
            };

            await setDoc(doc(db, 'admissions', docId), payload, { merge: true });
            try { await setDoc(doc(db, 'masterRegisters', docId), payload, { merge: true }); } catch (e) {}

            updateCachedItem('admissions', docId, payload);
            if (onRecordAdded) onRecordAdded(payload);
            importedCount++;
          }

          await logAdminActivity({
            actionType: 'bulk_import',
            actionTitle: 'Bulk CSV Student Ingestion',
            details: `Bulk imported ${importedCount} student records from file "${file.name}"`,
            reasonCategory,
            customReason,
            metadata: { count: importedCount, filename: file.name }
          });

          setSuccessToast(`🎉 Bulk Imported ${importedCount} Student Records from CSV!`);
        } catch (err) {
          console.error('CSV import error:', err);
          alert(`Error reading CSV: ${err.message}`);
        } finally {
          setCsvImporting(false);
        }
      }
    });
  };

  const handleSubmit = async (addAnother = false) => {
    setSaving(true);
    setSuccessToast(null);

    try {
      const generatedFormNo = formData.formNo.trim() || `HSS/ADM/2025/EXPRESS_${Date.now().toString().slice(-5)}`;
      const studentNameDisplay = formData.studentName.trim() || 'Direct Ingested Student';
      const docId = generatedFormNo.replace(/[\/\s]/g, '_').toLowerCase();
      const timestamp = new Date().toISOString();

      const payload = {
        id: docId,
        _isCurrentScope: true,
        _isDirectIngested: true,
        formNo: generatedFormNo,
        'Form Number': generatedFormNo,
        'Form No.': generatedFormNo,
        status: formData.status || 'Approved',
        'Status': formData.status || 'Approved',
        classRollNo: formData.classRollNo,
        'Class Roll No': formData.classRollNo,
        admNo: formData.admNo,
        'Adm. No.': formData.admNo,
        class: formData.class || '11th',
        'Class': formData.class || '11th',
        session: formData.session || '2025-26',
        'Session': formData.session || '2025-26',
        boardRegNo: formData.boardRegNo,
        'Board Registration Number': formData.boardRegNo,
        studentName: studentNameDisplay,
        "Student's Name (as per school records)": studentNameDisplay,
        fatherName: formData.fatherName,
        "Father's/Guardian's Name (as per school records)": formData.fatherName,
        motherName: formData.motherName,
        "Mother's Name (as per school records)": formData.motherName,
        dob: formData.dob,
        'DoB (as per school records)': formData.dob,
        gender: formData.gender,
        'Gender': formData.gender,
        stream: formData.stream,
        'Stream': formData.stream,
        subs: formData.subs,
        'Subjects (Stream)': formData.subs,
        mobile: formData.mobile,
        'Mobile No. (with working WhatsApp)': formData.mobile,
        category: formData.category,
        'Cat._JKBOSE': formData.category,
        village: formData.village,
        'Name of your village': formData.village,
        residence: formData.residence,
        'Residence (Village, District)': formData.residence,
        block: formData.block,
        'Block': formData.block,
        tehsil: formData.tehsil,
        'Tehsil': formData.tehsil,
        district: formData.district,
        'District': formData.district,
        pinCode: formData.pinCode,
        'PIN code': formData.pinCode,
        state: formData.state,
        'State/UT': formData.state,
        aadhar: formData.aadhar,
        'Aadhar No.': formData.aadhar,
        apaarId: formData.apaarId,
        'APAAR ID': formData.apaarId,
        penNo: formData.penNo,
        'PEN No.': formData.penNo,
        bankAccount: formData.bankAccount,
        'Bank Account No.': formData.bankAccount,
        bankName: formData.bankName,
        'Name of Bank': formData.bankName,
        ifsc: formData.ifsc,
        'IFSC code': formData.ifsc,
        boardName: formData.boardName,
        'Board Name': formData.boardName,
        prevSchool: formData.prevSchool,
        'Previous School': formData.prevSchool,
        remarks: formData.remarks,
        'Remarks': formData.remarks,
        photoId: formData.photoUrl || '',
        'Student Photo': formData.photoUrl || '',
        photoUrl: formData.photoUrl || '',
        onlineSubmDate: new Date().toISOString().split('T')[0],
        'Online Subm. Date': new Date().toISOString().split('T')[0],
        admDate: new Date().toISOString().split('T')[0],
        'Adm. Date': new Date().toISOString().split('T')[0],
        createdAt: timestamp,
        updatedAt: timestamp,
        lastEditedBy: 'Admin (Direct Express Ingestion)'
      };

      // 1. Write to Firestore admissions
      await setDoc(doc(db, 'admissions', docId), payload, { merge: true });

      // 2. Write to masterRegisters
      try {
        await setDoc(doc(db, 'masterRegisters', docId), payload, { merge: true });
      } catch (e) {}

      // 3. Update local cache
      updateCachedItem('admissions', docId, payload);

      // 4. Update Direct Ingestion History Log in localStorage
      const historyItem = {
        id: docId,
        studentName: studentNameDisplay,
        formNo: generatedFormNo,
        class: formData.class,
        date: new Date().toLocaleString()
      };
      const updatedHistory = [historyItem, ...historyList.filter(h => h.id !== docId)].slice(0, 50);
      setHistoryList(updatedHistory);
      try { localStorage.setItem('hss_admin_direct_ingestion_history_v1', JSON.stringify(updatedHistory)); } catch (e) {}

      if (onRecordAdded) onRecordAdded(payload);

      await logAdminActivity({
        actionType: 'manual_entry',
        actionTitle: 'Express Direct Record Entry',
        details: `Ingested new student record for "${studentNameDisplay}" (${generatedFormNo})`,
        reasonCategory: formData._reasonCategory || 'Batch Student Admission Ingestion',
        customReason: formData._customReason || '',
        metadata: { formNo: generatedFormNo, studentName: studentNameDisplay, class: formData.class }
      });

      setSuccessToast(`⚡ Direct Record Created for "${studentNameDisplay}" (${generatedFormNo})!`);

      if (addAnother) {
        setFormData(prev => ({
          ...prev,
          formNo: '',
          classRollNo: '',
          boardRegNo: '',
          studentName: '',
          fatherName: '',
          motherName: '',
          aadhar: '',
          apaarId: '',
          penNo: '',
          photoUrl: ''
        }));
        setPhotoPreview(null);
        setTimeout(() => setSuccessToast(null), 3000);
      } else {
        setTimeout(() => {
          setSuccessToast(null);
          onClose();
        }, 1200);
      }
    } catch (err) {
      console.error('Direct Ingestion error:', err);
      alert(`❌ Failed to ingest record: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-2 sm:p-3 bg-slate-950/75 backdrop-blur-md animate-fadeIn" style={{ fontFamily: 'var(--font-admin-sans, "Plus Jakarta Sans", sans-serif)' }}>
      <div className="w-full max-w-4xl rounded-2xl border border-amber-500/40 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* Super Compact Top Header Bar */}
        <div className="px-3.5 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/15 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-600 text-white flex items-center justify-center font-black shadow-xs flex-shrink-0">
              <PlusCircle size={15} />
            </div>
            <div>
              <h2 className="text-xs sm:text-sm font-black flex items-center gap-1.5 text-slate-900 dark:text-white tracking-tight" style={{ fontFamily: 'var(--font-admin-sans, "Plus Jakarta Sans", sans-serif)' }}>
                ⚡ Express Direct Ingestion <span className="px-1.5 py-0.2 rounded-full text-[8px] font-black bg-amber-600 text-white uppercase tracking-wider">Admin Privilege</span>
              </h2>
              <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 leading-none mt-0.5">
                Directly insert or update student records into Firestore. <strong>Zero mandatory field restrictions.</strong>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveTab('csv')}
              className="px-2 py-1 rounded-lg font-black text-[10px] bg-amber-600 hover:bg-amber-500 text-white cursor-pointer transition-all flex items-center gap-1 shadow-2xs"
              title="Bulk import student records from CSV file"
            >
              <FileSpreadsheet size={12} />
              <span className="hidden sm:inline">Import CSV</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('other')}
              className="px-2 py-1 rounded-lg font-black text-[10px] bg-slate-800 dark:bg-slate-700 hover:bg-slate-700 text-white cursor-pointer transition-all flex items-center gap-1 shadow-2xs"
              title="Upload student photo"
            >
              <ImageIcon size={12} />
              <span className="hidden sm:inline">Photo Upload</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-pointer transition-colors ml-1"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Success Alert Banner */}
        {successToast && (
          <div className="mx-3.5 mt-2 p-2 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-800 dark:text-emerald-300 font-black text-[11px] flex items-center justify-between gap-2 shadow-xs">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={14} className="text-emerald-600 flex-shrink-0" />
              <span>{successToast}</span>
            </span>
          </div>
        )}

        {/* Super Compact Tab Navigation */}
        <div className="px-3.5 pt-1.5 border-b border-slate-200 dark:border-slate-800 flex items-center gap-0.5 overflow-x-auto text-[11px] font-black flex-shrink-0">
          {[
            { id: 'personal', label: '👤 Personal', icon: User },
            { id: 'academic', label: '📚 Academic', icon: BookOpen },
            { id: 'contact', label: '📞 Contact', icon: Phone },
            { id: 'bank', label: '🏛️ Bank & ID', icon: Landmark },
            { id: 'other', label: '📷 Photo & Status', icon: ImageIcon },
            { id: 'csv', label: '📄 CSV Bulk Import', icon: FileSpreadsheet },
            { id: 'history', label: '📜 Entry History', icon: History },
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-2 py-1 rounded-t-lg transition-all cursor-pointer whitespace-nowrap border-b-2 text-[10px] sm:text-[11px] ${
                activeTab === tab.id
                  ? 'border-amber-500 text-amber-700 dark:text-amber-400 bg-amber-500/10 font-black'
                  : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 font-bold'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Scrollable Form Body */}
        <div className="p-4 overflow-y-auto space-y-3 flex-1 text-xs font-bold">
          
          {/* TAB 1: PERSONAL */}
          {activeTab === 'personal' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-0.5">
                  Student's Full Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Shahid Mushtaq Padder"
                  value={formData.studentName}
                  onChange={(e) => handleChange('studentName', e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-extrabold focus:ring-2 focus:ring-amber-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-0.5">
                  Father's Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Mushtaq Ahmad Padder"
                  value={formData.fatherName}
                  onChange={(e) => handleChange('fatherName', e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-extrabold focus:ring-2 focus:ring-amber-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-0.5">
                  Mother's Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Raja Begum"
                  value={formData.motherName}
                  onChange={(e) => handleChange('motherName', e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-extrabold focus:ring-2 focus:ring-amber-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-0.5">
                  Date of Birth (DoB)
                </label>
                <input
                  type="date"
                  value={formData.dob}
                  onChange={(e) => handleChange('dob', e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-extrabold focus:ring-2 focus:ring-amber-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-0.5">
                  Gender
                </label>
                <select
                  value={formData.gender}
                  onChange={(e) => handleChange('gender', e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-extrabold focus:ring-2 focus:ring-amber-500 text-xs cursor-pointer"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-0.5">
                  Category
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => handleChange('category', e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-extrabold focus:ring-2 focus:ring-amber-500 text-xs cursor-pointer"
                >
                  <option value="General">General</option>
                  <option value="RBA">RBA</option>
                  <option value="ST">ST</option>
                  <option value="SC">SC</option>
                  <option value="EWS">EWS</option>
                  <option value="OBC">OBC</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-0.5">
                  Religion
                </label>
                <input
                  type="text"
                  placeholder="Islam"
                  value={formData.religion}
                  onChange={(e) => handleChange('religion', e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-extrabold focus:ring-2 focus:ring-amber-500 text-xs"
                />
              </div>
            </div>
          )}

          {/* TAB 2: ACADEMIC */}
          {activeTab === 'academic' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-0.5">
                  Class
                </label>
                <select
                  value={formData.class}
                  onChange={(e) => handleChange('class', e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-extrabold focus:ring-2 focus:ring-amber-500 text-xs cursor-pointer"
                >
                  <option value="11th">11th</option>
                  <option value="12th">12th</option>
                  <option value="9th">9th (Class 9)</option>
                  <option value="10th">10th (Class 10)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-0.5">
                  Stream
                </label>
                <select
                  value={formData.stream}
                  onChange={(e) => handleChange('stream', e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-extrabold focus:ring-2 focus:ring-amber-500 text-xs cursor-pointer"
                >
                  <option value="Science">Science</option>
                  <option value="General">General</option>
                  <option value="Humanities">Humanities</option>
                  <option value="Commerce">Commerce</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-0.5">
                  Session
                </label>
                <select
                  value={formData.session}
                  onChange={(e) => handleChange('session', e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-extrabold focus:ring-2 focus:ring-amber-500 text-xs cursor-pointer"
                >
                  <option value="2025-26">2025-26</option>
                  <option value="2024-25">2024-25</option>
                  <option value="2023-24">2023-24</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-0.5">
                  Subjects Combination
                </label>
                <input
                  type="text"
                  placeholder="e.g. English, Physics, Chemistry, Biology"
                  value={formData.subs}
                  onChange={(e) => handleChange('subs', e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-extrabold focus:ring-2 focus:ring-amber-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-0.5">
                  Form Number <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. HSS/ADM/2025/1042"
                  value={formData.formNo}
                  onChange={(e) => handleChange('formNo', e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-extrabold focus:ring-2 focus:ring-amber-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-0.5">
                  Class Roll No.
                </label>
                <input
                  type="text"
                  placeholder="e.g. 504"
                  value={formData.classRollNo}
                  onChange={(e) => handleChange('classRollNo', e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-extrabold focus:ring-2 focus:ring-amber-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-0.5">
                  Admission No. (Adm. No.)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 5480"
                  value={formData.admNo}
                  onChange={(e) => handleChange('admNo', e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-extrabold focus:ring-2 focus:ring-amber-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-0.5">
                  Board Registration No.
                </label>
                <input
                  type="text"
                  placeholder="e.g. 2568409384"
                  value={formData.boardRegNo}
                  onChange={(e) => handleChange('boardRegNo', e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-extrabold focus:ring-2 focus:ring-amber-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-0.5">
                  Previous School
                </label>
                <input
                  type="text"
                  placeholder="e.g. High School Shangus"
                  value={formData.prevSchool}
                  onChange={(e) => handleChange('prevSchool', e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-extrabold focus:ring-2 focus:ring-amber-500 text-xs"
                />
              </div>
            </div>
          )}

          {/* TAB 3: CONTACT */}
          {activeTab === 'contact' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-0.5">
                  Mobile No. (WhatsApp)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 9876543210"
                  value={formData.mobile}
                  onChange={(e) => handleChange('mobile', e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-extrabold focus:ring-2 focus:ring-amber-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-0.5">
                  Village / Town
                </label>
                <input
                  type="text"
                  placeholder="e.g. Shangus"
                  value={formData.village}
                  onChange={(e) => handleChange('village', e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-extrabold focus:ring-2 focus:ring-amber-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-0.5">
                  Block
                </label>
                <input
                  type="text"
                  placeholder="Shangus"
                  value={formData.block}
                  onChange={(e) => handleChange('block', e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-extrabold focus:ring-2 focus:ring-amber-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-0.5">
                  Tehsil
                </label>
                <input
                  type="text"
                  placeholder="Shangus"
                  value={formData.tehsil}
                  onChange={(e) => handleChange('tehsil', e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-extrabold focus:ring-2 focus:ring-amber-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-0.5">
                  District
                </label>
                <input
                  type="text"
                  placeholder="Anantnag"
                  value={formData.district}
                  onChange={(e) => handleChange('district', e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-extrabold focus:ring-2 focus:ring-amber-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-0.5">
                  PIN Code
                </label>
                <input
                  type="text"
                  placeholder="192201"
                  value={formData.pinCode}
                  onChange={(e) => handleChange('pinCode', e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-extrabold focus:ring-2 focus:ring-amber-500 text-xs"
                />
              </div>
            </div>
          )}

          {/* TAB 4: BANK & IDENTIFIERS */}
          {activeTab === 'bank' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-0.5">
                  Aadhaar No.
                </label>
                <input
                  type="text"
                  placeholder="12-digit Aadhaar"
                  value={formData.aadhar}
                  onChange={(e) => handleChange('aadhar', e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-extrabold focus:ring-2 focus:ring-amber-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-0.5">
                  APAAR ID
                </label>
                <input
                  type="text"
                  placeholder="APAAR ID"
                  value={formData.apaarId}
                  onChange={(e) => handleChange('apaarId', e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-extrabold focus:ring-2 focus:ring-amber-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-0.5">
                  PEN No.
                </label>
                <input
                  type="text"
                  placeholder="PEN No."
                  value={formData.penNo}
                  onChange={(e) => handleChange('penNo', e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-extrabold focus:ring-2 focus:ring-amber-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-0.5">
                  Bank Account No.
                </label>
                <input
                  type="text"
                  placeholder="Account Number"
                  value={formData.bankAccount}
                  onChange={(e) => handleChange('bankAccount', e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-extrabold focus:ring-2 focus:ring-amber-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-0.5">
                  Name of Bank
                </label>
                <input
                  type="text"
                  placeholder="J&K Bank / SBI"
                  value={formData.bankName}
                  onChange={(e) => handleChange('bankName', e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-extrabold focus:ring-2 focus:ring-amber-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-0.5">
                  IFSC Code
                </label>
                <input
                  type="text"
                  placeholder="e.g. JAKA0SHANGU"
                  value={formData.ifsc}
                  onChange={(e) => handleChange('ifsc', e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-extrabold focus:ring-2 focus:ring-amber-500 text-xs"
                />
              </div>
            </div>
          )}

          {/* TAB 5: PHOTO & STATUS WITH BULK PHOTO GUIDANCE (MAX 20KB) */}
          {activeTab === 'other' && (
            <div className="space-y-3">
              {/* Photo Import Guidance Banner */}
              <div className="p-3 rounded-2xl border border-sky-500/30 bg-sky-500/10 text-sky-900 dark:text-sky-200 text-xs space-y-1.5">
                <div className="flex items-center gap-1.5 font-black text-sky-700 dark:text-sky-300">
                  <Info size={15} />
                  <span>📷 Photo Guidance & Max 20KB Compression Rules</span>
                </div>
                <ul className="list-disc list-inside space-y-0.5 font-bold text-[11px] text-sky-800 dark:text-sky-300/90">
                  <li><strong>Automatic Size Optimization:</strong> All uploaded photos are downscaled and compressed to <strong>Max 20KB</strong> high-efficiency JPEG format.</li>
                  <li><strong>Bulk Photo Filename Matching:</strong> Name your image files as <code>[BoardRegNo].jpg</code>, <code>[FormNo].jpg</code>, or <code>[StudentName].jpg</code> for automatic bulk sync.</li>
                </ul>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-0.5">
                    Admission Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => handleChange('status', e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-extrabold focus:ring-2 focus:ring-amber-500 text-xs cursor-pointer"
                  >
                    <option value="Approved">Approved (Active Record)</option>
                    <option value="Submitted">Submitted (Under Review)</option>
                    <option value="Provisionally Approved">Provisionally Approved</option>
                    <option value="Pending">Pending</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-0.5">
                    Remarks / Internal Note
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Class 9 student uploaded by Admin due to offline request"
                    value={formData.remarks}
                    onChange={(e) => handleChange('remarks', e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-extrabold focus:ring-2 focus:ring-amber-500 text-xs"
                  />
                </div>

                <div className="sm:col-span-2 p-3 rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 flex flex-col sm:flex-row items-center gap-3">
                  <div className="w-20 h-24 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-200 dark:bg-slate-800 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {photoPreview ? (
                      <img src={photoPreview} alt="Student Preview" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[10px] font-bold text-slate-400 text-center px-1">No Photo</span>
                    )}
                  </div>
                  <div className="space-y-1 flex-1">
                    <label className="block text-xs font-black text-slate-800 dark:text-slate-200">
                      Upload Student Passport Photo (Auto-compressed &lt; 20KB)
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="block w-full text-xs text-slate-500 file:mr-3 file:py-1 file:px-2.5 file:rounded-xl file:border-0 file:text-xs file:font-black file:bg-amber-500 file:text-white hover:file:bg-amber-600 cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: CSV BULK IMPORT & TEMPLATE DOWNLOAD */}
          {activeTab === 'csv' && (
            <div className="p-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 space-y-4">
              <div className="flex items-center gap-2">
                <FileSpreadsheet size={20} className="text-amber-600 dark:text-amber-400 flex-shrink-0" />
                <div>
                  <h3 className="font-black text-sm text-slate-900 dark:text-white">Bulk Student CSV Ingestion</h3>
                  <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    Import dozens of student records at once from a single Excel or CSV spreadsheet.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {/* Download Template Button */}
                <div className="p-3.5 rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 space-y-2 flex flex-col justify-between">
                  <div>
                    <h4 className="font-black text-xs text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Download size={14} className="text-emerald-600" /> 1. Download Standard CSV Template
                    </h4>
                    <p className="text-[11px] text-slate-500 font-bold mt-1">
                      Download the official pre-formatted CSV template with all database headers.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadCsvTemplate}
                    className="w-full py-2 px-3 rounded-xl font-black text-xs text-emerald-800 dark:text-emerald-300 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Download size={13} />
                    <span>Download CSV Template (.csv)</span>
                  </button>
                </div>

                {/* Upload CSV File */}
                <div className="p-3.5 rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 space-y-2 flex flex-col justify-between">
                  <div>
                    <h4 className="font-black text-xs text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Upload size={14} className="text-amber-600" /> 2. Upload Filled CSV Spreadsheet
                    </h4>
                    <p className="text-[11px] text-slate-500 font-bold mt-1">
                      Select your completed CSV spreadsheet to ingest all records directly into Firestore.
                    </p>
                  </div>
                  <label className="w-full py-2 px-3 rounded-xl font-black text-xs text-white bg-amber-600 hover:bg-amber-500 transition-colors flex items-center justify-center gap-1.5 cursor-pointer text-center">
                    {csvImporting ? <RefreshCw size={13} className="animate-spin" /> : <Upload size={13} />}
                    <span>{csvImporting ? 'Ingesting CSV Records...' : 'Upload & Process CSV'}</span>
                    <input
                      type="file"
                      accept=".csv"
                      disabled={csvImporting}
                      onChange={handleCsvFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: DIRECT INGESTION HISTORY LOG */}
          {activeTab === 'history' && (
            <div className="space-y-3" style={{ fontFamily: 'var(--font-admin-sans, "Plus Jakarta Sans", sans-serif)' }}>
              <div className="flex items-center justify-between">
                <h3 className="font-black text-xs text-slate-800 dark:text-slate-200 flex items-center gap-1.5" style={{ fontFamily: 'var(--font-admin-sans, "Plus Jakarta Sans", sans-serif)' }}>
                  <History size={15} className="text-amber-600" /> Audit Log of Recent Direct Ingestions
                </h3>
                {historyList.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Clear all entry history items from local history log? (Does not delete actual database records)')) {
                        setHistoryList([]);
                        localStorage.removeItem('hss_admin_direct_ingestion_history_v1');
                      }
                    }}
                    className="text-[10px] font-black text-rose-600 hover:underline cursor-pointer"
                  >
                    Clear History Log
                  </button>
                )}
              </div>

              {historyList.length === 0 ? (
                <div className="p-6 text-center text-slate-500 dark:text-slate-400 font-bold text-xs bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800">
                  No recent direct express ingestion records recorded in this session.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                  {historyList.map((item, idx) => (
                    <div
                      key={item.id + idx}
                      className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between text-xs font-bold hover:border-amber-500/40 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                          ⚡ Express
                        </span>
                        <div>
                          <div className="font-black text-slate-900 dark:text-white text-xs">{item.studentName}</div>
                          <div className="text-[10px] text-slate-400 font-mono">Form: {item.formNo} | Class: {item.class}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">{item.date}</span>
                        
                        {/* Delete Record Button */}
                        <button
                          type="button"
                          onClick={() => {
                            setConfirmModalConfig({
                              isOpen: true,
                              type: 'danger',
                              title: 'Permanent Record Removal',
                              message: `Are you sure you want to permanently delete the entry for "${item.studentName}"?`,
                              consequence: 'This student record will be permanently deleted from database registers and history logs. This action cannot be undone.',
                              confirmText: '🔥 Confirm & Delete Entry',
                              cancelText: 'Cancel',
                              onConfirm: async ({ reasonCategory, customReason } = {}) => {
                                setConfirmModalConfig(null);
                                try {
                                  const docId = item.id || (item.formNo ? item.formNo.replace(/[\/\s]/g, '_').toLowerCase() : '');
                                  if (docId) {
                                    await deleteDoc(doc(db, 'admissions', docId)).catch(() => {});
                                    await deleteDoc(doc(db, 'masterRegisters', docId)).catch(() => {});
                                  }
                                  
                                  // Log admin activity audit to Firestore
                                  await logAdminActivity({
                                    actionType: 'delete',
                                    actionTitle: `Deleted Express Record: ${item.studentName || 'Student'}`,
                                    details: `Permanently deleted record ${docId} (Form: ${item.formNo || 'N/A'}) from history and database.`,
                                    reasonCategory: reasonCategory || 'Duplicate / Invalid Entry Removal',
                                    customReason: customReason || '',
                                    metadata: { docId, formNo: item.formNo, studentName: item.studentName }
                                  }).catch(e => console.warn('Audit logger note:', e));

                                  const updated = historyList.filter(h => h.id !== item.id);
                                  setHistoryList(updated);
                                  try { localStorage.setItem('hss_admin_direct_ingestion_history_v1', JSON.stringify(updated)); } catch (e) {}
                                  setSuccessToast(`🗑️ Permanently deleted record "${item.studentName}"`);
                                  setTimeout(() => setSuccessToast(null), 3000);
                                } catch (err) {
                                  console.error('Delete error:', err);
                                }
                              }
                            });
                          }}
                          className="px-2 py-1 rounded-lg text-[10px] font-black text-rose-700 dark:text-rose-300 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 transition-colors cursor-pointer flex items-center gap-1"
                          title="Permanently Delete Student Record from Database"
                        >
                          <Trash2 size={11} />
                          <span>Delete Record</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 flex-shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400 font-black">
            <ShieldCheck size={15} />
            <span className="text-[11px]">Admin Privileged Ingestion Mode</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl font-extrabold text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                const nameDisplay = formData.studentName.trim() || 'Direct Ingested Student';
                setConfirmModalConfig({
                  isOpen: true,
                  type: 'warning',
                  title: 'Express Direct Record Entry',
                  message: `Commit new student record for "${nameDisplay}" directly into Firestore database?`,
                  consequence: 'This record will be written to "admissions" and "masterRegisters" collections with Approved status and will instantly appear at the top of the Admin table.',
                  confirmText: '⚡ Confirm & Save Record',
                  cancelText: 'Cancel',
                  onConfirm: async ({ reasonCategory, customReason } = {}) => {
                    setConfirmModalConfig(null);
                    setFormData(prev => ({ ...prev, _reasonCategory: reasonCategory, _customReason: customReason }));
                    await handleSubmit(true);
                  }
                });
              }}
              className="px-3.5 py-1.5 rounded-xl font-extrabold text-xs text-amber-900 dark:text-amber-300 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 cursor-pointer transition-all flex items-center justify-center gap-1 disabled:opacity-50"
            >
              {saving ? <RefreshCw size={13} className="animate-spin" /> : <PlusCircle size={13} />}
              <span>Save & Add Another</span>
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                const nameDisplay = formData.studentName.trim() || 'Direct Ingested Student';
                setConfirmModalConfig({
                  isOpen: true,
                  type: 'warning',
                  title: 'Express Direct Record Entry',
                  message: `Commit new student record for "${nameDisplay}" directly into Firestore database?`,
                  consequence: 'This record will be authorized and committed to master registers and active table views.',
                  confirmText: '⚡ Confirm & Save Record',
                  cancelText: 'Cancel',
                  onConfirm: async ({ reasonCategory, customReason } = {}) => {
                    setConfirmModalConfig(null);
                    setFormData(prev => ({ ...prev, _reasonCategory: reasonCategory, _customReason: customReason }));
                    await handleSubmit(false);
                  }
                });
              }}
              className="px-4 py-1.5 rounded-xl font-black text-xs text-white bg-amber-700 hover:bg-amber-600 shadow-md cursor-pointer transition-all flex items-center justify-center gap-1 disabled:opacity-50"
            >
              {saving ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
              <span>Save & Close</span>
            </button>
          </div>
        </div>

        {/* Reusable Custom Confirmation Modal inside Ingestion Modal */}
        {confirmModalConfig && (
          <ConfirmDialogModal
            {...confirmModalConfig}
            onClose={() => setConfirmModalConfig(null)}
          />
        )}

      </div>
    </div>
  );
}
