import { publicFacultyDocumentId, toPublicFacultyList, toPublicFacultyMember } from './facultyPrivacy';

describe('faculty privacy projection', () => {
  test('keeps only the public directory allowlist', () => {
    const projected = toPublicFacultyMember({
      name: 'A Teacher',
      designation: 'Lecturer',
      subject: 'Physics',
      department: 'Science',
      photo: '/slides/teacher.jpg',
      mobile: '9999999999',
      email: 'private@example.com',
      PAN: 'ABCDE1234F',
      salary: 123,
    });

    expect(projected).toEqual({
      name: 'A Teacher',
      designation: 'Lecturer',
      subject: 'Physics',
      department: 'Science',
      photo: '/slides/teacher.jpg',
    });
  });

  test('rejects hidden members and unsafe photo URLs', () => {
    expect(toPublicFacultyMember({ name: 'Hidden', designation: 'Teacher', hidden: true })).toBeNull();
    expect(toPublicFacultyMember({
      name: 'Visible', designation: 'Teacher', photo: 'data:image/png;base64,secret',
    }).photo).toBe('');
  });

  test('limits lists and creates stable non-PII document IDs', () => {
    const list = Array.from({ length: 180 }, (_, index) => ({
      name: `Teacher ${index}`, designation: 'Teacher', department: 'School',
    }));
    expect(toPublicFacultyList(list)).toHaveLength(150);
    expect(publicFacultyDocumentId(list[0], 0)).toBe(publicFacultyDocumentId(list[0], 0));
    expect(publicFacultyDocumentId(list[0], 0)).not.toContain(' ');
  });
});
