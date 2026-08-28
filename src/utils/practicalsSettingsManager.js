import { db } from '../services/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { getCachedCollection } from '../services/dbCache';

/**
 * Official Comprehensive JKBOSE Subjects Catalog
 * Covers all Science, Humanities, Commerce, Home Science, and Vocational Streams
 * for Class 10th, 11th, and 12th.
 */
export const SUBJECT_CONFIG_DEFS = [
  // ─── 1. CORE SCIENCE & LAB PRACTICAL SUBJECTS ─────────────────────────
  { code: 'PH',   name: 'Physics',                         stream: 'Science',                  isLab: true },
  { code: 'CH',   name: 'Chemistry',                       stream: 'Science',                  isLab: true },
  { code: 'BI',   name: 'Biology (Botany & Zoology)',      stream: 'Science',                  isLab: true },
  { code: 'BO',   name: 'Botany',                          stream: 'Science',                  isLab: true },
  { code: 'ZO',   name: 'Zoology',                         stream: 'Science',                  isLab: true },
  { code: 'BT',   name: 'Biotechnology',                  stream: 'Science',                  isLab: true },
  { code: 'MB',   name: 'Microbiology',                    stream: 'Science',                  isLab: true },
  { code: 'BC',   name: 'Biochemistry',                    stream: 'Science',                  isLab: true },
  { code: 'ES',   name: 'Environmental Science',           stream: 'Science / All Streams',    isLab: true },
  { code: 'GL',   name: 'Geology',                         stream: 'Science',                  isLab: true },
  { code: 'EL',   name: 'Electronics',                     stream: 'Science',                  isLab: true },
  { code: 'CS',   name: 'Computer Science',                stream: 'Science / Arts',           isLab: true },
  { code: 'IP',   name: 'Information Practices',           stream: 'Science / Arts',           isLab: true },
  { code: 'ST',   name: 'Statistics',                      stream: 'Science / Arts',           isLab: true },
  { code: 'FT',   name: 'Food Technology',                 stream: 'Science / Arts',           isLab: true },
  { code: 'GG',   name: 'Geography',                       stream: 'Arts / Science',           isLab: true },
  { code: 'PY',   name: 'Psychology',                      stream: 'Humanities',               isLab: true },

  // ─── 2. COMPULSORY & PHYSICAL EDUCATION ────────────────────────────────
  { code: 'EN',   name: 'General English',                 stream: 'All Streams',              isLab: false },
  { code: 'PD',   name: 'Physical Education',              stream: 'All Streams',              isLab: true },

  // ─── 3. VOCATIONAL STREAM (NSQF / SSC) ─────────────────────────────────
  { code: 'ITE',  name: 'IT and ITES',                     stream: 'Vocational',               isLab: true },
  { code: 'HTC',  name: 'Healthcare',                      stream: 'Vocational',               isLab: true },
  { code: 'RT',   name: 'Retail',                          stream: 'Vocational',               isLab: true },
  { code: 'AT',   name: 'Automobile / Automotive',         stream: 'Vocational',               isLab: true },
  { code: 'AG',   name: 'Agriculture',                     stream: 'Vocational',               isLab: true },
  { code: 'BW',   name: 'Beauty & Wellness',               stream: 'Vocational',               isLab: true },
  { code: 'AP',   name: 'Apparel & Made-ups',              stream: 'Vocational',               isLab: true },
  { code: 'ELC',  name: 'Electronics & Hardware',          stream: 'Vocational',               isLab: true },
  { code: 'PLM',  name: 'Plumbing',                        stream: 'Vocational',               isLab: true },
  { code: 'SEC',  name: 'Security',                        stream: 'Vocational',               isLab: true },
  { code: 'TEL',  name: 'Telecommunication',               stream: 'Vocational',               isLab: true },

  // ─── 4. HUMANITIES & SOCIAL SCIENCES ──────────────────────────────────
  { code: 'MA',   name: 'Mathematics',                     stream: 'Science / Arts',           isLab: false },
  { code: 'AM',   name: 'Applied Mathematics',             stream: 'Science / Arts',           isLab: false },
  { code: 'HT',   name: 'History',                         stream: 'Humanities',               isLab: false },
  { code: 'PS',   name: 'Political Science',               stream: 'Humanities',               isLab: false },
  { code: 'EC',   name: 'Economics',                       stream: 'Humanities / Commerce',    isLab: false },
  { code: 'ED',   name: 'Education',                       stream: 'Humanities',               isLab: false },
  { code: 'SO',   name: 'Sociology',                       stream: 'Humanities',               isLab: false },
  { code: 'PA',   name: 'Public Administration',           stream: 'Humanities / Commerce',    isLab: false },
  { code: 'PL',   name: 'Philosophy',                      stream: 'Humanities',               isLab: false },
  { code: 'IS',   name: 'Islamic Studies',                 stream: 'Humanities',               isLab: false },
  { code: 'VS',   name: 'Vedic Studies',                   stream: 'Humanities',               isLab: false },
  { code: 'BST',  name: 'Buddhist Studies',                stream: 'Humanities',               isLab: false },
  { code: 'MU',   name: 'Music (Arts)',                    stream: 'Humanities',               isLab: true },
  { code: 'HSC',  name: 'Home Science (Elective)',         stream: 'Humanities / Home Sci',    isLab: true },
  { code: 'FHC',  name: 'Family Health Care & Prevention', stream: 'Home Science',             isLab: true },

  // ─── 5. LANGUAGES & LITERATURE ─────────────────────────────────────────
  { code: 'UR',   name: 'Urdu',                            stream: 'Humanities',               isLab: false },
  { code: 'HN',   name: 'Hindi',                           stream: 'Humanities',               isLab: false },
  { code: 'KS',   name: 'Kashmiri',                        stream: 'Humanities',               isLab: false },
  { code: 'AR',   name: 'Arabic',                          stream: 'Humanities',               isLab: false },
  { code: 'PE',   name: 'Persian',                         stream: 'Humanities',               isLab: false },
  { code: 'SK',   name: 'Sanskrit',                        stream: 'Humanities',               isLab: false },
  { code: 'PB',   name: 'Punjabi',                         stream: 'Humanities',               isLab: false },
  { code: 'DG',   name: 'Dogri',                           stream: 'Humanities',               isLab: false },
  { code: 'BH',   name: 'Bhoti',                           stream: 'Humanities',               isLab: false },
  { code: 'ELT',  name: 'English Literature',              stream: 'Humanities',               isLab: false },
  { code: 'FE',   name: 'Functional English',              stream: 'All Streams',              isLab: false },

  // ─── 6. COMMERCE STREAM ───────────────────────────────────────────────
  { code: 'AY',   name: 'Accountancy',                     stream: 'Commerce',                 isLab: false },
  { code: 'BS',   name: 'Business Studies',                stream: 'Commerce',                 isLab: false },
  { code: 'EP',   name: 'Entrepreneurship',                stream: 'Commerce',                 isLab: false },
  { code: 'BM',   name: 'Business Mathematics',            stream: 'Commerce',                 isLab: false },
  { code: 'TS',   name: 'Typewriting & Shorthand',         stream: 'Commerce',                 isLab: true },
  { code: 'TT',   name: 'Travel Tourism & Hotel Mgt',      stream: 'Arts / Commerce',          isLab: false },

  // ─── 7. CLASS 10TH GENERAL / ADDITIONAL SUBJECTS ──────────────────────
  { code: 'SC',   name: 'Science (Class 10th)',            stream: 'Class 10th',               isLab: true },
  { code: 'SS',   name: 'Social Science (Class 10th)',     stream: 'Class 10th',               isLab: false },
  { code: 'AD',   name: 'Art and Drawing (Class 10th)',    stream: 'Class 10th',               isLab: true }
];

