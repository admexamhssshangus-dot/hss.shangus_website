import fs from 'fs';
import path from 'path';

const PHOTOS_DIR = 'I:\\My Drive\\Projects\\admission form\\2026 onwards\\Student Photos\\optimized_photos';

const targetRegs = [
  { name: 'Uzma jan', reg: '2401015001220006', form: '250218' },
  { name: 'Sheeza shafi', reg: '2401010001010072', form: '250398' },
  { name: 'Hanan Bashir Mantoo', reg: '2401003000610024', form: '250407' },
  { name: 'Wanhar Ahmad Malik', reg: '2401000000610005', form: '250558' },
  { name: 'Malikatariq', reg: '2301010000900057', form: '250271' }
];

console.log('Checking directory:', PHOTOS_DIR);
if (!fs.existsSync(PHOTOS_DIR)) {
  console.log('Directory does not exist on this drive letter. Checking other possible drive letters or project folders...');
  ['C:', 'D:', 'E:', 'F:', 'G:', 'H:', 'I:'].forEach(drive => {
    const p = `${drive}\\My Drive\\Projects\\admission form\\2026 onwards\\Student Photos\\optimized_photos`;
    if (fs.existsSync(p)) console.log('Found on drive:', p);
  });
} else {
  const files = fs.readdirSync(PHOTOS_DIR);
  console.log(`Total files in PHOTOS_DIR: ${files.length}`);
  for (const t of targetRegs) {
    const matches = files.filter(f => f.includes(t.reg) || f.toLowerCase().includes(t.name.toLowerCase().split(' ')[0]) || f.includes(t.form));
    console.log(`\nMatches for ${t.name} (${t.reg}):`);
    matches.forEach(m => console.log('  ->', m));
  }
}
