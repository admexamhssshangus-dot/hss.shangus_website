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
 * Formats and normalizes a photo string (base64, Firebase Storage, HTTP)
 * Pure Firebase Architecture: Google Drive links are deprecated and filtered out.
 */
export const formatPhotoDisplayUrl = (val) => {
  if (!val || typeof val !== 'string') return '';
  const str = val.trim();
  if (!str || str === '—' || str === 'N/A' || str === 'null' || str === 'undefined' || str === '/logo.png') return '';

  // 1. Native Data URL
  if (str.startsWith('data:image/') || str.startsWith('data:application/octet-stream;base64')) {
    return str;
  }

  // 2. Disallow / Deprecate Google Drive links completely per user directive
  if (str.includes('drive.google.com') || str.includes('docs.google.com') || str.includes('googleusercontent.com')) {
    return '';
  }

  // 3. Standard Web URLs / Firebase Storage URLs
  if (str.startsWith('http://') || str.startsWith('https://') || str.startsWith('/')) {
    return str;
  }

  // 4. Raw Base64 string without data: prefix (handles newlines, PNG/WebP/JPEG headers)
  const cleanBase64 = str.replace(/\s+/g, '');
  if (cleanBase64.length > 40) {
    if (cleanBase64.startsWith('iVBORw0KGgo')) {
      return `data:image/png;base64,${cleanBase64}`;
    }
    if (cleanBase64.startsWith('UklGR')) {
      return `data:image/webp;base64,${cleanBase64}`;
    }
    return `data:image/jpeg;base64,${cleanBase64}`;
  }

  return '';
};

/**
 * Resolves student photo URL across all historical & standardized key aliases and localStorage cache.
 * Pure Firebase single source of truth: Prioritizes processed admin passport photos in studentPhotos.
 */
