/**
 * In-browser canvas image compressor.
 * Downscales images to portrait student photo dimensions (max 300x360) and compresses to ~5-15 KB JPEG.
 */
export const compressImageFile = (file, maxWidth = 300, maxHeight = 360, quality = 0.8) => {
  return new Promise((resolve, reject) => {
    if (!file) return resolve(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        // Fill white background for transparent PNGs
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);

        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = (err) => reject(err);
      img.src = e.target.result;
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
};

export const compressStudentPhoto = compressImageFile;
export default compressImageFile;

/**
 * Parses multi-identifier photo filenames:
 * e.g. "11th_2023-24_1901003000900019_Basharat Shabir Wani.jpg"
 * or "250004_MEHRAN_RIYAZ_SHEIKH_10th.jpeg"
 */
export const parsePhotoFilename = (filename) => {
  const cleanName = filename.replace(/\.[^/.]+$/, '').trim();
  const parts = cleanName.split('_').map(p => p.trim()).filter(Boolean);

  let className = '';
  let session = '';
  let regNoOrFormNo = '';
  let studentName = '';

  const regNoMatch = cleanName.match(/\b\d{14,17}\b/);
  const formNoMatch = cleanName.match(/\b25\d{4}\b/);

  if (regNoMatch) {
    regNoOrFormNo = regNoMatch[0];
  } else if (formNoMatch) {
    regNoOrFormNo = formNoMatch[0];
  }

  const classMatch = cleanName.match(/\b(9th|10th|11th|12th)\b/i);
  if (classMatch) className = classMatch[0];

  const sessionMatch = cleanName.match(/\b20\d{2}-\d{2}\b/);
  if (sessionMatch) session = sessionMatch[0];

  const nameParts = parts.filter(p => 
    !/\b(9th|10th|11th|12th)\b/i.test(p) &&
    !/\b20\d{2}-\d{2}\b/.test(p) &&
    !/^\d+$/.test(p)
  );
  if (nameParts.length > 0) {
    studentName = nameParts.join(' ');
  }

  return {
    raw: filename,
    cleanName,
    className,
    session,
    regNoOrFormNo,
    studentName
  };
};
