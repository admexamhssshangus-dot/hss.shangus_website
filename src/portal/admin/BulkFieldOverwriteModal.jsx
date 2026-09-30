import { uniqueStudentMatch, sameCohort, classKey, sessionKey, formatConsistentName, recordLocator } from '../../utils/recordIdentity';
import { beginMutationJob, applyRecordPatch, completeMutationJob } from '../../services/recordMutationService';
import { 
  resolveCertificateStream, 
  streamMatches, 
  normalizeStreamName, 
  normalizeRegistrationKey,
  areNamesCompatible
} from '../../utils/certificateStudentResolution';
import { parseJkboseMarks, calculateDivision } from '../../utils/jkboseMarksParser';
import { expandJkboseSubjectCodes } from '../../utils/jkboseResultManager';
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, AlertTriangle, CheckSquare, Square, FileSpreadsheet, 
  Upload, Copy, CheckCircle2, User, BookOpen, Award, Hash,
  ArrowRight, ArrowLeft, Sparkles, RefreshCw, Eye, EyeOff, Plus, Trash2,
  ChevronDown, ChevronUp, Database, Sliders, Download, Search,
  Phone, Landmark, Layers, Check, Terminal, ExternalLink, RotateCcw,
  Minimize2, Maximize2, Lock, BookmarkCheck, Save
} from 'lucide-react';
import { 
  hasAssignedClassRollNumber, 
  getAssignedClassRollNumber, 
  resolveStudentAdmissionStatus, 
  isStudentAdmissionApproved 
} from '../../utils/studentApprovalStatus';
import { 
  fetchStudentsForSessionOnDemand, 
  isStudentInSession 
} from '../../utils/studentDataFetcher';
import * as XLSX from 'xlsx';
import { db } from '../../services/firebase';
import { doc, getDoc, setDoc, serverTimestamp, getDocs, collection } from 'firebase/firestore';
import { updateCachedItem, getCachedCollectionSync, getCachedCollection, getMasterRegistersScoped, invalidateCache, invalidateStudentCaches } from '../../services/dbCache';
import { logAdminActivity } from '../../services/adminActivityLogger';
import { saveCsvImportBatch } from '../../services/csvBatchManager';
import { toTitleCase } from '../../utils/textFormatting';
import { cleanRawSubjectTokens, formatDobToDisplay, extractIndividualSubjectsList, formatStudentSubjects } from './AdvancedReports';

import ExcelSpreadsheetGrid from './bulkOverwrite/ExcelSpreadsheetGrid';
import ExpressDirectIngestionTab from './bulkOverwrite/ExpressDirectIngestionTab';
import GazetteAndAdmitAiTab from './bulkOverwrite/GazetteAndAdmitAiTab';

// Helper to unpack chunked or flat masterRegisters documents into standard candidate records
export function flattenMasterRegisters(rawList = []) {
  if (!Array.isArray(rawList)) return [];
  const flat = [];
  rawList.forEach((docItem, docIdx) => {
    if (!docItem || typeof docItem !== 'object') return;
    const chunk = docItem.items || docItem.students || docItem.records || docItem.data;
    const parentSession = docItem.Session || docItem.session || docItem['Academic Session'] || docItem.groupKey?.split('_')[0] || docItem.id?.split('_')[0] || '';
    const parentClass = docItem.class || docItem.Class || docItem.className || docItem['Class'] || docItem.groupKey?.split('_')[1] || '';
    const parentStream = docItem.stream || docItem.Stream || docItem['Stream'] || docItem.groupKey?.split('_')[2] || '';

    if (Array.isArray(chunk) && chunk.length > 0) {
      chunk.forEach((item, itemIdx) => {
        if (item && typeof item === 'object') {
          if (item.Status === 'Deleted' || item.status === 'Deleted' || item._deleted === true) return;
          const iSess = item.Session || item.session || item['Academic Session'] || parentSession;
          const iCls = item.Class || item.class || item['Class'] || parentClass;
          const defaultStream = (String(iCls).includes('9') || String(iCls).includes('10')) ? 'General' : '';
          const itemRoll = String(item['Class Roll No'] || item['Class Roll No.'] || item['Class R.No.'] || item['Class R.No'] || item['RL. NO.'] || item.classRollNo || item.rollNo || '').trim();
          const hasItemRoll = itemRoll !== '' && itemRoll !== '-' && itemRoll !== '—' && itemRoll !== 'N/A' && itemRoll !== 'null' && itemRoll !== 'undefined';
          const defaultStat = hasItemRoll ? 'Approved' : 'Submitted';
          const resolvedItemStatus = item.status || item.Status || item.admissionStatus || defaultStat;

          flat.push({
            ...item,
            id: item.id || item['Form Number'] || item['Form No.'] || item['Form No'] || item.formNo || item['Board Registration Number'] || `${docItem.id}_${itemIdx}`,
            formNo: item.formNo || item['Form Number'] || item['Form No.'] || item['Form No'] || item.fNo || '',
            classRollNo: item.classRollNo || item['Class Roll No'] || item['Class Roll No.'] || item['Class R.No.'] || item['Class R.No'] || item['RL. NO.'] || item.rollNo || '',
            boardRegNo: item.boardRegNo || item.regNo || item['Board Registration Number'] || item['Board Reg. No.'] || item['Board Registration No.'] || '',
            Session: iSess,
            session: iSess,
            Class: iCls,
            class: iCls,
            Stream: item.Stream || item.stream || item['Stream'] || parentStream || item.faculty || defaultStream,
            stream: item.stream || item.Stream || item['Stream'] || parentStream || item.faculty || defaultStream,
            status: resolvedItemStatus,
            Status: resolvedItemStatus,
            _source: 'masterRegisters',
            _srcCollection: 'masterRegisters',
            _parentDocId: docItem._docId || docItem.id,
            _arrayKey: ['items', 'students', 'records', 'data'].find(key => Array.isArray(docItem[key])) || 'items',
            _arrayIndex: itemIdx,
            _isHistorical: true
          });
        }
      });
    } else {
      if (docItem.Status === 'Deleted' || docItem.status === 'Deleted' || docItem._deleted === true) return;
      const docSess = docItem.Session || docItem.session || docItem['Academic Session'] || parentSession;
      const docCls = docItem.Class || docItem.class || docItem['Class'] || parentClass;
      const defaultDocStream = (String(docCls).includes('9') || String(docCls).includes('10')) ? 'General' : '';
      const docRoll = String(docItem['Class Roll No'] || docItem['Class Roll No.'] || docItem['Class R.No.'] || docItem['Class R.No'] || docItem['RL. NO.'] || docItem.classRollNo || docItem.rollNo || '').trim();
      const hasDocRoll = docRoll !== '' && docRoll !== '-' && docRoll !== '—' && docRoll !== 'N/A' && docRoll !== 'null' && docRoll !== 'undefined';
      const defaultDocStat = hasDocRoll ? 'Approved' : 'Submitted';
      const resolvedDocStatus = docItem.status || docItem.Status || docItem.admissionStatus || defaultDocStat;

      flat.push({
        ...docItem,
        id: docItem.id || docItem['Form Number'] || docItem['Form No.'] || `${docItem.id || 'doc'}_${docIdx}`,
        formNo: docItem.formNo || docItem['Form Number'] || docItem['Form No.'] || docItem['Form No'] || docItem.fNo || '',
        classRollNo: docItem.classRollNo || docItem['Class Roll No'] || docItem['Class Roll No.'] || docItem['Class R.No.'] || docItem['Class R.No'] || docItem['RL. NO.'] || docItem.rollNo || '',
        boardRegNo: docItem.boardRegNo || docItem.regNo || docItem['Board Registration Number'] || docItem['Board Reg. No.'] || docItem['Board Registration No.'] || '',
        Session: docSess,
        session: docSess,
        Class: docCls,
        class: docCls,
        Stream: docItem.Stream || docItem.stream || docItem['Stream'] || parentStream || docItem.faculty || defaultDocStream,
        stream: docItem.stream || docItem.Stream || docItem['Stream'] || parentStream || docItem.faculty || defaultDocStream,
        status: resolvedDocStatus,
        Status: resolvedDocStatus,
        _source: 'masterRegisters',
        _srcCollection: 'masterRegisters',
        _isHistorical: true
      });
    }
  });
  return flat;
}

// ─── Standard Database Fields Grouped by Functional Categories ───
export const STANDARD_DB_CATEGORIES = [
  {
    id: 'core_bio',
    title: 'Core Board Identity & Bio',
    badge: 'Authoritative',
    badgeClass: 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
    color: 'emerald',
    icon: User,
    fields: [
      { key: 'studentName', label: "Student's Name", defaultChecked: true, dbKeys: ["Student's Name (as per school records)", "Student's Name", 'Student Name', 'studentName', 'name', 'candidatename', 'Candidate Name'], excelKeys: ['studentname', 'name', 'candidatename', 'nameofstudent', 'candidate', 'nameofcandidate', 'nameofthecandidate', 'nameofthestudent', 'studentsname', 'student', 'candidatesname', 'sname', 'childname', 'student_name', 'candidate_name', 'stdname'] },
      { key: 'fatherName', label: "Father's Name", defaultChecked: true, dbKeys: ["Father's/Guardian's Name (as per school records)", "Father's Name", 'Father Name', 'fatherName', "Parent's Name", 'parentName', 'parentage', "Father's/Guardian's Name", "Father's/Guardian's"], excelKeys: ['fathername', 'fathersname', 'parentname', 'parentage', 'father', 'fathersguardiansname', 'guardianname', 'fatherguardian'] },
      { key: 'motherName', label: "Mother's Name", defaultChecked: true, dbKeys: ["Mother's Name (as per school records)", "Mother's Name", 'Mother Name', 'motherName', 'Mother', 'mother'], excelKeys: ['mothername', 'mothersname', 'mother'] },
      { key: 'dob', label: "Date of Birth (DoB)", defaultChecked: true, dbKeys: ['DoB (figures)', 'DoB (as per school records)', 'dob', 'DoB', 'dateOfBirth', 'DOB', 'Date of Birth'], excelKeys: ['dob', 'dateofbirth', 'dobfigures', 'birthdate'] },
      { key: 'dobWords', label: "DoB (in words)", defaultChecked: false, dbKeys: ['DoB (words)', 'dobWords', 'dateOfBirthInWords', 'DOB in words', 'DoB in words'], excelKeys: ['dobwords', 'dateofbirthinwords'] },
      { key: 'gender', label: "Gender", defaultChecked: true, dbKeys: ['Gender', 'gender', 'Sex', 'sex'], excelKeys: ['gender', 'sex'] },
      { key: 'fatherOccupation', label: "Father's Occupation", defaultChecked: false, dbKeys: ["Father's/Guardian's Occupation", "Father's Occupation", 'fatherOccupation', 'guardianOccupation', 'occupation'], excelKeys: ['fatheroccupation', 'occupation', 'guardiansoccupation', 'parentsoccupation'] },
      { key: 'motherTongue', label: "Mother Tongue", defaultChecked: false, dbKeys: ['Your Mother Tongue', 'Mother Tongue', 'motherTongue', 'mother_tongue'], excelKeys: ['mothertongue', 'yourmothertongue', 'language'] },
      { key: 'identificationMark', label: "Identification Mark", defaultChecked: false, dbKeys: ['Identification Mark (if any)', 'Identification Mark', 'identificationMark', 'identityMark'], excelKeys: ['identificationmark', 'identitymark', 'markofidentification'] },
      { key: 'bloodGroup', label: "Blood Group", defaultChecked: false, dbKeys: ['Blood Group', 'bloodGroup', 'blood_group'], excelKeys: ['bloodgroup', 'blood'] },
      { key: 'religion', label: "Religion", defaultChecked: false, dbKeys: ['Religion', 'religion'], excelKeys: ['religion'] },
    ]
  },
  {
    id: 'academics',
    title: 'Academic Details & Curriculum',
    badge: 'Curriculum',
    badgeClass: 'bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-800',
    color: 'blue',
    icon: BookOpen,
    fields: [
      { key: 'formNo', label: "Form Number", defaultChecked: false, dbKeys: ['Form Number', 'Form No.', 'Form No', 'formNo', 'fNo', 'form_no', 'formNumber'], excelKeys: ['formnumber', 'formno', 'fno', 'applicationno', 'applicationnumber'] },
      { key: 'admDate', label: "Date of Admission", defaultChecked: false, dbKeys: ['Date of Admission', 'Admission Date', 'admissionDate', 'admDate', 'Date of admission', 'approvedAt'], excelKeys: ['admissiondate', 'dateofadmission', 'admdate'] },
      { key: 'className', label: "Class", defaultChecked: false, dbKeys: ['Admission sought for class', 'Class', 'class', 'className'], excelKeys: ['class', 'classname', 'admissionsoughtforclass'] },
      { key: 'session', label: "Session", defaultChecked: false, dbKeys: ['Session', 'session', 'Academic Session'], excelKeys: ['session', 'academicsession'] },
      { key: 'stream', label: "Stream", defaultChecked: true, dbKeys: ['Stream', 'stream', 'Stream for Class 11th', 'Stream opted in Class 11th', 'Stream & Subjects for Class 12th', 'faculty'], excelKeys: ['stream', 'faculty'] },
      { key: 'classRollNo', label: "Class Roll No.", defaultChecked: false, dbKeys: ['Class Roll No', 'Class Roll No.', 'rollNo', 'classRollNo', 'RL. NO.', 'RL. NO', 'Class R.No.', 'Class R.No', 'roll'], excelKeys: ['classrollno', 'classroll', 'rno', 'rollno'] },
      { key: 'subjects', label: "Subjects (Auto-Expand)", defaultChecked: true, dbKeys: ['Subjects', 'subjects', 'selectedSubjects', 'Subjects to be taken in Class 12th', 'Subjects to be taken in Class 11th', 'Subjects to be taken in Class 10th', 'Subjects to be taken in Class 9th', 'Subjects Studied in Class 10th', 'Subjects Studied in Class 9th', 'subs', 'Subs', 'Subjects Offered'], excelKeys: ['subjects', 'subs', 'subjectsoffered', 'subjectcomb', 'subjectcombination'] },
      { key: 'subjects1', label: "Subject 1", defaultChecked: false, dbKeys: ['Subjects1', 'subjects1', 'Subject 1', 'Subject1', 'sub1', 'Sub1', 'subject1'], excelKeys: ['subjects1', 'subject1', 'sub1', 'subject_1', 'subjects_1'] },
      { key: 'subjects2', label: "Subject 2", defaultChecked: false, dbKeys: ['Subjects2', 'subjects2', 'Subject 2', 'Subject2', 'sub2', 'Sub2', 'subject2'], excelKeys: ['subjects2', 'subject2', 'sub2', 'subject_2', 'subjects_2'] },
      { key: 'subjects3', label: "Subject 3", defaultChecked: false, dbKeys: ['Subjects3', 'subjects3', 'Subject 3', 'Subject3', 'sub3', 'Sub3', 'subject3'], excelKeys: ['subjects3', 'subject3', 'sub3', 'subject_3', 'subjects_3'] },
      { key: 'subjects4', label: "Subject 4", defaultChecked: false, dbKeys: ['Subjects4', 'subjects4', 'Subject 4', 'Subject4', 'sub4', 'Sub4', 'subject4'], excelKeys: ['subjects4', 'subject4', 'sub4', 'subject_4', 'subjects_4'] },
      { key: 'subjects5', label: "Subject 5", defaultChecked: false, dbKeys: ['Subjects5', 'subjects5', 'Subject 5', 'Subject5', 'sub5', 'Sub5', 'subject5'], excelKeys: ['subjects5', 'subject5', 'sub5', 'subject_5', 'subjects_5'] },
      { key: 'subjects6', label: "Subject 6 (Voc / Addl)", defaultChecked: false, dbKeys: ['Subject6', 'Subjects6', 'subjects6', 'Subject 6', 'sub6', 'Sub6', 'subject6'], excelKeys: ['subjects6', 'subject6', 'sub6', 'subject_6', 'subjects_6', 'additionalsubject', 'vocational'] },
      { key: 'admissionType', label: "Admission Type", defaultChecked: false, dbKeys: ['Admission Type', 'admissionType', 'Type of Admission', 'Admission Type (Class 11th)', 'Admission Type (Class 12th)'], excelKeys: ['admissiontype', 'typeofadmission'] },
      { key: 'reasonProvisional', label: "Reason for Provisional", defaultChecked: false, dbKeys: ['Reason for Provisional (Class 11th)', 'Reason for Provisional (Class 12th)', 'Reason for Provisional', 'reasonProvisional'], excelKeys: ['reasonforprovisional', 'provisionalreason', 'reasonprovisional'] },
      { key: 'prevSchool', label: "Previous School", defaultChecked: false, dbKeys: ['Name of Previous School (Class 10th)', 'Previous School', 'prevSchool', 'Name of the Institution last attended', 'Name of the institution last attended', 'School last attended'], excelKeys: ['previousschool', 'prevschool', 'lastschool', 'schoollastattended', 'nameofpreviousschool'] },
      { key: 'prevBoard', label: "Previous Board", defaultChecked: false, dbKeys: ['Board (Class 10th)', 'Board Class 10th', 'prevBoard', 'Board (Class 8th)'], excelKeys: ['board', 'prevboard', 'boardclass10th', 'board10th'] },
      { key: 'prevPassingYear', label: "10th Passing Year", defaultChecked: false, dbKeys: ['Year of Passing Class 10th', 'Year of Passing (Class 10th)', 'prevPassingYear', 'Year of Appearing (Class 10th)'], excelKeys: ['yearofpassing', 'passingyear', 'prevpassingyear', '10thpassingyear'] },
      { key: 'prevExamRollNo', label: "10th Exam Roll No.", defaultChecked: false, dbKeys: ['Exam Roll Number of Class 10th', 'Exam R.No. (Prev.)', 'Roll No. (Class 10th)', 'prevExamRollNo', 'examRollPrev', 'Exam R.no. (Prev.)'], excelKeys: ['prevexamrollno', '10thexamrollno', 'rollnoclass10th', 'prevrollno', 'examrollnumberofclass10th'] },
      { key: 'prevMarks', label: "10th Marks Obtained", defaultChecked: false, dbKeys: ['Total Marks Obtained in Class 10th', '10th/11th Marks', 'Marks Obt. (Prev.)', 'Marks Obtained (Class 10th)', 'prevMarks', 'Marks obtained in previous examination'], excelKeys: ['prevmarks', '10thmarks', 'marks10th', 'previousmarks', 'marksobtprev', 'totalmarksobtainedinclass10th'] },
      { key: 'prevMaxMarks', label: "10th Max Marks", defaultChecked: false, dbKeys: ['Total Max. Marks in Class 10th', 'Max. Marks (Prev.)', 'Max Marks (Class 10th)', 'prevMaxMarks'], excelKeys: ['prevmaxmarks', '10thmaxmarks', 'maxmarksprev', 'totalmaxmarksinclass10th'] },
      { key: 'prevPercentage', label: "10th Percentage (%)", defaultChecked: false, dbKeys: ['%age (Prev.)', 'Percentage (Class 10th)', 'prevPercentage'], excelKeys: ['prevpercentage', '10thpercentage', 'prevpercent'] },
      { key: 'prevDivision', label: "10th Division / Grade", defaultChecked: false, dbKeys: ['Div/Distinc (Prev.)', 'prevDivision'], excelKeys: ['prevdivision', '10thdivision', 'prevgrade'] },
      { key: 'reappearSubjects10th', label: "Subjects to Reappear (10th)", defaultChecked: false, dbKeys: ['Subjects to Reappear (Class 10th)', 'Subjects to Reappear', 'reappearSubjects10th'], excelKeys: ['subjectstoreappear', 'reappearslevels', 'reappears'] },
      { key: 'class11ExamRollNo', label: "11th Exam Roll No.", defaultChecked: false, dbKeys: ['Exam Roll Number of Class 11th', 'class11ExamRollNo'], excelKeys: ['11thexamrollno', 'examrollnumberofclass11th'] },
      { key: 'class11Marks', label: "11th Marks Obtained", defaultChecked: false, dbKeys: ['Total Marks Obtained in Class 11th', 'class11Marks'], excelKeys: ['11thmarksobtained', 'totalmarksobtainedinclass11th'] },
      { key: 'class11MaxMarks', label: "11th Max Marks", defaultChecked: false, dbKeys: ['Total Max. Marks in Class 11th', 'class11MaxMarks'], excelKeys: ['11thmaxmarks', 'totalmaxmarksinclass11th'] },
      { key: 'class11School', label: "11th School Attended", defaultChecked: false, dbKeys: ['Name of Previous School (Class 11th)', 'class11School'], excelKeys: ['11thschool', 'nameofpreviousschoolclass11th'] },
      { key: 'class11Board', label: "11th Board", defaultChecked: false, dbKeys: ['Board (Class 11th)', 'class11Board'], excelKeys: ['11thboard', 'boardclass11th'] },
    ]
  },
  {
    id: 'results',
    title: 'Board Exam & Results (Bulk Sync)',
    badge: 'Gazette & Board',
    badgeClass: 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800',
    color: 'amber',
    icon: Award,
    fields: [
      { key: 'boardRollNo', label: "Exam Roll No. (Board)", defaultChecked: false, dbKeys: ['Exam R.No. (Current)', 'Exam R. No. (Current)', 'boardRollNo', 'currExamRollNo', 'examRollNo', 'currExamRoll', 'Board Roll Number', 'Board Roll No.', 'Board Roll No', 'Exam R.No.', 'Exam R. No.', 'Board Roll'], excelKeys: ['boardrollno', 'examrollno', 'boardrollnumber', 'boardroll', 'examroll', 'rollno'] },
      { key: 'result', label: "Board Result Status", defaultChecked: false, dbKeys: ['Result (Current)', 'Board Result', 'Result', 'result', 'boardResult', 'currResult', 'statusResult'], excelKeys: ['boardresult', 'result', 'resultstatus', 'examresult', 'status'] },
      { key: 'marks', label: "Marks Obtained", defaultChecked: false, dbKeys: ['Marks/Reapp (Current)', 'Marks Obtained', 'Marks', 'marks', 'totalMarks', 'marksObtained', 'currMarksReapp'], excelKeys: ['marksobtained', 'marks', 'totalmarks', 'securedmarks', 'obtmarks'] },
      { key: 'maxMarks', label: "Max Marks", defaultChecked: false, dbKeys: ['Max Marks', 'Maximum Marks', 'maxMarks', 'totalMaxMarks'], excelKeys: ['maxmarks', 'maximummarks', 'totalmax', 'outof'] },
      { key: 'percentage', label: "Percentage (%)", defaultChecked: false, dbKeys: ['Percentage', 'percentage', 'percent', 'pct', '%age', '%age (Current)'], excelKeys: ['percentage', 'percent', 'pct', 'markspercentage', 'percentage%'] },
      { key: 'grade', label: "Grade / Division", defaultChecked: false, dbKeys: ['Div/Distinc (Current)', 'Division', 'division', 'Grade', 'grade', 'Distinction', 'currDiv'], excelKeys: ['grade', 'division', 'divdistinc', 'distinction', 'gradeawarded'] },
      { key: 'currExamMode', label: "Exam Mode (Current)", defaultChecked: false, dbKeys: ['Exam Mode (Current)', 'currExamMode', 'examMode'], excelKeys: ['exammode', 'currexammode', 'mode'] },
      { key: 'withdrawalDate', label: "Date of Withdrawal", defaultChecked: false, dbKeys: ['Date of withdrawl', 'withdrawalDate', 'dateOfWithdrawal'], excelKeys: ['dateofwithdrawal', 'dateofwithdrawl', 'withdrawaldate'] },
      { key: 'ccDcIssued', label: "CC/DC Issued", defaultChecked: false, dbKeys: ['No. & Date of CC/DC Issued (This Institution)', 'currCcDc', 'ccDcIssued'], excelKeys: ['ccdcissued', 'currccdc', 'ccdc'] },
    ]
  },
  {
    id: 'ids_demographics',
    title: 'Official IDs, Contact & Demographics',
    badge: 'Registry',
    badgeClass: 'bg-purple-100 dark:bg-purple-950/80 text-purple-800 dark:text-purple-300 border-purple-300 dark:border-purple-800',
    color: 'purple',
    icon: Hash,
    fields: [
      { key: 'category', label: "Social Category", defaultChecked: false, dbKeys: ['Social category', 'Social Category', 'Cat._JKBOSE', 'Category', 'category'], excelKeys: ['category', 'socialcategory', 'catjkbose', 'caste'] },
      { key: 'socioEconomicCategory', label: "Socio-Economic Category", defaultChecked: false, dbKeys: ['Socio-economic category', 'Socio-Economic Category', 'socioEconomicCategory'], excelKeys: ['socioeconomiccategory', 'socioeconomic', 'bplcategory'] },
      { key: 'admNo', label: "Admission No.", defaultChecked: false, dbKeys: ['Admission No.', 'Adm. No.', 'admNo', 'admissionNo'], excelKeys: ['admissionno', 'admno', 'admissionnumber'] },
      { key: 'apaarId', label: "APAAR ID (12-Digit)", defaultChecked: false, dbKeys: ['APAAR ID', 'apaarId', 'apaar', 'apaarNumber'], excelKeys: ['apaarid', 'apaar', 'apaarnumber'] },
      { key: 'penNo', label: "Student PEN No.", defaultChecked: false, dbKeys: ['Permanent Education Number (PEN)', 'PEN number (given by UDISE portal)', 'PEN No', 'PEN No.', 'pen', 'penNo', 'Student PEN No.'], excelKeys: ['penno', 'pen', 'pennumber', 'studentpen', 'pennumbergivenbyudiseportal'] },
      { key: 'aadhaarNo', label: "Aadhaar Card No.", defaultChecked: false, dbKeys: ['Student Aadhaar Number', 'Aadhaar Number (12 Digits)', 'Aadhaar Number', 'Aadhaar No', 'aadhaarNo', 'aadhaar', 'aadhar', 'Aadhar No.'], excelKeys: ['studentaadhaarnumber', 'aadhaarno', 'aadhaar', 'aadharnumber', 'uid', 'aadhar', 'aadharno'] },
      { key: 'fatherAadhar', label: "Father's Aadhaar No.", defaultChecked: false, dbKeys: ["Father's Aadhar No.", "Father's Aadhaar No.", 'fatherAadhar', "Father's Aadhaar Number", "Father Aadhaar"], excelKeys: ['fatheraadhar', 'fatheraadhaar', 'fatheraadharno'] },
      { key: 'phone', label: "Mobile No.", defaultChecked: false, dbKeys: ['Mobile No. (with working WhatsApp)', 'Mobile No.', 'Mobile Number', 'phone', 'mobileNo', 'contactNo', 'mobile'], excelKeys: ['mobileno', 'mobilenumber', 'phone', 'contactno', 'mobile'] },
      { key: 'parentMobile', label: "Parent's Mobile", defaultChecked: false, dbKeys: ["Parent's Contact", "Parent's Mobile No. (must be working)", "Parent's Mobile No.", "Father's Mobile No.", 'parentMobile', 'parentContact'], excelKeys: ['parentmobile', 'parentscontact', 'fathermobile'] },
      { key: 'email', label: "Email Address", defaultChecked: false, dbKeys: ['Email Address', 'Email', 'email', 'email1'], excelKeys: ['email', 'emailaddress'] },
      { key: 'address', label: "Village / Address", defaultChecked: false, dbKeys: ['Name of your village', 'Permanent Address', 'Village / Town', 'Village/Town', 'village', 'address', 'Residence (Village, District)'], excelKeys: ['village', 'nameofyourvillage', 'town', 'address', 'locality'] },
      { key: 'houseNo', label: "House No.", defaultChecked: false, dbKeys: ['House No.', 'houseNo', 'House Number'], excelKeys: ['houseno', 'housenumber'] },
      { key: 'block', label: "Block", defaultChecked: false, dbKeys: ['Block', 'block'], excelKeys: ['block'] },
      { key: 'tehsil', label: "Tehsil", defaultChecked: false, dbKeys: ['Tehsil', 'tehsil'], excelKeys: ['tehsil'] },
      { key: 'district', label: "District", defaultChecked: false, dbKeys: ['District', 'district'], excelKeys: ['district'] },
      { key: 'pinCode', label: "PIN Code", defaultChecked: false, dbKeys: ['PIN code', 'Pin Code', 'pinCode', 'pincode'], excelKeys: ['pincode', 'pin'] },
      { key: 'state', label: "State / UT", defaultChecked: false, dbKeys: ['State/UT', 'State', 'state'], excelKeys: ['state', 'stateut'] },
      { key: 'bankAccount', label: "Bank Account No.", defaultChecked: false, dbKeys: ['Bank Account Number', 'Bank Account No.', 'bankAccount', 'bankAccountNo', 'bank'], excelKeys: ['bankaccount', 'bankaccountno', 'accountno', 'accno'] },
      { key: 'bankName', label: "Bank Name", defaultChecked: false, dbKeys: ['Name of the Bank', 'Name of Bank', 'Bank Name', 'bankName'], excelKeys: ['bankname', 'bank'] },
      { key: 'ifsc', label: "IFSC Code", defaultChecked: false, dbKeys: ['IFSC Code of the Bank Branch', 'IFSC Code', 'IFSC code', 'ifsc', 'ifscCode'], excelKeys: ['ifsc', 'ifsccode'] },
      { key: 'height', label: "Height (cm)", defaultChecked: false, dbKeys: ['Height (cm)', 'Height', 'height'], excelKeys: ['height', 'heightcm'] },
      { key: 'weight', label: "Weight (kg)", defaultChecked: false, dbKeys: ['Weight (kg)', 'Weight', 'weight'], excelKeys: ['weight', 'weightkg'] },
      { key: 'disability', label: "Disability Status", defaultChecked: false, dbKeys: ['Whether Any Disability', 'Whether specially-abled (PwD)', 'Disability Status', 'disability', 'pwd'], excelKeys: ['whetheranydisability', 'disability', 'pwd', 'speciallyabled'] },
      { key: 'disabilityType', label: "Type of Disability", defaultChecked: false, dbKeys: ['Type of Disability', 'disabilityType'], excelKeys: ['typeofdisability', 'disabilitytype'] },
      { key: 'sportsParticipation', label: "Sports Participation", defaultChecked: false, dbKeys: ['Previous participation in sports (if any)', 'Previous participation in sports', 'sportsParticipation'], excelKeys: ['previousparticipationinsports', 'sportsparticipation', 'sports'] },
      { key: 'gamesToParticipate', label: "Games to Participate", defaultChecked: false, dbKeys: ['Games to participate', 'gamesToParticipate'], excelKeys: ['gamestoparticipate', 'games'] },
      { key: 'passportNo', label: "Passport No.", defaultChecked: false, dbKeys: ['Passport No. (if available)', 'Passport No.', 'passportNo'], excelKeys: ['passportno', 'passportnumber'] },
      { key: 'scholarshipReceived', label: "Scholarship Received", defaultChecked: false, dbKeys: ['Whether scholarship received in previous academic year', 'scholarshipReceived'], excelKeys: ['whetherscholarshipreceivedinpreviousacademicyear', 'scholarshipreceived', 'scholarship'] },
      { key: 'scholarshipType', label: "Scholarship Type", defaultChecked: false, dbKeys: ['Type of scholarship received', 'scholarshipType'], excelKeys: ['typeofscholarshipreceived', 'scholarshiptype'] },
      { key: 'scholarshipAmount', label: "Scholarship Amount", defaultChecked: false, dbKeys: ['Amount received (INR)', 'scholarshipAmount'], excelKeys: ['amountreceived', 'scholarshipamount'] },
      { key: 'vocationalSubject', label: "Vocational Subject", defaultChecked: false, dbKeys: ['Vocational subject in previous class', 'vocationalSubject'], excelKeys: ['vocationalsubjectinpreviousclass', 'vocationalsubject'] },
      { key: 'vocationalPercentage', label: "Vocational %age", defaultChecked: false, dbKeys: ['Percentage Obtained in Vocational Subject', 'vocationalPercentage'], excelKeys: ['percentageobtainedinvocationalsubject', 'vocationalpercentage'] },
      { key: 'remarks', label: "Remarks", defaultChecked: false, dbKeys: ['Remarks/Feedback (if any)', 'Remarks', 'remarks'], excelKeys: ['remarks', 'remark', 'feedback'] },
    ]
  }
];

