function generateExamNumber() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function buildOmrPayload(studentRecord, examNumber) {
  return {
    examNumber,
    studentId: studentRecord.registrationNumber || examNumber,
    name: studentRecord.name,
    fatherName: studentRecord.fatherName,
    formNumber: studentRecord.formNumber,
    registrationNumber: studentRecord.registrationNumber,
    className: studentRecord.className,
    classRollNumber: studentRecord.classRollNumber,
    session: studentRecord.session || '2025-26',
    photoUrl: studentRecord.photoUrl || null,
    questionCount: 60,
    signatureAreas: ['student-signature', 'invigilator-signature'],
    identityMarks: ['corner-mark-1', 'corner-mark-2', 'row-guide'],
    status: 'prepared'
  };
}

function classifyResponse(answer) {
  if (!answer || !answer.marked) return 'unmarked';
  if (answer.marked === 'invalid') return 'invalid';
  if (answer.marked === 'multiple') return 'multiple-marked';
  if (answer.marked === 'faint') return 'faint-unclear';
  return 'valid';
}

module.exports = {
  generateExamNumber,
  buildOmrPayload,
  classifyResponse
};
