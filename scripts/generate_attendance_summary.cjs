const path = require('path');
const fs = require('fs');

const { initializeApp, cert } = require(path.resolve(__dirname, '../functions/node_modules/firebase-admin'));
const { getFirestore } = require(path.resolve(__dirname, '../functions/node_modules/firebase-admin/lib/firestore'));

const saPath = path.resolve(__dirname, 'serviceAccount.json');
const sa = JSON.parse(fs.readFileSync(saPath, 'utf8'));

const app = initializeApp({ credential: cert(sa) });
const db = getFirestore(app);

const MASTER_SUBJECT_NAMES = {
  'BO': 'Botany',
  'BOTANY': 'Botany',
  'BOTANY (BO)': 'Botany',
  'UR': 'Urdu',
  'URDU': 'Urdu',
  'EN': 'General English',
  'PH': 'Physics',
  'CH': 'Chemistry',
  'BI': 'Biology',
  'ZO': 'Zoology',
  'ES': 'Environmental Science',
  'PD': 'Physical Education',
  'ITE': 'IT and ITES',
  'HTC': 'Healthcare',
  'CS': 'Computer Science',
  'GG': 'Geography',
  'MA': 'Mathematics',
  'ED': 'Education',
  'HT': 'History',
  'PS': 'Political Science',
  'EC': 'Economics',
  'SO': 'Sociology',
  'GENERAL': 'General / Morning Roll Call'
};

function formatSubjectName(sub) {
  if (!sub) return 'General Attendance';
  const clean = String(sub).trim().toUpperCase();
  return MASTER_SUBJECT_NAMES[clean] || sub;
}

function resolveRecordClass(r, id) {
  const idParts = String(id || '').split('_');
  const raw = String(r.className || r.class || r.Class || idParts[0] || '').trim().toLowerCase();
  if (raw.includes('11') || raw.includes('xi')) return '11th';
  if (raw.includes('12') || raw.includes('xii')) return '12th';
  if (raw.includes('10') || raw.includes('x')) return '10th';
  return raw.endsWith('th') ? raw : (raw ? `${raw}th` : '11th');
}

function resolveRecordDate(r, id) {
  const idParts = String(id || '').split('_');
  return r.date || r.dateStr || (idParts.length >= 2 && /^\d{4}-\d{2}-\d{2}$/.test(idParts[1]) ? idParts[1] : '') || '';
}

function resolveRecordSubject(r, id) {
  const idParts = String(id || '').split('_');
  return r.subject || r.subjectCode || r.subjectName || (idParts.length >= 3 ? idParts[2] : 'General');
}