/**
 * Authoritative JKBOSE Official Scheme Matrix (Class 10th, 11th, and 12th)
 * - Class 10th Passing Rule: 33% (separate in Theory and IA/Practical)
 * - General English (11th & 12th): 33% (Theory 80/26, IA 20/7)
 * - Electives (11th & 12th): 36% overall and separate 36% in Theory, IA, & Ext Practical
 */
export const DEFAULT_PRACTICAL_MARKS_CONFIG = {
  '11th': {
    internal: {
      // Pattern A: Lab Science & Practical Subjects (Max 10 / Min 4)
      PH:  { max: 10, min: 4 },
      CH:  { max: 10, min: 4 },
      BI:  { max: 10, min: 4 },
      BO:  { max: 5,  min: 2 },
      ZO:  { max: 5,  min: 2 },
      BT:  { max: 10, min: 4 },
      MB:  { max: 10, min: 4 },
      BC:  { max: 10, min: 4 },
      ES:  { max: 10, min: 4 },
      GL:  { max: 10, min: 4 },
      EL:  { max: 10, min: 4 },
      CS:  { max: 10, min: 4 },
      IP:  { max: 10, min: 4 },
      ST:  { max: 10, min: 4 },
      FT:  { max: 10, min: 4 },
      GG:  { max: 10, min: 4 },
      PY:  { max: 10, min: 4 },
      PD:  { max: 10, min: 4 },
      FHC: { max: 10, min: 4 },

      // Pattern B: Project Work / Languages / Humanities / Math (Max 20 / Min 7)
      EN:     { max: 20, min: 7 }, // General English (33%)
      MA:     { max: 20, min: 7 },
      AM:     { max: 20, min: 7 },
      HT:     { max: 20, min: 7 },
      PS:     { max: 20, min: 7 },
      EC:     { max: 20, min: 7 },
      ED:     { max: 20, min: 7 },
      PA:     { max: 20, min: 7 },
      PL:     { max: 20, min: 7 },
      IS:     { max: 20, min: 7 },
      VS:     { max: 20, min: 7 },
      BST:    { max: 20, min: 7 },
      UR:     { max: 20, min: 7 },
      HN:     { max: 20, min: 7 },
      KS:     { max: 20, min: 7 },
      AR:     { max: 20, min: 7 },
      PE:     { max: 20, min: 7 },
      SK:     { max: 20, min: 7 },
      PB:     { max: 20, min: 7 },
      DG:     { max: 20, min: 7 },
      ELT:    { max: 20, min: 7 },
      FE:     { max: 20, min: 7 },
      BS:     { max: 20, min: 7 },
      BM:     { max: 20, min: 7 },

      // Pattern C: Commerce Skill / Lab (Max 5 / Min 2)
      SO:  { max: 5,  min: 2 },
      AY:  { max: 5,  min: 2 },
      EP:  { max: 5,  min: 2 },

      // Pattern D: Performing Arts (Max 25 / Min 9)
      MU:  { max: 25, min: 9 },

      // Pattern F: Typewriting & Shorthand (Max 50 / Min 18)
      TS:  { max: 50, min: 18 },

      // Pattern G: Home Science Elective (Max 30 / Min 11)
      HSC: { max: 30, min: 11 },

      // Pattern H: Pure Theory (No IA)
      BH:  { max: 0,  min: 0 },
      TT:  { max: 0,  min: 0 },

      // Pattern I: Vocational Stream (Max 25 or 50)
      ITE: { max: 25, min: 9 },
      HTC: { max: 25, min: 9 },
      RT:  { max: 25, min: 9 },
      AT:  { max: 25, min: 9 },
      AG:  { max: 25, min: 9 },
      BW:  { max: 25, min: 9 },
      AP:  { max: 25, min: 9 },
      ELC: { max: 25, min: 9 },
      PLM: { max: 25, min: 9 },
      SEC: { max: 25, min: 9 },
      TEL: { max: 25, min: 9 }
    },
    external: {
      // Pattern A: Lab Science & Practical Subjects (Max 20 / Min 7)
      PH:  { max: 20, min: 7 },
      CH:  { max: 20, min: 7 },
      BI:  { max: 20, min: 7 },
      BO:  { max: 10, min: 4 },
      ZO:  { max: 10, min: 4 },
      BT:  { max: 20, min: 7 },
      MB:  { max: 20, min: 7 },
      BC:  { max: 20, min: 7 },
      ES:  { max: 20, min: 7 },
      GL:  { max: 20, min: 7 },
      EL:  { max: 20, min: 7 },
      CS:  { max: 20, min: 7 },
      IP:  { max: 20, min: 7 },
      ST:  { max: 20, min: 7 },
      FT:  { max: 20, min: 7 },
      GG:  { max: 20, min: 7 },
      PY:  { max: 20, min: 7 },
      PD:  { max: 20, min: 7 },
      FHC: { max: 20, min: 7 },

      // Pattern C: Commerce Skill / Lab (Max 15 / Min 5)
      SO:  { max: 15, min: 5 },
      AY:  { max: 15, min: 5 },
      EP:  { max: 15, min: 5 },

      // Pattern D: Performing Arts (Max 25 / Min 9)
      MU:  { max: 25, min: 9 },

      // Pattern F: Typewriting & Shorthand (Max 50 / Min 18)
      TS:  { max: 50, min: 18 },

      // Pattern G: Home Science (No External in 11th)
      HSC: { max: 0,  min: 0 },

      // Pattern I: Vocational Stream (Max 25 / Min 9)
      ITE: { max: 25, min: 9 },
      HTC: { max: 25, min: 9 },
      RT:  { max: 25, min: 9 },
      AT:  { max: 25, min: 9 },
      AG:  { max: 25, min: 9 },
      BW:  { max: 25, min: 9 },
      AP:  { max: 25, min: 9 },
      ELC: { max: 25, min: 9 },
      PLM: { max: 25, min: 9 },
      SEC: { max: 25, min: 9 },
      TEL: { max: 25, min: 9 },

      // Non-Practical / Project Work Subjects have No External Practical (0)
      EN:  { max: 0,  min: 0 },
      MA:  { max: 0,  min: 0 },
      AM:  { max: 0,  min: 0 },
      HT:  { max: 0,  min: 0 },
      PS:  { max: 0,  min: 0 },
      EC:  { max: 0,  min: 0 },
      ED:  { max: 0,  min: 0 },
      PA:  { max: 0,  min: 0 },
      PL:  { max: 0,  min: 0 },
      IS:  { max: 0,  min: 0 },
      VS:  { max: 0,  min: 0 },
      BST: { max: 0,  min: 0 },
      UR:  { max: 0,  min: 0 },
      HN:  { max: 0,  min: 0 },
      KS:  { max: 0,  min: 0 },
      AR:  { max: 0,  min: 0 },
      PE:  { max: 0,  min: 0 },
      SK:  { max: 0,  min: 0 },
      PB:  { max: 0,  min: 0 },
      DG:  { max: 0,  min: 0 },
      BH:  { max: 0,  min: 0 },
      ELT: { max: 0,  min: 0 },
      FE:  { max: 0,  min: 0 },
      BS:  { max: 0,  min: 0 },
      BM:  { max: 0,  min: 0 },
      TT:  { max: 0,  min: 0 }
    }
  },
  '12th': {
    internal: {
      // Pattern A: Lab Science & Practical Subjects (Max 10 / Min 4)
      PH:  { max: 10, min: 4 },
      CH:  { max: 10, min: 4 },
      BI:  { max: 10, min: 4 },
      BO:  { max: 5,  min: 2 },
      ZO:  { max: 5,  min: 2 },
      BT:  { max: 10, min: 4 },
      MB:  { max: 10, min: 4 },
      BC:  { max: 10, min: 4 },
      ES:  { max: 10, min: 4 },
      GL:  { max: 10, min: 4 },
      EL:  { max: 10, min: 4 },
      CS:  { max: 10, min: 4 },
      IP:  { max: 10, min: 4 },
      ST:  { max: 10, min: 4 },
      FT:  { max: 10, min: 4 },
      GG:  { max: 10, min: 4 },
      PY:  { max: 10, min: 4 },
      FHC: { max: 10, min: 4 },
      HSC: { max: 10, min: 4 }, // In 12th, HSC is 10 IA + 20 Ext

      // Special Pattern E: Physical Education in Class 12th (Max 15 / Min 5)
      PD:  { max: 15, min: 5 },

      // Pattern B: Project Work / Languages / Humanities / Math (Max 20 / Min 7)
      EN:     { max: 20, min: 7 },
      MA:     { max: 20, min: 7 },
      AM:     { max: 20, min: 7 },
      HT:     { max: 20, min: 7 },
      PS:     { max: 20, min: 7 },
      EC:     { max: 20, min: 7 },
      PA:     { max: 20, min: 7 },
      PL:     { max: 20, min: 7 },
      IS:     { max: 20, min: 7 },
      VS:     { max: 20, min: 7 },
      BST:    { max: 20, min: 7 },
      UR:     { max: 20, min: 7 },
      HN:     { max: 20, min: 7 },
      KS:     { max: 20, min: 7 },
      AR:     { max: 20, min: 7 },
      PE:     { max: 20, min: 7 },
      SK:     { max: 20, min: 7 },
      PB:     { max: 20, min: 7 },
      DG:     { max: 20, min: 7 },
      ELT:    { max: 20, min: 7 },
      FE:     { max: 20, min: 7 },
      BS:     { max: 20, min: 7 },
      BM:     { max: 20, min: 7 },

      // Pattern C: Commerce Skill / Lab (Max 5 / Min 2)
      SO:  { max: 5,  min: 2 },
      AY:  { max: 5,  min: 2 },
      EP:  { max: 5,  min: 2 },

      // Pattern D: Performing Arts (Max 25 / Min 9)
      MU:  { max: 25, min: 9 },

      // Pattern F: Typewriting & Shorthand (Max 40 / Min 14)
      TS:  { max: 40, min: 14 },

      // Pattern H: Pure Theory (No IA in Class 12th)
      ED:  { max: 0,  min: 0 }, // Education in Class 12th is 100 Theory Pure
      BH:  { max: 0,  min: 0 },
      TT:  { max: 0,  min: 0 },

      // Pattern I: Vocational Stream (Max 25 / Min 9)
      ITE: { max: 25, min: 9 },
      HTC: { max: 25, min: 9 },
      RT:  { max: 25, min: 9 },
      AT:  { max: 25, min: 9 },
      AG:  { max: 25, min: 9 },
      BW:  { max: 25, min: 9 },
      AP:  { max: 25, min: 9 },
      ELC: { max: 25, min: 9 },
      PLM: { max: 25, min: 9 },
      SEC: { max: 25, min: 9 },
      TEL: { max: 25, min: 9 }
    },
    external: {
      // Pattern A: Lab Science & Practical Subjects (Max 20 / Min 7)
      PH:  { max: 20, min: 7 },
      CH:  { max: 20, min: 7 },
      BI:  { max: 20, min: 7 },
      BO:  { max: 10, min: 4 },
      ZO:  { max: 10, min: 4 },
      BT:  { max: 20, min: 7 },
      MB:  { max: 20, min: 7 },
      BC:  { max: 20, min: 7 },
      ES:  { max: 20, min: 7 },
      GL:  { max: 20, min: 7 },
      EL:  { max: 20, min: 7 },
      CS:  { max: 20, min: 7 },
      IP:  { max: 20, min: 7 },
      ST:  { max: 20, min: 7 },
      FT:  { max: 20, min: 7 },
      GG:  { max: 20, min: 7 },
      PY:  { max: 20, min: 7 },
      FHC: { max: 20, min: 7 },
      HSC: { max: 20, min: 7 },

      // Special Pattern E: Physical Education in Class 12th (Max 25 / Min 9)
      PD:  { max: 25, min: 9 },

      // Pattern C: Commerce Skill / Lab (Max 15 / Min 5)
      SO:  { max: 15, min: 5 },
      AY:  { max: 15, min: 5 },
      EP:  { max: 15, min: 5 },

      // Pattern D: Performing Arts (Max 25 / Min 9)
      MU:  { max: 25, min: 9 },

      // Pattern F: Typewriting & Shorthand (Max 60 / Min 22)
      TS:  { max: 60, min: 22 },

      // Pattern I: Vocational Stream (Max 25 / Min 9)
      ITE: { max: 25, min: 9 },
      HTC: { max: 25, min: 9 },
      RT:  { max: 25, min: 9 },
      AT:  { max: 25, min: 9 },
      AG:  { max: 25, min: 9 },
      BW:  { max: 25, min: 9 },
      AP:  { max: 25, min: 9 },
      ELC: { max: 25, min: 9 },
      PLM: { max: 25, min: 9 },
      SEC: { max: 25, min: 9 },
      TEL: { max: 25, min: 9 },

      // Non-Practical / Project Work Subjects have No External Practical (0)
      EN:  { max: 0,  min: 0 },
      MA:  { max: 0,  min: 0 },
      AM:  { max: 0,  min: 0 },
      HT:  { max: 0,  min: 0 },
      PS:  { max: 0,  min: 0 },
      EC:  { max: 0,  min: 0 },
      ED:  { max: 0,  min: 0 },
      PA:  { max: 0,  min: 0 },
      PL:  { max: 0,  min: 0 },
      IS:  { max: 0,  min: 0 },
      VS:  { max: 0,  min: 0 },
      BST: { max: 0,  min: 0 },
      UR:  { max: 0,  min: 0 },
      HN:  { max: 0,  min: 0 },
      KS:  { max: 0,  min: 0 },
      AR:  { max: 0,  min: 0 },
      PE:  { max: 0,  min: 0 },
      SK:  { max: 0,  min: 0 },
      PB:  { max: 0,  min: 0 },
      DG:  { max: 0,  min: 0 },
      BH:  { max: 0,  min: 0 },
      ELT: { max: 0,  min: 0 },
      FE:  { max: 0,  min: 0 },
      BS:  { max: 0,  min: 0 },
      BM:  { max: 0,  min: 0 },
      TT:  { max: 0,  min: 0 }
    }
  },
  '10th': {
    internal: {
      EN:  { max: 20, min: 7 },
      MA:  { max: 20, min: 7 },
      UR:  { max: 20, min: 7 },
      HN:  { max: 20, min: 7 },
      SC:  { max: 20, min: 7 },
      SS:  { max: 20, min: 7 },
      CS:  { max: 40, min: 13 },
      AD:  { max: 70, min: 23 },
      HSC: { max: 40, min: 13 },
      MU:  { max: 60, min: 20 },
      PT:  { max: 70, min: 23 },
      AR:  { max: 20, min: 7 },
      SK:  { max: 20, min: 7 },
      PB:  { max: 20, min: 7 },
      DG:  { max: 20, min: 7 },
      KS:  { max: 20, min: 7 },
      PE:  { max: 20, min: 7 },
      ITE: { max: 20, min: 7 },
      HTC: { max: 20, min: 7 }
    },
    external: {
      ITE: { max: 50, min: 16 },
      HTC: { max: 50, min: 16 },
      RT:  { max: 50, min: 16 },
      AT:  { max: 50, min: 16 },
      AG:  { max: 50, min: 16 },
      BW:  { max: 50, min: 16 },
      AP:  { max: 50, min: 16 },
      ELC: { max: 50, min: 16 },
      PLM: { max: 50, min: 16 },
      SEC: { max: 50, min: 16 },
      TEL: { max: 50, min: 16 }
    }
  }
};

