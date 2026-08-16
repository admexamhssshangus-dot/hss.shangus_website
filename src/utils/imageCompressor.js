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

        // Base64 adds about 33% overhead, so keep the encoded value small
        // enough for an efficient Firestore admission document.
        let outputQuality = Math.min(Math.max(quality, 0.4), 0.86);
        let dataUrl = canvas.toDataURL('image/jpeg', outputQuality);
        const maxEncodedLength = 100 * 1024; // approximately 75 KiB JPEG
        while (dataUrl.length > maxEncodedLength && outputQuality > 0.42) {
          outputQuality = Math.max(0.42, outputQuality - 0.1);
          dataUrl = canvas.toDataURL('image/jpeg', outputQuality);
        }
        if (dataUrl.length > maxEncodedLength) {
          reject(new Error('The photograph could not be compressed below the Firestore safety limit.'));
          return;
        }
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

/**
 * Formats and normalizes a photo string (base64, Google Drive, Firebase Storage, HTTP)
 */
export const formatPhotoDisplayUrl = (val) => {
  if (!val || typeof val !== 'string') return '';
  const str = val.trim();
  if (!str || str === '—' || str === 'N/A' || str === 'null' || str === 'undefined') return '';

  // 1. Native Firestore / Data URL Base64 image
  if (str.startsWith('data:image/') || str.startsWith('data:application/octet-stream;base64')) {
    return str;
  }
  // Raw Base64 string without data: prefix (e.g. /9j/4AAQSkZJRg... or long base64 string)
  if (str.startsWith('/9j/') || str.startsWith('iVBORw') || /^[A-Za-z0-9+/=]{100,}$/.test(str)) {
    return `data:image/jpeg;base64,${str}`;
  }

  // 2. Google Drive Links -> Convert to direct thumbnail URL
  if (str.includes('drive.google.com') || str.includes('docs.google.com')) {
    const fileIdMatch = str.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
                        str.match(/id=([a-zA-Z0-9_-]+)/) ||
                        str.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (fileIdMatch && fileIdMatch[1]) {
      return `https://drive.google.com/thumbnail?id=${fileIdMatch[1]}&sz=w300`;
    }
  }

  // 3. Firebase Storage, local paths, or standard web image URLs
  if (str.startsWith('http://') || str.startsWith('https://') || str.startsWith('/')) {
    return str;
  }

  return '';
};

/**
 * Resolves student photo URL across all historical & standardized key aliases and localStorage cache.
 */