export const getStudentPhotoUrl = (st, fallback = '') => {
  if (!st) return fallback;

  // Direct string passed
  if (typeof st === 'string') {
    return formatPhotoDisplayUrl(st) || fallback;
  }

  // Helper to check if a value is a genuine photo (not placeholder or deprecated Google Drive link)
  const isValidPhotoStr = (v) => {
    if (!v || typeof v !== 'string') return false;
    const t = v.trim();
    if (t.includes('drive.google.com') || t.includes('docs.google.com') || t.includes('googleusercontent.com')) return false;
    return t.length > 20 && t !== '—' && t !== 'N/A' && t !== 'null' && t !== 'undefined' && t !== '/logo.png';
  };

  const cleanReg = (val) => {
    if (!val) return '';
    let s = String(val).trim();
    if (/^[+-]?\d+(\.\d+)?[eE][+-]?\d+$/.test(s) || typeof val === 'number') {
      try {
        const num = Number(s);
        if (!isNaN(num) && num > 0 && typeof window !== 'undefined' && typeof window.BigInt === 'function') {
          s = window.BigInt(Math.round(num)).toString();
        } else {
          const match = s.match(/^([+-]?\d+)(?:\.(\d+))?[eE]([+-]?\d+)$/);
          if (match) {
            let intPart = match[1];
            let decPart = match[2] || '';
            let exponent = parseInt(match[3], 10);
            if (exponent > 0) {
              s = decPart.length <= exponent ? intPart + decPart + '0'.repeat(exponent - decPart.length) : intPart + decPart.slice(0, exponent) + '.' + decPart.slice(exponent);
            }
          }
        }
      } catch (_) {}
    }
    return s.replace(/\.0+$/, '').replace(/[^a-zA-Z0-9]/g, '');
  };

  const explicitRegKeys = [
    "Board Registration No. (Class 10th)",
    "Board Registration No. (Class 11th)",
    "Board Registration No. (Class 12th)",
    "Registration No. (allotted by JKBOSE)",
    "Registration No. (allotted by JKBOSE )",
    "Registration No. (allotted by JKBOSE  )",
    "Board Registration Number",
    "Board Registration No.",
    "Board Registration No",
    "Board Reg. No.",
    "Board Reg No",
    "Registration Number",
    "Registration No.",
    "Registration No",
    "Reg. No.",
    "Reg. No",
    "Reg No.",
    "Reg No",
    "REG. NO.",
    "REG NO",
    "REG. NO",
    "DIET Registration No.",
    "DIET/Board Reg. No.",
    "DIET Reg. No.",
    "boardRegNo",
    "regNo",
    "registrationNo",
    "Reg_No",
    "registration_no"
  ];
  let rawBoardReg = '';
  for (const k of explicitRegKeys) {
    if (st[k] !== undefined && st[k] !== null) {
      const valStr = String(st[k]).trim();
      if (valStr && !/^(—|-|NA|N\/A|Nill|null|undefined|0)$/i.test(valStr)) {
        rawBoardReg = valStr;
        break;
      }
    }
  }
  if (!rawBoardReg) {
    for (const [k, v] of Object.entries(st)) {
      const lk = k.toLowerCase();
      if ((lk.includes('reg') || lk.includes('registration')) && !lk.includes('date') && !lk.includes('fee') && !lk.includes('status') && !lk.includes('type')) {
        const valStr = String(v || '').trim();
        if (valStr && !/^(—|-|NA|N\/A|Nill|null|undefined|0)$/i.test(valStr)) {
          rawBoardReg = valStr;
          break;
        }
      }
    }
  }

  const cleanedBoardReg = cleanReg(rawBoardReg);
  const fNo = String(st['Form Number'] || st['Form No.'] || st['FormNo'] || st.formNo || st.form_no || st['Application ID'] || st.appId || '').replace(/^'/, '').trim();
  const rawId = String(st.docId || st._docId || st.id || '').trim();

  // 1. PRIMARY PRIORITY: Central photo map keyed by Board Registration Number, Form No, or DocId
  if (typeof window !== 'undefined') {
    try {
      const memoryMap = window._hss_central_photo_map || {};
      const cache1 = JSON.parse(localStorage.getItem('hss_photo_url_cache_v1') || '{}');
      const cache2 = JSON.parse(localStorage.getItem('hss_student_photo_cache_v1') || '{}');
      const mergedMap = { ...cache2, ...cache1, ...memoryMap };

      if (cleanedBoardReg) {
        const rawClass = String(st.class || st.Class || st['Admission sought for class'] || '').toLowerCase();
        const targetClass = rawClass.includes('12') ? '12th' : rawClass.includes('11') ? '11th' : rawClass.includes('10') ? '10th' : (rawClass.includes('9') || rawClass.includes('ix')) ? '9th' : '';

        // Class-band precedence: 9th takes precedence in 9th/10th; 11th takes precedence in 11th/12th
        const p9 = mergedMap[`${cleanedBoardReg}_9th`] || mergedMap[`photo_${cleanedBoardReg}_9th`];
        const p10 = mergedMap[`${cleanedBoardReg}_10th`] || mergedMap[`photo_${cleanedBoardReg}_10th`];
        const p11 = mergedMap[`${cleanedBoardReg}_11th`] || mergedMap[`photo_${cleanedBoardReg}_11th`];
        const p12 = mergedMap[`${cleanedBoardReg}_12th`] || mergedMap[`photo_${cleanedBoardReg}_12th`];

        let classPhoto = '';
        if (targetClass === '9th' || targetClass === '10th') {
          classPhoto = p9 || p10 || p11 || p12 || '';
        } else if (targetClass === '11th' || targetClass === '12th') {
          classPhoto = p11 || p12 || p9 || p10 || '';
        } else {
          classPhoto = p11 || p12 || p9 || p10 || '';
        }

        if (isValidPhotoStr(classPhoto)) {
          const formatted = formatPhotoDisplayUrl(classPhoto);
          if (formatted) return formatted;
        }
      }

      const regCandidates = [
        cleanedBoardReg,
        cleanedBoardReg ? `photo_${cleanedBoardReg}` : null,
        cleanedBoardReg ? `reg_${cleanedBoardReg}` : null,
        cleanedBoardReg ? cleanedBoardReg.toLowerCase() : null,
        fNo ? `photo_form_${fNo}` : null,
        fNo ? `form_${fNo}` : null,
        fNo ? `photo_${fNo}` : null,
        fNo,
        rawId ? `photo_${rawId}` : null,
        rawId
      ].filter(Boolean);

      for (const rKey of regCandidates) {
        const p = mergedMap[rKey];
        if (isValidPhotoStr(p)) {
          const formatted = formatPhotoDisplayUrl(p);
          if (formatted) return formatted;
        }
      }
    } catch (_) {}
  }

  // 2. SECONDARY PRIORITY: Direct photo fields on current student record (Base64 only)
  const photoCandidates = [
    st.photo_id,
    st['photo_id'],
    st.photoId,
    st['photoId'],
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

  return fallback;
};

/**
 * Ensures student record payload stores Base64 string ONLY under 'photo_id'
 * to avoid duplicate Base64 document bloat and remove deprecated Drive links.
 */
export const cleanStudentPhotoPayload = (payload) => {
  if (!payload) return payload;
  const photo = getStudentPhotoUrl(payload);
  const cleaned = { ...payload };
  if (photo && !photo.includes('drive.google.com') && photo.length > 20) {
    cleaned.photo_id = photo;
  }

  ['photoId', 'Student Photo', 'Student Photograph', 'Student Photo URL', 'photoUrl', 'photo', 'Photo', 'studentPhoto', 'studentPhotoUrl', 'passport_photo'].forEach(key => {
    if (key !== 'photo_id') delete cleaned[key];
  });

  return cleaned;
};

export const resolveStudentPhoto = getStudentPhotoUrl;
