const sessionOf = app => String(app.sessionCanonical || app.Session || app.session || app['Academic Session'] || '').replace(/[–—]/g, '-').trim();

export function applicationRank(app) {
  const status = app.Status || app.status;
  if (['Submitted', 'Under Review', 'Approved', 'Provisional'].includes(status)) return 0;
  if (status === 'Rejected') {
    const editableUntil = app.editableUntil || app.editUnlockedUntil;
    const millis = typeof editableUntil === 'object'
      ? Number(editableUntil._seconds || editableUntil.seconds || 0) * 1000
      : (Date.parse(editableUntil || '') || Number(editableUntil || 0) || 0);
    const isActiveCorrection = app.isEditable === true || !editableUntil || millis > Date.now();
    return isActiveCorrection ? 1 : 2;
  }
  if (status === 'Draft') return 3;
  if (status === 'Withdrawn') return 4;
  return 5;
}

export function selectStudentApplication(applications, activeSession) {
  if (!Array.isArray(applications) || applications.length === 0) return null;
  const session = String(activeSession || '').replace(/[–—]/g, '-').trim();
  const timeOf = app => {
    const val = app.updatedAt || app.submittedAt || app.createdAt;
    if (!val) return 0;
    if (typeof val === 'object') return Number(val._seconds || val.seconds || 0) * 1000;
    return Date.parse(val) || Number(val) || 0;
  };

  return [...applications].sort((a, b) =>
    Number(sessionOf(b) === session) - Number(sessionOf(a) === session) ||
    applicationRank(a) - applicationRank(b) ||
    timeOf(b) - timeOf(a)
  )[0] || null;
}