/**
 * Resolves configured Max Marks and Min / Pass Marks for any subject, class, and evaluation type.
 */
export function getSubjectMarksConfig(settings, cls = '11th', evalType = 'internal', subCode = 'PH') {
  const rawCls = String(cls).toLowerCase();
  const normClass = rawCls.includes('10') ? '10th' : rawCls.includes('12') ? '12th' : '11th';
  const normType = String(evalType || '').toLowerCase().includes('ext') ? 'external' : 'internal';
  const code = String(subCode || '').toUpperCase().trim();

  // 1. Check evaluationMarksConfig or evaluationSettings in settings object
  const customConfig =
    settings?.evaluationMarksConfig?.[normClass]?.[normType]?.[code] ||
    settings?.evaluationSettings?.[normClass]?.[normType]?.[code] ||
    settings?.marksConfig?.[normClass]?.[normType]?.[code];

  if (customConfig) {
    const rawMax = customConfig.max ?? customConfig.maxMarks;
    const rawMin = customConfig.min ?? customConfig.minMarks;
    const max = parseInt(rawMax, 10);
    const min = parseInt(rawMin, 10);
    if (!isNaN(max) && max >= 0) {
      return {
        max,
        min: !isNaN(min) && min >= 0 ? min : Math.ceil(0.36 * max)
      };
    }
  }

  // 2. Check flat legacy keys (e.g. maxMarks11, maxMarks12)
  if (normType === 'internal') {
    const flatMap = normClass === '12th' ? settings?.maxMarks12 : settings?.maxMarks11;
    if (flatMap && flatMap[code] !== undefined) {
      const max = parseInt(flatMap[code], 10);
      if (!isNaN(max) && max >= 0) {
        return { max, min: Math.ceil(0.36 * max) };
      }
    }
  }

  // 3. Fallback to default practical marks configuration
  const def = DEFAULT_PRACTICAL_MARKS_CONFIG[normClass]?.[normType]?.[code];
  if (def) {
    return { max: def.max, min: def.min };
  }

  // 4. Fallback defaults by evaluation type
  const fallbackMax = normType === 'external' ? 20 : 20;
  return { max: fallbackMax, min: Math.ceil(0.36 * fallbackMax) };
}

/**
 * Fetches practical settings from cache / Firestore
 */
export async function getAdminPracticalsSettings() {
  try {
    const cachedDocs = await getCachedCollection('adminPracticalsSettings', false, 10 * 60 * 1000).catch(() => []);
    if (Array.isArray(cachedDocs)) {
      const configDoc = cachedDocs.find(d => d.id === 'config');
      if (configDoc) return configDoc;
    }
    const snap = await getDoc(doc(db, 'adminPracticalsSettings', 'config')).catch(() => null);
    if (snap && snap.exists()) {
      return snap.data();
    }
  } catch (e) {
    console.warn('Failed to load practical settings:', e);
  }
  return null;
}
