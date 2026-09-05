const sessionOf = app => String(app.sessionCanonical || app.Session || app.session || app['Academic Session'] || '').replace(/[–—]/g, '-').trim();
export function selectStudentApplication(applications, activeSession) {
  const rank = app => ['Submitted', 'Under Review', 'Approved'].includes(app.Status || app.status) ? 0 : 1;
  const session = String(activeSession || '').replace(/[–—]/g, '-').trim();
  return [...applications].sort((a, b) =>
    Number(sessionOf(b) === session) - Number(sessionOf(a) === session) || rank(a) - rank(b)
  )[0] || null;
}
