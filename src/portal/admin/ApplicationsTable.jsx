import React from 'react';
import { Search, Eye, Unlock, Trash2, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { getStudentPhotoUrl, formatPhotoDisplayUrl } from '../../utils/imageCompressor';

/**
 * ApplicationsTable — Sortable, Filterable Student Applications Data Table.
 */
export default function ApplicationsTable({
  applications = [],
  onReview,
  onUnlock,
  onDelete,
  searchTerm,
  setSearchTerm,
  selectedClass,
  setSelectedClass,
  selectedStatus,
  setSelectedStatus,
  selectedStream,
  setSelectedStream,
}) {
  // Apply filtering
  const filtered = applications.filter((app) => {
    const formNo = String(app['Form Number'] || app['FormNo'] || app['formNumber'] || '').toLowerCase();
    const name = String(
      app["Student's Name (as per school records)"] ||
      app["Student's Name"] ||
      app['Full Name'] ||
      app['Name'] ||
      app['Account Name'] ||
      app['User Name'] ||
      app['Email Address'] ||
      ''
    ).toLowerCase();
    const parentage = String(app["Father's/Guardian's Name (as per school records)"] || app["Father's/Guardian's Name"] || app["Father's Name"] || app['FatherName'] || '').toLowerCase();
    const mobile = String(app["Mobile No. (with working WhatsApp)"] || app["Mobile No."] || app['Student Mobile No'] || app['Mobile'] || app['Account Mobile'] || '').toLowerCase();
    const cls = String(app['Admission sought for class'] || app['Class'] || '');
    const status = String(app['Status'] || '');
    const stream = String(app['Stream for Class 11th'] || app['Stream opted in Class 11th'] || app['Stream'] || '');

    const query = searchTerm.toLowerCase();
    const matchesSearch = !query || formNo.includes(query) || name.includes(query) || parentage.includes(query) || mobile.includes(query);
    const matchesClass = selectedClass === 'All' || cls.includes(selectedClass);
    const matchesStatus = selectedStatus === 'All' || status === selectedStatus;
    const matchesStream = selectedStream === 'All' || stream === selectedStream;

    return matchesSearch && matchesClass && matchesStatus && matchesStream;
  });

  // Dynamically extract unique filter options directly from loaded database applications
  const dynamicClasses = React.useMemo(() => {
    const set = new Set();
    applications.forEach(a => {
      const cls = a['Admission sought for class'] || a['Class'];
      if (cls) set.add(cls);
    });
    return Array.from(set).sort();
  }, [applications]);

  const dynamicStatuses = React.useMemo(() => {
    const set = new Set();
    applications.forEach(a => {
      const st = a['Status'];
      if (st) set.add(st);
    });
    return Array.from(set).sort();
  }, [applications]);

  const dynamicStreams = React.useMemo(() => {
    const set = new Set();
    applications.forEach(a => {
      const strm = a['Stream for Class 11th'] || a['Stream opted in Class 11th'] || a['Stream'];
      if (strm) set.add(strm);
    });
    return Array.from(set).sort();
  }, [applications]);

  return (
    <div className="space-y-4">
      {/* Filter Controls Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
        {/* Search */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search Form No, Name, Mobile..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3.5 py-2.5 pl-9 rounded-xl border focus:outline-none focus:ring-2 focus:ring-amber-500"
            style={{ backgroundColor: 'var(--bg-page, #f8fafc)', borderColor: 'var(--border-ui, #cbd5e1)', color: 'var(--text-main, #0f172a)' }}
          />
          <Search size={15} className="absolute left-3 top-3 text-slate-400" />
        </div>

        {/* Class Filter */}
        <select
          value={selectedClass}
          onChange={(e) => setSelectedClass(e.target.value)}
          className="px-3.5 py-2.5 rounded-xl border font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
          style={{ backgroundColor: 'var(--bg-page, #f8fafc)', borderColor: 'var(--border-ui, #cbd5e1)', color: 'var(--text-main, #0f172a)' }}
        >
          <option value="All">All Classes</option>
          {dynamicClasses.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        {/* Status Filter */}
        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="px-3.5 py-2.5 rounded-xl border font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
          style={{ backgroundColor: 'var(--bg-page, #f8fafc)', borderColor: 'var(--border-ui, #cbd5e1)', color: 'var(--text-main, #0f172a)' }}
        >
          <option value="All">All Statuses</option>
          {dynamicStatuses.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        {/* Stream Filter */}
        <select
          value={selectedStream}
          onChange={(e) => setSelectedStream(e.target.value)}
          className="px-3.5 py-2.5 rounded-xl border font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
          style={{ backgroundColor: 'var(--bg-page, #f8fafc)', borderColor: 'var(--border-ui, #cbd5e1)', color: 'var(--text-main, #0f172a)' }}
        >
          <option value="All">All Streams</option>
          {dynamicStreams.map(st => <option key={st} value={st}>{st}</option>)}
        </select>
      </div>

      {/* Applications Table */}
      <div className="overflow-x-auto rounded-2xl border" style={{ borderColor: 'var(--border-ui, #e2e8f0)' }}>
        <table className="w-full text-left text-xs">
          <thead style={{ backgroundColor: 'var(--bg-secondary, #f1f5f9)', color: 'var(--text-muted, #64748b)' }}>
            <tr>
              <th className="p-3 font-extrabold">S.No.</th>
              <th className="p-3 font-extrabold">Photo</th>
              <th className="p-3 font-extrabold">Form #</th>
              <th className="p-3 font-extrabold">Student Name</th>
              <th className="p-3 font-extrabold">Parentage</th>
              <th className="p-3 font-extrabold">Class</th>
              <th className="p-3 font-extrabold">Stream</th>
              <th className="p-3 font-extrabold">Roll No</th>
              <th className="p-3 font-extrabold">Status</th>
              <th className="p-3 font-extrabold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: 'var(--border-ui, #f1f5f9)' }}>
            {filtered.length > 0 ? (
              filtered.map((app, idx) => {
                const status = app['Status'] || 'Draft';
                const formNo = app['Form Number'] || app['FormNo'] || app['formNumber'] || 'N/A';
                const name = app["Student's Name (as per school records)"] ||
                  app["Student's Name"] ||
                  app['Full Name'] ||
                  app['Name'] ||
                  app['Account Name'] ||
                  app['User Name'] ||
                  app['Email Address'] ||
                  'Draft Student';
                const parentage = app["Father's/Guardian's Name (as per school records)"] || app["Father's/Guardian's Name"] || app["Father's Name"] || app['FatherName'] || (status === 'Draft' ? 'Draft (Unfilled)' : 'N/A');
                const cls = app['Admission sought for class'] || app['Class'] || (status === 'Draft' ? 'Draft' : 'N/A');
                const stream = app['Stream for Class 11th'] || app['Stream opted in Class 11th'] || app['Stream'] || (status === 'Draft' ? 'Draft' : 'N/A');
                const rollNo = app['Class Roll No'] || app['Class Roll No.'] || app['RL. NO.'] || app['RL. NO'] || app['Roll No'] || app['Roll No.'] || app.classRollNo || app.rollNo || app.roll || '—';
                const photoUrl = formatPhotoDisplayUrl(getStudentPhotoUrl(app)) || formatPhotoDisplayUrl(app.photo_id) || formatPhotoDisplayUrl(app['Student Photo']) || formatPhotoDisplayUrl(app.photoUrl) || '';

                return (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="p-3 font-mono font-bold text-amber-600">{idx + 1}</td>
                    <td className="p-3">
                      {photoUrl && photoUrl !== '/logo.png' && photoUrl.length > 20 ? (
                        <img
                          src={photoUrl}
                          alt={name}
                          onClick={() => onReview(app)}
                          className="w-8 h-10 rounded-lg border border-teal-500/40 object-cover shadow-sm hover:scale-125 transition-transform cursor-pointer"
                          title="Click to view/update photo"
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      ) : (
                        <div
                          onClick={() => onReview(app)}
                          className="w-8 h-10 rounded-lg bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 flex items-center justify-center text-[9px] font-bold text-slate-400 cursor-pointer hover:border-amber-500"
                          title="Click to upload photo"
                        >
                          No Photo
                        </div>
                      )}
                    </td>
                    <td className="p-3 font-mono font-bold text-teal-600">{formNo}</td>
                    <td className="p-3 font-extrabold" style={{ color: 'var(--text-main, #0f172a)' }}>{name}</td>
                    <td className="p-3 text-slate-500">{parentage}</td>
                    <td className="p-3 font-semibold">{cls}</td>
                    <td className="p-3 text-slate-500">{stream}</td>
                    <td className="p-3 font-mono text-teal-600 font-bold">{rollNo}</td>
                    <td className="p-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                        status === 'Submitted'
                          ? 'bg-emerald-500/15 text-emerald-600'
                          : status === 'Approved'
                          ? 'bg-teal-500/15 text-teal-600'
                          : status === 'Rejected'
                          ? 'bg-red-500/15 text-red-600'
                          : 'bg-amber-500/15 text-amber-600'
                      }`}>
                        {status}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => onReview(app)}
                          className="p-1.5 rounded-lg border hover:bg-slate-200 dark:hover:bg-slate-700 text-teal-600 cursor-pointer"
                          title="Review Application"
                        >
                          <Eye size={15} />
                        </button>

                        <button
                          type="button"
                          onClick={() => onUnlock(app)}
                          className="p-1.5 rounded-lg border hover:bg-slate-200 dark:hover:bg-slate-700 text-amber-600 cursor-pointer"
                          title="Unlock for Editing"
                        >
                          <Unlock size={15} />
                        </button>

                        <button
                          type="button"
                          onClick={() => onDelete(formNo)}
                          className="p-1.5 rounded-lg border hover:bg-red-500/10 text-red-600 cursor-pointer"
                          title="Delete Application"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={8} className="p-8 text-center text-slate-400 font-medium">
                  No matching student applications found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