async function buildAttendanceSummary() {
  console.log('Fetching all attendance documents from Firestore...');
  const snap = await db.collection('attendance').get();
  console.log(`Found ${snap.size} session documents in attendance collection.`);

  let totalLogs = 0;
  let totalPresent = 0;
  const distinctDates = new Set();
  const classCounts = { '11th': 0, '12th': 0, other: 0 };
  const subjectGroupsMap = {};
  const dateGroupsMap = {};

  snap.forEach(docSnap => {
    const data = docSnap.data();
    const docId = docSnap.id;
    const cls = resolveRecordClass(data, docId);
    const dt = resolveRecordDate(data, docId);
    const sub = resolveRecordSubject(data, docId);
    const subKey = `${cls}_${sub.toUpperCase()}`;

    if (dt) distinctDates.add(dt);

    let sessionTotal = 0;
    let sessionPresent = 0;

    if (Array.isArray(data.records)) {
      data.records.forEach(st => {
        sessionTotal++;
        totalLogs++;
        if (cls === '11th' || cls === '12th') {
          classCounts[cls] = (classCounts[cls] || 0) + 1;
        } else {
          classCounts.other = (classCounts.other || 0) + 1;
        }

        const s = String(st.status || '').toUpperCase();
        if (s === 'P' || s === 'PRESENT') {
          sessionPresent++;
          totalPresent++;
        }
      });
    } else if (data.status) {
      sessionTotal++;
      totalLogs++;
      if (cls === '11th' || cls === '12th') {
        classCounts[cls] = (classCounts[cls] || 0) + 1;
      } else {
        classCounts.other = (classCounts.other || 0) + 1;
      }

      const s = String(data.status || '').toUpperCase();
      if (s === 'P' || s === 'PRESENT') {
        sessionPresent++;
        totalPresent++;
      }
    }

    // 1. Group by Subject & Class
    if (!subjectGroupsMap[subKey]) {
      subjectGroupsMap[subKey] = {
        id: subKey,
        className: cls,
        subjectCode: sub,
        subjectFullName: formatSubjectName(sub),
        sessionsCount: 0,
        totalStudentsCount: 0,
        totalPresentCount: 0,
        earliestDate: dt,
        latestDate: dt,
        sessions: []
      };
    }

    const sg = subjectGroupsMap[subKey];
    sg.sessionsCount++;
    sg.totalStudentsCount += sessionTotal;
    sg.totalPresentCount += sessionPresent;
    if (dt) {
      if (!sg.earliestDate || dt < sg.earliestDate) sg.earliestDate = dt;
      if (!sg.latestDate || dt > sg.latestDate) sg.latestDate = dt;
    }
    sg.sessions.push({
      docId: docId,
      date: dt,
      totalStudents: sessionTotal,
      presentStudents: sessionPresent,
      presentRate: sessionTotal > 0 ? Math.round((sessionPresent / sessionTotal) * 100) : 0,
      teacher: data.teacher || data.teacherName || data.teacherEmail || 'Faculty'
    });

    // 2. Group by Date
    if (dt) {
      if (!dateGroupsMap[dt]) {
        dateGroupsMap[dt] = {
          date: dt,
          sessionsCount: 0,
          totalStudentsCount: 0,
          totalPresentCount: 0,
          classes: new Set(),
          subjects: new Set(),
          sessionSummaries: []
        };
      }
      const dg = dateGroupsMap[dt];
      dg.sessionsCount++;
      dg.totalStudentsCount += sessionTotal;
      dg.totalPresentCount += sessionPresent;
      dg.classes.add(cls);
      dg.subjects.add(`${formatSubjectName(sub)} (${cls})`);
      dg.sessionSummaries.push({
        className: cls,
        subject: formatSubjectName(sub),
        subjectCode: sub,
        totalStudents: sessionTotal,
        presentStudents: sessionPresent,
        rate: sessionTotal > 0 ? Math.round((sessionPresent / sessionTotal) * 100) : 0
      });
    }
  });

  // Calculate averages and sort
  const subjectGroups = Object.values(subjectGroupsMap).map(sg => {
    sg.avgPresentRate = sg.totalStudentsCount > 0 ? Math.round((sg.totalPresentCount / sg.totalStudentsCount) * 100) : 0;
    // Sort sessions in reverse chronological order
    sg.sessions.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    return sg;
  }).sort((a, b) => b.totalStudentsCount - a.totalStudentsCount);

  const dateGroups = Object.values(dateGroupsMap).map(dg => {
    return {
      date: dg.date,
      sessionsCount: dg.sessionsCount,
      totalStudentsCount: dg.totalStudentsCount,
      totalPresentCount: dg.totalPresentCount,
      avgPresentRate: dg.totalStudentsCount > 0 ? Math.round((dg.totalPresentCount / dg.totalStudentsCount) * 100) : 0,
      classes: Array.from(dg.classes).sort(),
      subjects: Array.from(dg.subjects).sort(),
      sessionSummaries: dg.sessionSummaries
    };
  }).sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const overallPresentRate = totalLogs > 0 ? Math.round((totalPresent / totalLogs) * 100) : 0;

  const payload = {
    totalLogs,
    totalSessions: snap.size,
    distinctDays: distinctDates.size,
    classCounts,
    totalPresent,
    overallPresentRate,
    subjectGroups,
    dateGroups,
    updatedAt: new Date().toISOString(),
    isCompactSummary: true
  };

  console.log('Summary metrics:', {
    totalLogs,
    totalSessions: snap.size,
    distinctDays: distinctDates.size,
    overallPresentRate: `${overallPresentRate}%`,
    subjectGroupsCount: subjectGroups.length,
    dateGroupsCount: dateGroups.length
  });

  console.log('Writing compact summary to systemSettings/attendanceSummary in Firestore...');
  await db.collection('systemSettings').doc('attendanceSummary').set(payload, { merge: true });
  console.log('✅ Successfully written systemSettings/attendanceSummary!');
}

buildAttendanceSummary().then(() => process.exit(0)).catch(err => {
  console.error('Failed to build attendance summary:', err);
  process.exit(1);
});
