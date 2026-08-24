'use strict';

const fs = require('fs');
const path = require('path');

const MAX_LENGTHS = Object.freeze({
  name: 120,
  designation: 120,
  subject: 120,
  department: 80,
});

function cleanString(value, maxLength) {
  return String(value || '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function toPublicFacultyMember(member) {
  if (!member || typeof member !== 'object' || member.hidden === true) return null;

  const projected = {};
  Object.entries(MAX_LENGTHS).forEach(([field, maxLength]) => {
    projected[field] = cleanString(member[field], maxLength);
  });

  const photo = cleanString(member.photo, 2048);
  if (/^\/slides\/[a-zA-Z0-9._-]+\.(?:jpe?g|png|webp)$/i.test(photo) ||
      /^https:\/\/(?:firebasestorage\.googleapis\.com|[^/]+\.googleusercontent\.com)\//i.test(photo)) {
    projected.photo = photo;
  } else {
    projected.photo = '';
  }

  return projected.name && projected.designation ? projected : null;
}

function main() {
  const inputArg = process.argv[2];
  const outputArg = process.argv[3];
  if (!inputArg || !outputArg) {
    throw new Error('Usage: node scripts/generate-public-faculty.js <private-input.json> <public-output.json>');
  }

  const inputPath = path.resolve(inputArg);
  const outputPath = path.resolve(outputArg);
  const source = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  if (!Array.isArray(source)) throw new Error('Private faculty input must be a JSON array.');

  const publicFaculty = source.map(toPublicFacultyMember).filter(Boolean);
  fs.writeFileSync(outputPath, `${JSON.stringify(publicFaculty, null, 2)}\n`, 'utf8');
  process.stdout.write(`Generated ${publicFaculty.length} public faculty records with an explicit five-field allowlist.\n`);
}

if (require.main === module) main();

module.exports = { toPublicFacultyMember };
