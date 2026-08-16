/**
 * HSS SHANGUS — Student Photo Migration & Seeding Utility
 * Matches optimized photo files against Cloud Firestore student records using multi-identifiers:
 * 1. Board Registration No. (e.g., 237080123456)
 * 2. Form Number / Roll No. (e.g., 202611001)
 * 3. Student's Name & Father's Name match
 */

import { db } from '../services/firebase';
import { collection, getDocs, doc, setDoc, deleteField } from 'firebase/firestore';
import { parsePhotoFilename, compressStudentPhoto } from './imageCompressor';

/**
 * Sync a batch of image files to Firestore student records.
 *
 * @param {Array<File>} files - List of File objects from input or directory drop
 * @param {Function} onProgress - Progress callback (current, total, currentFileName, statusMsg)
 * @returns {Promise<{ matched: number, updated: number, errors: Array }>}
 */
export async function seedPhotosToFirestore(files, onProgress = null) {
  if (!files || files.length === 0) {
    return { matched: 0, updated: 0, errors: ['No photo files provided'] };
  }

  // 1. Fetch all admissions records from Firestore
  let studentDocs = [];
  try {
    const snap = await getDocs(collection(db, 'admissions'));
    studentDocs = snap.docs.map(d => ({ docId: d.id, ...d.data() }));
  } catch (err) {
    console.error('Error fetching Firestore admissions for photo sync:', err);
    return { matched: 0, updated: 0, errors: [err.message] };
  }

  let matchedCount = 0;
  let updatedCount = 0;
  const errors = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const parsed = parsePhotoFilename(file.name);

    if (onProgress) {
      onProgress(i + 1, files.length, file.name, `Matching student record for ${file.name}...`);
    }

    // Try finding matching student in Firestore
    const studentMatch = studentDocs.find(s => {
      const regNo = String(s['Board Registration No. (Class 10th)'] || s['Board Reg. No.'] || s['Board Registration No.'] || s.regNo || '').trim().toLowerCase();
      const formNo = String(s['Form Number'] || s['Form No.'] || s.formNo || '').trim().toLowerCase();
      const rollNo = String(s['Class Roll No'] || s['Class R.No.'] || s.rollNo || '').trim().toLowerCase();
      const sName = String(s["Student's Name (as per school records)"] || s["Student's Name"] || s.name || '').trim().toLowerCase();

      // Check Reg No match
      if (parsed.boardRegNo && regNo && regNo === parsed.boardRegNo.toLowerCase()) return true;

      // Check Form No match
      if (parsed.formNo && formNo && formNo === parsed.formNo.toLowerCase()) return true;

      // Check Roll No match
      if (parsed.formNo && rollNo && rollNo === parsed.formNo.toLowerCase()) return true;

      // Check Student Name match
      if (parsed.studentName && sName && sName === parsed.studentName.toLowerCase()) return true;

      return false;
    });

    if (studentMatch) {
      matchedCount++;
      try {
        // Compress photo to ~5-10 KB JPEG
        const dataUrl = await compressStudentPhoto(file, 300, 360, 0.8);

        // Update Firestore student record
        await setDoc(doc(db, 'admissions', studentMatch.docId), {
          photo_id: dataUrl,
          'Student Photo': deleteField(),
          photoUrl: deleteField(),
          photoId: deleteField(),
          photo: deleteField(),
          'photo_synced_at': new Date().toISOString()
        }, { merge: true });

        updatedCount++;
      } catch (e) {
        console.error(`Failed to update photo for ${file.name}:`, e);
        errors.push(`Failed for ${file.name}: ${e.message}`);
      }
    } else {
      errors.push(`No student record match found for filename "${file.name}"`);
    }
  }

  return { matched: matchedCount, updated: updatedCount, errors };
}
