import {
  cleanContactNumber,
  extractStudentContact,
  extractParentContact,
  renderContactCell
} from './practicalsPdfGenerator';

describe('Practicals Defaulters & Absent Student Contact Resolution', () => {
  describe('cleanContactNumber', () => {
    test('cleans valid mobile numbers with spaces or hyphens', () => {
      expect(cleanContactNumber('9419123456')).toBe('9419123456');
      expect(cleanContactNumber('+91 94191 23456')).toBe('+919419123456');
      expect(cleanContactNumber('7006-123-456')).toBe('7006123456');
    });

    test('filters out placeholders and invalid values', () => {
      expect(cleanContactNumber('')).toBe('');
      expect(cleanContactNumber('—')).toBe('');
      expect(cleanContactNumber('N/A')).toBe('');
      expect(cleanContactNumber('null')).toBe('');
      expect(cleanContactNumber('undefined')).toBe('');
      expect(cleanContactNumber('-')).toBe('');
      expect(cleanContactNumber('123')).toBe(''); // less than 7 digits
    });
  });

  describe('extractStudentContact', () => {
    test('extracts from official admission keys', () => {
      const st = { 'Mobile No. (with working WhatsApp)': '9419111222' };
      expect(extractStudentContact(st)).toBe('9419111222');
    });

    test('extracts from student record keys', () => {
      const st = { mobile: '7006222333' };
      expect(extractStudentContact(st)).toBe('7006222333');
    });

    test('prefers practical mark rec if present', () => {
      const st = { mobile: '7006111111' };
      const rec = { studentMobile: '7006222222' };
      expect(extractStudentContact(st, rec)).toBe('7006222222');
    });

    test('returns — when no valid contact exists', () => {
      const st = { name: 'Test Student' };
      expect(extractStudentContact(st)).toBe('—');
    });
  });

  describe('extractParentContact', () => {
    test('extracts from official admission keys', () => {
      const st = { "Parent's Mobile No. (must be working)": '9906333444' };
      expect(extractParentContact(st)).toBe('9906333444');
    });

    test('extracts from parentContact or parentMobile', () => {
      const st = { parentContact: '9906555666' };
      expect(extractParentContact(st)).toBe('9906555666');
    });

    test('returns — when no valid parent contact exists', () => {
      const st = { name: 'Test Student' };
      expect(extractParentContact(st)).toBe('—');
    });
  });

  describe('renderContactCell', () => {
    test('renders distinct student and parent contacts with S: and P: labels', () => {
      const html = renderContactCell('9419111111', '7006222222');
      expect(html).toContain('S:');
      expect(html).toContain('9419111111');
      expect(html).toContain('P:');
      expect(html).toContain('7006222222');
    });

    test('renders single combined number when student and parent numbers are identical', () => {
      const html = renderContactCell('9419111111', '9419111111');
      expect(html).toContain('9419111111');
      expect(html).toContain('(Student / Parent)');
    });

    test('renders student contact with P: — when only student contact is available', () => {
      const html = renderContactCell('9419111111', '—');
      expect(html).toContain('S:');
      expect(html).toContain('9419111111');
      expect(html).toContain('P: —');
    });

    test('renders parent contact with S: — when only parent contact is available', () => {
      const html = renderContactCell('—', '7006222222');
      expect(html).toContain('S: —');
      expect(html).toContain('P:');
      expect(html).toContain('7006222222');
    });

    test('renders em-dash when neither contact is available', () => {
      const html = renderContactCell('—', '—');
      expect(html).toContain('—');
      expect(html).not.toContain('S:');
      expect(html).not.toContain('P:');
    });
  });
});