export const getStudentPhotoUrl = (st, fallback = '') => {
  if (!st) return fallback;

  // Direct string passed
  if (typeof st === 'string') {
    return formatPhotoDisplayUrl(st) || fallback;
  }

  // Helper to check if a value is a genuine photo (not placeholder like '—' or 'N/A')
  const isValidPhotoStr = (v) => {
    if (!v || typeof v !== 'string') return false;
    const t = v.trim();
    return t.length > 20 && t !== '—' && t !== 'N/A' && t !== 'null' && t !== 'undefined' && t !== '/logo.png';
  };

  const cleanReg = (val) => {
    if (!val) return '';
    let s = String(val).trim();
    if (/^[+-]?\d+(\.\d+)?[eE][+-]?\d+$/.test(s) || typeof val === 'number') {
      try {
        if (typeof window !== 'undefined' && window.BigInt) {
          s = window.BigInt(Math.floor(Number(val))).toString();
        } else {
          s = Number(val).toLocaleString('fullwide', { useGrouping: false });
        }
      } catch (_) {}
    }
    return s.replace(/\.0+$/, '').replace(/[^a-zA-Z0-9]/g, '');
  };

  const rawBoardReg = 
    st.boardRegNo ||
    st.regNo ||
    st['Board Registration No. (Class 10th)'] ||
    st['Board Registration No. (Class 11th)'] ||
    st['Board Registration No.'] ||
    st['Board Registration Number'] ||
    st['Board Reg. No.'] ||
    st['Board Reg No'] ||
    st['REG. NO.'] ||
    st['Registration No.'] ||
    '';

  const cleanedBoardReg = cleanReg(rawBoardReg);

  // 1. PRIMARY PRIORITY: Central photo map keyed by Board Registration Number
  if (typeof window !== 'undefined' && cleanedBoardReg) {
    try {
      const memoryMap = window._hss_central_photo_map || {};
      const cache1 = JSON.parse(localStorage.getItem('hss_photo_url_cache_v1') || '{}');
      const cache2 = JSON.parse(localStorage.getItem('hss_student_photo_cache_v1') || '{}');
      const regCandidates = [
        cleanedBoardReg,
        `photo_${cleanedBoardReg}`,
        `reg_${cleanedBoardReg}`,
        cleanedBoardReg.toLowerCase()
      ];
      for (const rKey of regCandidates) {
        const p = memoryMap[rKey] || cache1[rKey] || cache2[rKey];
        if (isValidPhotoStr(p)) {
          const formatted = formatPhotoDisplayUrl(p);
          if (formatted) return formatted;
        }
      }
    } catch (_) {}
  }

  // 2. SECONDARY PRIORITY: Direct photo fields on current student record
  const photoCandidates = [
    st.photoId,
    st['photoId'],
    st.photo_id,
    st['photo_id'],
    st['Student Photo'],
    st['Student Photograph'],
    st['Student Photo URL'],
    st.photoUrl,
    st['photoUrl'],
    st.photo,
    st['photo'],
    st.Photo,
    st['Photo'],
    st.studentPhoto,
    st['studentPhoto'],
    st.studentPhotoUrl,
    st['studentPhotoUrl'],
    st.photoData,
    st['photoData'],
    st._resolvedPhoto
  ];

  for (const cand of photoCandidates) {
    if (isValidPhotoStr(cand)) {
      const formatted = formatPhotoDisplayUrl(cand);
      if (formatted) return formatted;
    }
  }

  // 3. TERTIARY PRIORITY: Other candidate IDs in cache (Form No, DocId, Name)
  if (typeof window !== 'undefined') {
    try {
      const memoryMap = window._hss_central_photo_map || {};
      const cache1 = JSON.parse(localStorage.getItem('hss_photo_url_cache_v1') || '{}');
      const cache2 = JSON.parse(localStorage.getItem('hss_student_photo_cache_v1') || '{}');
      const cache = { ...cache2, ...cache1, ...memoryMap };

      const candidateIds = [
        st.id,
        st.docId,
        st._docId,
        st['Form Number'],
        st['Form No.'],
        st['FormNo'],
        st.formNo,
        st.form_no,
        st['Class Roll No'],
        st['Class Roll No.'],
        st['Class R.No.'],
        st.classRollNo,
        st.rollNo
      ].filter(Boolean);

      const sName = String(st["Student's Name (as per school records)"] || st["Student's Name"] || st.studentName || st.name || '').trim().toLowerCase();
      if (sName && sName !== 'student' && sName !== '—') {
        candidateIds.push(sName);
        candidateIds.push(sName.replace(/[^a-z0-9]/g, ''));
      }

      for (const cId of candidateIds) {
        const cleanId = String(cId).trim();
        const cached = 
          cache[cleanId] || 
          cache[cleanId.toLowerCase()] || 
          cache[`photo_${cleanId}`] ||
          cache[`reg_${cleanId}`] ||
          cache[cleanId.replace(/[^0-9]/g, '')] || 
          cache[`photo_${cleanId.replace(/[^0-9]/g, '')}`] ||
          cache[cleanId.replace(/[^a-z0-9]/g, '')];

        if (isValidPhotoStr(cached)) {
          const cachedFormatted = formatPhotoDisplayUrl(cached);
          if (cachedFormatted) return cachedFormatted;
        }
      }
    } catch (_) {}
  }

  return fallback;
};

/**
 * Ensures student record payload stores Base64 string ONLY under 'photo_id'
 * to avoid duplicate Base64 document bloat in Firestore.
 */
export const cleanStudentPhotoPayload = (payload) => {
  if (!payload) return payload;
  const photo = getStudentPhotoUrl(payload);
  if (!photo) return payload;

  const cleaned = { ...payload, photo_id: photo };
  ['photoId', 'Student Photo', 'Student Photograph', 'Student Photo URL', 'photoUrl', 'photo', 'Photo', 'studentPhoto', 'studentPhotoUrl'].forEach(key => delete cleaned[key]);

  return cleaned;
};
