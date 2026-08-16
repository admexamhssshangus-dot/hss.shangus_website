import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PHOTOS_DIR = 'D:\\Shk_Gulfam\\Projects\\optimized_photos (8 aug 2026)';

function cleanStr(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
}

function cleanName(s) {
  return String(s || '').toLowerCase().replace(/[^a-z]/g, ' ').replace(/\s+/g, ' ').trim();
}

// Session rank: higher number = more recent
function getSessionRank(sessionStr) {
  const s = String(sessionStr || '').toLowerCase();
  if (s.includes('2026-27') || s.includes('2026')) return 5;
  if (s.includes('2025-26') || s.includes('2025')) return 4;
  if (s.includes('2024-25') || s.includes('2024')) return 3;
  if (s.includes('2023-24') || s.includes('2023')) return 2;
  if (s.includes('2022-23') || s.includes('2022')) return 1;
  return 0;
}

// Class rank for preference:
// In 9th/10th track: 9th is preferred over 10th (older class preferred)
// In 11th/12th track: 11th is preferred over 12th (older class preferred)
function parsePhoto(fileName) {
  const ext = path.extname(fileName);
  const base = path.basename(fileName, ext);
  const parts = base.split('_');

  let cls = '';
  let session = '';
  let identifier = '';
  let name = '';

  if (parts.length >= 4) {
    cls = parts[0];
    session = parts[1];
    identifier = parts[2];
    name = parts.slice(3).join(' ');
  } else if (parts.length === 3) {
    cls = parts[0];
    identifier = parts[1];
    name = parts[2];
  } else if (parts.length === 2) {
    identifier = parts[0];
    name = parts[1];
  } else {
    name = base;
  }

  const cleanCls = cleanStr(cls);
  const is9or10 = cleanCls.includes('9') || cleanCls.includes('10');
  const is11or12 = cleanCls.includes('11') || cleanCls.includes('12');

  const filePath = path.join(PHOTOS_DIR, fileName);
  const stats = fs.statSync(filePath);

  return {
    fileName,
    filePath,
    fileSizeBytes: stats.size,
    cls: cleanCls,
    is9or10,
    is11or12,
    session: String(session || '').trim(),
    sessionRank: getSessionRank(session),
    regNo: cleanStr(identifier),
    name: cleanName(name),
    rawName: name.trim()
  };
}

async function run() {
  const allFiles = fs.readdirSync(PHOTOS_DIR).filter(f => /\.(jpe?g|png|webp)$/i.test(f));
  console.log(`📁 Found ${allFiles.length} photo files in "${PHOTOS_DIR}".`);

  const photos = allFiles.map(parsePhoto);

  // Group by Track & Unique Key (RegNo or Name)
  // Track 1: 9th & 10th
  // Track 2: 11th & 12th
  // Track 3: Other / Unclassified

  const track1Groups = new Map(); // key -> list of photos (9th/10th)
  const track2Groups = new Map(); // key -> list of photos (11th/12th)
  const trackOtherGroups = new Map();

  for (const p of photos) {
    const key = (p.regNo && p.regNo.length >= 6) ? `reg_${p.regNo}` : `name_${p.name}`;
    if (p.is9or10) {
      if (!track1Groups.has(key)) track1Groups.set(key, []);
      track1Groups.get(key).push(p);
    } else if (p.is11or12) {
      if (!track2Groups.has(key)) track2Groups.set(key, []);
      track2Groups.get(key).push(p);
    } else {
      if (!trackOtherGroups.has(key)) trackOtherGroups.set(key, []);
      trackOtherGroups.get(key).push(p);
    }
  }

  // Selection function for Track 1 (9th vs 10th):
  // 1. Prefer 9th over 10th
  // 2. Within same class, prefer higher sessionRank (recent session)
  function selectBest9th10th(list) {
    return list.slice().sort((a, b) => {
      const aIs9 = a.cls.includes('9') ? 1 : 0;
      const bIs9 = b.cls.includes('9') ? 1 : 0;
      if (aIs9 !== bIs9) return bIs9 - aIs9; // 9th first
      return b.sessionRank - a.sessionRank; // recent session first
    })[0];
  }

  // Selection function for Track 2 (11th vs 12th):
  // 1. Prefer 11th over 12th
  // 2. Within same class, prefer higher sessionRank (recent session)
  function selectBest11th12th(list) {
    return list.slice().sort((a, b) => {
      const aIs11 = a.cls.includes('11') ? 1 : 0;
      const bIs11 = b.cls.includes('11') ? 1 : 0;
      if (aIs11 !== bIs11) return bIs11 - aIs11; // 11th first
      return b.sessionRank - a.sessionRank; // recent session first
    })[0];
  }

  const selectedPhotos = [];
  let track1DupsPruned = 0;
  let track2DupsPruned = 0;

  for (const [k, list] of track1Groups.entries()) {
    const best = selectBest9th10th(list);
    selectedPhotos.push(best);
    if (list.length > 1) track1DupsPruned += (list.length - 1);
  }

  for (const [k, list] of track2Groups.entries()) {
    const best = selectBest11th12th(list);
    selectedPhotos.push(best);
    if (list.length > 1) track2DupsPruned += (list.length - 1);
  }

  for (const [k, list] of trackOtherGroups.entries()) {
    const best = list[0];
    selectedPhotos.push(best);
  }

  const totalRawSize = photos.reduce((sum, p) => sum + p.fileSizeBytes, 0);
  const totalDedupedSize = selectedPhotos.reduce((sum, p) => sum + p.fileSizeBytes, 0);

  console.log('\n================ DEDUPLICATION ANALYSIS ================');
  console.log(`Total Source Photos                    : ${photos.length} (${(totalRawSize / (1024 * 1024)).toFixed(2)} MB)`);
  console.log(`9th & 10th Unique Student Photo Count  : ${track1Groups.size} (Pruned ${track1DupsPruned} duplicates)`);
  console.log(`11th & 12th Unique Student Photo Count : ${track2Groups.size} (Pruned ${track2DupsPruned} duplicates)`);
  console.log(`Total Final Deduplicated Photos        : ${selectedPhotos.length} (${(totalDedupedSize / (1024 * 1024)).toFixed(2)} MB)`);
  console.log(`Total Redundant Duplicate Photos Saved : ${photos.length - selectedPhotos.length}`);
  console.log('========================================================\n');

  // Sample deduplications:
  console.log('Sample Multi-Photo Resolution in 11th/12th:');
  let sampleCount = 0;
  for (const [k, list] of track2Groups.entries()) {
    if (list.length > 1 && sampleCount < 5) {
      const chosen = selectBest11th12th(list);
      console.log(`\nIdentifier: ${k}`);
      console.log('  Available candidates:');
      list.forEach(item => console.log(`    - [${item.cls.toUpperCase()}] (${item.session || 'No session'}) : ${item.fileName}`));
      console.log(`  👉 Selected Photo: ${chosen.fileName}`);
      sampleCount++;
    }
  }
}

run().catch(e => console.error(e));