// ─── Authoritative Student Property Extractors ───
export const getStudentDisplayName = (st) => {
  if (!st) return '—';
  const raw = st.raw || {};
  const name = (
    st["Student's Name (as per school records)"] ||
    raw["Student's Name (as per school records)"] ||
    st["Student's Name"] ||
    raw["Student's Name"] ||
    st["Student Name"] ||
    raw["Student Name"] ||
    st.studentName ||
    raw.studentName ||
    st.name ||
    raw.name ||
    st.Name ||
    raw.Name ||
    st["Candidate Name"] ||
    raw["Candidate Name"] ||
    st.candidateName ||
    raw.candidateName ||
    st.fullName ||
    raw.fullName ||
    st["Name of Student"] ||
    raw["Name of Student"] ||
    st["Candidate"] ||
    raw["Candidate"] ||
    ''
  );
  return name ? String(name).trim() : '—';
};

export const getStudentDisplayFather = (st) => {
  if (!st) return '';
  const raw = st.raw || {};
  const father = (
    st["Father's/Guardian's Name (as per school records)"] ||
    raw["Father's/Guardian's Name (as per school records)"] ||
    st["Father's Name"] ||
    raw["Father's Name"] ||
    st["Father Name"] ||
    raw["Father Name"] ||
    st.fatherName ||
    raw.fatherName ||
    st.parentName ||
    raw.parentName ||
    st.parentage ||
    raw.parentage ||
    st["Parent's Name"] ||
    raw["Parent's Name"] ||
    st["Father/Guardian"] ||
    raw["Father/Guardian"] ||
    ''
  );
  return father ? String(father).trim() : '';
};

export const getStudentDisplayClass = (st) => {
  if (!st) return '—';
  const raw = st.raw || {};
  const val = (
    st.selectedClass ||
    raw.selectedClass ||
    st.className ||
    raw.className ||
    st.Class ||
    raw.Class ||
    st.class ||
    raw.class ||
    st.classCanonical ||
    raw.classCanonical ||
    st['Admission sought for class'] ||
    raw['Admission sought for class'] ||
    st['Class for which Admission Sought'] ||
    raw['Class for which Admission Sought'] ||
    ''
  );
  if (!val) return '—';
  const str = String(val).trim();
  const digitMatch = str.match(/\d+/);
  if (digitMatch) return `${digitMatch[0]}th`;
  return str;
};

export const getStudentDisplaySession = (st) => {
  if (!st) return '—';
  const raw = st.raw || {};
  const sess = (
    st.selectedSession ||
    raw.selectedSession ||
    st.Session ||
    raw.Session ||
    st.session ||
    raw.session ||
    st.sessionCanonical ||
    raw.sessionCanonical ||
    st.academicSession ||
    raw.academicSession ||
    st['Academic Session'] ||
    raw['Academic Session'] ||
    ''
  );
  return sess ? String(sess).trim() : '—';
};

export const getStudentDisplayRollNo = (st) => {
  if (!st) return '—';
  const raw = st.raw || {};
  const roll = (
    st.classRollNo ||
    raw.classRollNo ||
    st['Class Roll No'] ||
    raw['Class Roll No'] ||
    st['Class Roll No.'] ||
    raw['Class Roll No.'] ||
    st['RL. NO.'] ||
    raw['RL. NO.'] ||
    st['RL. NO'] ||
    raw['RL. NO'] ||
    st['Class R.No.'] ||
    raw['Class R.No.'] ||
    st['Class R.No'] ||
    raw['Class R.No'] ||
    st.rollNo ||
    raw.rollNo ||
    st.roll ||
    raw.roll ||
    ''
  );
  return roll ? String(roll).trim() : '—';
};

