import React, { useState } from 'react';
import { Download, FileSpreadsheet, FolderArchive, Contact, RefreshCw } from 'lucide-react';
import appsScriptApi from '../../services/appsScriptApi';

export default function BulkOperations() {
  const [loadingAction, setLoadingAction] = useState(null);

  // CSV Export
  const handleExportCsv = async () => {
    setLoadingAction('csv');
    try {
      const res = await appsScriptApi.call('exportToCSV');
      const csvUrl = res?.csvUrl || res?.data?.csvUrl || res?.url;
      if (csvUrl) {
        window.open(csvUrl, '_blank', 'noopener,noreferrer');
      } else {
        alert('CSV Export generated successfully!');
      }
    } catch (err) {
      console.error('CSV Export error:', err);
      alert('Failed to export CSV.');
    } finally {
      setLoadingAction(null);
    }
  };

  // Backup PDFs
  const handleBackupPdfs = async () => {
    setLoadingAction('pdfBackup');
    try {
      const res = await appsScriptApi.call('backupPdfsWithClassOrganization');
      const folderUrl = res?.folderUrl || res?.url;
      if (folderUrl) {
        window.open(folderUrl, '_blank', 'noopener,noreferrer');
      } else {
        alert('PDF backup task initialized successfully!');
      }
    } catch (err) {
      console.error('PDF backup error:', err);
      alert('Failed to initialize PDF backup.');
    } finally {
      setLoadingAction(null);
    }
  };

  // Generate ID Card Data
  const handleGenerateIdCards = async () => {
    setLoadingAction('idCard');
    try {
      const res = await appsScriptApi.call('generateIdCardData');
      const url = res?.url || res?.data?.url;
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        alert('ID Card data generated successfully!');
      }
    } catch (err) {
      console.error('ID Card generation error:', err);
      alert('Failed to generate ID Card data.');
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
      {/* CSV Export Card */}
      <div className="p-6 rounded-3xl border space-y-3 flex flex-col justify-between" style={{ backgroundColor: 'var(--bg-page, #f8fafc)', borderColor: 'var(--border-ui, #cbd5e1)' }}>
        <div className="space-y-2">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
            <FileSpreadsheet size={20} />
          </div>
          <h3 className="font-extrabold text-sm" style={{ color: 'var(--text-main, #0f172a)' }}>
            Export Master CSV
          </h3>
          <p className="text-slate-400 leading-relaxed">
            Download complete student applications data sheet in CSV format for offline reporting.
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportCsv}
          disabled={loadingAction === 'csv'}
          className="w-full py-3 px-4 rounded-xl font-extrabold text-white bg-emerald-600 hover:bg-emerald-500 shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
        >
          {loadingAction === 'csv' ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
          <span>Export CSV</span>
        </button>
      </div>

      {/* Class PDF Backup Card */}
      <div className="p-6 rounded-3xl border space-y-3 flex flex-col justify-between" style={{ backgroundColor: 'var(--bg-page, #f8fafc)', borderColor: 'var(--border-ui, #cbd5e1)' }}>
        <div className="space-y-2">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/10 text-indigo-600 flex items-center justify-center">
            <FolderArchive size={20} />
          </div>
          <h3 className="font-extrabold text-sm" style={{ color: 'var(--text-main, #0f172a)' }}>
            Backup PDFs by Class
          </h3>
          <p className="text-slate-400 leading-relaxed">
            Organize all student application PDFs into class-wise Google Drive backup folders.
          </p>
        </div>

        <button
          type="button"
          onClick={handleBackupPdfs}
          disabled={loadingAction === 'pdfBackup'}
          className="w-full py-3 px-4 rounded-xl font-extrabold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
        >
          {loadingAction === 'pdfBackup' ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
          <span>Backup PDFs</span>
        </button>
      </div>

      {/* ID Card Generation Card */}
      <div className="p-6 rounded-3xl border space-y-3 flex flex-col justify-between" style={{ backgroundColor: 'var(--bg-page, #f8fafc)', borderColor: 'var(--border-ui, #cbd5e1)' }}>
        <div className="space-y-2">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
            <Contact size={20} />
          </div>
          <h3 className="font-extrabold text-sm" style={{ color: 'var(--text-main, #0f172a)' }}>
            Generate ID Cards
          </h3>
          <p className="text-slate-400 leading-relaxed">
            Generate student identity card print files with photos, roll numbers, and QR codes.
          </p>
        </div>

        <button
          type="button"
          onClick={handleGenerateIdCards}
          disabled={loadingAction === 'idCard'}
          className="w-full py-3 px-4 rounded-xl font-extrabold text-white bg-amber-600 hover:bg-amber-500 shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
        >
          {loadingAction === 'idCard' ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
          <span>Generate ID Cards</span>
        </button>
      </div>
    </div>
  );
}
