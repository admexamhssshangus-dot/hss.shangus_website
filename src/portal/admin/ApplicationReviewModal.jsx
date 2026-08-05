import React, { useState } from 'react';
import { X, CheckCircle2, XCircle, Unlock, Download, User, Phone, BookOpen, GraduationCap, MapPin, RefreshCw, Camera, Upload, Eye } from 'lucide-react';
import appsScriptApi from '../../services/appsScriptApi';
import { db } from '../../services/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { compressImageFile } from '../../utils/imageCompressor';
import { generateStudentAdmissionPdf, downloadStudentAdmissionPdf } from '../../utils/pdfGenerator';

export default function ApplicationReviewModal({ app, onClose, onRefresh }) {
  const [rejecting, setRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [unlockHours, setUnlockHours] = useState('24');
  const [actionLoading, setActionLoading] = useState(false);

  const initialPhoto = app ? (app['Student Photo'] || app['Student Photograph'] || app['Photo'] || app['photo_id'] || app['photoId'] || '') : '';
  const [currentPhoto, setCurrentPhoto] = useState(initialPhoto);
  const [photoUploading, setPhotoUploading] = useState(false);

  if (!app) return null;

  const formNo = app['Form Number'] || app['FormNo'] || 'N/A';
  const name = app["Student's Name (as per school records)"] || app["Student's Name"] || app['Full Name'] || app['Name'] || app['Account Name'] || app['User Name'] || app['Email Address'] || 'Draft Student';
  const fatherName = app["Father's/Guardian's Name (as per school records)"] || app["Father's/Guardian's Name"] || app["Father's Name"] || (app['Status'] === 'Draft' ? 'Draft (Unfilled)' : 'N/A');
  const motherName = app["Mother's Name (as per school records)"] || app["Mother's Name"] || (app['Status'] === 'Draft' ? 'Draft (Unfilled)' : 'N/A');
  const dob = app["DoB (as per school records)"] || app["DoB"] || app['Date of Birth'] || (app['Status'] === 'Draft' ? 'Draft (Unfilled)' : 'N/A');
  const mobile = app["Mobile No. (with working WhatsApp)"] || app["Mobile No."] || app['Student Mobile No'] || app['Account Mobile'] || 'N/A';
  const category = app["Social category"] || app['Category'] || 'OM';
  const aadhar = app["Aadhar No."] || app['Aadhaar Number'] || 'N/A';
  const gender = app["Gender"] || 'N/A';
  const cls = app["Admission sought for class"] || (app['Status'] === 'Draft' ? 'Draft' : 'N/A');
  const stream = app["Stream for Class 11th"] || app["Stream opted in Class 11th"] || app["Stream"] || '';
  const rollNo = app["Exam Roll Number of Class 10th"] || app["Exam Roll Number of Class 11th"] || app["Class Roll No"] || app['10th Roll No'] || '—';
  const marksObtained = app["Total Marks Obtained in Class 10th"] || app["Total Marks Obtained in Class 11th"] || app['Marks Obtained'] || '0';
  const totalMaxMarks = app["Total Max. Marks in Class 10th"] || app["Total Max. Marks in Class 11th"] || app['Total Marks'] || '500';

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoUploading(true);
    try {
      // 1. In-browser canvas downscaling & compression (~5-10 KB)
      const compressedDataUrl = await compressImageFile(file, 300, 360, 0.8);
      setCurrentPhoto(compressedDataUrl);

      // 2. Persist to Firestore document
      const payload = {
        ...app,
        'Student Photo': compressedDataUrl,
        'photo_id': compressedDataUrl,
        'photoUrl': compressedDataUrl
      };

      if (app.id) {
        try {
          const docRef = doc(db, 'admissions', String(app.id));
          await updateDoc(docRef, {
            'Student Photo': compressedDataUrl,
            'photo_id': compressedDataUrl,
            'photoUrl': compressedDataUrl
          });
        } catch (fsErr) {
          console.warn('Firestore direct update note:', fsErr);
        }
      }

      await appsScriptApi.saveApplication(payload);
      alert('Student photo updated & compressed successfully!');
      if (appsScriptApi.invalidateAdminCache) appsScriptApi.invalidateAdminCache();
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Photo upload error:', err);
      alert('Failed to update student photo.');
    } finally {
      setPhotoUploading(false);
    }
  };
  
  const pct = (parseFloat(marksObtained) && parseFloat(totalMaxMarks)) 
    ? Math.round((parseFloat(marksObtained) / parseFloat(totalMaxMarks)) * 100) 
    : 0;

  // Approve Application
  const handleApprove = async () => {
    if (!window.confirm(`Approve application #${formNo} for ${name}?`)) return;
    setActionLoading(true);
    try {
      const payload = { ...app, Status: 'Approved' };
      const res = await appsScriptApi.saveApplication(payload);
      if (res && res.success !== false) {
        alert('Application approved successfully!');
        if (appsScriptApi.invalidateAdminCache) appsScriptApi.invalidateAdminCache();
        onRefresh();
        onClose();
      }
    } catch (err) {
      console.error('Approve error:', err);
      alert('Failed to approve application.');
    } finally {
      setActionLoading(false);
    }
  };

  // Reject Application
  const handleRejectSubmit = async (e) => {
    e.preventDefault();
    if (!rejectionReason.trim()) {
      alert('Please enter a rejection reason.');
      return;
    }
    setActionLoading(true);
    try {
      const res = await appsScriptApi.call('rejectApplication', {
        formNumber: formNo,
        reason: rejectionReason.trim(),
      });
      if (res && res.success !== false) {
        alert('Application rejected & sent back for correction.');
        if (appsScriptApi.invalidateAdminCache) appsScriptApi.invalidateAdminCache();
        onRefresh();
        onClose();
      } else {
        alert(res?.error || res?.message || 'Failed to reject application.');
      }
    } catch (err) {
      console.error('Reject error:', err);
      alert(err.message || 'Failed to reject application.');
    } finally {
      setActionLoading(false);
    }
  };

  // Unlock Application
  const handleUnlockSubmit = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const expiryStr = `${unlockHours} hours`;
      const res = await appsScriptApi.call('unlockWithExpiry', {
        formNumber: formNo,
        expiryStr,
      });
      if (res && res.success !== false) {
        alert(`Application #${formNo} unlocked for editing (${expiryStr}).`);
        if (appsScriptApi.invalidateAdminCache) appsScriptApi.invalidateAdminCache();
        onRefresh();
        onClose();
      }
    } catch (err) {
      console.error('Unlock error:', err);
      alert('Failed to unlock application.');
    } finally {
      setActionLoading(false);
    }
  };

  // Download Form PDF
  const handleDownloadPdf = async () => {
    try {
      const existingPdf = app['PDF URL'] || app['PDFURL'] || app['pdfUrl'];
      if (existingPdf) {
        window.open(existingPdf, '_blank', 'noopener,noreferrer');
        return;
      }
      setActionLoading(true);
      const res = await appsScriptApi.call('generatePdfForForm', { formNumber: formNo });
      const pdfUrl = res?.pdfUrl || res?.data?.pdfUrl || res?.url;
      if (pdfUrl) {
        window.open(pdfUrl, '_blank', 'noopener,noreferrer');
      } else {
        alert('PDF generated successfully!');
      }
    } catch (err) {
      console.error('Download PDF error:', err);
      alert('Failed to generate PDF copy.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl p-6 sm:p-8 border shadow-2xl space-y-6 animate-fadeIn" style={{ backgroundColor: 'var(--bg-card, #ffffff)', borderColor: 'var(--border-ui, #e2e8f0)' }}>
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: 'var(--border-ui, #e2e8f0)' }}>
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-teal-600 dark:text-teal-400 flex items-center gap-1">
              <User size={12} /> Application Review Details
            </div>
            <h2 className="text-xl font-extrabold" style={{ color: 'var(--text-main, #0f172a)' }}>
              Form #{formNo} • {name}
            </h2>
          </div>
          <button onClick={onClose} disabled={actionLoading} className="p-2 rounded-xl text-slate-400 hover:text-slate-600 cursor-pointer disabled:opacity-50">
            <X size={20} />
          </button>
        </div>

        {/* Details Content */}
        <div className="space-y-6 text-xs">
          {/* Header Row: Photo + Core Info */}
          <div className="flex flex-col sm:flex-row gap-4 p-4 rounded-2xl border bg-slate-50 dark:bg-slate-900/50" style={{ borderColor: 'var(--border-ui, #cbd5e1)' }}>
            {/* Photo Container with Update Button */}
            <div className="relative group flex-shrink-0 w-24 h-28">
              {currentPhoto ? (
                <img src={currentPhoto} alt="Student Photo" className="w-24 h-28 object-cover rounded-xl border border-slate-300 dark:border-slate-700 shadow-sm" />
              ) : (
                <div className="w-24 h-28 rounded-xl bg-slate-200 dark:bg-slate-800 flex flex-col items-center justify-center text-slate-400 font-extrabold text-[10px] gap-1 border border-slate-300 dark:border-slate-700">
                  <User size={24} />
                  <span>No Photo</span>
                </div>
              )}

              {/* Hover / Camera Overlay */}
              <label className="absolute inset-0 bg-slate-900/60 rounded-xl flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer p-1 text-center font-black text-[10px]">
                {photoUploading ? (
                  <RefreshCw size={16} className="animate-spin text-amber-400" />
                ) : (
                  <>
                    <Camera size={16} className="text-amber-400 mb-0.5" />
                    <span>{currentPhoto ? 'Update Photo' : 'Upload Photo'}</span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  disabled={photoUploading}
                  className="hidden"
                />
              </label>
            </div>

            <div className="space-y-2 flex-1">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-400 font-bold block text-[10px]">Father's Name</span>
                  <strong className="text-sm">{fatherName}</strong>
                </div>

                <div>
                  <span className="text-slate-400 font-bold block text-[10px]">Mother's Name</span>
                  <strong className="text-sm">{motherName}</strong>
                </div>

                <div>
                  <span className="text-slate-400 font-bold block text-[10px]">Class & Stream</span>
                  <strong>{cls} {stream ? `(${stream})` : ''}</strong>
                </div>

                <div>
                  <span className="text-slate-400 font-bold block text-[10px]">Date of Birth</span>
                  <strong>{dob}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Contact Details */}
          <div className="space-y-2">
            <h4 className="font-extrabold text-slate-400 uppercase text-[10px] flex items-center gap-1">
              <Phone size={13} /> Contact Information
            </h4>
            <div className="grid grid-cols-2 gap-2 p-3 rounded-2xl border" style={{ borderColor: 'var(--border-ui, #e2e8f0)' }}>
              <div><span className="text-slate-400">Mobile:</span> <strong>{mobile}</strong></div>
              <div><span className="text-slate-400">Category:</span> <strong>{category}</strong></div>
              <div><span className="text-slate-400">Aadhaar:</span> <strong>{aadhar}</strong></div>
              <div><span className="text-slate-400">Gender:</span> <strong>{gender}</strong></div>
            </div>
          </div>

          {/* Academic Record */}
          <div className="space-y-2">
            <h4 className="font-extrabold text-slate-400 uppercase text-[10px] flex items-center gap-1">
              <GraduationCap size={13} /> Academic Record
            </h4>
            <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl border" style={{ borderColor: 'var(--border-ui, #e2e8f0)' }}>
              <div><span className="text-slate-400">Roll No:</span> <strong>{rollNo}</strong></div>
              <div><span className="text-slate-400">Marks:</span> <strong>{marksObtained} / {totalMaxMarks}</strong></div>
              <div><span className="text-slate-400">Percentage:</span> <strong className="text-teal-600">{pct}%</strong></div>
            </div>
          </div>

          {/* Rejection Form Overlay */}
          {rejecting && (
            <form onSubmit={handleRejectSubmit} className="p-5 rounded-2xl bg-red-500/10 border border-red-500/30 space-y-3 animate-fadeIn">
              <div className="font-extrabold text-red-600 dark:text-red-400 text-xs flex items-center gap-1.5">
                <XCircle size={15} /> Enter Reason for Rejection:
              </div>
              <textarea
                rows={3}
                required
                disabled={actionLoading}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Specify what needs correction (e.g. Photo is blurry, 10th Marks card missing, etc.)"
                className="w-full p-3 rounded-xl border text-xs focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
                style={{ backgroundColor: 'var(--bg-card, #ffffff)', borderColor: 'var(--border-ui, #cbd5e1)' }}
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => setRejecting(false)}
                  className="px-4 py-2 rounded-xl border font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-extrabold shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {actionLoading ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" /> Processing Rejection...
                    </>
                  ) : (
                    'Confirm & Send Rejection'
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Unlock Form Overlay */}
          {unlocking && (
            <form onSubmit={handleUnlockSubmit} className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3 animate-fadeIn">
              <div className="font-extrabold text-amber-600 dark:text-amber-400 text-xs flex items-center gap-1.5">
                <Unlock size={15} /> Select Unlock Duration for Student Editing:
              </div>
              <select
                value={unlockHours}
                disabled={actionLoading}
                onChange={(e) => setUnlockHours(e.target.value)}
                className="w-full p-3 rounded-xl border text-xs font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50"
                style={{ backgroundColor: 'var(--bg-card, #ffffff)', borderColor: 'var(--border-ui, #cbd5e1)' }}
              >
                <option value="2">2 Hours</option>
                <option value="6">6 Hours</option>
                <option value="12">12 Hours</option>
                <option value="24">24 Hours (1 Day)</option>
                <option value="48">48 Hours (2 Days)</option>
              </select>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => setUnlocking(false)}
                  className="px-4 py-2 rounded-xl border font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-extrabold shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {actionLoading ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" /> Unlocking...
                    </>
                  ) : (
                    'Confirm Unlock'
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-4 border-t" style={{ borderColor: 'var(--border-ui, #e2e8f0)' }}>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => generateStudentAdmissionPdf(app)}
                disabled={actionLoading}
                className="px-3.5 py-2 rounded-xl font-bold border flex items-center gap-1.5 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 text-xs"
                style={{ borderColor: 'var(--border-ui, #cbd5e1)', color: 'var(--text-main, #334155)' }}
              >
                <Eye size={14} className="text-teal-600 dark:text-teal-400" /> View PDF
              </button>

              <button
                type="button"
                onClick={() => downloadStudentAdmissionPdf(app)}
                disabled={actionLoading}
                className="px-3.5 py-2 rounded-xl font-bold border flex items-center gap-1.5 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 text-xs"
                style={{ borderColor: 'var(--border-ui, #cbd5e1)', color: 'var(--text-main, #334155)' }}
              >
                <Download size={14} className="text-emerald-600 dark:text-emerald-400" /> Download PDF
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => { setUnlocking(!unlocking); setRejecting(false); }}
                className="px-4 py-2.5 rounded-xl font-bold border border-amber-500/30 text-amber-600 bg-amber-500/10 hover:bg-amber-500/20 cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                <Unlock size={15} /> Unlock
              </button>

              <button
                type="button"
                disabled={actionLoading}
                onClick={() => { setRejecting(!rejecting); setUnlocking(false); }}
                className="px-4 py-2.5 rounded-xl font-bold border border-red-500/30 text-red-600 bg-red-500/10 hover:bg-red-500/20 cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                <XCircle size={15} /> Reject
              </button>

              <button
                type="button"
                onClick={handleApprove}
                disabled={actionLoading}
                className="px-5 py-2.5 rounded-xl font-extrabold text-white bg-emerald-600 hover:bg-emerald-500 shadow-md cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {actionLoading ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" /> Approving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} /> Approve
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
