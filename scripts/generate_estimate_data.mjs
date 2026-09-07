import fs from 'fs';
import path from 'path';

const rootDir = process.cwd();

const EXCLUDE_DIRS = new Set([
  'node_modules',
  '.git',
  '.agents',
  '.venv',
  'build',
  'login', // Legacy Apps Script excluded
  'old_practicals',
  '.firebase',
  '.netlify',
  'scratch',
  'backup',
  'backups'
]);

const CODE_EXTENSIONS = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
  '.css', '.html', '.json', '.rules', '.toml'
]);

const IGNORE_FILES = new Set([
  'package-lock.json',
  'skills-lock.json',
  'db_source.xlsx',
  'db_30 Jul 2026.xlsx',
  'serviceAccount.json'
]);

const allFiles = [];

function scan(dir) {
  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of list) {
    const full = path.join(dir, item.name);
    const rel = path.relative(rootDir, full).replace(/\\/g, '/');
    if (item.isDirectory()) {
      if (EXCLUDE_DIRS.has(item.name)) continue;
      scan(full);
    } else if (item.isFile()) {
      if (IGNORE_FILES.has(item.name)) continue;
      const ext = path.extname(item.name).toLowerCase();
      if (!CODE_EXTENSIONS.has(ext)) continue;

      const content = fs.readFileSync(full, 'utf8');
      const lines = content.split('\n');
      const loc = lines.length;
      const chars = content.length;
      const tokens = Math.round(chars / 3.9);

      let sectionKey = 'other';
      let sectionName = 'Other';
      let isData = false;

      if (rel.startsWith('src/portal/admin/')) {
        sectionKey = 'admin_portal';
        sectionName = 'Admin Portal Suite (Studio & ERP)';
      } else if (rel.startsWith('src/portal/teacher/')) {
        sectionKey = 'teacher_portal';
        sectionName = 'Teacher Portal (Attendance & Labs)';
      } else if (rel.startsWith('src/portal/student/')) {
        sectionKey = 'student_portal';
        sectionName = 'Student Portal (Admissions & Services)';
      } else if (rel.startsWith('src/portal/components/')) {
        sectionKey = 'portal_components';
        sectionName = 'Portal UI Components & Dynamic Forms';
      } else if (rel.startsWith('src/portal/layout/')) {
        sectionKey = 'portal_layout';
        sectionName = 'Portal Layout, Shell & Navigation';
      } else if (rel.startsWith('src/portal/')) {
        sectionKey = 'portal_core';
        sectionName = 'Portal Auth, Session & Role Routing';
      } else if (rel.startsWith('src/pages/')) {
        sectionKey = 'pages';
        sectionName = 'Public Pages & Primary Dashboards';
      } else if (rel.startsWith('src/components/')) {
        sectionKey = 'components';
        sectionName = 'Reusable Public UI Components';
      } else if (rel.startsWith('src/services/')) {
        sectionKey = 'services';
        sectionName = 'Firebase Services, Cache & Sync';
      } else if (rel.startsWith('src/utils/')) {
        sectionKey = 'utils';
        sectionName = 'Client Engines (PDF, DOCX, Canvas)';
      } else if (rel.startsWith('src/styles/') || rel === 'src/index.css') {
        sectionKey = 'styles';
        sectionName = 'Design System, Themes & Glassmorphism';
      } else if (rel.startsWith('scripts/')) {
        sectionKey = 'scripts';
        sectionName = 'Automation, Ingestion & Regressions';
      } else if (rel.startsWith('netlify/')) {
        sectionKey = 'netlify';
        sectionName = 'Netlify Serverless Edge Functions';
      } else if (rel.startsWith('functions/')) {
        sectionKey = 'functions';
        sectionName = 'Firebase Cloud Functions Backend';
      } else if (rel.startsWith('public/')) {
        sectionKey = 'public';
        sectionName = 'Public Static Manifests & Metadata';
      } else if (rel.startsWith('src/data/')) {
        sectionKey = 'data';
        sectionName = 'Master Seed Data & Schemas';
        isData = true;
      } else if (rel.startsWith('src/')) {
        sectionKey = 'src_root';
        sectionName = 'Core App Shell (App.js, index.js)';
      } else {
        sectionKey = 'root_config';
        sectionName = 'Root Config & Security Rules';
      }

      allFiles.push({
        rel,
        ext,
        loc,
        chars,
        tokens,
        sectionKey,
        sectionName,
        isData
      });
    }
  }
}

scan(rootDir);

const codeOnly = allFiles.filter(f => !f.isData);
const dataOnly = allFiles.filter(f => f.isData);

const totalCodeFiles = codeOnly.length;
const totalCodeLines = codeOnly.reduce((s, f) => s + f.loc, 0);
const totalCodeChars = codeOnly.reduce((s, f) => s + f.chars, 0);
const totalCodeTokens = codeOnly.reduce((s, f) => s + f.tokens, 0);

const totalAllFiles = allFiles.length;
const totalAllLines = allFiles.reduce((s, f) => s + f.loc, 0);
const totalAllChars = allFiles.reduce((s, f) => s + f.chars, 0);
const totalAllTokens = allFiles.reduce((s, f) => s + f.tokens, 0);

const sections = {};
for (const f of allFiles) {
  if (!sections[f.sectionKey]) {
    sections[f.sectionKey] = {
      name: f.sectionName,
      key: f.sectionKey,
      isData: f.isData,
      files: 0,
      lines: 0,
      chars: 0,
      tokens: 0
    };
  }
  sections[f.sectionKey].files++;
  sections[f.sectionKey].lines += f.loc;
  sections[f.sectionKey].chars += f.chars;
  sections[f.sectionKey].tokens += f.tokens;
}

const sortedSections = Object.values(sections).sort((a, b) => {
  if (a.isData) return 1;
  if (b.isData) return -1;
  return b.lines - a.lines;
});

const top20Code = [...codeOnly].sort((a, b) => b.loc - a.loc).slice(0, 20);

console.log('=== SUMMARY ===');
console.log(`Code Files: ${totalCodeFiles}, Code LOC: ${totalCodeLines}, Code Chars: ${totalCodeChars}, Code Tokens: ${totalCodeTokens}`);
console.log(`All Files: ${totalAllFiles}, All Lines: ${totalAllLines}, All Chars: ${totalAllChars}, All Tokens: ${totalAllTokens}`);

console.log('\n=== SECTIONS ===');
for (const s of sortedSections) {
  console.log(`${s.name} | Files: ${s.files} | Lines: ${s.lines.toLocaleString()} | Chars: ${s.chars.toLocaleString()} | Tokens: ${s.tokens.toLocaleString()}`);
}

console.log('\n=== TOP 20 CODE FILES ===');
top20Code.forEach((f, i) => {
  console.log(`${i + 1}. ${f.rel} | ${f.loc.toLocaleString()} lines | ${(f.chars / 1024).toFixed(0)}KB`);
});
