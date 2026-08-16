const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { generateExamNumber, buildOmrPayload, classifyResponse } = require('./omrProcessor');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const mockDb = {
  registrations: [],
  submissions: [],
  uploads: []
};

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'omr-backend' });
});

app.post('/api/students/register', (req, res) => {
  const { registrationNumber, formNumber, mode = 'student' } = req.body;

  const matched = mockDb.registrations.find((student) => {
    return student.registrationNumber === registrationNumber || student.formNumber === formNumber;
  });

  const studentRecord = matched || {
    registrationNumber: registrationNumber || 'MANUAL',
    formNumber: formNumber || 'MANUAL',
    name: 'Manual Entry',
    fatherName: 'Manual Entry',
    className: 'Manual Entry',
    classRollNumber: 'Manual Entry',
    session: '2025-26',
    photoUrl: null,
    manualFallback: true
  };

  const examNumber = generateExamNumber();
  const submission = {
    id: `sub_${Date.now()}`,
    examNumber,
    student: studentRecord,
    status: 'registered',
    createdAt: new Date().toISOString(),
    mode
  };

  mockDb.submissions.push(submission);

  res.json({
    ok: true,
    examNumber,
    submission,
    omrPayload: buildOmrPayload(studentRecord, examNumber)
  });
});

app.post('/api/omr/submit', (req, res) => {
  const { student, answers = [] } = req.body;

  const normalizedAnswers = answers.map((answer) => ({
    ...answer,
    status: classifyResponse(answer)
  }));

  const submissionRecord = {
    id: `omr_${Date.now()}`,
    student,
    answers: normalizedAnswers,
    createdAt: new Date().toISOString()
  };

  mockDb.submissions.push(submissionRecord);

  res.json({ ok: true, submissionRecord });
});

app.post('/api/omr/upload', (req, res) => {
  const { fileName, invigilatorEmail, uploadedAt } = req.body;
  const uploadRecord = {
    id: `upload_${Date.now()}`,
    fileName,
    invigilatorEmail,
    uploadedAt: uploadedAt || new Date().toISOString(),
    status: 'received'
  };

  mockDb.uploads.push(uploadRecord);

  res.json({ ok: true, uploadRecord });
});

const port = process.env.PORT || 4000;
if (require.main === module) {
  app.listen(port, () => {
    console.log(`OMR backend running on port ${port}`);
  });
}

module.exports = app;
