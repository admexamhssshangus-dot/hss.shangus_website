'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const schemaSource = read('src/utils/defaultFormSchema.js');
const formSource = read('src/portal/student/AdmissionForm.jsx');
const pdfSource = read('src/utils/pdfGenerator.js');

const schemaFields = [...schemaSource.matchAll(/"Field Name"\s*:\s*"([^"]+)"/g)].map(match => match[1]);
const mapStart = formSource.indexOf('const fieldSectionMap = {');
const mapEnd = formSource.indexOf('\n  };', mapStart);
assert(mapStart >= 0 && mapEnd > mapStart, 'Admission field classification map is missing');

const mapSource = formSource.slice(mapStart, mapEnd);
const mappedFields = [...mapSource.matchAll(/^\s*"([^"]+)"\s*:/gm)].map(match => match[1]);
const duplicates = mappedFields.filter((field, index) => mappedFields.indexOf(field) !== index);
const missing = [...new Set(schemaFields)].filter(field => !mappedFields.includes(field));

assert.strictEqual(duplicates.length, 0, `Duplicate admission classifications: ${[...new Set(duplicates)].join(', ')}`);
assert.strictEqual(missing.length, 0, `Unclassified admission fields: ${missing.join(', ')}`);
assert(/name === 'Declaration'\) return false;/.test(formSource), 'Declaration must remain workflow-managed');
assert(/Confirmation is intentionally handled by the final review modal/.test(formSource), 'Declaration handling is undocumented');
assert(/"Subjects Studied in Class 11th": '📚 Stream & Subject Selection'/.test(formSource), 'Class 12 dependent subjects are not classified with stream selection');
assert(/next\['Stream & Subjects for Class 12th'\] = value/.test(formSource), 'Class 12 subject summary is not synchronized');
assert(/if \(fieldName === 'Stream & Subjects for Class 12th'\) return false;/.test(formSource), 'Redundant Class 12 subject summary is visible');
assert(!/id: 'subjects'/.test(formSource), 'Subjects still use a separate workflow tab');
assert(/label: 'Academics & Subjects'/.test(formSource), 'Merged academics and subjects tab is missing');
assert(/"Bank Account No\.": '🏦 Bank Account Details'/.test(formSource), 'Bank details are not separated from scholarship details');
assert(/Single-page form: shortcuts above jump to these numbered groups/.test(formSource), 'Admission form is not using the single-page layout');
assert(!/sectionWorkflowStep\(sectionTitle\) === activeTab/.test(formSource), 'Admission fields are still hidden behind tabs');

const provisionalStart = pdfSource.indexOf('export function buildProvisionalFormHtml');
const provisionalEnd = pdfSource.indexOf('export function generateProvisionalAdmissionPdf', provisionalStart);
assert(provisionalStart >= 0 && provisionalEnd > provisionalStart, 'Provisional PDF generator is missing');
const provisionalSource = pdfSource.slice(provisionalStart, provisionalEnd);
assert.strictEqual((provisionalSource.match(/class="print-page prov-page"/g) || []).length, 1, 'Provisional PDF must contain exactly one page');
assert(/Exam Roll Number of Class/.test(provisionalSource), 'Provisional PDF uses a non-schema exam roll field');
assert(/Name of Previous School \(Class/.test(provisionalSource), 'Provisional PDF does not use class-specific previous-school data');
assert(/Stream & Subjects for Class 12th/.test(provisionalSource), 'Provisional PDF omits the Class 12 subject field');
assert(/Page 1\/1/.test(provisionalSource), 'Provisional PDF is not marked as one page');

assert(/includeAdmissionForm = true/.test(pdfSource), 'Full admission PDF page is disabled');
assert(/includeLibraryForm = true/.test(pdfSource), 'Full admission PDF second page is disabled');

console.log(`Admission regression checks passed: ${new Set(schemaFields).size} schema fields classified; provisional PDF 1 page; full PDF 2 pages.`);
