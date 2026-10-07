// =================================================================
// HSS SHANGUS — Official JKBOSE Board Examination Results
// =================================================================
// Authoritative institutional board results across sessions for:
// - Class 10th (Matriculation)
// - Class 11th (Higher Secondary Part-I)
// - Class 12th (Higher Secondary Part-II)
// Standardized session naming convention:
// 1. Regular 2024-25 (Oct-Nov)
// 2. Regular 2024-25 (Mar-Apr)
// 3. Regular 2023-24
// =================================================================

export const CLASS_10_BOARD_RESULTS = [
  {
    id: '10th-regular-2024-25-oct-nov',
    class: '10th',
    title: '10th Result Regular 2024-25 (Oct-Nov)',
    session: '2024-25',
    examPeriod: 'Regular 2024-25 (Oct-Nov)',
    category: 'Regular',
    schoolName: 'Govt. Higher Secondary School Shangus',
    indicators: [
      { label: 'total appeared', count: '35' },
      { label: 'total failed/reappear', count: '7' },
      { label: 'total passed', count: '28' },
      { label: 'total Distinc', count: '13' },
      { label: 'total 1st Div', count: '9' },
      { label: 'total 2nd Div', count: '6' },
      { label: 'total 3rd Div', count: '0' },
      { label: 'Result (Overall)', count: '80.00%', highlight: true }
    ],
    summaryStats: {
      appeared: 35,
      totalEnrolled: 35,
      passed: 28,
      failed: 7,
      distinction: 13,
      firstDiv: 9,
      secondDiv: 6,
      thirdDiv: 0,
      overallPercent: '80.00%'
    },
    toppers: [
      { rollNo: '101060016', name: 'Fayiz Bilal', result: 'Distinc', marksObt: 485, grade: 'A1', percentage: '97.0%', maxMarks: 500 },
      { rollNo: '101060029', name: 'Naveed Ul Haq', result: 'Distinc', marksObt: 484, grade: 'A1', percentage: '96.8%', maxMarks: 500 },
      { rollNo: '101060007', name: 'Sabzar Bashir Kumar', result: 'Distinc', marksObt: 483, grade: 'A1', percentage: '96.6%', maxMarks: 500 },
      { rollNo: '101060017', name: 'Owais Ashraf Mantoo', result: 'Distinc', marksObt: 475, grade: 'A1', percentage: '95.0%', maxMarks: 500 },
      { rollNo: '101060004', name: 'Sahil Yousuf', result: 'Distinc', marksObt: 453, grade: 'A1', percentage: '90.6%', maxMarks: 500 },
      { rollNo: '101060008', name: 'Ahzan Muzaffar Beig', result: 'Distinc', marksObt: 452, grade: 'A1', percentage: '90.4%', maxMarks: 500 },
      { rollNo: '101060031', name: 'Murtaza Rasool Kanth', result: 'Distinc', marksObt: 448, grade: 'A2', percentage: '89.6%', maxMarks: 500 },
      { rollNo: '101060001', name: 'Rahil Ahmad Rather', result: 'Distinc', marksObt: 444, grade: 'A2', percentage: '88.8%', maxMarks: 500 },
      { rollNo: '101060000', name: 'Mohammad Daniyal Sheikh', result: 'Distinc', marksObt: 440, grade: 'A2', percentage: '88.0%', maxMarks: 500 },
      { rollNo: '101060006', name: 'Hamid Amin', result: 'Distinc', marksObt: 410, grade: 'A2', percentage: '82.0%', maxMarks: 500 },
      { rollNo: '101060005', name: 'Tawqeer Bashir Bond', result: 'Distinc', marksObt: 397, grade: 'B1', percentage: '79.4%', maxMarks: 500 },
      { rollNo: '101060023', name: 'Waseem Ahmad Khan', result: 'Distinc', marksObt: 391, grade: 'B1', percentage: '78.2%', maxMarks: 500 },
      { rollNo: '101060020', name: 'Sheezan Sultan Wani', result: 'Distinc', marksObt: 377, grade: 'B1', percentage: '75.4%', maxMarks: 500 }
    ],
    // Complete 35-candidate roster
    allCandidates: [
      { rollNo: '101060000', name: 'MOHAMMAD DANIYAL SHEIKH', status: 'Qualified (A2)', marks: 440, division: 'Distinction', percentage: '88.0%' },
      { rollNo: '101060001', name: 'RAHIL AHMAD RATHER', status: 'Qualified (A2)', marks: 444, division: 'Distinction', percentage: '88.8%' },
      { rollNo: '101060002', name: 'YASIR RASHEED GANIE', status: 'Qualified (C1)', marks: 276, division: '2nd Division', percentage: '55.2%' },
      { rollNo: '101060003', name: 'MOZIM AHMAD ALLIE', status: 'Qualified (B1)', marks: 365, division: '1st Division', percentage: '73.0%' },
      { rollNo: '101060004', name: 'SAHIL YOUSUF', status: 'Qualified (A1)', marks: 453, division: 'Distinction', percentage: '90.6%' },
      { rollNo: '101060005', name: 'TAWQEER BASHIR BOND', status: 'Qualified (B1)', marks: 397, division: 'Distinction', percentage: '79.4%' },
      { rollNo: '101060006', name: 'HAMID AMIN', status: 'Qualified (A2)', marks: 410, division: 'Distinction', percentage: '82.0%' },
      { rollNo: '101060007', name: 'SABZAR BASHIR KUMAR', status: 'Qualified (A1)', marks: 483, division: 'Distinction', percentage: '96.6%' },
      { rollNo: '101060008', name: 'AHZAN MUZAFFAR BEIG', status: 'Qualified (A1)', marks: 452, division: 'Distinction', percentage: '90.4%' },
      { rollNo: '101060009', name: 'SAHIL AHMAD DARZI', status: 'Qualified (C1)', marks: 257, division: '2nd Division', percentage: '51.4%' },
      { rollNo: '101060010', name: 'FAZIL AARIF', status: 'Qualified (B2)', marks: 306, division: '1st Division', percentage: '61.2%' },
      { rollNo: '101060011', name: 'ADNAN AHMAD BHAT', status: 'Qualified (B2)', marks: 301, division: '1st Division', percentage: '60.2%' },
      { rollNo: '101060012', name: 'NASIR AHMAD MIR', status: 'Qualified (B2)', marks: 334, division: '1st Division', percentage: '66.8%' },
      { rollNo: '101060013', name: 'AATIF AMIN MIR', status: 'Qualified (B2)', marks: 314, division: '1st Division', percentage: '62.8%' },
      { rollNo: '101060014', name: 'MUNEEB HASSAN', status: 'Qualified (C1)', marks: 288, division: '2nd Division', percentage: '57.6%' },
      { rollNo: '101060015', name: 'IRFAN IBRAHIM KHAN', status: 'Not Qualified', marks: null, reappearSubjects: 'MA UR SC', division: 'Reappear' },
      { rollNo: '101060016', name: 'FAYIZ BILAL', status: 'Qualified (A1)', marks: 485, division: 'Distinction', percentage: '97.0%' },
      { rollNo: '101060017', name: 'OWAIS ASHRAF MANTOO', status: 'Qualified (A1)', marks: 475, division: 'Distinction', percentage: '95.0%' },
      { rollNo: '101060018', name: 'HINAN AHMAD SHAH', status: 'Not Qualified', marks: null, reappearSubjects: 'EN MA UR SC SS', division: 'Reappear' },
      { rollNo: '101060019', name: 'SUJAN AHMAD BHAT', status: 'Not Qualified', marks: null, reappearSubjects: 'MA SC', division: 'Reappear' },
      { rollNo: '101060020', name: 'SHEEZAN SULTAN WANI', status: 'Qualified (B1)', marks: 377, division: 'Distinction', percentage: '75.4%' },
      { rollNo: '101060021', name: 'HANAN BASHIR MANTOO', status: 'Qualified (B2)', marks: 336, division: '1st Division', percentage: '67.2%' },
      { rollNo: '101060022', name: 'FAISAL GULZAR', status: 'Qualified (B2)', marks: 324, division: '1st Division', percentage: '64.8%' },
      { rollNo: '101060023', name: 'WASEEM AHMAD KHAN', status: 'Qualified (B1)', marks: 391, division: 'Distinction', percentage: '78.2%' },
      { rollNo: '101060024', name: 'ISHTIYAK AHMAD BHAT', status: 'Not Qualified', marks: null, reappearSubjects: 'EN MA UR SC SS', division: 'Reappear' },
      { rollNo: '101060025', name: 'HASHIM KHURSHID', status: 'Qualified (B2)', marks: 337, division: '1st Division', percentage: '67.4%' },
      { rollNo: '101060026', name: 'WANHAR AHMAD MALIK', status: 'Qualified (C1)', marks: 265, division: '2nd Division', percentage: '53.0%' },
      { rollNo: '101060027', name: 'MOHAMMAD ASLAM KHAN', status: 'Qualified (B2)', marks: 308, division: '1st Division', percentage: '61.6%' },
      { rollNo: '101060028', name: 'RIZWAN AHMAD SHEIKH', status: 'Qualified (C1)', marks: 269, division: '2nd Division', percentage: '53.8%' },
      { rollNo: '101060029', name: 'NAVEED UL HAQ', status: 'Qualified (A1)', marks: 484, division: 'Distinction', percentage: '96.8%' },
      { rollNo: '101060030', name: 'ARSHEED FAROOQ GOJAR', status: 'Not Qualified', marks: null, reappearSubjects: 'EN MA SC', division: 'Reappear' },
      { rollNo: '101060031', name: 'MURTAZA RASOOL KANTH', status: 'Qualified (A2)', marks: 448, division: 'Distinction', percentage: '89.6%' },
      { rollNo: '101060032', name: 'UBAID AHMAD BRARHAJI', status: 'Not Qualified', marks: null, reappearSubjects: 'UR SC', division: 'Reappear' },
      { rollNo: '101060033', name: 'SAHIR NAZIR BAND', status: 'Not Qualified', marks: null, reappearSubjects: 'EN MA SC', division: 'Reappear' },
      { rollNo: '101060034', name: 'SAMEER AHMAD GANIE', status: 'Qualified (C1)', marks: 260, division: '2nd Division', percentage: '52.0%' }
    ]
  },
  {
    id: '10th-regular-2024-25-mar-apr',
    class: '10th',
    title: '10th Result Regular 2024-25 (Mar-Apr)',
    session: '2024-25',
    examPeriod: 'Regular 2024-25 (Mar-Apr)',
    category: 'Regular',
    schoolName: 'Govt. Higher Secondary School Shangus',
    indicators: [
      { label: 'total appeared', count: '17' },
      { label: 'total failed/reappear', count: '4' },
      { label: 'total passed', count: '13' },
      { label: 'total Distinc (≥ 75% / 375+ marks)', count: '4' },
      { label: 'total 1st Div (60% to 74.9% / 300–374 marks)', count: '3' },
      { label: 'total 2nd Div (45% to 59.9% / 225–299 marks)', count: '6' },
      { label: 'total 3rd Div (33% to 44.9% / 165–224 marks)', count: '0' },
      { label: 'Result (Overall)', count: '76.47%', highlight: true }
    ],
    summaryStats: {
      appeared: 17,
      totalEnrolled: 17,
      passed: 13,
      failed: 4,
      distinction: 4,
      firstDiv: 3,
      secondDiv: 6,
      thirdDiv: 0,
      overallPercent: '76.47%'
    },
    toppers: [
      { rollNo: '101059014', name: 'Ahytisham Ishaq Ganie', result: 'Distinc', marksObt: 429, grade: 'A2', percentage: '85.8%', maxMarks: 500 },
      { rollNo: '101059016', name: 'Muneeb Tariq Allie', result: 'Distinc', marksObt: 413, grade: 'A2', percentage: '82.6%', maxMarks: 500 },
      { rollNo: '101059002', name: 'Hamid Manzoor Bhat', result: 'Distinc', marksObt: 406, grade: 'A2', percentage: '81.2%', maxMarks: 500 },
      { rollNo: '101059004', name: 'Muzamil Imtiyaz Bond', result: 'Distinc', marksObt: 403, grade: 'A2', percentage: '80.6%', maxMarks: 500 }
    ],
    allCandidates: [
      { rollNo: '101059014', name: 'Ahytisham Ishaq Ganie', status: 'Qualified (A2)', marks: 429, division: 'Distinction', percentage: '85.8%' },
      { rollNo: '101059016', name: 'Muneeb Tariq Allie', status: 'Qualified (A2)', marks: 413, division: 'Distinction', percentage: '82.6%' },
      { rollNo: '101059002', name: 'Hamid Manzoor Bhat', status: 'Qualified (A2)', marks: 406, division: 'Distinction', percentage: '81.2%' },
      { rollNo: '101059004', name: 'Muzamil Imtiyaz Bond', status: 'Qualified (A2)', marks: 403, division: 'Distinction', percentage: '80.6%' },
      { rollNo: '101059011', name: 'Candidate 101059011', status: 'Qualified', marks: 267, division: '2nd Division', percentage: '53.4%' }
    ]
  },
  {
    id: '10th-regular-2023-24',
    class: '10th',
    title: '10th Result Regular 2023-24',
    session: '2023-24',
    examPeriod: 'Regular 2023-24',
    category: 'Regular',
    schoolName: 'Govt. Higher Secondary School Shangus',
    indicators: [
      { label: 'total appeared', count: '34' },
      { label: 'total failed/reappear', count: '10' },
      { label: 'total passed', count: '24' },
      { label: 'total Distinc', count: '9' },
      { label: 'total 1st Div', count: '7' },
      { label: 'total 2nd Div', count: '8' },
      { label: 'total 3rd Div', count: '0' },
      { label: 'Result (Overall)', count: '70.59%', highlight: true }
    ],
    summaryStats: {
      appeared: 34,
      totalEnrolled: 34,
      passed: 24,
      failed: 10,
      distinction: 9,
      firstDiv: 7,
      secondDiv: 8,
      thirdDiv: 0,
      overallPercent: '70.59%'
    },
    toppers: [
      { rollNo: '101057052', name: 'Sartaj Ahmad Mir', result: 'Distinc', marksObt: 485, grade: 'A1', percentage: '97.0%', maxMarks: 500 },
      { rollNo: '101057029', name: 'Farhan Yousuf Wani', result: 'Distinc', marksObt: 470, grade: 'A1', percentage: '94.0%', maxMarks: 500 },
      { rollNo: '101057030', name: 'Wasiq Ahmad Bhat', result: 'Distinc', marksObt: 464, grade: 'A1', percentage: '92.8%', maxMarks: 500 }
    ]
  }
];