export const getStudentDisplayFormNo = (st) => {
  if (!st) return '—';
  const raw = st.raw || {};
  const form = (
    st.formNo ||
    raw.formNo ||
    st['Form Number'] ||
    raw['Form Number'] ||
    st['Form No.'] ||
    raw['Form No.'] ||
    st['Form No'] ||
    raw['Form No'] ||
    st.fNo ||
    raw.fNo ||
    st.id ||
    ''
  );
  return form ? String(form).trim().replace(/^#/, '') : '—';
};

export const getStudentDisplayRegNo = (st) => {
  if (!st) return '';
  const raw = st.raw || {};
  const reg = (
    st.boardRegNo ||
    raw.boardRegNo ||
    st.regNo ||
    raw.regNo ||
    st['Board Registration Number'] ||
    raw['Board Registration Number'] ||
    st['Board Registration No.'] ||
    raw['Board Registration No.'] ||
    st['Board Registration No'] ||
    raw['Board Registration No'] ||
    st['Board Reg. No.'] ||
    raw['Board Reg. No.'] ||
    st['Board Reg. No'] ||
    raw['Board Reg. No'] ||
    st['Board Reg No'] ||
    raw['Board Reg No'] ||
    st['Registration No. (allotted by JKBOSE)'] ||
    raw['Registration No. (allotted by JKBOSE)'] ||
    st['Registration No. (allotted by JKBOSE )'] ||
    raw['Registration No. (allotted by JKBOSE )'] ||
    st['Registration No. (allotted by DIET)'] ||
    raw['Registration No. (allotted by DIET)'] ||
    st['Registration No.'] ||
    raw['Registration No.'] ||
    st['Registration No'] ||
    raw['Registration No'] ||
    st['Registration Number'] ||
    raw['Registration Number'] ||
    st['Reg. No.'] ||
    raw['Reg. No.'] ||
    st['Reg. No'] ||
    raw['Reg. No'] ||
    st['Reg No.'] ||
    raw['Reg No.'] ||
    st['Reg No'] ||
    raw['Reg No'] ||
    st['REG. NO.'] ||
    raw['REG. NO.'] ||
    st['REG NO'] ||
    raw['REG NO'] ||
    st['Board Registration No. (Class 10th)'] ||
    raw['Board Registration No. (Class 10th)'] ||
    st['Board Registration No. (Class 11th)'] ||
    raw['Board Registration No. (Class 11th)'] ||
    st['Board Registration No. (Class 9th)'] ||
    raw['Board Registration No. (Class 9th)'] ||
    st['Board Registration No. (Class 8th)'] ||
    raw['Board Registration No. (Class 8th)'] ||
    st['DIET Registration No.'] ||
    raw['DIET Registration No.'] ||
    st['DIET/Board Reg. No.'] ||
    raw['DIET/Board Reg. No.'] ||
    st['DIET Reg. No.'] ||
    raw['DIET Reg. No.'] ||
    st['DIET Registration Number'] ||
    raw['DIET Registration Number'] ||
    st.boardReg ||
    raw.boardReg ||
    ''
  );
  return reg ? String(reg).replace(/\.0+$/, '').trim() : '';
};

// ─── Compact Multi-Select Checkbox Dropdown Component ───
export function CohortCheckboxDropdown({
  label,
  options = [],
  selected = [],
  onChange,
  allLabel,
  presets = [],
  studentCounts = {}
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isAll = selected.length === 0 || selected.includes('All');

  const handleToggle = (opt) => {
    if (opt === 'All') {
      onChange([]);
      return;
    }
    let next;
    if (isAll) {
      next = [opt];
    } else if (selected.includes(opt)) {
      next = selected.filter(x => x !== opt);
      if (next.length === 0) next = [];
    } else {
      next = [...selected, opt];
      if (options.length > 0 && next.length === options.length) {
        next = [];
      }
    }
    onChange(next);
  };

  const handleSelectAll = () => {
    onChange([]);
  };

  const handleReset = () => {
    if (options.length > 0) {
      onChange([options[0]]);
    }
  };

  let buttonText = allLabel || `All ${label}s (${options.length})`;
  if (!isAll) {
    if (selected.length === 1) {
      buttonText = label === 'Class' && !selected[0].toLowerCase().startsWith('class') ? `Class ${selected[0]}` : selected[0];
    } else if (selected.length === 2) {
      buttonText = `${selected.join(', ')}`;
    } else {
      buttonText = `${selected[0]}, +${selected.length - 1} (${selected.length})`;
    }
  }

  return (
    <div className="relative text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
          !isAll
            ? 'bg-blue-50 dark:bg-blue-950/70 border-blue-400 dark:border-blue-600 text-blue-800 dark:text-blue-200 shadow-2xs'
            : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
        }`}
        title={`Filter by ${label}`}
      >
        <span className="truncate max-w-[130px]">{buttonText}</span>
        <ChevronDown size={11} className={`text-slate-400 transition-transform duration-200 flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-1 w-56 max-w-[calc(100vw-32px)] rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl z-50 p-2 space-y-1.5 animate-fadeIn bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800 text-[10px] font-black">
            <span className="text-blue-600 dark:text-blue-400 uppercase tracking-wider">{label}</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleSelectAll}
                className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-[9px] font-black cursor-pointer hover:bg-blue-200"
              >
                All
              </button>
              {options.length > 1 && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[9px] font-bold cursor-pointer hover:bg-slate-200"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {presets.length > 0 && (
            <div className="flex flex-wrap gap-1 pb-1 border-b border-slate-100 dark:border-slate-800">
              {presets.map(p => {
                const isActive = p.values.length === selected.length && p.values.every(v => selected.includes(v));
                return (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => onChange(p.values)}
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold cursor-pointer transition-colors ${
                      isActive
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          )}

          <div className="max-h-52 overflow-y-auto space-y-0.5 py-0.5 custom-scrollbar">
            <button
              type="button"
              onClick={() => handleToggle('All')}
              className="w-full flex items-center justify-between px-2 py-1 rounded text-[11px] font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left cursor-pointer"
            >
              <div className="flex items-center gap-2">
                {isAll ? (
                  <CheckSquare size={13} className="text-blue-600 dark:text-blue-400 flex-shrink-0" />
                ) : (
                  <Square size={13} className="text-slate-400 dark:text-slate-500 flex-shrink-0" />
                )}
                <span className="font-bold">{allLabel || `All ${label}s`}</span>
              </div>
            </button>

            {options.map((opt) => {
              const checked = isAll || selected.includes(opt);
              const count = studentCounts[opt];
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => handleToggle(opt)}
                  className="w-full flex items-center justify-between px-2 py-1 rounded text-[11px] font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left cursor-pointer"
                >
                  <div className="flex items-center gap-2 truncate">
                    {checked ? (
                      <CheckSquare size={13} className="text-blue-600 dark:text-blue-400 flex-shrink-0" />
                    ) : (
                      <Square size={13} className="text-slate-400 dark:text-slate-500 flex-shrink-0" />
                    )}
                    <span className="truncate">{label === 'Class' && !opt.toLowerCase().startsWith('class') ? `Class ${opt}` : opt}</span>
                  </div>
                  {count !== undefined && (
                    <span className="text-[9px] font-semibold text-slate-400 ml-1">
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function BulkFieldOverwriteModal({
  isOpen = true,
  onClose,
  isPage = false,
  allStudents = [],
  currentSession = '2025-26',
  onComplete,
  onRecordAdded,
  onIngestSuccess,
  initialMode = 'overwrite', // 'overwrite' | 'express' | 'gazette_ai' | 'admit_ai'
  showToast: externalShowToast,
  onOpenHub
}) {
  // Top-level modal mode tab
  const [modalMode, setModalMode] = useState(initialMode || 'overwrite');

  useEffect(() => {
    if (initialMode) {
      setModalMode(initialMode);
    }
  }, [initialMode, isOpen]);

  // Local toast fallback
  const [toastMessage, setToastMessage] = useState(null);
  const showToast = (msg, type = 'success') => {
    if (externalShowToast) externalShowToast(msg, type);
    setToastMessage({ msg, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // ─── Bulk Overwrite Sub-State ───
  const [step, setStep] = useState('upload'); // 'upload' | 'preview' | 'executing' | 'completed'

  // Multi-Select Cohort States:
  const [selectedClasses, setSelectedClasses] = useState(() => {
    try {
      const saved = sessionStorage.getItem('hss_last_selected_classes');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_) {}
    return ['11th', '12th']; // Senior Secondary default: Class 11th first, then Class 12th!
  });

  const [selectedSessions, setSelectedSessions] = useState(() => {
    if (currentSession && currentSession !== '2025-26') return [currentSession];
    try {
      const saved = sessionStorage.getItem('hss_last_selected_sessions');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_) {}
    return [currentSession || '2025-26'];
  });

  const [selectedStreams, setSelectedStreams] = useState([]); // Empty = All Streams
  const [selectedStatuses, setSelectedStatuses] = useState(['Approved']); // Default: Approved

  // Backward-compatible single-value helpers
  const targetClass = useMemo(() => {
    if (selectedClasses.length === 0 || selectedClasses.includes('All')) return 'All';
    return selectedClasses.join(', ');
  }, [selectedClasses]);

  const targetSession = useMemo(() => {
    if (selectedSessions.length === 0 || selectedSessions.includes('All')) return 'All';
    return selectedSessions.join(', ');
  }, [selectedSessions]);

  const targetStream = useMemo(() => {
    if (selectedStreams.length === 0 || selectedStreams.includes('All')) return 'All';
    return selectedStreams[0];
  }, [selectedStreams]);

  const targetStatus = useMemo(() => {
    if (selectedStatuses.length === 0 || selectedStatuses.includes('All')) return 'All';
    return selectedStatuses[0];
  }, [selectedStatuses]);

  const setTargetClass = (val) => {
    if (val === 'All') setSelectedClasses([]);
    else if (Array.isArray(val)) setSelectedClasses(val);
    else setSelectedClasses([val]);
  };
  const setTargetSession = (val) => {
    if (val === 'All') setSelectedSessions([]);
    else if (Array.isArray(val)) setSelectedSessions(val);
    else setSelectedSessions([val]);
  };
  const setTargetStream = (val) => {
    if (val === 'All') setSelectedStreams([]);
    else if (Array.isArray(val)) setSelectedStreams(val);
    else setSelectedStreams([val]);
  };
  const setTargetStatus = (val) => {
    if (val === 'All') setSelectedStatuses([]);
    else if (Array.isArray(val)) setSelectedStatuses(val);
    else setSelectedStatuses([val]);
  };

  // Preview Diff Table Sorting State (Default: natural numeric Class Roll No)
  const [previewSortColumn, setPreviewSortColumn] = useState('rollNo'); // 'rollNo' | 'regNo' | 'name' | 'diffs'
  const [previewSortDirection, setPreviewSortDirection] = useState('asc'); // 'asc' | 'desc'

  // Method under Overwrite tab: 'upload' (spreadsheet file) vs 'grid' (Excel tabular clipboard grid)
  const [ingestMethod, setIngestMethod] = useState('upload'); // 'upload' | 'grid'

  // Hide / Unhide field selection matrix (collapsed by default for clean minimal view)
  const [showFieldMatrix, setShowFieldMatrix] = useState(false);

  // Custom fields added dynamically by user
  const [customFields, setCustomFields] = useState([]);
  const [customFieldInput, setCustomFieldInput] = useState('');

  // Selected fields to overwrite (defaults loaded from admin custom saved settings or system standard)
  const [selectedFields, setSelectedFields] = useState(() => {
    try {
      const saved = localStorage.getItem('hss_bulk_overwrite_default_fields_v1');
      if (saved) {
        const parsedKeys = JSON.parse(saved);
        if (Array.isArray(parsedKeys) && parsedKeys.length > 0) {
          const customMap = {};
          parsedKeys.forEach(k => { customMap[k] = true; });
          return customMap;
        } else if (typeof parsedKeys === 'object' && parsedKeys !== null && Object.keys(parsedKeys).length > 0) {
          return parsedKeys;
        }
      }
    } catch (err) {
      console.warn('Failed to load custom default fields:', err);
    }

    const initial = {};
    STANDARD_DB_CATEGORIES.forEach(cat => {
      cat.fields.forEach(f => {
        initial[f.key] = Boolean(f.defaultChecked);
      });
    });
    return initial;
  });

  // Track whether admin has saved custom default columns
  const [hasCustomDefaults, setHasCustomDefaults] = useState(() => {
    try {
      return Boolean(localStorage.getItem('hss_bulk_overwrite_default_fields_v1'));
    } catch (_) {
      return false;
    }
  });

  // Raw file & parsed data
  const [fileName, setFileName] = useState('');
  const [, setRawParsedRows] = useState([]);
  const [previewData, setPreviewData] = useState([]);
  const [previewFilter, setPreviewFilter] = useState('changed'); // 'changed' | 'all' | 'unmatched' | 'identical'
  const [selectedRowIds, setSelectedRowIds] = useState(new Set());
  const [inspectStudent, setInspectStudent] = useState(null);

  // Execution & Parsing Progress
  const [progressStage, setProgressStage] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);
  const [executionStats, setExecutionStats] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  // Non-blocking chunked parsing progress state
  const [isProcessingRows, setIsProcessingRows] = useState(false);
  const [parsingProgress, setParsingProgress] = useState({
    percent: 0,
    current: 0,
    total: 0,
    stage: '',
    candidateInfo: ''
  });

  // Real-time execution activity stream & safe abort control
  const abortExecutionRef = useRef(false);
  const [isAborting, setIsAborting] = useState(false);
  const [executionLogs, setExecutionLogs] = useState([]);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isImportExpanded, setIsImportExpanded] = useState(false);

  // Expand from minimized background dock back into full screen dialog
  const handleMaximize = useCallback(() => {
    setIsMinimized(false);
    if (typeof onOpenHub === 'function') {
      onOpenHub();
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('hss-switch-tab', { detail: { tab: 'directEntry' } }));
    }
  }, [onOpenHub]);

  // Reset workflow back to initial upload step (enables immediate overwrite for another cohort/class)
  const handleResetToUpload = useCallback(() => {
    setStep('upload');
    setPreviewData([]);
    setFileName('');
    setRawParsedRows([]);
    setExecutionStats(null);
    setErrorMsg(null);
    setProgressPercent(0);
    setProgressStage('');
    setSelectedRowIds(new Set());
    setIsProcessingRows(false);
    setIsAborting(false);
    setIsMinimized(false);
    setIsImportExpanded(false);
    setExecutionLogs([]);
    abortExecutionRef.current = false;
  }, []);

  // Safe modal close handler that cleans up state so reopening always starts fresh
  const handleClose = useCallback(() => {
    handleResetToUpload();
    if (onClose) onClose();
  }, [handleResetToUpload, onClose]);

  // If modal reopens after completion or execution, reset to upload step
  useEffect(() => {
    if (isOpen) {
      if (step === 'completed' || step === 'executing') {
        handleResetToUpload();
      }
    }
  }, [isOpen]);

  // Helper to normalize alphanumeric keys
  const cleanKey = (val) => String(val || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase().trim();

  // Helper to canonically prioritize class progression: Class 11th first, then 12th, 10th, 9th
  const getClassRank = (clsStr) => {
    const str = String(clsStr || '').trim().toLowerCase();
    if (str.includes('11')) return 1;
    if (str.includes('12')) return 2;
    if (str.includes('10')) return 3;
    if (str.includes('9')) return 4;
    const num = str.match(/\d+/);
    return num ? parseInt(num[0], 10) + 10 : 99;
  };

  // Helper to canonically normalize subjects for diff comparison
  // Ensures 'IT & ITES', 'IT and ITES', 'IT & ITeS', 'ITES', 'ITE' are recognized as identical
  const normalizeSubjectForDiff = (sub) => {
    if (!sub) return '';
    const expanded = expandJkboseSubjectCodes(sub) || sub;
    return String(expanded)
      .replace(/\b(it\s*(&|and)\s*ites|it\s*(&|and)\s*ite|ites|ite)\b/gi, 'it_ites')
      .replace(/&/g, 'and')
      .replace(/[^a-zA-Z0-9]/g, '')
      .toLowerCase()
      .trim();
  };

  // Helper to normalize names for diff comparison
  // Preserves word spacing so unspaced strings (e.g. 'Mallkatariq' vs 'Mallka Tariq') trigger diffs
  const normalizeNameForDiff = (name) => {
    if (!name) return '';
    return String(name).trim().replace(/\s+/g, ' ').toLowerCase();
  };

  // Helper to evaluate name similarity and detect critical person mismatches
  const checkNameSimilarity = (incName, dbName) => {
    if (!incName || !dbName) return { isMatch: true, isMismatch: false };
    const normInc = formatConsistentName(incName).toLowerCase().replace(/[^a-z0-9]/g, '');
    const normDb = formatConsistentName(dbName).toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!normInc || !normDb || normInc === normDb) return { isMatch: true, isMismatch: false };
    if (normDb.includes(normInc) || normInc.includes(normDb)) return { isMatch: true, isMismatch: false };

    const incTokens = formatConsistentName(incName).toLowerCase().split(/\s+/).filter(t => t.length > 1);
    const dbTokens = formatConsistentName(dbName).toLowerCase().split(/\s+/).filter(t => t.length > 1);
    const matched = incTokens.filter(t => dbTokens.some(d => d === t || d.includes(t) || t.includes(d)));
    const ratio = matched.length / Math.max(incTokens.length, dbTokens.length);

    if (ratio >= 0.4) return { isMatch: true, isMismatch: false };

    return {
      isMatch: false,
      isMismatch: true,
      message: `File has "${incName}", but Reg No belongs to "${dbName}"`
    };
  };

  // ─── UNIVERSAL DATABASE POOL (ADMISSIONS + MASTER REGISTERS + ON-DEMAND SESSION RECORDS) ───
  // Builds a deduplicated unified student pool without duplicating current admissions with masterRegisters copies.
  // Authoritatively merges multi-submission records so assigned class roll numbers & approved status are never suppressed!
  const buildUniversalPool = useCallback((baseList = [], admList = [], masterList = [], onDemandList = []) => {
    const list = [];
    const indexMap = new Map();

    const allRaw = [
      ...(baseList || []).map(s => ({ ...s, _sourcePriority: 4 })),
      ...(onDemandList || []).map(s => ({ ...s, _sourcePriority: 3 })),
      ...(admList || []).map(s => ({ ...s, _sourcePriority: 2 })),
      ...(masterList || []).map(s => ({ ...s, _sourcePriority: 1 }))
    ];

    // Priority Sort: records with an assigned Class Roll No. or Approved status are processed first
    allRaw.sort((a, b) => {
      const aHasRoll = Boolean(hasAssignedClassRollNumber(a));
      const bHasRoll = Boolean(hasAssignedClassRollNumber(b));
      if (aHasRoll && !bHasRoll) return -1;
      if (!aHasRoll && bHasRoll) return 1;
      return (b._sourcePriority || 0) - (a._sourcePriority || 0);
    });

    allRaw.forEach(s => {
      if (!s || typeof s !== 'object') return;
      if (s.Status === 'Deleted' || s.status === 'Deleted' || s._deleted === true) return;

      const fNo = String(s.formNo || s['Form Number'] || s['Form No.'] || s['Form No'] || s.fNo || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      const rawReg = String(s.boardRegNo || s.regNo || s.boardReg || s['Board Registration Number'] || s['Board Registration No.'] || s['Board Reg. No.'] || s['Registration No. (allotted by JKBOSE)'] || '');
      const reg = normalizeRegistrationKey(rawReg);
      const rawAdm = String(s.admNo || s['Admission No.'] || s['Admission No'] || s['Adm. No.'] || s.admissionNo || '').trim();
      const adm = rawAdm ? rawAdm.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() : '';
      const cls = classKey(s.classCanonical || s.selectedClass || s.className || s.Class || s.class || s['Admission sought for class']);
      const sess = sessionKey(s.sessionCanonical || s.selectedSession || s.Session || s.session || s['Academic Session']);
      const sName = String(s["Student's Name (as per school records)"] || s["Student's Name"] || s.studentName || s.name || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      const fName = String(s["Father's/Guardian's Name (as per school records)"] || s["Father's Name"] || s.fatherName || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      const rawId = s.id || s.docId || s._docId;

      const roll = getAssignedClassRollNumber(s);

      // Uniquely identify student using reg no - session - class
      const keys = [];
      if (rawId) keys.push(`id_${rawId}`);
      if (reg && reg.length > 5 && !reg.endsWith('00000000')) {
        keys.push(`reg_${reg}_${sess}_${cls}`);
      }
      if (fNo && fNo !== '—' && fNo.length > 1) {
        keys.push(`form_${fNo}_${sess}_${cls}`);
      }
      if (adm && adm !== '—' && adm.length > 1) {
        keys.push(`adm_${adm}_${sess}_${cls}`);
      }
      if (roll && roll !== '—') {
        keys.push(`roll_${roll}_${sess}_${cls}`);
      }
      if (sName && sName.length > 2 && fName && fName.length > 2 && !roll && !reg && !fNo) {
        keys.push(`name_${sName}_${fName}_${sess}_${cls}`);
      }

      let existingIdx = -1;
      for (const k of keys) {
        if (indexMap.has(k)) {
          const candidateIdx = indexMap.get(k);
          const existing = list[candidateIdx];
          const exRoll = getAssignedClassRollNumber(existing);
          // Two students with different assigned Class Roll Numbers in the same session and class cannot be merged
          if (roll && exRoll && roll !== exRoll) {
            continue;
          }
          existingIdx = candidateIdx;
          break;
        }
      }

      if (existingIdx !== -1) {
        // Merge into existing record rather than discarding
        const existing = list[existingIdx];
        const mergedRoll = getAssignedClassRollNumber(existing) || roll;
        const isApproved = isStudentAdmissionApproved(existing) || isStudentAdmissionApproved(s);
        const effStatus = isApproved ? 'Approved' : (resolveStudentAdmissionStatus(existing) || resolveStudentAdmissionStatus(s));

        const mergedReg = normalizeRegistrationKey(existing.boardRegNo || existing.regNo) ? (existing.boardRegNo || existing.regNo) : (s.boardRegNo || s.regNo);
        const mergedStream = (existing.stream && existing.stream !== 'Unknown') ? existing.stream : (s.stream && s.stream !== 'Unknown' ? s.stream : existing.stream);
        const mergedPhoto = existing.photoUrl || existing.photo_id || existing.photo || s.photoUrl || s.photo_id || s.photo;

        const merged = {
          ...s,
          ...existing,
          boardRegNo: mergedReg || existing.boardRegNo || s.boardRegNo,
          regNo: mergedReg || existing.regNo || s.regNo,
          stream: mergedStream || existing.stream || s.stream,
          photoUrl: mergedPhoto || existing.photoUrl || s.photoUrl,
          classRollNo: mergedRoll || existing.classRollNo || roll,
          status: effStatus,
          Status: effStatus
        };
        list[existingIdx] = merged;
        keys.forEach(k => indexMap.set(k, existingIdx));
      } else {
        const effStatus = resolveStudentAdmissionStatus(s);
        const newIdx = list.length;
        const newRec = {
          ...s,
          classRollNo: roll,
          status: effStatus,
          Status: effStatus
        };
        list.push(newRec);
        keys.forEach(k => indexMap.set(k, newIdx));
      }
    });

    return list;
  }, []);

  const [onDemandStudents, setOnDemandStudents] = useState([]);

  const [universalStudents, setUniversalStudents] = useState(() => {
    const cachedAdm = getCachedCollectionSync('admissions') || [];
    const cachedMaster = getCachedCollectionSync('masterRegisters') || [];
    const flatMaster = Array.isArray(cachedMaster) && cachedMaster.length > 0 ? flattenMasterRegisters(cachedMaster) : [];
    const base = Array.isArray(allStudents) && allStudents.length > 0 ? allStudents : [];
    return buildUniversalPool(base, cachedAdm, flatMaster);
  });

  // Keep universalStudents in sync when allStudents, onDemandStudents, or caches update
  useEffect(() => {
    const cachedAdm = getCachedCollectionSync('admissions') || [];
    const cachedMaster = getCachedCollectionSync('masterRegisters') || [];
    const flatMaster = Array.isArray(cachedMaster) && cachedMaster.length > 0 ? flattenMasterRegisters(cachedMaster) : [];
    const base = Array.isArray(allStudents) && allStudents.length > 0 ? allStudents : [];
    setUniversalStudents(buildUniversalPool(base, cachedAdm, flatMaster, onDemandStudents));
  }, [allStudents, onDemandStudents, buildUniversalPool]);

  // On-demand fetching for all selected sessions from Firestore & background stores
  useEffect(() => {
    if (!isOpen) return;
    let isCancelled = false;
    const targetSessions = (selectedSessions.length > 0 && !selectedSessions.includes('All'))
      ? selectedSessions
      : [currentSession || '2025-26'];

    Promise.all(targetSessions.map(sess => fetchStudentsForSessionOnDemand(sess).catch(() => [])))
      .then(results => {
        if (isCancelled) return;
        const flattened = results.flat().filter(Boolean);
        if (flattened.length > 0) {
          setOnDemandStudents(flattened);
        }
      })
      .catch(err => console.warn('On-demand session load note:', err));

    return () => { isCancelled = true; };
  }, [isOpen, selectedSessions, currentSession]);

  // Asynchronous background hydration ensuring admissions + masterRegisters are fully loaded
  useEffect(() => {
    if (!isOpen) return;

    let isCancelled = false;
    const hydrateUniversalPool = async () => {
      try {
        const [admissionsList, masterList] = await Promise.all([
          getCachedCollection('admissions').catch(() => []),
          getCachedCollection('masterRegisters').catch(() => [])
        ]);

        if (isCancelled) return;

        let validAdmissions = Array.isArray(admissionsList) ? admissionsList : [];
        let validMaster = Array.isArray(masterList) ? masterList : [];

        if (validAdmissions.length === 0) {
          try {
            const admSnap = await getDocs(collection(db, 'admissions'));
            if (!admSnap.empty) {
              validAdmissions = admSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            }
          } catch (_) {}
        }

        if (validMaster.length === 0) {
          try {
            const masterRes = await getMasterRegistersScoped({ forceAll: true });
            if (Array.isArray(masterRes) && masterRes.length > 0) {
              validMaster = masterRes;
            } else {
              const masterSnap = await getDocs(collection(db, 'masterRegisters'));
              if (!masterSnap.empty) {
                validMaster = masterSnap.docs.map(d => ({ id: d.id, ...d.data() }));
              }
            }
          } catch (_) {}
        }

        if (!isCancelled) {
          const flatMaster = flattenMasterRegisters(validMaster);
          const base = Array.isArray(allStudents) && allStudents.length > 0 ? allStudents : [];
          setUniversalStudents(buildUniversalPool(base, validAdmissions, flatMaster, onDemandStudents));
        }
      } catch (err) {
        console.warn('Error loading universal students in BulkFieldOverwriteModal:', err);
      }
    };

    hydrateUniversalPool();
    return () => { isCancelled = true; };
  }, [isOpen, allStudents, onDemandStudents, buildUniversalPool]);

  // Dynamic discovery of sessions, classes, streams, and statuses from active database (11th, then 12th)
  const availableClasses = useMemo(() => {
    const classSet = new Set(['11th', '12th', '10th', '9th']);
    (universalStudents || []).forEach(st => {
      const cls = String(st.selectedClass || st.className || st.Class || st.class || st['Admission sought for class'] || '').trim();
      if (cls && cls !== '—' && cls !== 'undefined' && cls !== 'null') {
        const normalized = cls.match(/\d+/)?.[0] ? `${cls.match(/\d+/)[0]}th` : cls;
        classSet.add(normalized);
      }
    });

    const classOrder = { '11th': 1, '12th': 2, '10th': 3, '9th': 4 };
    return Array.from(classSet).sort((a, b) => {
      const orderA = classOrder[a] || 99;
      const orderB = classOrder[b] || 99;
      if (orderA !== orderB) return orderA - orderB;
      return a.localeCompare(b, undefined, { numeric: true });
    });
  }, [universalStudents]);

  const availableSessions = useMemo(() => {
    const sessionSet = new Set(['2026 APR/BIAN', '2025-26', '2025 APR/BIAN', '2024-25', '2023-24']);
    (universalStudents || []).forEach(st => {
      const sess = String(st.selectedSession || st.Session || st.session || st.academicSession || '').trim();
      if (sess && sess !== '—' && sess !== 'undefined' && sess !== 'null') {
        sessionSet.add(sess);
      }
    });

    return Array.from(sessionSet).sort((a, b) => {
      const aIsBian = /bian|bi-annual|apr/i.test(a);
      const bIsBian = /bian|bi-annual|apr/i.test(b);
      if (aIsBian && !bIsBian) return -1;
      if (!aIsBian && bIsBian) return 1;
      return b.localeCompare(a, undefined, { numeric: true });
    });
  }, [universalStudents]);

  // Index universal student pool by normalized Board Registration Number for instant historical cross-referencing
  const studentsByRegMap = useMemo(() => {
    const map = new Map();
    (universalStudents || []).forEach(st => {
      const reg = normalizeRegistrationKey(
        st.boardRegNo || st.regNo || st.boardReg || st['Board Registration Number'] || st['Board Reg. No.'] || st['Registration No. (allotted by JKBOSE)']
      );
      if (reg) {
        if (!map.has(reg)) map.set(reg, []);
        map.get(reg).push(st);
      }
    });
    return map;
  }, [universalStudents]);

  // Flexible multi-select cohort evaluator: matches candidate student against selectedClasses and selectedSessions
  const isStudentInSelectedCohort = useCallback((st) => {
    if (!st) return false;
    const stCls = getStudentDisplayClass(st);

    // Class filter:
    const classMatch = selectedClasses.length === 0 || selectedClasses.includes('All') || selectedClasses.some(c => {
      const cKey = classKey(c);
      const stKey = classKey(stCls);
      return cKey === stKey || c === stCls;
    });
    if (!classMatch) return false;

    // Session filter using authoritative session normalizer:
    const sessionMatch = selectedSessions.length === 0 || selectedSessions.includes('All') || selectedSessions.some(sess => {
      return isStudentInSession(st, sess);
    });
    if (!sessionMatch) return false;

    return true;
  }, [selectedClasses, selectedSessions]);

  // Student counts for Class and Session dropdown badges
  const classStudentCounts = useMemo(() => {
    const counts = {};
    (universalStudents || []).forEach(st => {
      const cls = getStudentDisplayClass(st);
      if (cls && cls !== '—') counts[cls] = (counts[cls] || 0) + 1;
    });
    return counts;
  }, [universalStudents]);

  const sessionStudentCounts = useMemo(() => {
    const counts = {};
    (universalStudents || []).forEach(st => {
      const sess = getStudentDisplaySession(st);
      if (sess && sess !== '—') counts[sess] = (counts[sess] || 0) + 1;
    });
    return counts;
  }, [universalStudents]);

  // Robust stream resolver: checks current subjects, and if not sufficient, checks prior records for that reg no
  const getStudentProperStream = useCallback((st) => {
    if (!st) return '';
    const reg = normalizeRegistrationKey(getStudentDisplayRegNo(st));
    const history = reg ? (studentsByRegMap.get(reg) || []) : [];
    const cls = getStudentDisplayClass(st) || targetClass;
    return resolveCertificateStream(st, history, cls);
  }, [studentsByRegMap, targetClass]);

  const availableStreams = useMemo(() => {
    const isSeniorSec = selectedClasses.length === 0 || selectedClasses.some(c => /11|12/i.test(c));
    const isSecOnly = selectedClasses.length > 0 && selectedClasses.every(c => /9|10/i.test(c));
    if (isSecOnly) return ['General'];

    const streamSet = new Set();
    (universalStudents || []).forEach(st => {
      if (isStudentInSelectedCohort(st)) {
        const properStrm = getStudentProperStream(st);
        if (properStrm && properStrm !== 'Unknown' && properStrm !== 'General') {
          streamSet.add(properStrm);
        }
      }
    });

    if (streamSet.size === 0) {
      return isSeniorSec ? ['Humanities', 'Science', 'Commerce'] : ['Science', 'Humanities', 'Commerce', 'General'];
    }

    const canonicalOrder = ['Humanities', 'Science', 'Commerce', 'Medical', 'Non-Medical'];
    return Array.from(streamSet).sort((a, b) => {
      const idxA = canonicalOrder.indexOf(a);
      const idxB = canonicalOrder.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [universalStudents, selectedClasses, isStudentInSelectedCohort, getStudentProperStream]);

  const availableStatuses = useMemo(() => {
    const statusSet = new Set(['Approved', 'Confirmed', 'Draft', 'Submitted', 'Provisional']);
    (universalStudents || []).forEach(st => {
      if (isStudentInSelectedCohort(st)) {
        const stat = resolveStudentAdmissionStatus(st);
        if (stat && stat !== '—' && stat !== 'undefined' && stat !== 'null') {
          statusSet.add(stat);
        }
      }
    });

    return Array.from(statusSet).sort((a, b) => a.localeCompare(b));
  }, [universalStudents, isStudentInSelectedCohort]);

  // Candidates currently matching the selected cohort scope
  const matchingCohortStudents = useMemo(() => {
    return (universalStudents || []).filter(st => {
      const matchCohort = isStudentInSelectedCohort(st);
      if (!matchCohort) return false;

      const resolvedStrm = getStudentProperStream(st);
      const matchStrm = selectedStreams.length === 0 || selectedStreams.includes('All') || selectedStreams.some(s => streamMatches(resolvedStrm, s));
      
      const effStat = resolveStudentAdmissionStatus(st);
      const matchStat = selectedStatuses.length === 0 || 
                        selectedStatuses.includes('All') || 
                        selectedStatuses.some(s => s.toLowerCase() === effStat.toLowerCase() || (s.toLowerCase() === 'approved' && isStudentAdmissionApproved(st)));

      return matchStrm && matchStat;
    });
  }, [universalStudents, isStudentInSelectedCohort, selectedStreams, selectedStatuses, getStudentProperStream]);

  // Dynamic discovery of any additional genuine student fields in database records (filtering system metadata)
  const dynamicDatabaseCategories = useMemo(() => {
    const knownDbKeysSet = new Set();
    STANDARD_DB_CATEGORIES.forEach(cat => {
      cat.fields.forEach(f => {
        f.dbKeys.forEach(k => knownDbKeysSet.add(cleanKey(k)));
        knownDbKeysSet.add(cleanKey(f.key));
        knownDbKeysSet.add(cleanKey(f.label));
      });
    });

    // Extensive blacklist of system, audit, internal, and non-student metadata keys
    const internalBlacklist = new Set([
      'id', 'docid', 'owneruid', 'uid', 'createdat', 'updatedat', 'timestamp', 'date',
      'created_at', 'updated_at', 'lasteditedat', 'lasteditedby', 'lastboardsyncat',
      'boardsyncsource', 'batchid', 'jobid', 'entryid', 'expiresat', 'submissiondate',
      'isapproved', 'isupdated', 'isverified', 'verified', 'status', 'admissionstatus',
      'statuscanonical', 'selectedsession', 'selectedclass', 'sessioncanonical',
      'classcanonical', 'classnamecanonical', 'academicsession', 'admissionsoughtforclass',
      'academictier', 'classtier', 'formfeepaid', 'formfeereceipt', 'applicationstatus',
      'isregistered', 'registered', 'sno', 'hasmismatch', 'hasstreammismatch',
      'hassubsmismatch', 'streammismatchnotice', 'subsmismatchnotice', 'stream11th',
      'subs11th', 'optedstream12th', 'optedsubs12th', 'photo_id', 'photourl',
      'photoid', 'photo_url', 'studentphoto', 'signature', 'signatureurl', 'pdfurl',
      'raw', 'items', 'students', 'records', 'data', 'groupkey', 'arrayindex',
      'arraykey', 'srccollection', 'source', 'parentdocid', 'ishistorical', 'currentscope',
      'declaration', 'editunlocked', 'unlockexpiry', 'rejectionreason', 'searchtokens',
      'keywords', 'auditlog', 'logs', 'history', 'mutationjob', 'lastmodified', 'formstatus',
      'boardregno', 'regno', 'boardregistrationnumber', 'boardreg', 'registrationno'
    ]);

    const discoveredFields = [];
    const discoveredKeysSeen = new Set();
    const sampleStudents = Array.isArray(universalStudents) ? universalStudents : [];
    
    sampleStudents.forEach(st => {
      if (!st || typeof st !== 'object') return;
      Object.keys(st).forEach(rawK => {
        if (rawK.startsWith('_') || rawK.startsWith('$')) return;
        const cKey = cleanKey(rawK);
        if (!cKey || cKey.length < 2 || cKey.length > 80) return;
        if (/^\d+$/.test(cKey) || /^[a-f0-9]{8,}$/i.test(cKey)) return;
        if (knownDbKeysSet.has(cKey) || discoveredKeysSeen.has(cKey) || internalBlacklist.has(cKey)) return;

        // Skip non-primitive values (arrays, sub-objects, functions)
        const val = st[rawK];
        if (val !== null && typeof val === 'object') return;

        discoveredKeysSeen.add(cKey);
        discoveredFields.push({
          key: cKey,
          label: rawK,
          defaultChecked: false,
          dbKeys: [rawK, cKey],
          excelKeys: [cKey]
        });
      });
    });

    // Only surface genuine discovered student fields
    if (discoveredFields.length === 0) {
      return STANDARD_DB_CATEGORIES;
    }

    return [
      ...STANDARD_DB_CATEGORIES,
      {
        id: 'discovered_db',
        title: `Discovered in Database (${discoveredFields.length})`,
        badge: 'Live Database',
        badgeClass: 'bg-teal-100 dark:bg-teal-950/80 text-teal-800 dark:text-teal-300 border-teal-300 dark:border-teal-800',
        color: 'teal',
        icon: Database,
        fields: discoveredFields
      }
    ];
  }, [universalStudents]);

  // All active field definitions (standard + discovered + custom)
  const allFieldDefinitions = useMemo(() => {
    const std = [];
    dynamicDatabaseCategories.forEach(cat => {
      std.push(...cat.fields);
    });
    return [...std, ...customFields];
  }, [dynamicDatabaseCategories, customFields]);

  // Active selected field objects and labels
  const activeFieldsList = useMemo(() => {
    return allFieldDefinitions.filter(f => selectedFields[f.key]);
  }, [allFieldDefinitions, selectedFields]);

  const activeFieldLabels = useMemo(() => {
    return activeFieldsList.map(f => f.label);
  }, [activeFieldsList]);

  // Toggle field selection
  const handleToggleField = (fieldKey) => {
    setSelectedFields(prev => ({ ...prev, [fieldKey]: !prev[fieldKey] }));
  };

  // Preset selectors
  const handleSelectPreset = (presetType) => {
    const next = {};
    allFieldDefinitions.forEach(f => {
      if (presetType === 'my_defaults') {
        try {
          const saved = localStorage.getItem('hss_bulk_overwrite_default_fields_v1');
          if (saved) {
            const parsed = JSON.parse(saved);
            const activeList = Array.isArray(parsed) ? parsed : Object.keys(parsed).filter(k => parsed[k]);
            next[f.key] = activeList.includes(f.key);
            return;
          }
        } catch (_) {}
        next[f.key] = Boolean(f.defaultChecked);
      } else if (presetType === 'board_bio') {
        const bioKeys = ['studentName', 'fatherName', 'motherName', 'dob', 'gender', 'stream', 'subjects'];
        next[f.key] = bioKeys.includes(f.key);
      } else if (presetType === 'exam_results') {
        const resKeys = ['boardRollNo', 'result', 'marks', 'maxMarks', 'percentage', 'grade'];
        next[f.key] = resKeys.includes(f.key);
      } else if (presetType === 'bio_and_ids') {
        const idKeys = ['studentName', 'fatherName', 'motherName', 'dob', 'gender', 'stream', 'subjects', 'category', 'boardRegNo', 'admNo', 'apaarId', 'penNo', 'aadhaarNo'];
        next[f.key] = idKeys.includes(f.key);
      } else if (presetType === 'all') {
        next[f.key] = true;
      } else if (presetType === 'none') {
        next[f.key] = false;
      }
    });
    setSelectedFields(next);
  };

  // Save current active column selections as user's persistent default
  const handleSaveAsDefault = () => {
    try {
      const activeKeys = Object.keys(selectedFields).filter(k => selectedFields[k]);
      localStorage.setItem('hss_bulk_overwrite_default_fields_v1', JSON.stringify(activeKeys));
      setHasCustomDefaults(true);
      showToast(`Saved ${activeKeys.length} column(s) as your default selection!`, 'success');
    } catch (err) {
      console.error('Failed to save default columns:', err);
      showToast('Failed to save default columns to browser storage.', 'error');
    }
  };

  // Reset default columns back to system factory defaults
  const handleResetToSystemDefaults = () => {
    try {
      localStorage.removeItem('hss_bulk_overwrite_default_fields_v1');
      setHasCustomDefaults(false);
      const systemDefaults = {};
      STANDARD_DB_CATEGORIES.forEach(cat => {
        cat.fields.forEach(f => {
          systemDefaults[f.key] = Boolean(f.defaultChecked);
        });
      });
      setSelectedFields(systemDefaults);
      showToast('Reset columns back to standard system defaults.', 'info');
    } catch (err) {
      console.error('Failed to reset default columns:', err);
    }
  };

  // Add custom database field
  const handleAddCustomField = () => {
    const clean = customFieldInput.trim();
    if (!clean) return;
    const cleanK = cleanKey(clean);
    if (!cleanK) return;

    if (allFieldDefinitions.some(f => f.key === cleanK || cleanKey(f.label) === cleanK)) {
      setErrorMsg(`Field "${clean}" already exists in the database schema.`);
      return;
    }

    const newFieldDef = {
      key: cleanK,
      label: clean,
      defaultChecked: true,
      dbKeys: [clean, cleanK],
      excelKeys: [cleanK]
    };

    setCustomFields(prev => [...prev, newFieldDef]);
    setSelectedFields(prev => ({ ...prev, [cleanK]: true }));
    setCustomFieldInput('');
    setErrorMsg(null);
  };

  const handleRemoveCustomField = (keyToRemove) => {
    setCustomFields(prev => prev.filter(f => f.key !== keyToRemove));
    setSelectedFields(prev => {
      const next = { ...prev };
      delete next[keyToRemove];
      return next;
    });
  };

  // ─── DOWNLOAD EXCEL TEMPLATE WITH CURRENTLY SELECTED FIELDS ───
  // First column is strictly Board Registration Number, followed by selected active fields.
  // Pre-fills existing students from the selected cohort, sorted natural numeric by Class Roll No.
  const handleDownloadExcelTemplate = () => {
    const cohortStudents = [...matchingCohortStudents];

    // Default sort cohort students by Class (11th first, then 12th) and natural numeric Class Roll No
    cohortStudents.sort((a, b) => {
      const clsA = getStudentDisplayClass(a);
      const clsB = getStudentDisplayClass(b);
      const rankA = getClassRank(clsA);
      const rankB = getClassRank(clsB);
      if (rankA !== rankB) return rankA - rankB;

      const getRollNum = (st) => {
        const rollVal = String(
          st.classRollNo || 
          st['Class Roll No'] || 
          st['Class Roll No.'] || 
          st.rollNo || 
          st['RL. NO.'] || 
          st['Class R.No.'] || 
          ''
        ).trim();
        const match = rollVal.match(/\d+/);
        return match ? parseInt(match[0], 10) : 999999;
      };

      const diff = getRollNum(a) - getRollNum(b);
      if (diff !== 0) return diff;
      const nameA = String(a.studentName || a["Student's Name"] || '');
      const nameB = String(b.studentName || b["Student's Name"] || '');
      return nameA.localeCompare(nameB);
    });

    const headers = ['Board Registration Number', ...activeFieldLabels];
    let rowsData = [];

    if (cohortStudents.length > 0) {
      rowsData = cohortStudents.map(st => {
        const row = {
          'Board Registration Number': st.boardRegNo || st.regNo || st['Board Registration Number'] || st['Board Reg. No.'] || ''
        };
        activeFieldsList.forEach(f => {
          let val = '';
          if (f.key === 'stream') {
            val = getStudentProperStream(st);
          } else if (f.key === 'subjects') {
            const formatted = formatStudentSubjects(st, targetClass);
            if (formatted && formatted !== '—') {
              val = formatted;
            } else {
              const currentSubs = st.subjects || st.subs || st.selectedSubjects || st['Subjects'] || '';
              if (currentSubs && currentSubs.trim() && currentSubs.trim().length > 5 && !/^(—|-|n\/?a)$/i.test(currentSubs.trim())) {
                val = currentSubs.trim();
              } else {
                const reg = normalizeRegistrationKey(st.boardRegNo || st.regNo || st['Board Registration Number'] || st['Board Reg. No.']);
                const history = reg ? (studentsByRegMap.get(reg) || []) : [];
                let historySubs = '';
                for (const h of history) {
                  const hSubs = h.subjects || h.subs || h.selectedSubjects || h['Subjects to be taken in Class 11th'] || h['Subjects to be taken in Class 12th'] || h['Subjects Studied in Class 11th'] || h['Subjects Offered'] || h['Subjects'] || '';
                  if (hSubs && String(hSubs).trim() && String(hSubs).trim().length > 5) {
                    historySubs = String(hSubs).trim();
                    break;
                  }
                }
                val = historySubs || currentSubs || '';
              }
            }
          } else if (f.key.startsWith('subjects') || f.key.startsWith('Subjects') || f.key === 'Subject6') {
            const matchSlot = f.key.match(/\d+/);
            const slotIdx = matchSlot ? parseInt(matchSlot[0], 10) - 1 : -1;
            const indiv = extractIndividualSubjectsList(st, targetClass);
            if (slotIdx >= 0 && indiv && indiv[slotIdx]) {
              val = indiv[slotIdx];
            } else {
              for (const k of f.dbKeys) {
                if (st[k] !== undefined && String(st[k]).trim() !== '') {
                  val = String(st[k]).trim();
                  break;
                }
              }
            }
          } else {
            for (const k of f.dbKeys) {
              if (st[k] !== undefined && String(st[k]).trim() !== '') {
                val = String(st[k]).trim();
                break;
              }
            }
          }
          row[f.label] = val;
        });
        return row;
      });
    } else {
      // Provide sample row
      const sampleRow = {
        'Board Registration Number': '2161234-2024-0001'
      };
      activeFieldsList.forEach(f => {
        sampleRow[f.label] = f.key === 'studentName' ? 'SAMPLE STUDENT' : f.key === 'dob' ? '15/03/2007' : 'SAMPLE DATA';
      });
      rowsData = [sampleRow];
    }

    const ws = XLSX.utils.json_to_sheet(rowsData, { header: headers });
    const colWidths = headers.map(h => ({ wch: Math.max(h.length + 4, 18) }));
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Board_Overwrite_Template');
    const safeCls = targetClass.replace(/[^a-zA-Z0-9]/g, '_');
    const safeSess = targetSession.replace(/[^a-zA-Z0-9]/g, '_');
    XLSX.writeFile(wb, `HSS_Shangus_Sync_Template_${safeCls}_${safeSess}.xlsx`);

    showToast(`📥 Downloaded Excel template with ${rowsData.length} student record(s)!`, 'success');
  };

  // Parse Excel file
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setErrorMsg(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const buffer = evt.target.result;
        const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
        if (!rows || rows.length === 0) {
          setErrorMsg('The uploaded spreadsheet contains no readable rows.');
          return;
        }
        processIncomingRows(rows, file.name);
      } catch (err) {
        console.error('Spreadsheet read error:', err);
        setErrorMsg('Failed to parse spreadsheet: ' + (err.message || 'Invalid format'));
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // ─── STRICT AUTHORITATIVE STUDENT MATCHING & COLUMN AUTO-DETECTION ENGINE (NON-BLOCKING CHUNKED) ───
  // First column is strictly parsed as Registration Number.
  // Automatically detects every column header in the uploaded file and selects corresponding DB fields.
  const processIncomingRows = async (rows, sourceTitle = 'Spreadsheet') => {
    if (!rows || rows.length === 0) return;
    setRawParsedRows(rows);
    setErrorMsg(null);
    setIsProcessingRows(true);
    setParsingProgress({
      percent: 5,
      current: 0,
      total: rows.length,
      stage: 'Detecting columns & verifying headers...',
      candidateInfo: ''
    });

    // Yield so progress overlay appears immediately
    await new Promise(r => setTimeout(r, 20));

    // 1. Automatic Column Header Auto-Detection:
    // Inspect headers of incoming file and automatically activate all matching database fields
    const detectedFieldKeys = new Set();
    const incomingHeaders = Object.keys(rows[0] || {});
    incomingHeaders.forEach(rawH => {
      const clnH = cleanKey(rawH);
      if (!clnH) return;
      allFieldDefinitions.forEach(f => {
        const matchCandidates = [
          cleanKey(f.label),
          cleanKey(f.key),
          ...(f.excelKeys || []).map(cleanKey),
          ...(f.dbKeys || []).map(cleanKey)
        ];
        if (matchCandidates.includes(clnH)) {
          detectedFieldKeys.add(f.key);
        }
      });
    });

    // Ensure studentName is always activated if any column looks like student name or candidate name
    const nameHeaderAliases = ['studentname', 'name', 'candidatename', 'nameofstudent', 'nameofcandidate', 'studentsname', 'student', 'candidatesname', 'sname', 'childname'];
    if (incomingHeaders.some(h => nameHeaderAliases.includes(cleanKey(h)))) {
      detectedFieldKeys.add('studentName');
    }

    const effectiveSelectedFields = { ...selectedFields };
    if (detectedFieldKeys.size > 0) {
      detectedFieldKeys.forEach(k => {
        effectiveSelectedFields[k] = true;
      });
      setSelectedFields(prev => ({ ...prev, ...effectiveSelectedFields }));
    }

    const cohortStudents = (universalStudents || []).filter(isStudentInSelectedCohort);
    const correlated = [];
    const initialSelectedIds = new Set();
    const total = rows.length;
    const CHUNK_SIZE = 25;

    for (let start = 0; start < total; start += CHUNK_SIZE) {
      const end = Math.min(start + CHUNK_SIZE, total);

      for (let idx = start; idx < end; idx++) {
        const row = rows[idx];
        // Normalize row keys
        const normalizedRow = {};
        Object.entries(row).forEach(([k, v]) => {
          normalizedRow[cleanKey(k)] = typeof v === 'string' ? v.trim() : String(v || '');
        });

        // Find first column / Registration No with complete alias coverage
        let rawReg = row['Board Registration Number'] || row['Registration No.'] || row['Registration No'] || 
                       row['Board Reg. No.'] || row['Board Reg No'] || row['Board Reg. No'] ||
                       row['Registration Number'] || row['Reg. No.'] || row['Reg No'] || row['REG. NO.'] ||
                       row['Registration No. (allotted by JKBOSE)'] || row['Registration No. (allotted by JKBOSE )'] ||
                       row['Registration No. (allotted by DIET)'] || row['Registration No. (allotted by DIET )'] ||
                       row['Board Registration No. (Class 10th)'] || row['Board Registration No. (Class 11th)'] ||
                       row['Board Registration No.'] || row['Board Registration No'] ||
                       normalizedRow['boardregistrationnumber'] || normalizedRow['registrationno'] || 
                       normalizedRow['regno'] || normalizedRow['boardregno'] || normalizedRow['boardregistrationno'] || 
                       normalizedRow['registrationnumber'] || '';
        
        if (!rawReg) {
          for (const [k, v] of Object.entries(row)) {
            const cleanK = cleanKey(k);
            if ((cleanK.includes('regno') || cleanK.includes('registrationno') || cleanK.includes('boardreg') || cleanK.includes('dietreg')) && v) {
              rawReg = String(v).trim();
              break;
            }
          }
        }

        if (!rawReg) {
          const firstColVal = String(Object.values(row)[0] || '').trim();
          if (firstColVal && (firstColVal.length >= 10 || /^\d{16}$/i.test(firstColVal) || /\d{4,}/.test(firstColVal))) {
            rawReg = firstColVal;
          }
        }
        rawReg = String(rawReg).replace(/\.0+$/, '').trim();

        const rawAdm = normalizedRow['admissionno'] || normalizedRow['admno'] || normalizedRow['admissionnumber'] || '';
        const rawForm = normalizedRow['formno'] || normalizedRow['formnumber'] || normalizedRow['fno'] || '';
        const rawRoll = row['Class Roll No.'] || row['Class Roll No'] || row['Roll No.'] || row['Roll No'] ||
                        normalizedRow['classrollno'] || normalizedRow['classroll'] || normalizedRow['rollno'] || normalizedRow['rollnumber'] || '';

        const rawName = row["Student's Name (as per school records)"] || row["Student's Name"] || row["Student Name"] || 
                        row["Name of Student"] || row["Candidate Name"] || row["Name of Candidate"] || row["Name"] || 
                        row["Candidate"] || row["Child Name"] ||
                        normalizedRow['studentsname'] || normalizedRow['studentname'] || normalizedRow['name'] || 
                        normalizedRow['candidatename'] || normalizedRow['nameofstudent'] || normalizedRow['nameofcandidate'] || 
                        normalizedRow['nameofthestudent'] || normalizedRow['nameofthecandidate'] || '';

        const rawFather = row["Father's/Guardian's Name (as per school records)"] || row["Father's Name"] || row["Father Name"] || 
                          row["Father/Guardian"] || row["Parent's Name"] || row["Parentage"] || 
                          normalizedRow['fathersname'] || normalizedRow['fathername'] || normalizedRow['fathersguardiansname'] || 
                          normalizedRow['parentname'] || normalizedRow['parentage'] || '';

        const cleanReg = cleanKey(rawReg);
        const cleanAdm = cleanKey(rawAdm);
        const cleanForm = cleanKey(rawForm);
        const cleanRoll = cleanKey(rawRoll);

        // Authoritative multi-tier matching strictly within selected cohort:
        // Tier 1: Try strict multi-identifier match within selected cohort
        let matchedStudent = uniqueStudentMatch(cohortStudents,
          { reg: rawReg, adm: rawAdm, form: rawForm, roll: rawRoll }, targetSession, targetClass);

        // Tier 2: Match strictly by Registration Number within cohort (reg no - session - class)
        if (!matchedStudent && cleanReg) {
          matchedStudent = uniqueStudentMatch(cohortStudents, { reg: rawReg }, targetSession, targetClass) ||
            cohortStudents.find(st => {
              const stReg = cleanKey(getStudentDisplayRegNo(st));
              return stReg && stReg === cleanReg;
            });
        }

        // Tier 3: Match by Form No or Admission No within cohort
        if (!matchedStudent && (cleanForm || cleanAdm)) {
          matchedStudent = cohortStudents.find(st => {
            const stForm = cleanKey(getStudentDisplayFormNo(st));
            const stAdm = cleanKey(st.admNo || st['Admission No.'] || st.admissionNo || '');
            return (cleanForm && stForm === cleanForm) || (cleanAdm && stAdm === cleanAdm);
          });
        }

        // Tier 4: Match by Name + Father's Name or Name + Roll No within cohort
        let matchedByName = false;
        if (!matchedStudent && rawName) {
          const normRawName = formatConsistentName(rawName).toLowerCase().replace(/[^a-z0-9]/g, '');
          const normRawFather = rawFather ? formatConsistentName(rawFather).toLowerCase().replace(/[^a-z0-9]/g, '') : '';
          const cleanRawRoll = cleanRoll ? String(cleanRoll).replace(/\D/g, '') : '';

          if (normRawName && normRawName.length >= 3) {
            // Check Name + Father
            if (normRawFather && normRawFather.length >= 3) {
              const nfMatches = cohortStudents.filter(st => {
                const stName = formatConsistentName(getStudentDisplayName(st)).toLowerCase().replace(/[^a-z0-9]/g, '');
                const stFather = formatConsistentName(getStudentDisplayFather(st)).toLowerCase().replace(/[^a-z0-9]/g, '');
                return (stName === normRawName || areNamesCompatible(normRawName, stName)) &&
                       (stFather === normRawFather || stFather.includes(normRawFather) || normRawFather.includes(stFather));
              });
              if (nfMatches.length === 1) {
                matchedStudent = nfMatches[0];
                matchedByName = true;
              }
            }

            // Check Name + Roll No
            if (!matchedStudent && cleanRawRoll) {
              const nrMatches = cohortStudents.filter(st => {
                const stName = formatConsistentName(getStudentDisplayName(st)).toLowerCase().replace(/[^a-z0-9]/g, '');
                const stRoll = String(getStudentDisplayRollNo(st)).replace(/\D/g, '');
                return (stName === normRawName || areNamesCompatible(normRawName, stName)) && stRoll === cleanRawRoll;
              });
              if (nrMatches.length === 1) {
                matchedStudent = nrMatches[0];
                matchedByName = true;
              }
            }
          }
        }

        // Universal / Out of Cohort Cross-Match:
        // If student exists in database under another class/session
        let isOutOfCohort = false;
        let outOfCohortNotice = '';
        if (!matchedStudent) {
          let universalMatch = null;
          if (cleanReg) {
            universalMatch = (universalStudents || []).find(st => {
              const stReg = cleanKey(getStudentDisplayRegNo(st));
              return stReg && stReg === cleanReg;
            });
          }
          if (!universalMatch && cleanForm) {
            universalMatch = (universalStudents || []).find(st => {
              const stForm = cleanKey(getStudentDisplayFormNo(st));
              return stForm && stForm === cleanForm;
            });
          }
          if (!universalMatch && cleanAdm) {
            universalMatch = (universalStudents || []).find(st => {
              const stAdm = cleanKey(st.admNo || st['Admission No.'] || st.admissionNo || '');
              return stAdm && stAdm === cleanAdm;
            });
          }
          if (universalMatch) {
            isOutOfCohort = true;
            matchedStudent = universalMatch;
            const stCls = getStudentDisplayClass(universalMatch);
            const stSess = getStudentDisplaySession(universalMatch);
            outOfCohortNotice = `Found in Class ${stCls} (${stSess}), outside selected cohort`;
          }
        }

        // Verify Student Name against Registration Number to catch discrepancies
        let hasNameMismatch = false;
        let nameMismatchWarning = '';
        if (matchedStudent && rawName) {
          const dbStudentName = getStudentDisplayName(matchedStudent);
          const nameCheck = checkNameSimilarity(rawName, dbStudentName);
          if (nameCheck.isMismatch) {
            hasNameMismatch = true;
            nameMismatchWarning = nameCheck.message;
          }
        }

        // Extract all incoming fields dynamically
        const incomingFields = {};
        allFieldDefinitions.forEach(f => {
          let extracted = '';
          const searchKeys = [
            cleanKey(f.label),
            cleanKey(f.key),
            ...(f.excelKeys || []).map(cleanKey),
            ...(f.dbKeys || []).map(cleanKey)
          ];
          for (const ek of [...new Set(searchKeys)]) {
            const val = normalizedRow[ek];
            if (val !== undefined && val !== '') {
              extracted = val;
              break;
            }
          }

          if (f.key === 'studentName' && !extracted && rawName) {
            extracted = rawName;
          } else if (f.key === 'fatherName' && !extracted && rawFather) {
            extracted = rawFather;
          }

          if (f.key === 'studentName' || f.key === 'fatherName' || f.key === 'motherName' || f.key === 'gender' || f.key === 'stream' || f.key === 'category' || f.key === 'address') {
            extracted = toTitleCase(extracted);
          } else if (f.key === 'dob' && extracted) {
            extracted = formatDobToDisplay(extracted);
          } else if (f.key === 'subjects' && extracted) {
            extracted = cleanRawSubjectTokens(extracted).join(', ');
          } else if ((f.key.startsWith('subjects') || f.key.startsWith('Subjects') || f.key === 'Subject6') && extracted) {
            extracted = expandJkboseSubjectCodes(extracted) || extracted;
          } else if (f.key === 'boardRollNo' && extracted) {
            extracted = String(extracted).replace(/\.0+$/, '').trim();
          } else if (f.key === 'marks' && extracted) {
            extracted = String(extracted).replace(/\.0+$/, '').trim();
          } else if (f.key === 'result' && extracted) {
            const resUpper = String(extracted).trim().toUpperCase();
            if (resUpper === 'PASS' || resUpper === 'PASSED' || resUpper === 'QUAL' || resUpper === 'QUALIFIED') {
              extracted = 'Qualified';
            } else if (resUpper === 'REAP' || resUpper === 'RE-APPEAR' || resUpper === 'REAPPEAR') {
              extracted = 'Reappear';
            }
          }
          incomingFields[f.key] = extracted;
        });

        // Automatic Calculation of Percentage, Division & Additional Subjects
        const rawIncMarks = incomingFields['marks'];
        const rawIncMax = incomingFields['maxMarks'] || '500';
        const rawIncRes = incomingFields['result'] || '';

        if (rawIncMarks) {
          const parsedM = parseJkboseMarks(rawIncMarks, rawIncMax, rawIncRes || 'Qualified');
          if (parsedM.formattedMarks) {
            incomingFields['marks'] = parsedM.formattedMarks;
          }
          if (parsedM.max) {
            incomingFields['maxMarks'] = parsedM.max;
          }
          if (!incomingFields['percentage'] && parsedM.pctStr !== '—') {
            incomingFields['percentage'] = parsedM.pctStr;
          }
          if (!incomingFields['grade'] && parsedM.division !== '—') {
            incomingFields['grade'] = parsedM.division;
          }
        }

        // Compute diff against matched student using canonical DB values
        const diffs = {};
        let hasChanges = false;

        if (matchedStudent) {
          allFieldDefinitions.forEach(f => {
            // Registration number is an immutable board identity key and is never overwritten
            if (['boardregno', 'regno', 'boardregistrationnumber', 'boardreg', 'registrationno'].includes(cleanKey(f.key))) return;
            if (!effectiveSelectedFields[f.key]) return;
            const incVal = incomingFields[f.key];
            if (!incVal) return;

            let currVal = '';
            if (f.key === 'stream') {
              currVal = getStudentProperStream(matchedStudent);
            } else if (f.key === 'subjects') {
              const formatted = formatStudentSubjects(matchedStudent, getStudentDisplayClass(matchedStudent) || targetClass);
              currVal = (formatted && formatted !== '—') ? formatted : '';
              if (!currVal) {
                currVal = String(matchedStudent.subjects || matchedStudent.subs || matchedStudent.selectedSubjects || matchedStudent['Subjects'] || '').trim();
              }
            } else if (f.key.startsWith('subjects') || f.key.startsWith('Subjects') || f.key === 'Subject6') {
              const matchSlot = f.key.match(/\d+/);
              const slotIdx = matchSlot ? parseInt(matchSlot[0], 10) - 1 : -1;
              const indiv = extractIndividualSubjectsList(matchedStudent, getStudentDisplayClass(matchedStudent) || targetClass);
              if (slotIdx >= 0 && indiv && indiv[slotIdx]) {
                currVal = indiv[slotIdx];
              } else {
                for (const k of f.dbKeys) {
                  if (matchedStudent[k] !== undefined && String(matchedStudent[k]).trim() !== '') {
                    currVal = String(matchedStudent[k]).trim();
                    break;
                  }
                }
              }
            } else if (f.key === 'dob') {
              for (const k of f.dbKeys) {
                if (matchedStudent[k] !== undefined && String(matchedStudent[k]).trim() !== '') {
                  currVal = formatDobToDisplay(matchedStudent[k]);
                  break;
                }
              }
            } else {
              for (const k of f.dbKeys) {
                if (matchedStudent[k] !== undefined && String(matchedStudent[k]).trim() !== '') {
                  currVal = String(matchedStudent[k]).trim();
                  break;
                }
              }
            }

            let normCurr = cleanKey(currVal);
            let normInc = cleanKey(incVal);

            if (f.key === 'studentName' || f.key === 'fatherName' || f.key === 'motherName') {
              // Preserve word spacing so unspaced strings (e.g. 'Mallkatariq' vs 'Mallka Tariq') trigger diffs
              normCurr = normalizeNameForDiff(currVal);
              normInc = normalizeNameForDiff(incVal);
            } else if (f.key === 'subjects' || f.key.startsWith('subjects') || f.key.startsWith('Subjects') || f.key === 'Subject6') {
              normCurr = normalizeSubjectForDiff(currVal);
              normInc = normalizeSubjectForDiff(incVal);
            }

            if (normCurr !== normInc) {
              diffs[f.key] = {
                fieldLabel: f.label,
                currentValue: currVal || '—',
                incomingValue: incVal
              };
              hasChanges = true;
            }
          });
        }

        const rowId = `row_${idx}_${cleanReg || cleanAdm || cleanForm || idx}`;
        if (hasChanges && matchedStudent) {
          initialSelectedIds.add(rowId);
        }

        correlated.push({
          id: rowId,
          rowIndex: idx + 1,
          matchedStudent,
          rawReg: rawReg || '—',
          rawAdm: rawAdm || '—',
          rawForm: rawForm || '—',
          rawName: rawName || '—',
          rawFather: rawFather || '—',
          incomingFields,
          diffs,
          hasChanges,
          isUnmatched: !matchedStudent,
          isOutOfCohort,
          outOfCohortNotice,
          hasNameMismatch,
          nameMismatchWarning,
          matchedByName
        });
      }

      // Update non-blocking progress
      const pct = Math.min(95, 10 + Math.round((end / total) * 85));
      const inCohortCount = correlated.filter(r => r.matchedStudent && !r.isOutOfCohort).length;
      const lastCorrelated = correlated[correlated.length - 1];
      const name = getStudentDisplayName(lastCorrelated?.matchedStudent) || `Row #${end}`;

      setParsingProgress({
        percent: pct,
        current: end,
        total,
        stage: `Scanning row ${end} of ${total} (${inCohortCount} matched in Class ${targetClass})...`,
        candidateInfo: name ? `Latest: ${name}` : ''
      });

      // Yield control back to the browser to paint frame and avoid freezing
      await new Promise(r => setTimeout(r, 0));
    }

    setParsingProgress({
      percent: 100,
      current: total,
      total,
      stage: 'Comparison complete! Preparing diff table...',
      candidateInfo: 'Ready'
    });
    await new Promise(r => setTimeout(r, 100));

    setPreviewData(correlated);
    setSelectedRowIds(initialSelectedIds);
    setFileName(sourceTitle);
    setIsProcessingRows(false);
    // If all records are identical/already updated (0 detected changes), show 'all' so admin immediately sees all matched records
    if (initialSelectedIds.size === 0 && correlated.length > 0) {
      setPreviewFilter('all');
    } else {
      setPreviewFilter('changed');
    }
    setStep('preview');
  };

  // Preview stats
  const stats = useMemo(() => {
    let changed = 0;
    let unmatched = 0;
    let identical = 0;
    let nameMismatches = 0;
    let outOfCohort = 0;
    let inCohort = 0;

    previewData.forEach(r => {
      if (r.hasNameMismatch) nameMismatches++;
      if (r.isOutOfCohort) {
        outOfCohort++;
        if (r.matchedStudent && r.hasChanges) changed++;
      } else if (r.isUnmatched) {
        unmatched++;
      } else if (r.matchedStudent) {
        inCohort++;
        if (r.hasChanges) changed++;
        else identical++;
      }
    });

    return { total: previewData.length, changed, unmatched, identical, nameMismatches, outOfCohort, inCohort };
  }, [previewData]);

  // Sort toggle handler for Preview Diff Table
  const handleTogglePreviewSort = (colKey) => {
    if (previewSortColumn === colKey) {
      setPreviewSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setPreviewSortColumn(colKey);
      setPreviewSortDirection('asc');
    }
  };

  // Filtered and Sorted preview data (Default: natural numeric Class Roll No ascending)
  const filteredPreview = useMemo(() => {
    const list = previewData.filter(r => {
      if (previewFilter === 'changed') return r.hasChanges;
      if (previewFilter === 'mismatches') return r.hasNameMismatch;
      if (previewFilter === 'outOfCohort') return r.isOutOfCohort;
      if (previewFilter === 'unmatched') return r.isUnmatched;
      if (previewFilter === 'identical') return !r.hasChanges && !r.isUnmatched;
      return true;
    });

    list.sort((a, b) => {
      // Primary class grouping: Class 11th first (1), then Class 12th (2), then 10th (3), 9th (4)
      const clsA = getStudentDisplayClass(a.matchedStudent) || a.incomingFields?.class || a.incomingFields?.className || '';
      const clsB = getStudentDisplayClass(b.matchedStudent) || b.incomingFields?.class || b.incomingFields?.className || '';
      const rankA = getClassRank(clsA);
      const rankB = getClassRank(clsB);

      if (rankA !== rankB) {
        return previewSortDirection === 'asc' ? rankA - rankB : rankB - rankA;
      }

      if (previewSortColumn === 'rollNo') {
        const getRollNum = (item) => {
          if (!item.matchedStudent) return 999999;
          const rollVal = getStudentDisplayRollNo(item.matchedStudent);
          const match = String(rollVal).match(/\d+/);
          return match ? parseInt(match[0], 10) : 999999;
        };
        const numA = getRollNum(a);
        const numB = getRollNum(b);
        if (numA !== numB) {
          return previewSortDirection === 'asc' ? numA - numB : numB - numA;
        }
        const nameA = getStudentDisplayName(a.matchedStudent);
        const nameB = getStudentDisplayName(b.matchedStudent);
        return nameA.localeCompare(nameB);
      }

      if (previewSortColumn === 'regNo') {
        const comp = String(a.rawReg || '').localeCompare(String(b.rawReg || ''), undefined, { numeric: true, sensitivity: 'base' });
        return previewSortDirection === 'asc' ? comp : -comp;
      }

      if (previewSortColumn === 'name') {
        const nameA = getStudentDisplayName(a.matchedStudent);
        const nameB = getStudentDisplayName(b.matchedStudent);
        const comp = nameA.localeCompare(nameB);
        return previewSortDirection === 'asc' ? comp : -comp;
      }

      if (previewSortColumn === 'diffs') {
        const diffA = Object.keys(a.diffs || {}).length;
        const diffB = Object.keys(b.diffs || {}).length;
        return previewSortDirection === 'asc' ? diffA - diffB : diffB - diffA;
      }

      return 0;
    });

    return list;
  }, [previewData, previewFilter, previewSortColumn, previewSortDirection]);

  // Selection handlers
  const handleToggleRow = (rowId) => {
    setSelectedRowIds(prev => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  };

  const handleSelectAllFiltered = (selectAll) => {
    setSelectedRowIds(prev => {
      const next = new Set(prev);
      filteredPreview.forEach(r => {
        if (selectAll && r.matchedStudent) next.add(r.id);
        else next.delete(r.id);
      });
      return next;
    });
  };

  // Safe abort handler for running execution
  const handleAbortExecution = () => {
    abortExecutionRef.current = true;
    setIsAborting(true);
    setProgressStage('Stopping execution safely... Completing current candidate.');
  };

  // Execute Overwrite into Firestore & dbCache
  const executeOverwrite = async () => {
    const rowsToExecute = previewData.filter(r => selectedRowIds.has(r.id) && r.matchedStudent);
    if (rowsToExecute.length === 0) {
      setErrorMsg('No matched student records are selected for overwrite.');
      return;
    }

    abortExecutionRef.current = false;
    setIsAborting(false);
    setExecutionLogs([]);
    setStep('executing');
    setProgressPercent(5);
    setProgressStage('Initializing Board Database Transaction...');
    setErrorMsg(null);

    try {
      const jobId = await beginMutationJob(`Board Data Overwrite: ${fileName || 'JKBOSE Sync'}`, rowsToExecute.length, 'Board Data Sync & Field Overwrite');
      let updatedCount = 0;

      // Helper to construct full normalized payload for a single student row
      const buildTaskPayload = (item, i) => {
        const st = item.matchedStudent;
        const inc = item.incomingFields;
        const sName = String(st.studentName || st["Student's Name"] || 'Candidate');
        const sRoll = String(st.classRollNo || st['Class Roll No'] || '—');
        const sReg = String(st.boardRegNo || st.regNo || item.rawReg || '—');

        const payload = {};
        allFieldDefinitions.forEach(f => {
          if (!selectedFields[f.key]) return;
          const incVal = inc[f.key];
          if (!incVal) return;

          f.dbKeys.forEach(k => {
            payload[k] = incVal;
          });
        });

        // Ensure student name is overwritten across all database key variations
        if (selectedFields['studentName'] && inc['studentName']) {
          const cleanStudentName = toTitleCase(formatConsistentName(inc['studentName']));
          payload['studentName'] = cleanStudentName;
          payload["Student's Name"] = cleanStudentName;
          payload["Student's Name (as per school records)"] = cleanStudentName;
          payload['Student Name'] = cleanStudentName;
          payload['name'] = cleanStudentName;
        }

        // Ensure father's name is overwritten across all database key variations
        if (selectedFields['fatherName'] && inc['fatherName']) {
          const cleanFatherName = toTitleCase(formatConsistentName(inc['fatherName']));
          payload['fatherName'] = cleanFatherName;
          payload["Father's Name"] = cleanFatherName;
          payload["Father's/Guardian's Name (as per school records)"] = cleanFatherName;
          payload["Father's/Guardian's Name"] = cleanFatherName;
          payload['Father Name'] = cleanFatherName;
          payload["Parent's Name"] = cleanFatherName;
        }

        // Ensure mother's name is overwritten across all database key variations
        if (selectedFields['motherName'] && inc['motherName']) {
          const cleanMotherName = toTitleCase(formatConsistentName(inc['motherName']));
          payload['motherName'] = cleanMotherName;
          payload["Mother's Name"] = cleanMotherName;
          payload["Mother's Name (as per school records)"] = cleanMotherName;
          payload['Mother Name'] = cleanMotherName;
        }

        // Ensure Form Number is synchronized across all database key variations
        if (selectedFields['formNo'] && inc['formNo']) {
          const cleanFormNo = String(inc['formNo']).replace(/^'/, '').trim();
          payload['formNo'] = cleanFormNo;
          payload['Form Number'] = cleanFormNo;
          payload['Form No.'] = cleanFormNo;
          payload['Form No'] = cleanFormNo;
          payload['fNo'] = cleanFormNo;
        }

        // Ensure Class Roll Number is synchronized across all database key variations
        if (selectedFields['classRollNo'] && inc['classRollNo']) {
          const cleanRoll = String(inc['classRollNo']).trim();
          payload['classRollNo'] = cleanRoll;
          payload['Class Roll No'] = cleanRoll;
          payload['Class Roll No.'] = cleanRoll;
          payload['rollNo'] = cleanRoll;
          payload['RL. NO.'] = cleanRoll;
          payload['Class R.No.'] = cleanRoll;
        }

        // Ensure Board Examination Roll Number is synchronized across all database key variations
        if (selectedFields['boardRollNo'] && inc['boardRollNo']) {
          const cleanExamRoll = String(inc['boardRollNo']).replace(/\.0+$/, '').trim();
          payload['boardRollNo'] = cleanExamRoll;
          payload['currExamRollNo'] = cleanExamRoll;
          payload['examRollNo'] = cleanExamRoll;
          payload['Exam R.No. (Current)'] = cleanExamRoll;
          payload['Exam R. No. (Current)'] = cleanExamRoll;
          payload['Board Roll Number'] = cleanExamRoll;
          payload['Board Roll No.'] = cleanExamRoll;
        }

        // Ensure Student Aadhaar Number is synchronized across all database key variations
        if (selectedFields['aadhaarNo'] && inc['aadhaarNo']) {
          const cleanAadhaar = String(inc['aadhaarNo']).replace(/\D/g, '').trim();
          payload['aadhaarNo'] = cleanAadhaar;
          payload['aadhaar'] = cleanAadhaar;
          payload['aadhar'] = cleanAadhaar;
          payload['Aadhaar Number (12 Digits)'] = cleanAadhaar;
          payload['Aadhaar Number'] = cleanAadhaar;
          payload['Aadhaar No'] = cleanAadhaar;
          payload['Aadhar No.'] = cleanAadhaar;
          payload['Student Aadhaar Number'] = cleanAadhaar;
        }

        // End-to-End Bidirectional Synchronize Subject Slots, Composite Strings & Tier Fields
        const hasSubjOverwrite = 
          selectedFields['subjects'] || selectedFields['Subjects'] ||
          selectedFields['subjects1'] || selectedFields['Subjects1'] || selectedFields['subject1'] ||
          selectedFields['subjects2'] || selectedFields['Subjects2'] || selectedFields['subject2'] ||
          selectedFields['subjects3'] || selectedFields['Subjects3'] || selectedFields['subject3'] ||
          selectedFields['subjects4'] || selectedFields['Subjects4'] || selectedFields['subject4'] ||
          selectedFields['subjects5'] || selectedFields['Subjects5'] || selectedFields['subject5'] ||
          selectedFields['subjects6'] || selectedFields['Subjects6'] || selectedFields['subject6'] || selectedFields['Subject6'];

        if (hasSubjOverwrite) {
          const existingIndiv = extractIndividualSubjectsList(st, targetClass);
          let s1 = inc['subjects1'] || inc['Subjects1'] || inc['subject1'] || payload['subjects1'] || payload['Subjects1'] || existingIndiv[0] || '';
          let s2 = inc['subjects2'] || inc['Subjects2'] || inc['subject2'] || payload['subjects2'] || payload['Subjects2'] || existingIndiv[1] || '';
          let s3 = inc['subjects3'] || inc['Subjects3'] || inc['subject3'] || payload['subjects3'] || payload['Subjects3'] || existingIndiv[2] || '';
          let s4 = inc['subjects4'] || inc['Subjects4'] || inc['subject4'] || payload['subjects4'] || payload['Subjects4'] || existingIndiv[3] || '';
          let s5 = inc['subjects5'] || inc['Subjects5'] || inc['subject5'] || payload['subjects5'] || payload['Subjects5'] || existingIndiv[4] || '';
          let s6 = inc['subjects6'] || inc['Subjects6'] || inc['Subject6'] || inc['subject6'] || payload['subjects6'] || payload['Subjects6'] || payload['Subject6'] || existingIndiv[5] || '';

          // If composite subjects field was provided, split into individual slots if slots were not all explicit
          const incComposite = inc['subjects'] || inc['Subjects'] || payload['Subjects'] || payload['subjects'];
          if (incComposite && (selectedFields['subjects'] || selectedFields['Subjects'])) {
            const parsedSlots = cleanRawSubjectTokens(incComposite);
            if (parsedSlots[0]) s1 = parsedSlots[0];
            if (parsedSlots[1]) s2 = parsedSlots[1];
            if (parsedSlots[2]) s3 = parsedSlots[2];
            if (parsedSlots[3]) s4 = parsedSlots[3];
            if (parsedSlots[4]) s5 = parsedSlots[4];
            if (parsedSlots[5]) s6 = parsedSlots[5];
          }

          // Expand short codes
          s1 = expandJkboseSubjectCodes(s1) || s1;
          s2 = expandJkboseSubjectCodes(s2) || s2;
          s3 = expandJkboseSubjectCodes(s3) || s3;
          s4 = expandJkboseSubjectCodes(s4) || s4;
          s5 = expandJkboseSubjectCodes(s5) || s5;
          s6 = expandJkboseSubjectCodes(s6) || s6;

          let activeSubList = [s1, s2, s3, s4, s5, s6].map(s => String(s || '').trim()).filter(s => s && s !== '—' && s !== '-');

          // Secondary Class Intelligence (Classes 9th & 10th):
          // In JKBOSE, all secondary students take Urdu as their 5th compulsory core language subject (unless Hindi is opted).
          const stCls = payload['class'] || payload['Class'] || st.class || st.Class || targetClass;
          const isSec = String(stCls).includes('9') || String(stCls).includes('10');
          if (isSec) {
            const hasUrduOrHindi = activeSubList.some(s => /\b(urdu|hindi)\b/i.test(s));
            if (!hasUrduOrHindi) {
              if (!s5 || s5 === '—' || s5 === '-') {
                s5 = 'Urdu';
              } else if (!s6 || s6 === '—' || s6 === '-') {
                s6 = 'Urdu';
              }
              if (!activeSubList.includes('Urdu')) {
                activeSubList.push('Urdu');
              }
            }
          }

          const finalSubStr = activeSubList.join(', ');

          if (activeSubList.length > 0) {
            // Write all casing variants for individual slots
            payload['subjects1'] = s1; payload['Subjects1'] = s1; payload['subject1'] = s1; payload['Subject 1'] = s1;
            payload['subjects2'] = s2; payload['Subjects2'] = s2; payload['subject2'] = s2; payload['Subject 2'] = s2;
            payload['subjects3'] = s3; payload['Subjects3'] = s3; payload['subject3'] = s3; payload['Subject 3'] = s3;
            payload['subjects4'] = s4; payload['Subjects4'] = s4; payload['subject4'] = s4; payload['Subject 4'] = s4;
            payload['subjects5'] = s5; payload['Subjects5'] = s5; payload['subject5'] = s5; payload['Subject 5'] = s5;
            payload['subjects6'] = s6; payload['Subjects6'] = s6; payload['Subject6'] = s6; payload['subject6'] = s6; payload['Subject 6'] = s6;

            // Write composite strings
            payload['Subjects'] = finalSubStr;
            payload['subjects'] = finalSubStr;
            payload['Subs'] = finalSubStr;
            payload['subs'] = finalSubStr;
            payload['selectedSubjects'] = activeSubList;

            // Write class tier specific subject fields
            const isSenior = String(stCls).includes('11') || String(stCls).includes('12');
            if (!isSenior) {
              payload['Subjects to be taken in Class 10th'] = finalSubStr;
              payload['Subjects to be taken in Class 9th'] = finalSubStr;
              payload['Subjects Studied in Class 10th'] = finalSubStr;
              payload['Subjects Studied in Class 9th'] = finalSubStr;
              payload['Stream'] = 'General';
              payload['stream'] = 'General';
            } else {
              if (String(stCls).includes('12')) {
                payload['Subjects to be taken in Class 12th'] = finalSubStr;
                payload['Stream & Subjects for Class 12th'] = finalSubStr;
              } else {
                payload['Subjects to be taken in Class 11th'] = finalSubStr;
                payload['Stream & Subjects for Class 11th'] = finalSubStr;
                payload['Subjects Studied in Class 11th'] = finalSubStr;
              }
              // Auto resolve stream if not present
              if (!payload['Stream'] && !payload['stream']) {
                const subStrLower = finalSubStr.toLowerCase();
                let autoStream = 'Arts';
                if (subStrLower.includes('biology') || subStrLower.includes('botany') || subStrLower.includes('zoology')) {
                  autoStream = 'Medical';
                } else if (subStrLower.includes('mathematics') && (subStrLower.includes('physics') || subStrLower.includes('chemistry'))) {
                  autoStream = 'Non-Medical';
                } else if (subStrLower.includes('accountancy') || subStrLower.includes('business studies')) {
                  autoStream = 'Commerce';
                }
                payload['Stream'] = autoStream;
                payload['stream'] = autoStream;
              }
            }
          }
        }

        // Auto-calculate Percentage and Division if marks and maxMarks are available
        const finalMarks = payload['Marks Obtained'] || payload['marks'] || st.marks || st['Marks Obtained'] || st['Marks/Reapp (Current)'];
        const finalMax = payload['Max Marks'] || payload['maxMarks'] || st.maxMarks || st['Max Marks'] || '500';
        const finalRes = payload['Result (Current)'] || payload['result'] || st.result || st['Result (Current)'] || 'Qualified';
        if (finalMarks) {
          const parsed = parseJkboseMarks(finalMarks, finalMax, finalRes);
          if (parsed.pctStr !== '—') {
            payload['Percentage'] = parsed.pctStr;
            payload['percentage'] = parsed.pctStr;
            payload['%age'] = parsed.pctStr;
            payload['%age (Current)'] = parsed.pctStr;
          }
          if (parsed.division !== '—') {
            payload['Div/Distinc (Current)'] = parsed.division;
            payload['Division'] = parsed.division;
            payload['division'] = parsed.division;
            payload['Grade'] = parsed.division;
            payload['grade'] = parsed.division;
          }
          if (parsed.formattedMarks) {
            if (payload['Marks/Reapp (Current)']) payload['Marks/Reapp (Current)'] = parsed.formattedMarks;
            if (payload['Marks Obtained']) payload['Marks Obtained'] = parsed.formattedMarks;
            if (payload['marks']) payload['marks'] = parsed.formattedMarks;
          }
        }

        const fieldsChangedKeys = Object.keys(item.diffs || {}).filter(k => {
          const norm = cleanKey(k);
          return !['boardregno', 'regno', 'boardregistrationnumber', 'boardreg', 'registrationno'].includes(norm);
        });
        const syncTimestamp = new Date().toISOString();
        const syncSource = fileName || 'JKBOSE Board Overwrite';

        const existingJkboseFields = Array.isArray(st.jkboseUpdatedFields)
          ? st.jkboseUpdatedFields
          : (Array.isArray(st.jkbose_updated_fields) ? st.jkbose_updated_fields : []);

        const existingFieldUpdates = (st.jkboseFieldUpdates && typeof st.jkboseFieldUpdates === 'object')
          ? st.jkboseFieldUpdates
          : {};

        const mergedUpdates = { ...existingFieldUpdates };
        // Purge any stale or legacy boardRegNo/regNo tracking so registration numbers never show update badges
        delete mergedUpdates.boardRegNo;
        delete mergedUpdates.regNo;
        delete mergedUpdates['Board Registration Number'];
        delete mergedUpdates['Board Reg. No.'];

        fieldsChangedKeys.forEach(k => {
          const diffItem = item.diffs[k];
          mergedUpdates[k] = {
            updatedAt: syncTimestamp,
            source: syncSource,
            label: diffItem?.fieldLabel || k,
            oldValue: String(diffItem?.currentValue ?? ''),
            newValue: String(diffItem?.incomingValue ?? '')
          };
        });

        const mergedJkboseFields = Array.from(new Set([...existingJkboseFields, ...fieldsChangedKeys])).filter(k => {
          const norm = cleanKey(k);
          return !['boardregno', 'regno', 'boardregistrationnumber', 'boardreg', 'registrationno'].includes(norm);
        });

        payload.jkboseUpdatedFields = mergedJkboseFields;
        payload.jkboseFieldUpdates = mergedUpdates;
        payload.jkboseLastSyncedAt = syncTimestamp;
        payload.jkboseSyncSource = syncSource;
        payload.updatedAt = syncTimestamp;
        payload.lastBoardSyncAt = syncTimestamp;
        payload.boardSyncSource = syncSource;

        let docKey = 'admissions_single';
        try {
          const loc = recordLocator(st);
          docKey = `${loc.collection}_${loc.documentId}`;
        } catch {
          docKey = String(st.docId || st.id || st.formNo || i);
        }

        return {
          index: i,
          item,
          student: st,
          payload,
          docKey,
          sName,
          sRoll,
          sReg
        };
      };

      // Group tasks by physical database document
      // (ensures chunked documents are patched sequentially to prevent transaction collisions,
      // while distinct documents run concurrently across parallel workers)
      const docQueuesMap = new Map();
      rowsToExecute.forEach((item, idx) => {
        const task = buildTaskPayload(item, idx);
        if (!docQueuesMap.has(task.docKey)) {
          docQueuesMap.set(task.docKey, []);
        }
        docQueuesMap.get(task.docKey).push(task);
      });

      const docQueues = Array.from(docQueuesMap.values());
      let queueIdx = 0;
      const CONCURRENCY = 5;

      const runWorker = async () => {
        while (queueIdx < docQueues.length) {
          if (abortExecutionRef.current) break;
          const currentQueue = docQueues[queueIdx++];
          for (const task of currentQueue) {
            if (abortExecutionRef.current) break;

            await applyRecordPatch(task.student, task.payload, {
              jobId,
              entryId: String(task.index),
              force: true,
              skipCacheInvalidation: true
            });

            updatedCount++;
            const pct = Math.round((updatedCount / rowsToExecute.length) * 100);
            setProgressPercent(pct);
            setProgressStage(`Overwriting records (${updatedCount} of ${rowsToExecute.length}): ${task.sName}...`);

            const fieldsChanged = Object.keys(task.item.diffs || {}).length;
            setExecutionLogs(prev => [
              {
                id: `log_${task.index}_${Date.now()}`,
                name: task.sName,
                roll: task.sRoll,
                reg: task.sReg,
                fieldsCount: fieldsChanged,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
              },
              ...prev.slice(0, 8)
            ]);

            // Yield to event loop
            await new Promise(r => setTimeout(r, 0));
          }
        }
      };

      const workerPromises = [];
      const numWorkers = Math.min(CONCURRENCY, docQueues.length);
      for (let w = 0; w < numWorkers; w++) {
        workerPromises.push(runWorker());
      }
      await Promise.all(workerPromises);

      await completeMutationJob(jobId);

      // Invalidate memory & persistent multi-tier caches once at the end of the batch
      try {
        invalidateCache('admissions');
        invalidateCache('masterRegisters');
        invalidateStudentCaches();
      } catch (cacheErr) {
        console.warn('Cache invalidation warning after bulk overwrite:', cacheErr);
      }

      // Log Admin Activity
      await logAdminActivity({
        actionType: 'bulk_field_overwrite',
        actionTitle: 'Board Data Bulk Field Overwrite',
        details: `Successfully synchronized and overwritten verified Board fields for ${updatedCount} students (${targetClass}, ${targetSession}) from ${fileName || 'Excel Sheet'}`,
        reasonCategory: 'Board Data Sync & Record Verification',
        metadata: {
          count: updatedCount,
          fields: Object.keys(selectedFields).filter(k => selectedFields[k]),
          session: targetSession,
          class: targetClass,
          abortedEarly: abortExecutionRef.current
        }
      });

      window.dispatchEvent(new CustomEvent('hss-results-updated'));
      window.dispatchEvent(new CustomEvent('hss-master-register-updated'));
      window.dispatchEvent(new CustomEvent('hss-admissions-updated'));

      setProgressPercent(100);
      setProgressStage(abortExecutionRef.current ? `Execution stopped safely. ${updatedCount} records updated.` : 'All fields successfully overwritten and synchronized!');
      setExecutionStats({ updatedCount });
      setStep('completed');

      if (onComplete) onComplete({ updatedCount });
      if (onIngestSuccess) onIngestSuccess({ updatedCount });
    } catch (err) {
      console.error('Execution error during bulk field overwrite:', err);
      setErrorMsg('Failed during overwrite execution: ' + err.message);
      setIsMinimized(false);
      setStep('preview');
    } finally {
      setIsAborting(false);
    }
  };

  if (!isOpen && !isPage) return null;

  // Floating Minimized Background Dock Widget (leaves website 100% interactive across all modules and tabs)
  if (isMinimized && (isProcessingRows || step === 'executing' || step === 'completed')) {
    const isCompleted = step === 'completed';
    const widgetContent = (
      <div className="fixed bottom-5 right-5 z-[99999] bg-white/95 dark:bg-slate-900/95 border border-emerald-500/50 shadow-2xl rounded-2xl p-3.5 flex flex-col gap-2.5 w-80 sm:w-96 backdrop-blur-md animate-slideUp transition-all select-none">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className={`w-7 h-7 rounded-lg ${isCompleted ? 'bg-emerald-600 text-white' : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400'} flex items-center justify-center flex-shrink-0 shadow-2xs`}>
              {isCompleted ? <CheckCircle2 size={15} /> : <RefreshCw size={13} className="animate-spin" />}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5 truncate">
                <span>{isCompleted ? 'Overwrite Completed' : (isProcessingRows ? 'Verifying Cohort Data' : 'Syncing Database Records')}</span>
                <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 font-mono bg-emerald-50 dark:bg-emerald-950/80 px-1 py-0.2 rounded">
                  {isCompleted ? '100%' : (isProcessingRows ? `${parsingProgress.percent}%` : `${progressPercent}%`)}
                </span>
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                {isCompleted 
                  ? `${executionStats?.updatedCount !== undefined ? executionStats.updatedCount : progressPercent} student record(s) synchronized`
                  : (isProcessingRows 
                    ? `${parsingProgress.current} of ${parsingProgress.total} evaluated`
                    : `${progressStage || 'Applying transactional updates...'}`)}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              type="button"
              onClick={handleMaximize}
              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer shadow-2xs text-[11px] font-bold flex items-center gap-1"
              title="Expand to full sync dialog"
            >
              <Maximize2 size={12} />
              <span>Expand</span>
            </button>
            {isCompleted && (
              <button
                type="button"
                onClick={() => {
                  setIsMinimized(false);
                  setStep('upload');
                }}
                className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 transition-colors cursor-pointer"
                title="Dismiss"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Mini progress bar */}
        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-200 dark:border-slate-700/60 shadow-inner">
          <div 
            className="bg-gradient-to-r from-emerald-600 via-teal-500 to-cyan-400 h-full rounded-full transition-all duration-300"
            style={{ width: `${isCompleted ? 100 : (isProcessingRows ? parsingProgress.percent : progressPercent)}%` }}
          />
        </div>

        {/* Lock indicator & safe abort */}
        <div className="flex items-center justify-between text-[10px] pt-1 border-t border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center gap-1 font-bold text-amber-600 dark:text-amber-400">
            {isCompleted ? (
              <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <BookmarkCheck size={11} />
                <span>Ready for inspection</span>
              </span>
            ) : (
              <>
                <Lock size={10} />
                <span>View-Only Mode • Edits Locked</span>
              </>
            )}
          </div>
          {!isCompleted && step === 'executing' && (
            isAborting ? (
              <span className="text-amber-600 font-bold">Stopping...</span>
            ) : (
              <button
                type="button"
                onClick={handleAbortExecution}
                className="text-rose-600 dark:text-rose-400 hover:underline font-bold cursor-pointer"
              >
                Stop Safely
              </button>
            )
          )}
        </div>
      </div>
    );

    return typeof document !== 'undefined' ? createPortal(widgetContent, document.body) : widgetContent;
  }

  const hubContent = (
    <div className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full ${isPage ? 'rounded-xl shadow-xs overflow-hidden flex flex-col' : 'max-w-5xl lg:max-w-6xl xl:max-w-7xl rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[96vh] sm:h-auto max-h-[96vh] sm:max-h-[92vh]'}`}>
        
        {/* Master Modal Header - Only shown in floating modal mode to eliminate duplicate title on dashboard */}
        {!isPage && (
          <div className="px-3.5 py-1.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-950/80 flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-md bg-emerald-700 text-white flex items-center justify-center shadow-2xs flex-shrink-0">
                <Database size={11} />
              </div>
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                  <span>Student Data & Board Ingestion Hub</span>
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                    Master Hub
                  </span>
                </h2>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer flex-shrink-0"
              aria-label="Close"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Master Mode Tabs Bar - Sleek Compact Pills */}
        <div className="px-2.5 py-1 sm:px-3 sm:py-1.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-1.5 flex-shrink-0 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-[11px] overflow-x-auto no-scrollbar max-w-full flex-shrink-0">
            <button
              type="button"
              onClick={() => setModalMode('overwrite')}
              className={`px-2.5 py-1 rounded-md font-bold flex items-center gap-1 cursor-pointer transition-all whitespace-nowrap flex-shrink-0 ${
                modalMode === 'overwrite'
                  ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 shadow-2xs font-black'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <FileSpreadsheet size={12} />
              <span>Bulk Overwrite</span>
            </button>

            <button
              type="button"
              onClick={() => setModalMode('express')}
              className={`px-2.5 py-1 rounded-md font-bold flex items-center gap-1 cursor-pointer transition-all whitespace-nowrap flex-shrink-0 ${
                modalMode === 'express'
                  ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 shadow-2xs font-black'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Plus size={12} />
              <span>Express Entry</span>
            </button>

            <button
              type="button"
              onClick={() => setModalMode('gazette_ai')}
              className={`px-2.5 py-1 rounded-md font-bold flex items-center gap-1 cursor-pointer transition-all whitespace-nowrap flex-shrink-0 ${
                modalMode === 'gazette_ai'
                  ? 'bg-white dark:bg-slate-900 text-purple-700 dark:text-purple-300 shadow-2xs font-black'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Sparkles size={12} />
              <span>Gazette AI</span>
            </button>

            <button
              type="button"
              onClick={() => setModalMode('admit_ai')}
              className={`px-2.5 py-1 rounded-md font-bold flex items-center gap-1 cursor-pointer transition-all whitespace-nowrap flex-shrink-0 ${
                modalMode === 'admit_ai'
                  ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow-2xs font-black'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Award size={12} />
              <span>Admit AI</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {toastMessage && (
              <div className="text-[10px] font-black text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-300 dark:border-emerald-800 animate-fadeIn">
                {toastMessage.msg}
              </div>
            )}
          </div>
        </div>

        {/* Modal Body Content */}
        <div className={`p-2 sm:p-3 flex-1 space-y-2.5 text-xs ${isPage ? '' : 'overflow-y-auto custom-scrollbar max-h-[calc(98vh-115px)] sm:max-h-[calc(94vh-130px)]'}`}>
          
          {/* ═════════ TAB 2: EXPRESS DIRECT INGESTION (SINGLE RECORD) ═════════ */}
          {modalMode === 'express' && (
            <ExpressDirectIngestionTab
              onRecordAdded={(record) => {
                if (onRecordAdded) onRecordAdded(record);
                if (onComplete) onComplete(record);
              }}
              onClose={onClose}
              allStudents={universalStudents}
              currentSession={currentSession}
              showToast={showToast}
            />
          )}

          {/* ═════════ TAB 3 & 4: GAZETTE AI OCR & ADMIT CARD AI ═════════ */}
          {(modalMode === 'gazette_ai' || modalMode === 'admit_ai') && (
            <GazetteAndAdmitAiTab
              mode={modalMode}
              allStudents={universalStudents}
              targetClass={targetClass !== 'All' ? targetClass : '12th'}
              targetSession={targetSession}
              onIngestSuccess={(res) => {
                if (onIngestSuccess) onIngestSuccess(res);
                if (onComplete) onComplete(res);
              }}
              showToast={showToast}
            />
          )}

          {/* ═════════ TAB 1: BULK OVERWRITE & BOARD SYNC ═════════ */}
          {modalMode === 'overwrite' && (
            <>
              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
                  <AlertTriangle size={15} className="shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* STEP 1: UPLOAD & FIELD SELECTION */}
              {step === 'upload' && (
                <div className="space-y-3">
                  {/* Compact Cohort Filters Toolbar */}
                  <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2 text-xs">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mr-0.5">Cohort:</span>
                      <CohortCheckboxDropdown
                        label="Class"
                        allLabel={`All Classes (${availableClasses.length})`}
                        options={availableClasses}
                        selected={selectedClasses}
                        onChange={(vals) => {
                          setSelectedClasses(vals);
                          try { sessionStorage.setItem('hss_last_selected_classes', JSON.stringify(vals)); } catch (_) {}
                        }}
                        presets={[
                          { label: '11th & 12th (Sr Sec)', values: ['11th', '12th'] },
                          { label: '9th & 10th (Secondary)', values: ['9th', '10th'] }
                        ]}
                        studentCounts={classStudentCounts}
                      />

                      <CohortCheckboxDropdown
                        label="Session"
                        allLabel={`All Sessions (${availableSessions.length})`}
                        options={availableSessions}
                        selected={selectedSessions}
                        onChange={(vals) => {
                          setSelectedSessions(vals);
                          try { sessionStorage.setItem('hss_last_selected_sessions', JSON.stringify(vals)); } catch (_) {}
                        }}
                        studentCounts={sessionStudentCounts}
                      />

                      <CohortCheckboxDropdown
                        label="Stream"
                        allLabel={`All Streams (${availableStreams.length})`}
                        options={availableStreams}
                        selected={selectedStreams}
                        onChange={setSelectedStreams}
                      />

                      <CohortCheckboxDropdown
                        label="Status"
                        allLabel={`All Statuses (${availableStatuses.length})`}
                        options={availableStatuses}
                        selected={selectedStatuses}
                        onChange={setSelectedStatuses}
                      />

                      {/* Live Cohort Candidates Counter Badge */}
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                        {matchingCohortStudents.length} Students
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={handleDownloadExcelTemplate}
                        className="px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-[11px] shadow-2xs flex items-center gap-1.5 cursor-pointer transition-colors shrink-0"
                        title="Download pre-filled Excel spreadsheet for this cohort"
                      >
                        <Download size={12} />
                        <span>Download Template ({matchingCohortStudents.length > 0 ? matchingCohortStudents.length : '.xlsx'})</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsImportExpanded(prev => {
                            const next = !prev;
                            if (next) {
                              setTimeout(() => {
                                const el = document.getElementById('hss-import-section');
                                if (el) el.scrollIntoView({ behavior: 'smooth' });
                              }, 60);
                            }
                            return next;
                          });
                        }}
                        className={`px-2.5 py-1 rounded-lg font-bold text-[11px] shadow-2xs flex items-center gap-1.5 cursor-pointer transition-all shrink-0 ${
                          isImportExpanded
                            ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 font-black'
                            : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900 border border-emerald-300 dark:border-emerald-800'
                        }`}
                        title="Expand or collapse the Import & Ingestion section"
                      >
                        <Upload size={12} />
                        <span>Import Data</span>
                        {isImportExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </button>
                    </div>
                  </div>

                  {/* Minimal Field Selection & Presets Bar */}
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-1.5">
                        <Sliders size={13} className="text-emerald-600" />
                        <span className="font-extrabold text-[11px] text-slate-900 dark:text-white">
                          Fields to Overwrite
                        </span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded-full font-black bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                          {activeFieldsList.length} active
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* Quick Presets */}
                        <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-md text-[10px] font-bold">
                          {hasCustomDefaults && (
                            <button
                              type="button"
                              onClick={() => handleSelectPreset('my_defaults')}
                              className="px-2 py-0.5 rounded hover:bg-white dark:hover:bg-slate-700 text-emerald-700 dark:text-emerald-300 cursor-pointer font-black flex items-center gap-1"
                              title="Restore your saved default column selection"
                            >
                              <BookmarkCheck size={11} />
                              <span>My Defaults</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleSelectPreset('exam_results')}
                            className="px-2 py-0.5 rounded hover:bg-white dark:hover:bg-slate-700 text-amber-700 dark:text-amber-300 cursor-pointer font-black"
                            title="Select Board Roll No, Result Status, Marks, and Division"
                          >
                            Exam Results
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSelectPreset('board_bio')}
                            className="px-2 py-0.5 rounded hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer"
                          >
                            Board Bio
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSelectPreset('bio_and_ids')}
                            className="px-2 py-0.5 rounded hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer"
                          >
                            Bio & IDs
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSelectPreset('all')}
                            className="px-1.5 py-0.5 rounded hover:bg-white dark:hover:bg-slate-700 text-emerald-700 dark:text-emerald-300 cursor-pointer font-bold"
                          >
                            All
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSelectPreset('none')}
                            className="px-1.5 py-0.5 rounded hover:bg-white dark:hover:bg-slate-700 text-rose-600 dark:text-rose-400 cursor-pointer"
                          >
                            Clear
                          </button>
                        </div>

                        {/* Save as Default Action */}
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={handleSaveAsDefault}
                            className="px-2 py-0.5 rounded-md bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/80 dark:hover:bg-emerald-900 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                            title="Save current checked columns as your default selection for future sessions"
                          >
                            <BookmarkCheck size={11} />
                            <span>Save as Default</span>
                          </button>

                          {hasCustomDefaults && (
                            <button
                              type="button"
                              onClick={handleResetToSystemDefaults}
                              className="px-1.5 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 text-[10px] font-bold flex items-center gap-0.5 cursor-pointer transition-colors"
                              title="Reset back to factory system default columns"
                            >
                              <RotateCcw size={10} />
                              <span>Reset</span>
                            </button>
                          )}
                        </div>

                        {/* Toggle Detailed Matrix */}
                        <button
                          type="button"
                          onClick={() => setShowFieldMatrix(!showFieldMatrix)}
                          className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          {showFieldMatrix ? <EyeOff size={11} /> : <Eye size={11} />}
                          <span>{showFieldMatrix ? 'Hide Checkboxes' : 'Customize Checkboxes'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Compact Horizontally Scrollable Selected Tags with direct 1-click removal */}
                    <div className="flex items-center gap-1.5 overflow-x-auto py-1 px-0.5 custom-scrollbar scroll-smooth">
                      {activeFieldsList.length > 0 ? (
                        activeFieldsList.map(f => (
                          <button 
                            key={f.key} 
                            type="button"
                            onClick={() => handleToggleField(f.key)}
                            className="px-2.5 py-1 rounded-full font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px] flex items-center gap-1.5 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300 transition-all group cursor-pointer whitespace-nowrap shrink-0 shadow-2xs"
                            title={`Click to remove ${f.label}`}
                          >
                            <span>{f.label}</span>
                            <span className="text-emerald-500 group-hover:text-rose-600 text-[11px] font-black leading-none">×</span>
                          </button>
                        ))
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400 font-bold text-[10px]">
                          ⚠️ No fields selected. Click a preset above (e.g. Exam Results or Board Bio).
                        </span>
                      )}
                    </div>

                    {/* Expandable Field Matrix (Spacious 3-Column Responsive Grid) */}
                    {showFieldMatrix && (
                      <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800 animate-fadeIn">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                          {dynamicDatabaseCategories.map(cat => {
                            const CatIcon = cat.icon || Database;
                            return (
                              <div 
                                key={cat.id} 
                                className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/60 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between"
                              >
                                <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-200/80 dark:border-slate-800">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <CatIcon size={14} className="text-slate-500 dark:text-slate-400 shrink-0" />
                                    <span className="font-extrabold text-[11.5px] text-slate-800 dark:text-slate-200 leading-tight">
                                      {cat.title}
                                    </span>
                                  </div>
                                  <span className={`text-[8.5px] font-black px-2 py-0.5 rounded-full border whitespace-nowrap shrink-0 shadow-2xs ${cat.badgeClass}`}>
                                    {cat.badge}
                                  </span>
                                </div>

                                <div className="space-y-0.5 overflow-y-auto max-h-40 pr-1 custom-scrollbar">
                                  {cat.fields.map(field => {
                                    const isChecked = Boolean(selectedFields[field.key]);
                                    return (
                                      <label
                                        key={field.key}
                                        className={`flex items-center gap-2 py-1 px-1.5 rounded-lg transition-colors cursor-pointer text-[10.5px] ${
                                          isChecked ? 'bg-emerald-50/60 dark:bg-emerald-950/30 font-bold text-slate-900 dark:text-white' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 font-normal text-slate-600 dark:text-slate-400'
                                        }`}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={() => handleToggleField(field.key)}
                                          className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer scale-95"
                                        />
                                        <span className="truncate">{field.label}</span>
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Add Custom Field Tool */}
                        <div className="flex items-center gap-1.5 pt-1">
                          <input
                            type="text"
                            value={customFieldInput}
                            onChange={(e) => setCustomFieldInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleAddCustomField(); }}
                            placeholder="Add custom database field name..."
                            className="px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-[10px] font-bold text-slate-900 dark:text-white outline-none flex-1 max-w-xs"
                          />
                          <button
                            type="button"
                            onClick={handleAddCustomField}
                            className="px-2 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-[10px] flex items-center gap-1 cursor-pointer"
                          >
                            <Plus size={11} />
                            <span>Add</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* EXPANDABLE INGESTION METHOD SELECTOR & DROPZONE */}
                  <div id="hss-import-section" className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden transition-all">
                    <button
                      type="button"
                      onClick={() => setIsImportExpanded(prev => !prev)}
                      className="w-full px-3.5 py-2.5 bg-slate-50/80 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800/80 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
                          <Upload size={13} />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-2 truncate">
                            <span>Import & Ingest Data</span>
                            <span className="text-[10px] font-bold text-slate-400">
                              • {ingestMethod === 'upload' ? 'Upload Spreadsheet' : 'Direct Copy-Paste Grid'}
                            </span>
                          </h3>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 text-xs font-bold">
                        <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-black">
                          {isImportExpanded ? 'Collapse' : 'Expand'}
                        </span>
                        {isImportExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </div>
                    </button>

                    {isImportExpanded && (
                      <div className="p-3.5 pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3 animate-fadeIn">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setIngestMethod('upload')}
                            className={`px-3 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
                              ingestMethod === 'upload'
                                ? 'bg-emerald-700 text-white font-black shadow-2xs'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                            }`}
                          >
                            <Upload size={12} />
                            <span>Upload Spreadsheet (.xlsx / .csv)</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setIngestMethod('grid')}
                            className={`px-3 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
                              ingestMethod === 'grid'
                                ? 'bg-emerald-700 text-white font-black shadow-2xs'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                            }`}
                          >
                            <Copy size={12} />
                            <span>Direct Copy-Paste Grid</span>
                          </button>
                        </div>

                        {/* METHOD A: SPREADSHEET FILE UPLOAD */}
                        {ingestMethod === 'upload' && (
                          <div className="p-4 rounded-xl border border-dashed border-emerald-400/80 dark:border-emerald-700/80 bg-emerald-50/40 dark:bg-emerald-950/20 text-center space-y-2 animate-fadeIn">
                            <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 flex items-center justify-center mx-auto shadow-2xs">
                              <Upload size={16} />
                            </div>
                            <div>
                              <h4 className="font-black text-xs text-slate-900 dark:text-white">
                                Drop Updated Board Spreadsheet Here (.xlsx / .csv)
                              </h4>
                              <p className="text-[10px] text-slate-500 font-medium">
                                Column 1 must be <strong>Board Registration Number</strong> for 100% authoritative matching.
                              </p>
                            </div>
                            <label className="inline-block px-4 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs shadow-2xs cursor-pointer transition-all active:scale-98">
                              <span>Browse Spreadsheet File</span>
                              <input
                                type="file"
                                accept=".xlsx,.xls,.csv"
                                onChange={handleFileUpload}
                                className="hidden"
                              />
                            </label>
                          </div>
                        )}

                        {/* METHOD B: EXCEL TABULAR SPREADSHEET GRID */}
                        {ingestMethod === 'grid' && (
                          <div className="animate-fadeIn">
                            <ExcelSpreadsheetGrid
                              activeFields={activeFieldsList}
                              onParseData={processIncomingRows}
                              allStudents={universalStudents}
                              targetClass={targetClass}
                              targetSession={targetSession}
                              targetStream={targetStream}
                              targetStatus={targetStatus}
                              showToast={showToast}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* STEP 2: SIDE-BY-SIDE PREVIEW & FIELD DIFF TABLE */}
              {step === 'preview' && (
                <div className="space-y-4 animate-fadeIn">
                  {/* Stats Toolbar */}
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-black text-xs text-slate-900 dark:text-white mr-1">
                        Correlated Preview:
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300">
                        {stats.total} File Rows
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                        {stats.changed} Ready for Overwrite
                      </span>
                      {stats.nameMismatches > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                          ⚠️ {stats.nameMismatches} Name Diff
                        </span>
                      )}
                      {stats.outOfCohort > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-800">
                          {stats.outOfCohort} Out of Cohort
                        </span>
                      )}
                      {stats.unmatched > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300">
                          {stats.unmatched} Unmatched
                        </span>
                      )}
                    </div>

                    {/* Filter Pills */}
                    <div className="flex items-center gap-1 bg-slate-200/80 dark:bg-slate-800 p-0.5 rounded-lg text-[10px] font-bold overflow-x-auto no-scrollbar flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => setPreviewFilter('changed')}
                        className={`px-2 py-0.5 rounded cursor-pointer whitespace-nowrap flex-shrink-0 ${previewFilter === 'changed' ? 'bg-white dark:bg-slate-900 text-emerald-700 font-black shadow-2xs' : 'text-slate-600 dark:text-slate-300'}`}
                      >
                        Changes Only ({stats.changed})
                      </button>
                      {stats.nameMismatches > 0 && (
                        <button
                          type="button"
                          onClick={() => setPreviewFilter('mismatches')}
                          className={`px-2 py-0.5 rounded cursor-pointer whitespace-nowrap flex-shrink-0 ${previewFilter === 'mismatches' ? 'bg-amber-500 text-white font-black shadow-2xs' : 'text-amber-700 dark:text-amber-300'}`}
                        >
                          Name Diff ({stats.nameMismatches})
                        </button>
                      )}
                      {stats.outOfCohort > 0 && (
                        <button
                          type="button"
                          onClick={() => setPreviewFilter('outOfCohort')}
                          className={`px-2 py-0.5 rounded cursor-pointer whitespace-nowrap flex-shrink-0 ${previewFilter === 'outOfCohort' ? 'bg-purple-600 text-white font-black shadow-2xs' : 'text-purple-700 dark:text-purple-300'}`}
                        >
                          Out of Cohort ({stats.outOfCohort})
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setPreviewFilter('all')}
                        className={`px-2 py-0.5 rounded cursor-pointer whitespace-nowrap flex-shrink-0 ${previewFilter === 'all' ? 'bg-white dark:bg-slate-900 text-blue-700 font-black shadow-2xs' : 'text-slate-600 dark:text-slate-300'}`}
                      >
                        All ({stats.total})
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewFilter('unmatched')}
                        className={`px-2 py-0.5 rounded cursor-pointer whitespace-nowrap flex-shrink-0 ${previewFilter === 'unmatched' ? 'bg-white dark:bg-slate-900 text-rose-700 font-black shadow-2xs' : 'text-slate-600 dark:text-slate-300'}`}
                      >
                        Unmatched ({stats.unmatched})
                      </button>
                    </div>
                  </div>

                  {/* Diff Table */}
                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto max-h-[420px] custom-scrollbar">
                    <table className="w-full min-w-[640px] text-left border-collapse text-xs">
                      <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold sticky top-0 z-10">
                        <tr className="border-b border-slate-200 dark:border-slate-700">
                          <th className="p-2 text-center w-8 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleSelectAllFiltered(selectedRowIds.size === 0)}
                              className="cursor-pointer text-slate-600"
                            >
                              {selectedRowIds.size > 0 ? <CheckSquare size={13} /> : <Square size={13} />}
                            </button>
                          </th>
                          <th 
                            onClick={() => handleTogglePreviewSort('regNo')}
                            className="p-2 cursor-pointer select-none hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors whitespace-nowrap min-w-[130px]"
                            title="Click to sort by Registration No"
                          >
                            <div className="flex items-center gap-1">
                              <span>Reg No (Col 1)</span>
                              {previewSortColumn === 'regNo' ? (
                                previewSortDirection === 'asc' ? <ChevronUp size={13} className="text-blue-600" /> : <ChevronDown size={13} className="text-blue-600" />
                              ) : (
                                <ChevronDown size={12} className="text-slate-400 opacity-40 hover:opacity-100" />
                              )}
                            </div>
                          </th>
                          <th 
                            onClick={() => handleTogglePreviewSort('rollNo')}
                            className="p-2 cursor-pointer select-none hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors whitespace-nowrap min-w-[190px]"
                            title="Click to toggle sorting by Class Roll No / Student Name"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 whitespace-nowrap">
                                <span>Database Matched Student</span>
                                {previewSortColumn === 'rollNo' ? (
                                  <span className="text-[9px] font-black px-1.5 py-0.5 bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 rounded-md border border-blue-200 dark:border-blue-800 flex items-center gap-0.5">
                                    Roll No {previewSortDirection === 'asc' ? '↑' : '↓'}
                                  </span>
                                ) : previewSortColumn === 'name' ? (
                                  <span className="text-[9px] font-black px-1.5 py-0.5 bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 rounded-md border border-blue-200 dark:border-blue-800 flex items-center gap-0.5">
                                    Name {previewSortDirection === 'asc' ? '↑' : '↓'}
                                  </span>
                                ) : (
                                  <span className="text-[9px] text-slate-400 font-normal">
                                    (Sorted by Roll No)
                                  </span>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleTogglePreviewSort('name');
                                }}
                                className={`text-[9px] px-1.5 py-0.5 rounded cursor-pointer transition-colors whitespace-nowrap ${previewSortColumn === 'name' ? 'bg-blue-600 text-white font-bold' : 'text-slate-500 hover:bg-slate-300 dark:hover:bg-slate-600'}`}
                                title="Sort alphabetically by Student Name"
                              >
                                By Name
                              </button>
                            </div>
                          </th>
                          <th 
                            onClick={() => handleTogglePreviewSort('diffs')}
                            className="p-2 cursor-pointer select-none hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors min-w-[240px]"
                            title="Click to sort by number of modified fields"
                          >
                            <div className="flex items-center gap-1 whitespace-nowrap">
                              <span>Field Modifications (Old ➔ New)</span>
                              {previewSortColumn === 'diffs' ? (
                                previewSortDirection === 'asc' ? <ChevronUp size={13} className="text-blue-600" /> : <ChevronDown size={13} className="text-blue-600" />
                              ) : (
                                <ChevronDown size={12} className="text-slate-400 opacity-40 hover:opacity-100" />
                              )}
                            </div>
                          </th>
                          <th className="p-2 text-center w-16 whitespace-nowrap">Inspect</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {filteredPreview.map(r => {
                          const isSelected = selectedRowIds.has(r.id);
                          const diffKeys = Object.keys(r.diffs);

                          return (
                            <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                              <td className="p-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleToggleRow(r.id)}
                                  disabled={r.isUnmatched}
                                  className="cursor-pointer text-emerald-600 disabled:opacity-30"
                                >
                                  {isSelected ? <CheckSquare size={13} /> : <Square size={13} className="text-slate-400" />}
                                </button>
                              </td>
                              <td className="p-2 font-mono font-bold text-slate-800 dark:text-slate-200">
                                {r.rawReg}
                              </td>
                              <td className="p-2">
                                {r.matchedStudent ? (
                                  <div className="space-y-0.5">
                                    <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 flex-wrap">
                                      <span className="text-[12px]">{getStudentDisplayName(r.matchedStudent)}</span>
                                      {getStudentDisplayFather(r.matchedStudent) && (
                                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">
                                          S/D of {getStudentDisplayFather(r.matchedStudent)}
                                        </span>
                                      )}
                                      {r.hasNameMismatch && (
                                        <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700" title={r.nameMismatchWarning}>
                                          ⚠️ Name in File: {r.rawName}
                                        </span>
                                      )}
                                      {r.matchedByName && (
                                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-700">
                                          Matched by Name
                                        </span>
                                      )}
                                      {r.isOutOfCohort && (
                                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-700" title={r.outOfCohortNotice}>
                                          ⚠️ Out of Cohort
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400 flex-wrap">
                                      <span className="px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 font-semibold text-slate-700 dark:text-slate-300">
                                        Class: <strong className="text-slate-900 dark:text-slate-100">{getStudentDisplayClass(r.matchedStudent)}</strong>
                                      </span>
                                      <span className="px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 font-semibold text-slate-700 dark:text-slate-300">
                                        Session: <strong className="text-slate-900 dark:text-slate-100">{getStudentDisplaySession(r.matchedStudent)}</strong>
                                      </span>
                                      {getStudentProperStream(r.matchedStudent) && getStudentProperStream(r.matchedStudent) !== '—' && (
                                        <span className="px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 font-semibold text-slate-700 dark:text-slate-300">
                                          Stream: <strong className="text-slate-900 dark:text-slate-100">{getStudentProperStream(r.matchedStudent)}</strong>
                                        </span>
                                      )}
                                      {getStudentDisplayRollNo(r.matchedStudent) !== '—' && (
                                        <span className="px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 font-semibold text-slate-700 dark:text-slate-300">
                                          Roll: <strong className="text-slate-900 dark:text-slate-100">{getStudentDisplayRollNo(r.matchedStudent)}</strong>
                                        </span>
                                      )}
                                      <span className="text-slate-400">
                                        Form: <strong className="text-slate-600 dark:text-slate-300">{getStudentDisplayFormNo(r.matchedStudent)}</strong>
                                      </span>
                                    </div>
                                  </div>
                                ) : r.isOutOfCohort ? (
                                  <div>
                                    <span className="text-purple-600 dark:text-purple-400 font-bold text-[11px] flex items-center gap-1">
                                      ⚠️ Out of Cohort
                                    </span>
                                    <div className="text-[10px] text-slate-400">
                                      {r.outOfCohortNotice}
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-rose-500 font-bold text-[11px]">
                                    ⚠️ Not Found in Database
                                  </span>
                                )}
                              </td>
                              <td className="p-2">
                                {diffKeys.length > 0 ? (
                                  <div className="flex flex-wrap gap-1.5 max-w-lg">
                                    {diffKeys.map(k => {
                                      const d = r.diffs[k];
                                      return (
                                        <div key={k} className="p-1 rounded bg-slate-100 dark:bg-slate-800 text-[10px] border border-slate-200 dark:border-slate-700">
                                          <span className="font-black text-slate-500 mr-1">{d.fieldLabel}:</span>
                                          <span className="line-through text-rose-500 mr-1">{d.currentValue}</span>
                                          <span className="text-slate-400 mr-1">➔</span>
                                          <span className="font-black text-emerald-600 dark:text-emerald-400">{d.incomingValue}</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <span className="text-slate-400 text-[11px] font-medium">
                                    Identical values (No changes needed)
                                  </span>
                                )}
                              </td>
                              <td className="p-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => setInspectStudent(r)}
                                  className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-900 cursor-pointer"
                                  title="Inspect student diff"
                                >
                                  <Eye size={13} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}

                        {filteredPreview.length === 0 && (
                          <tr>
                            <td colSpan={5} className="p-8 text-center">
                              <div className="flex flex-col items-center justify-center gap-2 max-w-md mx-auto">
                                {previewFilter === 'changed' ? (
                                  <>
                                    <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-950/80 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                                      <CheckCircle2 size={24} />
                                    </div>
                                    <span className="font-bold text-sm text-slate-800 dark:text-slate-100">
                                      All {stats.total} Records Are Already Up to Date!
                                    </span>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                      All {stats.total} student records in this file matched the database with <strong>0 differences</strong>. The exam roll numbers and selected fields already match the database exactly.
                                    </p>
                                    <button
                                      type="button"
                                      onClick={() => setPreviewFilter('all')}
                                      className="mt-2 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-bold text-xs hover:bg-blue-100 dark:hover:bg-blue-800/40 transition-colors cursor-pointer border border-blue-200 dark:border-blue-800"
                                    >
                                      View All {stats.total} Matched Records
                                    </button>
                                  </>
                                ) : previewFilter === 'unmatched' ? (
                                  <>
                                    <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-950/80 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                                      <CheckCircle2 size={24} />
                                    </div>
                                    <span className="font-bold text-sm text-slate-800 dark:text-slate-100">
                                      0 Unmatched Candidates
                                    </span>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                      Every candidate in this file was successfully matched to a database record.
                                    </p>
                                  </>
                                ) : (
                                  <span className="text-slate-400 text-xs">No records found for the selected filter.</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => setStep('upload')}
                      className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer hover:bg-slate-100"
                    >
                      Back to Settings
                    </button>

                    <button
                      type="button"
                      onClick={executeOverwrite}
                      disabled={selectedRowIds.size === 0}
                      className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-black text-xs shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                    >
                      <CheckCircle2 size={14} />
                      <span>Execute Verified Overwrite ({selectedRowIds.size} Records)</span>
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: EXECUTING OVERWRITE */}
              {step === 'executing' && (
                <div className="p-10 text-center space-y-4 animate-fadeIn">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 flex items-center justify-center mx-auto animate-spin">
                    <RefreshCw size={24} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">
                      Synchronizing Verified Board Fields into Database
                    </h3>
                    <p className="text-xs text-slate-500">{progressStage}</p>
                  </div>
                  <div className="w-full max-w-md mx-auto bg-slate-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden">
                    <div 
                      className="bg-emerald-600 h-full transition-all duration-300"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              )}

              {/* STEP 4: COMPLETED */}
              {step === 'completed' && (
                <div className="p-10 text-center space-y-4 animate-fadeIn">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center mx-auto shadow-lg">
                    <Check size={26} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-white">
                      Synchronization Complete!
                    </h3>
                    <p className="text-xs text-slate-500 max-w-md mx-auto">
                      Successfully updated {executionStats?.updatedCount || 0} student record(s) in Firebase Firestore and created a 30-day rollback point.
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={handleResetToUpload}
                      className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-black text-xs shadow-md cursor-pointer flex items-center gap-2 transition-all hover:scale-[1.02]"
                    >
                      <RotateCcw size={14} />
                      <span>Ingest / Overwrite Another Class</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleClose}
                      className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs border border-slate-300 dark:border-slate-700 cursor-pointer transition-colors"
                    >
                      Done & Close Hub
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

        </div>

        {/* Modal Footer for Overwrite Mode - Slim & Minimal */}
        {modalMode === 'overwrite' && step === 'upload' && (
          <div className="px-3.5 py-1.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-950/50 text-[11px] flex-shrink-0">
            <div className="text-slate-500 font-medium">
              Target: <strong className="text-slate-800 dark:text-slate-200">{targetClass}</strong> • Session <strong className="text-slate-800 dark:text-slate-200">{targetSession}</strong> • <strong className="text-emerald-600 dark:text-emerald-400">{matchingCohortStudents.length} candidate(s) loaded</strong>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="px-3 py-1 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-[11px] cursor-pointer transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

      </div>
  );

  // Inspect Student Profile Diff Modal
  const inspectModalNode = inspectStudent ? (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
              <div>
                <h3 className="text-xs font-black text-slate-900 dark:text-white">
                  Student Field Diff (Old vs New)
                </h3>
                <p className="text-[11px] text-slate-500 font-mono">
                  {inspectStudent.rawReg} • {getStudentDisplayName(inspectStudent.matchedStudent)} (Class {getStudentDisplayClass(inspectStudent.matchedStudent)} • Session {getStudentDisplaySession(inspectStudent.matchedStudent)})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectStudent(null)}
                className="p-1 rounded text-slate-400 hover:text-slate-700"
              >
                <X size={15} />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-2 text-xs">
              {allFieldDefinitions.filter(f => selectedFields[f.key]).map(f => {
                const diff = inspectStudent.diffs[f.key];
                const incVal = inspectStudent.incomingFields[f.key];
                let currentVal = '';
                if (inspectStudent.matchedStudent) {
                  for (const k of f.dbKeys) {
                    if (inspectStudent.matchedStudent[k] !== undefined && String(inspectStudent.matchedStudent[k]).trim() !== '') {
                      currentVal = String(inspectStudent.matchedStudent[k]).trim();
                      break;
                    }
                  }
                }
                const hasDiff = Boolean(diff);

                return (
                  <div key={f.key} className={`p-2 rounded-xl border grid grid-cols-2 gap-2 ${hasDiff ? 'bg-emerald-50/40 border-emerald-300 dark:border-emerald-800' : 'bg-slate-50 border-slate-200 dark:border-slate-800'}`}>
                    <div>
                      <div className="text-[9px] font-black uppercase text-slate-400">{f.label} (Current)</div>
                      <div className={`font-bold ${hasDiff ? 'line-through text-rose-600' : 'text-slate-700 dark:text-slate-300'}`}>{currentVal || '—'}</div>
                    </div>
                    <div>
                      <div className="text-[9px] font-black uppercase text-slate-400">Incoming Board</div>
                      <div className={`font-bold ${hasDiff ? 'text-emerald-700 dark:text-emerald-400 font-black' : 'text-slate-500'}`}>{incVal || '—'}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="px-5 py-2 border-t border-slate-200 dark:border-slate-800 flex justify-end bg-slate-50 dark:bg-slate-950">
              <button
                type="button"
                onClick={() => setInspectStudent(null)}
                className="px-4 py-1 rounded-xl bg-slate-800 text-white font-bold text-xs cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
  ) : null;

  // Non-Blocking Async Processing & Overwrite Progress Overlay
  const progressOverlayNode = (isProcessingRows || step === 'executing') ? (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-slate-950/75 backdrop-blur-md p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col p-6 space-y-5">
            
            {/* Header: Parsing vs Executing */}
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0 shadow-sm">
                <RefreshCw size={22} className="animate-spin" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-black text-slate-900 dark:text-white truncate">
                    {isProcessingRows ? 'Scanning & Correlating Spreadsheet Records' : 'Synchronizing Board Fields into Database'}
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                    {isProcessingRows ? 'Verification Engine' : 'Batch Mutator'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                  {isProcessingRows 
                    ? (parsingProgress.stage || `Verifying against Class ${targetClass} • Session ${targetSession} (${matchingCohortStudents.length} students)...`) 
                    : (progressStage || 'Applying transactional patches to student documents...')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsMinimized(true)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer flex-shrink-0"
                title="Minimize to background pill (Continue browsing in View-Only mode)"
              >
                <Minimize2 size={16} />
              </button>
            </div>

            {/* Glowing Gradient Progress Bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-300">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  <span>{isProcessingRows ? 'Analyzing Records...' : 'Writing Changes...'}</span>
                </span>
                <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 font-mono">
                  {isProcessingRows ? `${parsingProgress.percent}%` : `${progressPercent}%`}
                </span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden border border-slate-200 dark:border-slate-700/60 shadow-inner">
                <div 
                  className="bg-gradient-to-r from-emerald-600 via-teal-500 to-cyan-400 h-full rounded-full transition-all duration-300 shadow-sm"
                  style={{ width: `${isProcessingRows ? parsingProgress.percent : progressPercent}%` }}
                />
              </div>
            </div>

            {/* Real-time Metric Cards */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
                <div className="text-[10px] font-black uppercase text-slate-400">
                  {isProcessingRows ? 'File Rows' : 'Total'}
                </div>
                <div className="text-sm font-black text-slate-800 dark:text-slate-100 font-mono">
                  {isProcessingRows ? parsingProgress.total : previewData.filter(r => selectedRowIds.has(r.id)).length}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/60">
                <div className="text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-400">
                  {isProcessingRows ? 'Scanned' : 'Overwritten'}
                </div>
                <div className="text-sm font-black text-emerald-600 dark:text-emerald-400 font-mono">
                  {isProcessingRows ? parsingProgress.current : Math.round((progressPercent / 100) * previewData.filter(r => selectedRowIds.has(r.id)).length)}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
                <div className="text-[10px] font-black uppercase text-slate-400">Remaining</div>
                <div className="text-sm font-black text-slate-700 dark:text-slate-300 font-mono">
                  {isProcessingRows 
                    ? Math.max(0, parsingProgress.total - parsingProgress.current) 
                    : Math.max(0, previewData.filter(r => selectedRowIds.has(r.id)).length - Math.round((progressPercent / 100) * previewData.filter(r => selectedRowIds.has(r.id)).length))}
                </div>
              </div>
            </div>

            {/* Live Streaming Execution Activity Log (when executing) */}
            {step === 'executing' && executionLogs.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center justify-between">
                  <span>Recent Mutations</span>
                  <span className="text-emerald-500 font-bold">Live</span>
                </div>
                <div className="bg-slate-950 rounded-xl p-3 border border-slate-800 font-mono text-[11px] text-slate-300 max-h-28 overflow-y-auto divide-y divide-slate-850 no-scrollbar">
                  {executionLogs.map(log => (
                    <div key={log.id} className="py-1 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="text-emerald-400 font-bold">✓</span>
                        <span className="text-white font-medium truncate">{log.name}</span>
                        <span className="text-slate-500 text-[10px]">({log.roll ? `Roll ${log.roll}` : log.reg})</span>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/80 px-1.5 py-0.2 rounded flex-shrink-0">
                        {log.fieldsCount} field(s)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Bar / Safe Abort (when executing) */}
            {step === 'executing' && (
              <div className="pt-1 flex items-center justify-between flex-wrap gap-2">
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Please keep this window open until write operations complete.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsMinimized(true)}
                    className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
                  >
                    <Minimize2 size={13} />
                    <span>Minimize to Background</span>
                  </button>
                  {isAborting ? (
                    <span className="px-3 py-1.5 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-bold text-xs">
                      Stopping safely...
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleAbortExecution}
                      className="px-3.5 py-1.5 rounded-xl border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/60 font-bold text-xs cursor-pointer transition-colors"
                    >
                      Stop Execution Safely
                    </button>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>
  ) : null;

  if (isPage) {
    return (
      <div className="w-full min-h-screen bg-slate-50 dark:bg-slate-950 p-1 sm:p-2.5 space-y-2 animate-fadeIn">
        {hubContent}
        {inspectModalNode}
        {progressOverlayNode}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-1 sm:p-3 overflow-y-auto animate-fadeIn">
      {hubContent}
      {inspectModalNode}
      {progressOverlayNode}
    </div>
  );
}
