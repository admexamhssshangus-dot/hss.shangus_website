import fs from 'fs';
import path from 'path';

const PHOTOS_DIR = 'I:\\My Drive\\Projects\\admission form\\2026 onwards\\Student Photos\\optimized_photos';

const filesToCheck = [
  '11th_2024-25 (Oct-Nov)_2301010000900057_Malika Tariq.jpg',
  '12th_2025-26_2301010000790021_Malikatariq.jpg',
  '11th_2025-26_2401000000610032_Wanhar Ahmad Malik.jpg',
  '11th_2025-26_2401010001220012_Uzma Jan.jpg',
  '11th_2025-26_2401013000470021_Uzma Jan.jpg',
  '11th_2025-26_2401010000101007_Sheeza Shafi.jpg',
  '11th_2025-26_6775676685438986_Hanan Bashir Mantoo.jpg'
];

for (const f of filesToCheck) {
  const p = path.join(PHOTOS_DIR, f);
  if (fs.existsSync(p)) {
    const stat = fs.statSync(p);
    console.log(`File: ${f} | Size: ${stat.size} bytes`);
  } else {
    console.log(`❌ Missing: ${f}`);
  }
}