export const CLASS_11_BOARD_RESULTS = [
  {
    id: '11th-regular-2024-25-oct-nov',
    class: '11th',
    title: '11th Regular Result 2024-25 (Oct-Nov)',
    session: '2024-25',
    examPeriod: 'Regular 2024-25 (Oct-Nov)',
    originalLabel: '11th Regular Result 2025 (oct-nov)',
    category: 'Regular',
    schoolName: 'Govt. Higher Secondary School Shangus',
    indicators: [
      { label: 'total appeared', count: '169' },
      { label: 'total failed/reappear', count: '10' },
      { label: 'total passed', count: '159' },
      { label: 'total Distinc', count: '102' },
      { label: 'total 1st Div', count: '55' },
      { label: 'total 2nd Div', count: '2' },
      { label: 'total 3rd Div', count: '0' },
      { label: 'Total pass percentage', count: '94.08%', highlight: true }
    ],
    summaryStats: {
      appeared: 169,
      totalEnrolled: 169,
      passed: 159,
      failed: 10,
      distinction: 102,
      firstDiv: 55,
      secondDiv: 2,
      thirdDiv: 0,
      overallPercent: '94.08%'
    },
    toppers: [
      { rollNo: '201003060', name: 'Adeeba Batool', result: 'Distinc', marksObt: 490, maxMarks: 500, percentage: '98.0%', resultMarksDisplay: 'Distinc / 490', stream: 'Science' },
      { rollNo: '201003070', name: 'Syed Mohammad Shaiq', result: 'Distinc', marksObt: 473, maxMarks: 500, percentage: '94.6%', resultMarksDisplay: 'Distinc / 473', stream: 'Science' },
      { rollNo: '201003064', name: 'Mehzoom Riyaz', result: 'Distinc', marksObt: 472, maxMarks: 500, percentage: '94.4%', resultMarksDisplay: 'Distinc / 472', stream: 'Science' },
      { rollNo: '201002028', name: 'Seerat Jan', result: 'Distinc', marksObt: 487, maxMarks: 500, percentage: '97.4%', resultMarksDisplay: 'Distinc / 487', stream: 'Humanities/Arts' },
      { rollNo: '201002017', name: 'Saiqa Reyaz', result: 'Distinc', marksObt: 482, maxMarks: 500, percentage: '96.4%', resultMarksDisplay: 'Distinc / 482', stream: 'Humanities/Arts' },
      { rollNo: '201002020', name: 'Rumisa Bashir', result: 'Distinc', marksObt: 475, maxMarks: 500, percentage: '95.0%', resultMarksDisplay: 'Distinc / 475', stream: 'Humanities/Arts' }
    ]
  },
  {
    id: '11th-regular-2024-25-mar-apr',
    class: '11th',
    title: '11th Regular Result 2024-25 (Mar-Apr)',
    session: '2024-25',
    examPeriod: 'Regular 2024-25 (Mar-Apr)',
    originalLabel: '11th Regular Result 2025',
    category: 'Regular',
    schoolName: 'Govt. Higher Secondary School Shangus',
    indicators: [
      { label: 'total appeared', count: '194' },
      { label: 'total failed/reappear', count: '47' },
      { label: 'total passed', count: '147' },
      { label: 'total Distinc', count: '69' },
      { label: 'total 1st Div', count: '66' },
      { label: 'total 2nd Div', count: '12' },
      { label: 'total 3rd Div', count: '0' },
      { label: 'Total pass percentage', count: '75.77%', highlight: true }
    ],
    summaryStats: {
      appeared: 194,
      totalEnrolled: 194,
      passed: 147,
      failed: 47,
      distinction: 69,
      firstDiv: 66,
      secondDiv: 12,
      thirdDiv: 0,
      overallPercent: '75.77%'
    },
    toppers: [
      { rollNo: '201002066', name: 'Zaidan Wani (Bilal Ahmad Wani)', studentName: 'Zaidan Wani', parentage: 'Bilal Ahmad Wani', result: 'Distinc', marksObt: 493, maxMarks: 500, percentage: '98.6%', resultMarksDisplay: 'Distinc/493', stream: 'Science' },
      { rollNo: '201002067', name: 'Hadeeqa Tabasum (Imtiyaz Ahmad Itoo)', studentName: 'Hadeeqa Tabasum', parentage: 'Imtiyaz Ahmad Itoo', result: 'Distinc', marksObt: 492, maxMarks: 500, percentage: '98.4%', resultMarksDisplay: 'Distinc/492', stream: 'Science' },
      { rollNo: '201002088', name: 'Sheikh Inamulhaq (Khursheed Ahmad Sheikh)', studentName: 'Sheikh Inamulhaq', parentage: 'Khursheed Ahmad Sheikh', result: 'Distinc', marksObt: 491, maxMarks: 500, percentage: '98.2%', resultMarksDisplay: 'Distinc/491', stream: 'Science' },
      { rollNo: '201003018', name: 'Tahzeena Farooq (Farooq Ahmad Wani)', studentName: 'Tahzeena Farooq', parentage: 'Farooq Ahmad Wani', result: 'Distinc', marksObt: 459, maxMarks: 500, percentage: '91.8%', resultMarksDisplay: 'Distinc/459', stream: 'Humanities' },
      { rollNo: '201002049', name: 'Neha Majeed (Abdul Majeed Bhat)', studentName: 'Neha Majeed', parentage: 'Abdul Majeed Bhat', result: 'Distinc', marksObt: 455, maxMarks: 500, percentage: '91.0%', resultMarksDisplay: 'Distinc/455', stream: 'Humanities' },
      { rollNo: '201002019', name: 'Lone Hemayoun Nisar (Nisar Ahmad Lone)', studentName: 'Lone Hemayoun Nisar', parentage: 'Nisar Ahmad Lone', result: 'Distinc', marksObt: 453, maxMarks: 500, percentage: '90.6%', resultMarksDisplay: 'Distinc/453', stream: 'Humanities' }
    ]
  },
  {
    id: '11th-regular-2023-24',
    class: '11th',
    title: '11th Result Regular 2023-24',
    session: '2023-24',
    examPeriod: 'Regular 2023-24',
    originalLabel: '11th Result 2024',
    category: 'Regular',
    schoolName: 'Govt. Higher Secondary School Shangus',
    indicators: [
      { label: 'total appeared', count: '226' },
      { label: 'total failed/reappear', count: '114' },
      { label: 'total passed', count: '112' },
      { label: 'total Distinc', count: '36' },
      { label: 'total 1st Div', count: '58' },
      { label: 'total 2nd Div', count: '18' },
      { label: 'total 3rd Div', count: '0' },
      { label: 'Total pass percentage', count: '49.56%', highlight: true }
    ],
    summaryStats: {
      appeared: 226,
      totalEnrolled: 226,
      passed: 112,
      failed: 114,
      distinction: 36,
      firstDiv: 58,
      secondDiv: 18,
      thirdDiv: 0,
      overallPercent: '49.56%'
    },
    toppers: [
      { rollNo: '201005020', name: 'Barq Afshan', result: 'Distinc', marksObt: 460, maxMarks: 500, percentage: '92.0%', resultMarksDisplay: 'Distinc / 460', stream: 'Arts/Humanities' },
      { rollNo: '201005028', name: 'Talib Ahmad Mir', result: 'Distinc', marksObt: 460, maxMarks: 500, percentage: '92.0%', resultMarksDisplay: 'Distinc / 460', stream: 'Arts/Humanities' },
      { rollNo: '201005023', name: 'Farzana Hassan', result: 'Distinc', marksObt: 430, maxMarks: 500, percentage: '86.0%', resultMarksDisplay: 'Distinc / 430', stream: 'Arts/Humanities' },
      { rollNo: '201004085', name: 'Tabish Rasool', result: 'Distinc', marksObt: 454, maxMarks: 500, percentage: '90.8%', resultMarksDisplay: 'Distinc / 454', stream: 'Medical' },
      { rollNo: '201005073', name: 'Burhan Ahmad', result: 'Distinc', marksObt: 443, maxMarks: 500, percentage: '88.6%', resultMarksDisplay: 'Distinc / 443', stream: 'Medical' },
      { rollNo: '201005080', name: 'Umat Khan', result: 'Distinc', marksObt: 427, maxMarks: 500, percentage: '85.4%', resultMarksDisplay: 'Distinc / 427', stream: 'Medical' }
    ]
  }
];

