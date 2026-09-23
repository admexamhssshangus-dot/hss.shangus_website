/**
 * In-browser canvas image compressor.
 * Downscales images to portrait student photo dimensions (max 300x360) and compresses to ~5-15 KB JPEG.
 */
export const compressImageFile = (file, maxWidth = 300, maxHeight = 360, quality = 0.75) => {
  return new Promise((resolve, reject) => {
    if (!file) return resolve(null);
    let targetWidth = maxWidth;
    let targetHeight = maxHeight;
    let targetQuality = quality;

    if (typeof maxWidth === 'object' && maxWidth !== null) {
      targetWidth = maxWidth.maxWidth || 300;
      targetHeight = maxWidth.maxHeight || 360;
      targetQuality = maxWidth.quality !== undefined ? maxWidth.quality : 0.75;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > targetWidth) {
            height = Math.round((height * targetWidth) / width);
            width = targetWidth;
          }
        } else {
          if (height > targetHeight) {
            width = Math.round((width * targetHeight) / height);
            height = targetHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        // Fill white background for transparent PNGs
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);

        ctx.drawImage(img, 0, 0, width, height);

        // 75% quality gives optimal crispness (~12-18 KB JPEG) while minimizing Firestore document size
        let outputQuality = Math.min(Math.max(targetQuality, 0.35), 0.82);
        let dataUrl = canvas.toDataURL('image/jpeg', outputQuality);
        const maxEncodedLength = 80 * 1024; // approximately 60 KiB JPEG safety cap
        while (dataUrl.length > maxEncodedLength && outputQuality > 0.40) {
          outputQuality = Math.max(0.40, outputQuality - 0.08);
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
  const parts = cleanName.split(/[_-]/).map(p => p.trim()).filter(Boolean);

  let className = '';
  let session = '';
  let regNoOrFormNo = '';
  let admNo = '';
  let studentName = '';

  const regNoMatch = cleanName.match(/(?:^|[_\s-])(\d{14,17})(?:[_\s-]|$)/);
  const formNoMatch = cleanName.match(/(?:^|[_\s-])(2[0-9]\d{4})(?:[_\s-]|$)/);
  const admNoMatch = cleanName.match(/(?:^|[_\s-])(?:adm|admno)?[_-]?(\d{3,5})(?:[_\s-]|$)/i);

  if (regNoMatch) {
    regNoOrFormNo = regNoMatch[1];
  } else if (formNoMatch) {
    regNoOrFormNo = formNoMatch[1];
  }

  if (admNoMatch && admNoMatch[1]) {
    admNo = admNoMatch[1];
  }

  const classMatch = cleanName.match(/(?:^|[_\s-])(9th|10th|11th|12th)(?:[_\s-]|$)/i);
  if (classMatch) className = classMatch[1];

  const sessionMatch = cleanName.match(/(?:^|[_\s-])(20\d{2}-\d{2})(?:[_\s-]|$)/);
  if (sessionMatch) session = sessionMatch[1];

  const nameParts = parts.filter(p => 
    !/\b(9th|10th|11th|12th)\b/i.test(p) &&
    !/\b20\d{2}-\d{2}\b/.test(p) &&
    !/^\d+$/.test(p) &&
    !/\b(adm|admno|photo|student)\b/i.test(p)
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
    admNo,
    studentName
  };
};

/**
 * Formats and normalizes a photo string (Base64, Firebase Storage, direct Web URL)
 * Pure Firebase Architecture: Google Drive links are strictly rejected to ensure photos load from Firebase only.
 */
export const formatPhotoDisplayUrl = (val) => {
  if (!val || typeof val !== 'string') return '';
  const str = val.trim();
  if (
    !str ||
    str === '—' ||
    str === 'N/A' ||
    str === 'null' ||
    str === 'undefined' ||
    str === '/logo.png' ||
    str.includes('drive.google.com') ||
    str.includes('docs.google.com') ||
    str.includes('googleusercontent.com') ||
    /^[A-Za-z0-9_-]{25,45}$/.test(str)
  ) {
    return '';
  }

  // 1. Native Data URL (Base64)
  if (str.startsWith('data:image/') || str.startsWith('data:application/octet-stream;base64')) {
    return str;
  }

  // 2. Standard Web URLs / Firebase Storage URLs (excluding Google Drive)
  if (str.startsWith('http://') || str.startsWith('https://') || str.startsWith('/')) {
    return str;
  }

  // 3. Raw Base64 string without data: prefix (handles newlines, PNG/WebP/JPEG headers)
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

  // Helper to check if a value is a genuine photo (not placeholder or Drive link)
  const isValidPhotoStr = (v) => {
    if (!v || typeof v !== 'string') return false;
    const t = v.trim();
    return (
      t.length > 20 &&
      t !== '—' &&
      t !== 'N/A' &&
      t !== 'null' &&
      t !== 'undefined' &&
      t !== '/logo.png' &&
      !t.includes('drive.google.com') &&
      !t.includes('docs.google.com') &&
      !t.includes('googleusercontent.com') &&
      !/^[A-Za-z0-9_-]{25,45}$/.test(t)
    );
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

  const isValidIdKey = (val) => {
    if (!val) return false;
    const s = String(val).trim();
    if (s.length < 3) return false;
    if (/^(—|-|#?N\/A|NA|Nill|Nil|null|undefined|none|0|nan|st|student)$/i.test(s)) return false;
    if (/^(hist_|chunk_|rec_)/i.test(s)) return false;
    return true;
  };

  const cleanedBoardReg = cleanReg(rawBoardReg);
  const rawFormNo = String(st['Form Number'] || st['Form No.'] || st['FormNo'] || st.formNo || st.form_no || st['Application ID'] || st.appId || '').replace(/^'/, '').trim();
  const fNo = isValidIdKey(rawFormNo) ? rawFormNo : '';
  const candidateDocId = String(st.docId || st._docId || st.id || '').trim();
  const rawId = isValidIdKey(candidateDocId) ? candidateDocId : '';

  // 1. PRIMARY PRIORITY: Central photo map keyed by Board Registration Number, Form No, or DocId
  if (typeof window !== 'undefined') {
    try {
      const memoryMap = window._hss_central_photo_map || {};
      const cache1 = JSON.parse(localStorage.getItem('hss_photo_url_cache_v1') || '{}');
      const cache2 = JSON.parse(localStorage.getItem('hss_student_photo_cache_v1') || '{}');
      const mergedMap = { ...cache2, ...cache1, ...memoryMap };

      if (cleanedBoardReg && isValidIdKey(cleanedBoardReg)) {
        const rawClass = String(st.class || st.Class || st['Admission sought for class'] || '').toLowerCase();
        const targetClass = rawClass.includes('12') ? '12th' : rawClass.includes('11') ? '11th' : rawClass.includes('10') ? '10th' : (rawClass.includes('9') || rawClass.includes('ix')) ? '9th' : '';

        // Class-band precedence: 9th takes precedence in 9th/10th; 11th takes precedence in 11th/12th
        const p9 = mergedMap[`${cleanedBoardReg}_9th`] || mergedMap[`photo_${cleanedBoardReg}_9th`];
        const p10 = mergedMap[`${cleanedBoardReg}_10th`] || mergedMap[`photo_${cleanedBoardReg}_10th`];
        const p11 = mergedMap[`${cleanedBoardReg}_11th`] || mergedMap[`photo_${cleanedBoardReg}_11th`];
        const p12 = mergedMap[`${cleanedBoardReg}_12th`] || mergedMap[`photo_${cleanedBoardReg}_12th`];

        let classPhoto = '';
        if (targetClass === '9th' || targetClass === '10th') {
          classPhoto = p9 || p10 || '';
        } else if (targetClass === '11th' || targetClass === '12th') {
          classPhoto = p11 || p12 || '';
        } else {
          classPhoto = '';
        }

        if (isValidPhotoStr(classPhoto)) {
          const formatted = formatPhotoDisplayUrl(classPhoto);
          if (formatted) return formatted;
        }

        const regCandidates = [
          cleanedBoardReg,
          `photo_${cleanedBoardReg}`,
          `reg_${cleanedBoardReg}`,
          cleanedBoardReg.toLowerCase()
        ];
        for (const rKey of regCandidates) {
          if (!isValidIdKey(rKey)) continue;
          const p = mergedMap[rKey];
          if (isValidPhotoStr(p)) {
            const formatted = formatPhotoDisplayUrl(p);
            if (formatted) return formatted;
          }
        }
      } else {
        // Fallback to Form No or DocId ONLY when no registration number exists on the record
        const altCandidates = [
          ...(fNo ? [`photo_form_${fNo}`, `form_${fNo}`, `photo_${fNo}`, fNo] : []),
          ...(rawId ? [`photo_${rawId}`, rawId] : [])
        ];

        for (const aKey of altCandidates) {
          if (!isValidIdKey(aKey)) continue;
          const p = mergedMap[aKey];
          if (isValidPhotoStr(p)) {
            const formatted = formatPhotoDisplayUrl(p);
            if (formatted) return formatted;
          }
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

/**
 * Formats a clean, professional, descriptive filename for downloading a student photo.
 * e.g. "9th_F251316_DIET012345_Zakir_Gulzar_photo.jpg" or "10th_F251020_Aadil_Ahmad_photo.jpg"
 * Eliminates empty dashes '—', illegal filesystem characters, and undefined tokens.
 */
export const getStudentPhotoDownloadFilename = (student, ext = 'jpg') => {
  if (!student) return `student_photo.${ext.replace(/^\./, '')}`;

  const clean = (val) => {
    if (!val) return '';
    const str = String(val).trim();
    if (['—', '-', '--', 'n/a', 'na', 'null', 'undefined', 'none', '.'].includes(str.toLowerCase())) return '';
    return str
      .replace(/[\\/:*?"<>|\r\n\t]+/g, '_')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '')
      .trim();
  };

  const name = clean(
    student.studentName ||
    student["Student's Name (as per school records)"] ||
    student["Student's Name"] ||
    student.name
  ) || 'Student';

  const formNo = clean(
    student.formNo ||
    student['Form Number'] ||
    student['Form No.'] ||
    student['FormNo'] ||
    student.form_no
  );

  const regNo = clean(
    student.boardRegNo ||
    student.regNo ||
    student['Registration No.'] ||
    student['Registration No'] ||
    student['Board Registration No. (Class 9th)'] ||
    student['Board Registration No. (Class 10th)'] ||
    student['Board Registration No. (Class 11th)'] ||
    student['Board Registration No. (Class 12th)'] ||
    student['Board Registration Number'] ||
    student.reg_no
  );

  const cls = clean(
    student.class ||
    student.Class ||
    student['Admission sought for class']
  );

  const roll = clean(
    student.classRollNo ||
    student.rollNo ||
    student['Class Roll No'] ||
    student['Roll No.'] ||
    student['Roll No']
  );

  const parts = [];
  if (cls) parts.push(cls);
  if (formNo) parts.push(`F${formNo}`);
  if (regNo && regNo !== formNo) parts.push(regNo);
  if (roll) parts.push(`R${roll}`);
  parts.push(name);

  const cleanExt = ext.replace(/^\./, '');
  return `${parts.join('_')}_photo.${cleanExt}`;
};

/**
 * Downloads a photo with a guaranteed custom filename, supporting both Base64 Data URLs and remote URLs.
 */
export const downloadPhotoFile = (url, filename = 'student_photo.jpg') => {
  if (!url || typeof window === 'undefined') return;

  if (url.startsWith('data:image/')) {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return;
  }

  // Remote URL: fetch as blob to guarantee the browser enforces the custom filename
  fetch(url, { mode: 'cors' })
    .then(res => res.blob())
    .then(blob => {
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
    })
    .catch(() => {
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
};
