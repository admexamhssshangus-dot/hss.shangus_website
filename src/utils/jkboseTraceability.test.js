import { getJkboseFieldStatus, JKBOSE_FIELD_MAPPING } from './jkboseTraceability';

describe('jkboseTraceability', () => {
  it('identifies updated fields from student.jkboseUpdatedFields', () => {
    const student = {
      id: 'st_1',
      studentName: 'MOHAMMAD TARIQ',
      dob: '2007-04-05',
      jkboseUpdatedFields: ['studentName', 'dob'],
      jkboseLastSyncedAt: '2026-09-13T16:00:00.000Z',
      jkboseSyncSource: '10th_Gazette.xlsx',
      jkboseFieldUpdates: {
        studentName: {
          label: "Student's Name",
          oldValue: 'MOHD TARIQ',
          newValue: 'MOHAMMAD TARIQ',
          source: '10th_Gazette.xlsx',
          updatedAt: '2026-09-13T16:00:00.000Z'
        }
      }
    };

    const nameStatus = getJkboseFieldStatus(student, 'studentName');
    expect(nameStatus).not.toBeNull();
    expect(nameStatus.isUpdated).toBe(true);
    expect(nameStatus.oldValue).toBe('MOHD TARIQ');
    expect(nameStatus.newValue).toBe('MOHAMMAD TARIQ');
    expect(nameStatus.source).toBe('10th_Gazette.xlsx');

    const dobStatus = getJkboseFieldStatus(student, 'dob');
    expect(dobStatus).not.toBeNull();
    expect(dobStatus.isUpdated).toBe(true);

    const rollStatus = getJkboseFieldStatus(student, 'classRollNo');
    expect(rollStatus).toBeNull();
  });

  it('handles composite parentage sub-field checks', () => {
    const student = {
      id: 'st_2',
      fatherName: 'GHULAM NABI',
      motherName: 'FATIMA BEGUM',
      jkboseUpdatedFields: ['fatherName'],
      jkboseSyncSource: '11th_Board.xlsx'
    };

    const fatherStatus = getJkboseFieldStatus(student, 'fatherName', 'fatherName');
    expect(fatherStatus).not.toBeNull();
    expect(fatherStatus.isUpdated).toBe(true);

    const motherStatus = getJkboseFieldStatus(student, 'fatherName', 'motherName');
    expect(motherStatus).toBeNull();
  });

  it('resolves updates from recent batchTraceabilityMap for past-hour retro-traceability', () => {
    const student = {
      id: 'st_3',
      formNo: '2025-11-0042',
      studentName: 'ZAHID AHMAD',
      lastBoardSyncAt: '2026-09-13T15:30:00.000Z'
    };

    const batchMap = {
      'st_3': {
        source: '11th_Gazette_Final.xlsx',
        timestamp: '2026-09-13T15:30:00.000Z',
        fields: new Set(['studentName', 'subjects']),
        details: {
          studentName: { oldValue: 'ZAHID', newValue: 'ZAHID AHMAD' }
        }
      }
    };

    const nameStatus = getJkboseFieldStatus(student, 'studentName', null, batchMap);
    expect(nameStatus).not.toBeNull();
    expect(nameStatus.isUpdated).toBe(true);
    expect(nameStatus.oldValue).toBe('ZAHID');
    expect(nameStatus.newValue).toBe('ZAHID AHMAD');
    expect(nameStatus.source).toBe('11th_Gazette_Final.xlsx');

    const subsStatus = getJkboseFieldStatus(student, 'subs', null, batchMap);
    expect(subsStatus).not.toBeNull();
    expect(subsStatus.isUpdated).toBe(true);

    const dobStatus = getJkboseFieldStatus(student, 'dob', null, batchMap);
    expect(dobStatus).toBeNull();
  });
});
