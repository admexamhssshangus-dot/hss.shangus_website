const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'db_30 Jul 2026.xlsx');
const wb = XLSX.readFile(filePath);

const srcWs = wb.Sheets['source_data'];
const admWs = wb.Sheets['adm_form'];

const srcData = XLSX.utils.sheet_to_json(srcWs, { defval: '' });
const admData = XLSX.utils.sheet_to_json(admWs, { defval: '' });

console.log('=== ROLL NO 6 IN 12TH 2025-26 (EXCEL) ===');
const roll6_src = srcData.find(r => {
  const cls = String(r['Class'] || '').toLowerCase();
  const ses = String(r['Session'] || '').trim();
  const roll = String(r['Class R.No.'] || r['Class Roll No'] || '').trim();
  return (cls.includes('12') || cls.includes('xii')) && ses === '2025-26' && roll === '6';
});
console.log('Roll No 6 in source_data:', roll6_src);

const roll6_adm = admData.filter(r => {
  const cls = String(r['Admission sought for class'] || r['Class'] || '').toLowerCase();
  const ses = String(r['Session'] || '').trim();
  const roll = String(r['Class Roll No'] || '').trim();
  return (cls.includes('12') || cls.includes('xii')) && ses === '2025-26' && roll === '6';
});
console.log('Roll No 6 in adm_form:', roll6_adm);

console.log('\n=== CHECK ALL FORMS FOR ROLL NO 6 STUDENT ===');
if (roll6_src || roll6_adm[0]) {
  const name = roll6_src ? roll6_src["Student's Name"] : roll6_adm[0]["Student's Name (as per school records)"];
  const reg = roll6_src ? roll6_src["Board Registration Number"] : roll6_adm[0]["Board Registration Number"];
  console.log('Student Name:', name, '| Reg:', reg);

  const allFormsForStudent = admData.filter(r => {
    const rName = String(r["Student's Name (as per school records)"] || r["Student's Name"] || '').toLowerCase();
    const rReg = String(r['Board Registration Number'] || r['Board Reg. No.'] || '').toLowerCase();
    return (name && rName.includes(name.toLowerCase())) || (reg && rReg === reg.toLowerCase());
  });
  console.log('Forms found in adm_form for this student:', allFormsForStudent.length);
  allFormsForStudent.forEach(f => {
    console.log('  Form No:', f['Form Number'] || f['FormNo'], '| Class:', f['Admission sought for class'] || f['Class'], '| Session:', f['Session'], '| Roll:', f['Class Roll No'], '| Status:', f['Status'], '| Email:', f['Email Address'] || f['email1']);
  });
}
