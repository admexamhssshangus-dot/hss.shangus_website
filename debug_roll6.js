const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'db_30 Jul 2026.xlsx');
const wb = XLSX.readFile(filePath);
const admWs = wb.Sheets['adm_form'];
const admData = XLSX.utils.sheet_to_json(admWs, { defval: '' });

const mahreebForms = admData.filter(r => {
  const name = String(r["Student's Name (as per school records)"] || r["Student's Name"] || '').toLowerCase();
  return name.includes('mahreeb');
});

console.log('Mahreeb forms in adm_form:', mahreebForms.length);
mahreebForms.forEach(f => {
  console.log('Form:', f['Form Number'] || f['FormNo'], '| Class:', f['Admission sought for class'] || f['Class'], '| Session:', f['Session'], '| Roll:', f['Class Roll No'], '| Reg:', f['Board Registration No. (Class 11th)'] || f['Board Registration Number'], '| Email:', f['Email Address']);
});
