import { getStudentPhotoDownloadFilename, parsePhotoFilename } from './imageCompressor';

describe('imageCompressor utilities', () => {
  describe('getStudentPhotoDownloadFilename', () => {
    test('generates clean, structured filename with Class, Form No, Reg No, and Student Name', () => {
      const student = {
        studentName: 'Zakir Gulzar',
        formNo: '251316',
        boardRegNo: 'DIET012345',
        class: '9th'
      };
      const filename = getStudentPhotoDownloadFilename(student);
      expect(filename).toBe('9th_F251316_DIET012345_Zakir_Gulzar_photo.jpg');
    });

    test('strictly strips em dash (—) and placeholder hyphens so filename is never —_photo.jpg', () => {
      const student = {
        "Student's Name (as per school records)": 'Zakir Gulzar',
        'Form Number': '251316',
        boardRegNo: '—',
        classRollNo: '—',
        class: '9th'
      };
      const filename = getStudentPhotoDownloadFilename(student);
      expect(filename).toBe('9th_F251316_Zakir_Gulzar_photo.jpg');
      expect(filename).not.toContain('—');
      expect(filename).not.toBe('—_photo.jpg');
    });

    test('includes roll number if available', () => {
      const student = {
        name: 'Mehran Riyaz',
        formNo: '250004',
        rollNo: '101',
        class: '10th'
      };
      const filename = getStudentPhotoDownloadFilename(student);
      expect(filename).toBe('10th_F250004_R101_Mehran_Riyaz_photo.jpg');
    });

    test('sanitizes illegal filesystem characters and multiple spaces', () => {
      const student = {
        studentName: 'Syed Aadil / Mushtaq? <Test>',
        formNo: '250100',
        class: '11th'
      };
      const filename = getStudentPhotoDownloadFilename(student);
      expect(filename).toBe('11th_F250100_Syed_Aadil_Mushtaq_Test_photo.jpg');
      expect(filename).not.toMatch(/[\\/:*?"<>|]/);
    });

    test('falls back gracefully when student object is empty or null', () => {
      expect(getStudentPhotoDownloadFilename(null)).toBe('student_photo.jpg');
      expect(getStudentPhotoDownloadFilename({})).toBe('Student_photo.jpg');
    });
  });

  describe('parsePhotoFilename', () => {
    test('parses Class, Session, RegNo, and Name from formatted filename', () => {
      const res = parsePhotoFilename('11th_2023-24_1901003000900019_Basharat Shabir Wani.jpg');
      expect(res.className).toBe('11th');
      expect(res.session).toBe('2023-24');
      expect(res.regNoOrFormNo).toBe('1901003000900019');
      expect(res.studentName).toContain('Basharat');
    });
  });
});
