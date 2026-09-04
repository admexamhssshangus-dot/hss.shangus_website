import { publicFacultyDocumentId, toPublicFacultyList, toPublicFacultyMember } from './facultyPrivacy';

describe('faculty privacy projection', () => {
  test('keeps only the public directory allowlist and strips private data', () => {
    const projected = toPublicFacultyMember({
      name: 'A Teacher',
      designation: 'Lecturer',
      subject: 'Physics',
      department: 'Science',
      photo: '/slides/teacher.jpg',
      mobile: '9999999999',
      email: 'teacher@example.com',
      PAN: 'ABCDE1234F',
      salary: 123,
    });

    expect(projected).toEqual({
      name: 'A Teacher',
      designation: 'Lecturer',
      subject: 'Physics',
      department: 'Science',
      photo: '/slides/teacher.jpg',
      email: 'teacher@example.com',
      mobile: '9999999999',
      profile: '',
      if_deployed: '',
      order: 0,
    });
  });

  test('rejects hidden members and unsafe photo URLs while allowing valid image data URLs', () => {
    expect(toPublicFacultyMember({ name: 'Hidden', designation: 'Teacher', hidden: true })).toBeNull();
    // Rejects javascript schemes
    expect(toPublicFacultyMember({
      name: 'Visible', designation: 'Teacher', photo: 'javascript:alert(1)',
    }).photo).toBe('');
    // Rejects non-image data URLs
    expect(toPublicFacultyMember({
      name: 'Visible', designation: 'Teacher', photo: 'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
    }).photo).toBe('');
    // Allows valid base64 image data URLs
    const sampleDataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBD';
    expect(toPublicFacultyMember({
      name: 'Visible', designation: 'Teacher', photo: sampleDataUrl,
    }).photo).toBe(sampleDataUrl);
  });

  test('limits lists and creates stable non-PII document IDs', () => {
    const list = Array.from({ length: 180 }, (_, index) => ({
      name: `Teacher ${index}`, designation: 'Teacher', department: 'School', order: index,
    }));
    expect(toPublicFacultyList(list)).toHaveLength(150);
    expect(publicFacultyDocumentId(list[0], 0)).toBe(publicFacultyDocumentId(list[0], 0));
    expect(publicFacultyDocumentId(list[0], 0)).not.toContain(' ');
  });
});