export const CLASS_12_BOARD_RESULTS = [
  {
    id: '12th-regular-2024-25-oct-nov',
    class: '12th',
    title: '12th Regular Result 2024-25 (Oct-Nov)',
    session: '2024-25',
    examPeriod: 'Regular 2024-25 (Oct-Nov)',
    originalLabel: '12th Regular Result 2025 (oct-nov)',
    category: 'Regular',
    schoolName: 'Govt. Higher Secondary School Shangus',
    indicators: [
      { label: 'total appeared', count: '176' },
      { label: 'total failed/reappear', count: '57' },
      { label: 'total passed', count: '119' },
      { label: 'total Distinc', count: '72' },
      { label: 'total 1st Div', count: '36' },
      { label: 'total 2nd Div', count: '11' },
      { label: 'total 3rd Div', count: '0' },
      { label: 'Total pass percentage', count: '67.61%', highlight: true }
    ],
    summaryStats: {
      appeared: 176,
      totalEnrolled: 176,
      passed: 119,
      failed: 57,
      distinction: 72,
      firstDiv: 36,
      secondDiv: 11,
      thirdDiv: 0,
      overallPercent: '67.61%'
    },
    toppers: [
      { rollNo: '301003054', name: 'Hadeeqa Tabasum', result: 'Distinc', marksObt: 493, maxMarks: 500, percentage: '98.6%', resultMarksDisplay: 'Distinc / 493', stream: 'Science' },
      { rollNo: '301003037', name: 'Ajvaa Ibrahim Ganie', result: 'Distinc', marksObt: 492, maxMarks: 500, percentage: '98.4%', resultMarksDisplay: 'Distinc / 492', stream: 'Science' },
      { rollNo: '301003053', name: 'Zaidan Wani', result: 'Distinc', marksObt: 488, maxMarks: 500, percentage: '97.6%', resultMarksDisplay: 'Distinc / 488', stream: 'Science' },
      { rollNo: '301002031', name: 'Neha Majeed', result: 'Distinc', marksObt: 474, maxMarks: 500, percentage: '94.8%', resultMarksDisplay: 'Distinc / 474', stream: 'Humanities/Arts' },
      { rollNo: '301002003', name: 'Tahzeena Farooq', result: 'Distinc', marksObt: 473, maxMarks: 500, percentage: '94.6%', resultMarksDisplay: 'Distinc / 473', stream: 'Humanities/Arts' },
      { rollNo: '301002005', name: 'Sabhat Shafi', result: 'Distinc', marksObt: 471, maxMarks: 500, percentage: '94.2%', resultMarksDisplay: 'Distinc / 471', stream: 'Humanities/Arts' }
    ]
  },
  {
    id: '12th-regular-2024-25-mar-apr',
    class: '12th',
    title: '12th Regular Result 2024-25 (Mar-Apr)',
    session: '2024-25',
    examPeriod: 'Regular 2024-25 (Mar-Apr)',
    originalLabel: '12th Regular Result 2025',
    category: 'Regular',
    schoolName: 'Govt. Higher Secondary School Shangus',
    indicators: [
      { label: 'total appeared', count: '167' },
      { label: 'total failed/reappear', count: '19' },
      { label: 'total passed', count: '148' },
      { label: 'total Distinc', count: '77' },
      { label: 'total 1st Div', count: '65' },
      { label: 'total 2nd Div', count: '6' },
      { label: 'total 3rd Div', count: '0' },
      { label: 'Total pass percentage', count: '88.62%', highlight: true }
    ],
    summaryStats: {
      appeared: 167,
      totalEnrolled: 167,
      passed: 148,
      failed: 19,
      distinction: 77,
      firstDiv: 65,
      secondDiv: 6,
      thirdDiv: 0,
      overallPercent: '88.62%'
    },
    toppers: [
      { rollNo: '301002004', name: 'Farzana Hassan', result: 'Distinc', marksObt: 475, maxMarks: 500, percentage: '95.0%', resultMarksDisplay: 'Distinc / 475', stream: 'Arts/Humanities' },
      { rollNo: '301002005', name: 'Talib Ahmad Mir', result: 'Distinc', marksObt: 453, maxMarks: 500, percentage: '90.6%', resultMarksDisplay: 'Distinc / 453', stream: 'Arts/Humanities' },
      { rollNo: '301046025', name: 'Majid Nabi Dar', result: 'Distinc', marksObt: 447, maxMarks: 500, percentage: '89.4%', resultMarksDisplay: 'Distinc / 447', stream: 'Arts/Humanities' },
      { rollNo: '301046053', name: 'Tabish Rasool Allie', result: 'Distinc', marksObt: 475, maxMarks: 500, percentage: '95.0%', resultMarksDisplay: 'Distinc / 475', stream: 'Medical' },
      { rollNo: '301002042', name: 'Bismah Rahman', result: 'Distinc', marksObt: 424, maxMarks: 500, percentage: '84.8%', resultMarksDisplay: 'Distinc / 424', stream: 'Medical' },
      { rollNo: '301002069', name: 'Shahid Mushtaq Ganie', result: 'Distinc', marksObt: 422, maxMarks: 500, percentage: '84.4%', resultMarksDisplay: 'Distinc / 422', stream: 'Medical' }
    ]
  },
  {
    id: '12th-regular-2023-24',
    class: '12th',
    title: '12th Result Regular 2023-24',
    session: '2023-24',
    examPeriod: 'Regular 2023-24',
    originalLabel: '12th Result 2024',
    category: 'Regular',
    schoolName: 'Govt. Higher Secondary School Shangus',
    indicators: [
      { label: 'total appeared', count: '188' },
      { label: 'total failed/reappear', count: '71' },
      { label: 'total passed', count: '117' },
      { label: 'total Distinc', count: '49' },
      { label: 'total 1st Div', count: '53' },
      { label: 'total 2nd Div', count: '15' },
      { label: 'total 3rd Div', count: '0' },
      { label: 'Total pass percentage', count: '62.23%', highlight: true }
    ],
    summaryStats: {
      appeared: 188,
      totalEnrolled: 188,
      passed: 117,
      failed: 71,
      distinction: 49,
      firstDiv: 53,
      secondDiv: 15,
      thirdDiv: 0,
      overallPercent: '62.23%'
    },
    toppers: [
      { rollNo: '301003011', name: 'Afreena Asif', result: 'Distinc', marksObt: 485, maxMarks: 500, percentage: '97.0%', resultMarksDisplay: 'Distinc / 485', stream: 'Arts/Humanities' },
      { rollNo: '301002030', name: 'Faizan Fayaz Bond', result: 'Distinc', marksObt: 476, maxMarks: 500, percentage: '95.2%', resultMarksDisplay: 'Distinc / 476', stream: 'Arts/Humanities' },
      { rollNo: '301003013', name: 'Mehvish Nabi', result: 'Distinc', marksObt: 473, maxMarks: 500, percentage: '94.6%', resultMarksDisplay: 'Distinc / 473', stream: 'Arts/Humanities' },
      { rollNo: '301002046', name: 'Arbeena Khan', result: 'Distinc', marksObt: 450, maxMarks: 500, percentage: '90.0%', resultMarksDisplay: 'Distinc / 450', stream: 'Medical' },
      { rollNo: '301002051', name: 'Mir Saniya Bilal', result: 'Distinc', marksObt: 449, maxMarks: 500, percentage: '89.8%', resultMarksDisplay: 'Distinc / 449', stream: 'Medical' },
      { rollNo: '301002082', name: 'Areeba Iqbal', result: 'Distinc', marksObt: 448, maxMarks: 500, percentage: '89.6%', resultMarksDisplay: 'Distinc / 448', stream: 'Medical' }
    ]
  }
];

export const BOARD_RESULTS_BY_CLASS = {
  '10th': CLASS_10_BOARD_RESULTS,
  '11th': CLASS_11_BOARD_RESULTS,
  '12th': CLASS_12_BOARD_RESULTS
};

export const ALL_BOARD_RESULTS = [
  ...CLASS_10_BOARD_RESULTS,
  ...CLASS_11_BOARD_RESULTS,
  ...CLASS_12_BOARD_RESULTS
];
