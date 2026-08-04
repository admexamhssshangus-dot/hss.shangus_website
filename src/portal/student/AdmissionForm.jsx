import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Save, Send, CheckCircle, AlertCircle, RefreshCw, Info, HelpCircle, X, Eye, Edit3, Camera, Check, ShieldCheck } from 'lucide-react';
import SEO from '../../components/SEO';
import DynamicFormField from '../components/DynamicFormField';
import ModernLoader from '../../components/ModernLoader';
import appsScriptApi from '../../services/appsScriptApi';
import { sessionManager } from '../../services/sessionManager';
import { generateStudentAdmissionPdf } from '../../utils/pdfGenerator';
import { getNextAvailableFormNumber, consumeFormNumber } from '../../services/formNumberService';

export default function AdmissionForm() {
  const navigate = useNavigate();

  // Loading & Data States
  const [loading, setLoading] = useState(true);
  const [formStructure, setFormStructure] = useState([]);
  const [subjectsConfig, setSubjectsConfig] = useState(null);
  const [formData, setFormData] = useState({});

  // UI Flow States
  const [showInstructions, setShowInstructions] = useState(true);
  const [hasConfirmedInstructions, setHasConfirmedInstructions] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [activeTab, setActiveTab] = useState('personal'); 
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [alert, setAlert] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [draftSavedTime, setDraftSavedTime] = useState(null);

  const currentUser = sessionManager.getUser();
  const currentStatus = formData.Status || formData.status || '';
  const isSubmittedOrApproved = currentStatus === 'Submitted' || currentStatus === 'Approved';
  const isUnlocked = formData['Lock Status'] === 'Unlocked' || formData.isUnlockedEditMode || formData.isEditable || currentStatus === 'Rejected';
  const isAdmin = currentUser?.role === 'Admin' || currentUser?.role === 'Super Admin' || currentUser?.role === 'superadmin';
  const isFormLocked = isSubmittedOrApproved && !isUnlocked && !isAdmin;

  // Fetch initial form data & structure
  const initForm = useCallback(async () => {
    setLoading(true);
    setAlert(null);
    try {
      const [structRes, subjCfgRes, appDataRes] = await Promise.all([
        appsScriptApi.getFormStructure(),
        appsScriptApi.getSubjectsConfig(),
        appsScriptApi.getStudentApplication()
      ]);

      if (structRes && structRes.data) setFormStructure(structRes.data);
      else if (structRes && Array.isArray(structRes)) setFormStructure(structRes);

      if (subjCfgRes && subjCfgRes.data) setSubjectsConfig(subjCfgRes.data);
      else if (subjCfgRes) setSubjectsConfig(subjCfgRes);

      let existing = {};
      let historical = {};
      
      if (appDataRes && appDataRes.data) {
        if (Array.isArray(appDataRes.data.applications) && appDataRes.data.applications.length > 0) {
          existing = appDataRes.data.applications[appDataRes.data.applications.length - 1];
        }
        if (Array.isArray(appDataRes.data.historicalRecords) && appDataRes.data.historicalRecords.length > 0) {
          historical = appDataRes.data.historicalRecords[appDataRes.data.historicalRecords.length - 1];
        }
      } else if (appDataRes) {
        if (Array.isArray(appDataRes.applications) && appDataRes.applications.length > 0) {
          existing = appDataRes.applications[appDataRes.applications.length - 1];
        }
        if (Array.isArray(appDataRes.historicalRecords) && appDataRes.historicalRecords.length > 0) {
          historical = appDataRes.historicalRecords[appDataRes.historicalRecords.length - 1];
        }
      }

      // Check for local auto-saved draft in sessionStorage
      let localDraft = {};
      try {
        const savedDraftStr = sessionStorage.getItem('hss_admission_draft');
        if (savedDraftStr) {
          localDraft = JSON.parse(savedDraftStr);
        }
      } catch (e) {}

      // Pre-fill student photo from any available source
      const preloadedPhoto = localDraft['Student Photo'] || existing['Student Photo'] || historical['Student Photo'] || existing['photo_id'] || historical['photo_id'] || existing['photoUrl'] || historical['photoUrl'] || '';

      // Dynamically get next sequential Form Number if not already assigned in existing/draft
      let assignedFormNo = existing['Form Number'] || existing['FormNo'] || localDraft['Form Number'] || localDraft['FormNo'] || '';
      if (!assignedFormNo) {
        assignedFormNo = await getNextAvailableFormNumber();
      }

      // If filling a NEW form, merge historical student records for instant pre-fill
      const prefillSource = Object.keys(existing).length > 0 ? existing : historical;

      const mergedData = {
        ...prefillSource,
        ...localDraft,
        'Form Number': assignedFormNo,
        'FormNo': assignedFormNo,
        'Student Photo': preloadedPhoto,
        'photo_id': preloadedPhoto,
        'photoUrl': preloadedPhoto,
      };

      // Clear previous status if creating a fresh form from historical record
      if (Object.keys(existing).length === 0 && Object.keys(historical).length > 0) {
        delete mergedData.Status;
        delete mergedData.status;
        delete mergedData.submittedAt;
      }

      if (Object.keys(localDraft).length > 0) {
        setAlert({
          type: 'info',
          text: `✨ Restored your auto-saved draft (Form #${assignedFormNo})! You can continue filling out or updating your application form.`
        });
      } else if (Object.keys(existing).length > 0) {
        setAlert({
          type: 'info',
          text: `✨ Welcome back! Your application (Form #${assignedFormNo}) & passport photo have been retrieved. You can update any fields or select your new class & subjects.`
        });
      } else if (Object.keys(historical).length > 0) {
        setAlert({
          type: 'info',
          text: `✨ Smart Auto-Fill: Welcome back! Your previous school records & passport photo have been automatically retrieved. Simply choose your new class and subjects to submit for the new session!`
        });
      }

      setFormData(mergedData);
    } catch (err) {
      console.error('Failed to initialize admission form:', err);
      setAlert({ type: 'error', text: err.userMessage || 'Failed to load form configuration.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    initForm();
  }, [initForm]);

  // Auto-save draft changes to sessionStorage on change
  useEffect(() => {
    if (Object.keys(formData).length > 0 && !isFormLocked) {
      try {
        sessionStorage.setItem('hss_admission_draft', JSON.stringify(formData));
        setDraftSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      } catch (e) {}
    }
  }, [formData, isFormLocked]);

  const handleFieldChange = (fieldName, value) => {
    setFormData((prev) => {
      const next = { ...prev, [fieldName]: value };

      // ── Dependent field auto-clearing ──
      if (fieldName === 'Whether Any Disability' && value === 'No') {
        next['Type of Disability'] = '';
      }
      if (fieldName === 'Whether scholarship received in previous academic year' && value === 'No') {
        next['Type of scholarship received'] = '';
        next['Amount received (INR)'] = '';
      }
      if (fieldName === 'Vocational subject in previous class' && value === 'No') {
        next['Percentage Obtained in Vocational Subject'] = '';
      }
      if (fieldName === 'Admission Type (Class 11th)' && value !== 'Provisional') {
        next['Reason for Provisional (Class 11th)'] = '';
        next['Subjects to Reappear (Class 10th)'] = '';
      }
      if (fieldName === 'Admission Type (Class 12th)' && value !== 'Provisional') {
        next['Reason for Provisional (Class 12th)'] = '';
        next['Subjects to Reappear (Class 11th)'] = '';
      }

      // ── Auto-calculate Percentage for 10th/11th/8th/9th marks ──
      ['Class 10th', 'Class 11th', 'Class 8th', 'Class 9th'].forEach(cls => {
        const obtKey = `Total Marks Obtained in ${cls}`;
        const maxKey = `Total Max. Marks in ${cls}`;
        const obt = parseFloat(next[obtKey]);
        const max = parseFloat(next[maxKey]);
        if (!isNaN(obt) && !isNaN(max) && max > 0) {
          const calcPct = ((obt / max) * 100).toFixed(2);
          next[`%age (${cls})`] = `${calcPct}%`;
          next[`Percentage (${cls})`] = `${calcPct}%`;
        }
      });

      return next;
    });

    if (fieldErrors[fieldName]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[fieldName];
        return next;
      });
    }
  };

  const handleSaveDraft = async () => {
    setIsSubmitting(true);
    setAlert(null);
    try {
      const studentPhoto = formData['Student Photo'] || formData['photo'] || '';
      const currentUser = sessionManager.getUser() || { email: formData['Email Address'] || '' };

      let fileDataObj = null;
      if (studentPhoto && studentPhoto.startsWith('data:image')) {
        const parts = studentPhoto.split(',');
        const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
        const base64Data = parts[1];
        fileDataObj = {
          base64Data,
          mimeType: mime,
          fileName: 'student_photo.jpg'
        };
      }

      const payload = {
        formData: {
          ...formData,
          'Student Photo': studentPhoto && !studentPhoto.startsWith('data:') ? studentPhoto : '',
          'id card photo': studentPhoto && !studentPhoto.startsWith('data:') ? studentPhoto : '',
          Status: 'Draft',
        },
        fileData: fileDataObj,
        user: currentUser,
        status: 'Draft',
      };
      const res = await appsScriptApi.call('saveApplicationData', payload, { timeout: 120000 });
      if (res && res.success !== false) {
        setAlert({ type: 'success', text: 'Application draft saved successfully! You can resume anytime.' });
      } else {
        setAlert({ type: 'error', text: res?.error || res?.message || 'Failed to save draft.' });
      }
    } catch (err) {
      setAlert({ type: 'error', text: err.userMessage || err.message || 'Failed to save draft.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedClass = formData['Admission sought for class'] || '11th';
  const selectedStream = formData['Stream for Class 11th'] || formData['Stream'] || 'Science';

  const isVisible = (field) => {
    const clsList = field.classes || field['Classes'] || '';
    if (clsList) {
      const allowed = clsList.split(',').map(c => c.trim()).filter(Boolean);
      const isAllowed = allowed.some(clsToken => selectedClass.includes(clsToken));
      if (!isAllowed) return false;
    }

    const fieldName = field.fieldName || field.name || field['Field Name'];
    const admType11 = formData['Admission Type (Class 11th)'];
    const admType12 = formData['Admission Type (Class 12th)'];
    const reason11 = formData['Reason for Provisional (Class 11th)'];
    const reason12 = formData['Reason for Provisional (Class 12th)'];
    const disability = formData['Whether Any Disability'];
    const scholarship = formData['Whether scholarship received in previous academic year'];
    const vocational = formData['Vocational subject in previous class'];

    // Disability Dependent Fields
    if (fieldName === 'Type of Disability') {
      return disability === 'Yes';
    }

    // Scholarship Dependent Fields
    if (fieldName === 'Type of scholarship received' || fieldName === 'Amount received (INR)') {
      return scholarship === 'Yes';
    }

    // Vocational Dependent Fields
    if (fieldName === 'Percentage Obtained in Vocational Subject') {
      return vocational === 'Yes';
    }

    // Class 11th Provisional / Reappear / Marks Dependent Fields
    if (fieldName === 'Reason for Provisional (Class 11th)') {
      return admType11 === 'Provisional';
    }
    if (fieldName === 'Reason for Provisional (Class 12th)') {
      return admType12 === 'Provisional';
    }
    if (fieldName === 'Subjects to Reappear (Class 10th)') {
      return admType11 === 'Provisional' && reason11 === 'Reappear Candidate';
    }
    if (fieldName === 'Subjects to Reappear (Class 11th)') {
      return admType12 === 'Provisional' && reason12 === 'Reappear Candidate';
    }
    if (fieldName === 'Year of Appearing (Class 10th)') {
      return admType11 === 'Provisional';
    }
    if (fieldName === 'Year of Passing Class 10th') {
      return admType11 !== 'Provisional';
    }
    if (fieldName === 'Total Marks Obtained in Class 10th' || fieldName === 'Total Max. Marks in Class 10th') {
      return admType11 !== 'Provisional';
    }

    // Class 12th Provisional / Reappear / Marks Dependent Fields
    if (fieldName === 'Year of Appearing (Class 11th)') {
      return admType12 === 'Provisional';
    }
    if (fieldName === 'Year of Passing Class 11th') {
      return admType12 !== 'Provisional';
    }
    if (fieldName === 'Total Marks Obtained in Class 11th' || fieldName === 'Total Max. Marks in Class 11th') {
      return admType12 !== 'Provisional';
    }

    return true;
  };

  const fieldTabMap = {
    // 1. Personal & Contact & Physical Details
    "Student's Name (as per school records)": 'personal',
    "DoB (as per school records)": 'personal',
    "Gender": 'personal',
    "Father's/Guardian's Name (as per school records)": 'personal',
    "Mother's Name (as per school records)": 'personal',
    "Father's/Guardian's Occupation": 'personal',
    "Mobile No. (with working WhatsApp)": 'personal',
    "Parent's Mobile No. (must be working)": 'personal',
    "Aadhar No.": 'personal',
    "House No.": 'personal',
    "Name of your village": 'personal',
    "Block": 'personal',
    "Tehsil": 'personal',
    "District": 'personal',
    "State/UT": 'personal',
    "PIN code": 'personal',
    "Email Address": 'personal',
    "Height (cm)": 'personal',
    "Weight (kg)": 'personal',
    "Blood Group": 'personal',
    "Your Mother Tongue": 'personal',
    "Religion": 'personal',
    "Social category": 'personal',
    "Socio-economic category": 'personal',
    "Whether Any Disability": 'personal',
    "Type of Disability": 'personal',
    "Passport No. (if available)": 'personal',
    "Identification Mark (if any)": 'personal',
    "Previous participation in sports (if any)": 'personal',
    "Games to participate": 'personal',
    "PEN number (given by UDISE portal)": 'personal',
    "APAAR ID": 'personal',
    "Student Photo": 'personal',
    "id card photo": 'personal',

    // 2. Academic & Scholarship Details
    "Admission sought for class": 'academic',
    "Whether scholarship received in previous academic year": 'academic',
    "Type of scholarship received": 'academic',
    "Amount received (INR)": 'academic',
    "Bank Account No.": 'academic',
    "Name of Bank": 'academic',
    "IFSC code": 'academic',
    "Vocational subject in previous class": 'academic',
    "Percentage Obtained in Vocational Subject": 'academic',
    "DIET Registration No.": 'academic',
    "Year of Passing Class 8th": 'academic',
    "Name of Previous School (Class 8th)": 'academic',
    "Board (Class 8th)": 'academic',
    "Total Marks Obtained in Class 8th": 'academic',
    "Total Max. Marks in Class 8th": 'academic',
    "Name of Previous Complex Head": 'academic',
    "Board Registration No. (Class 9th)": 'academic',
    "Year of Passing Class 9th": 'academic',
    "Name of Previous School (Class 9th)": 'academic',
    "Board (Class 9th)": 'academic',
    "Total Max. Marks in Class 9th": 'academic',
    "Total Marks Obtained in Class 9th": 'academic',
    "Admission Type (Class 11th)": 'academic',
    "Reason for Provisional (Class 11th)": 'academic',
    "Board Registration No. (Class 10th)": 'academic',
    "Exam Roll Number of Class 10th": 'academic',
    "Year of Passing Class 10th": 'academic',
    "Year of Appearing (Class 10th)": 'academic',
    "Total Marks Obtained in Class 10th": 'academic',
    "Total Max. Marks in Class 10th": 'academic',
    "Name of Previous School (Class 10th)": 'academic',
    "Board (Class 10th)": 'academic',
    "Admission Type (Class 12th)": 'academic',
    "Reason for Provisional (Class 12th)": 'academic',
    "Board Registration No. (Class 11th)": 'academic',
    "Exam Roll Number of Class 11th": 'academic',
    "Year of Passing Class 11th": 'academic',
    "Year of Appearing (Class 11th)": 'academic',
    "Board (Class 11th)": 'academic',
    "Total Marks Obtained in Class 11th": 'academic',
    "Total Max. Marks in Class 11th": 'academic',
    "Name of Previous School (Class 11th)": 'academic',

    // 3. Subject Selection
    "Subjects Studied in Class 8th": 'subjects',
    "Subjects to be taken in Class 9th": 'subjects',
    "Subjects Studied in Class 9th": 'subjects',
    "Subjects to be taken in Class 10th": 'subjects',
    "Subjects Studied in Class 10th": 'subjects',
    "Stream for Class 11th": 'subjects',
    "Subjects to be taken in Class 11th": 'subjects',
    "Subjects to Reappear (Class 10th)": 'subjects',
    "Stream opted in Class 11th": 'subjects',
    "Subjects Studied in Class 11th": 'subjects',
    "Stream & Subjects for Class 12th": 'subjects',
    "Subjects to Reappear (Class 11th)": 'subjects',

    // 4. Docs & Declaration
    "Remarks/Feedback (if any)": 'subjects',
    "Declaration": 'photo'
  };

  const fieldSectionMap = {
    // Personal Sub-groups
    "Student's Name (as per school records)": '👤 Identity & Parentage',
    "DoB (as per school records)": '👤 Identity & Parentage',
    "Gender": '👤 Identity & Parentage',
    "Father's/Guardian's Name (as per school records)": '👤 Identity & Parentage',
    "Mother's Name (as per school records)": '👤 Identity & Parentage',
    "Father's/Guardian's Occupation": '👤 Identity & Parentage',
    "Your Mother Tongue": '👤 Identity & Parentage',

    "Mobile No. (with working WhatsApp)": '📱 Contact & Communication',
    "Parent's Mobile No. (must be working)": '📱 Contact & Communication',
    "Email Address": '📱 Contact & Communication',

    "House No.": '🏠 Residential Address',
    "Name of your village": '🏠 Residential Address',
    "Block": '🏠 Residential Address',
    "Tehsil": '🏠 Residential Address',
    "District": '🏠 Residential Address',
    "State/UT": '🏠 Residential Address',
    "PIN code": '🏠 Residential Address',

    "Height (cm)": '🩺 Physical & Category Profile',
    "Weight (kg)": '🩺 Physical & Category Profile',
    "Blood Group": '🩺 Physical & Category Profile',
    "Religion": '🩺 Physical & Category Profile',
    "Social category": '🩺 Physical & Category Profile',
    "Socio-economic category": '🩺 Physical & Category Profile',
    "Whether Any Disability": '🩺 Physical & Category Profile',
    "Type of Disability": '🩺 Physical & Category Profile',

    "Aadhar No.": '🆔 National Identifiers & Sports',
    "PEN number (given by UDISE portal)": '🆔 National Identifiers & Sports',
    "APAAR ID": '🆔 National Identifiers & Sports',
    "Passport No. (if available)": '🆔 National Identifiers & Sports',
    "Identification Mark (if any)": '🆔 National Identifiers & Sports',
    "Previous participation in sports (if any)": '🆔 National Identifiers & Sports',
    "Games to participate": '🆔 National Identifiers & Sports',

    // Academic Sub-groups
    "Admission sought for class": '🎓 Target Admission Details',
    "DIET Registration No.": '🎓 Target Admission Details',

    "Admission Type (Class 11th)": '🏫 Class 10th / 11th Examination Records',
    "Reason for Provisional (Class 11th)": '🏫 Class 10th / 11th Examination Records',
    "Board Registration No. (Class 10th)": '🏫 Class 10th / 11th Examination Records',
    "Exam Roll Number of Class 10th": '🏫 Class 10th / 11th Examination Records',
    "Year of Passing Class 10th": '🏫 Class 10th / 11th Examination Records',
    "Year of Appearing (Class 10th)": '🏫 Class 10th / 11th Examination Records',
    "Total Marks Obtained in Class 10th": '🏫 Class 10th / 11th Examination Records',
    "Total Max. Marks in Class 10th": '🏫 Class 10th / 11th Examination Records',
    "Name of Previous School (Class 10th)": '🏫 Class 10th / 11th Examination Records',
    "Board (Class 10th)": '🏫 Class 10th / 11th Examination Records',

    "Admission Type (Class 12th)": '🏫 Class 11th / 12th Examination Records',
    "Reason for Provisional (Class 12th)": '🏫 Class 11th / 12th Examination Records',
    "Board Registration No. (Class 11th)": '🏫 Class 11th / 12th Examination Records',
    "Exam Roll Number of Class 11th": '🏫 Class 11th / 12th Examination Records',
    "Year of Passing Class 11th": '🏫 Class 11th / 12th Examination Records',
    "Year of Appearing (Class 11th)": '🏫 Class 11th / 12th Examination Records',
    "Board (Class 11th)": '🏫 Class 11th / 12th Examination Records',
    "Total Marks Obtained in Class 11th": '🏫 Class 11th / 12th Examination Records',
    "Total Max. Marks in Class 11th": '🏫 Class 11th / 12th Examination Records',
    "Name of Previous School (Class 11th)": '🏫 Class 11th / 12th Examination Records',

    "Year of Passing Class 8th": '🏫 Class 8th / 9th Examination Records',
    "Name of Previous School (Class 8th)": '🏫 Class 8th / 9th Examination Records',
    "Board (Class 8th)": '🏫 Class 8th / 9th Examination Records',
    "Total Marks Obtained in Class 8th": '🏫 Class 8th / 9th Examination Records',
    "Total Max. Marks in Class 8th": '🏫 Class 8th / 9th Examination Records',
    "Name of Previous Complex Head": '🏫 Class 8th / 9th Examination Records',
    "Board Registration No. (Class 9th)": '🏫 Class 8th / 9th Examination Records',
    "Year of Passing Class 9th": '🏫 Class 8th / 9th Examination Records',
    "Name of Previous School (Class 9th)": '🏫 Class 8th / 9th Examination Records',
    "Board (Class 9th)": '🏫 Class 8th / 9th Examination Records',
    "Total Max. Marks in Class 9th": '🏫 Class 8th / 9th Examination Records',
    "Total Marks Obtained in Class 9th": '🏫 Class 8th / 9th Examination Records',

    "Whether scholarship received in previous academic year": '🏦 Scholarship & Bank Account',
    "Type of scholarship received": '🏦 Scholarship & Bank Account',
    "Amount received (INR)": '🏦 Scholarship & Bank Account',
    "Bank Account No.": '🏦 Scholarship & Bank Account',
    "Name of Bank": '🏦 Scholarship & Bank Account',
    "IFSC code": '🏦 Scholarship & Bank Account',
    "Vocational subject in previous class": '🏦 Scholarship & Bank Account',
    "Percentage Obtained in Vocational Subject": '🏦 Scholarship & Bank Account',

    // Subject Sub-groups
    "Stream for Class 11th": '📚 Stream Selection',
    "Stream opted in Class 11th": '📚 Stream Selection',
    "Stream & Subjects for Class 12th": '📚 Stream Selection',
    "Subjects Studied in Class 8th": '📖 Subject Combinations',
    "Subjects to be taken in Class 9th": '📖 Subject Combinations',
    "Subjects Studied in Class 9th": '📖 Subject Combinations',
    "Subjects to be taken in Class 10th": '📖 Subject Combinations',
    "Subjects Studied in Class 10th": '📖 Subject Combinations',
    "Subjects to be taken in Class 11th": '📖 Subject Combinations',
    "Subjects to Reappear (Class 10th)": '📖 Subject Combinations',
    "Subjects Studied in Class 11th": '📖 Subject Combinations',
    "Subjects to Reappear (Class 11th)": '📖 Subject Combinations',

    // Photo Sub-groups
    "Student Photo": '📸 Passport Photo Upload',
    "id card photo": '📸 Passport Photo Upload',

    // Subjects Sub-groups (Remarks goes here)
    "Remarks/Feedback (if any)": '💬 Additional Remarks & Feedback'
  };

  const FIELD_ORDER_LIST = [
    // 1. Identity & Parentage (Positioned First)
    "Student Photo",
    "Student's Name (as per school records)",
    "DoB (as per school records)",
    "Gender",
    "Father's/Guardian's Name (as per school records)",
    "Mother's Name (as per school records)",
    "Father's/Guardian's Occupation",
    "Your Mother Tongue",

    // 2. Contact & Communication
    "Mobile No. (with working WhatsApp)",
    "Parent's Mobile No. (must be working)",
    "Email Address",

    // 3. Residential Address
    "House No.",
    "Name of your village",
    "Block",
    "Tehsil",
    "District",
    "State/UT",
    "PIN code",

    // 4. Physical & Category Profile
    "Height (cm)",
    "Weight (kg)",
    "Blood Group",
    "Religion",
    "Social category",
    "Socio-economic category",
    "Whether Any Disability",
    "Type of Disability",

    // 5. National Identifiers & Sports
    "Aadhar No.",
    "PEN number (given by UDISE portal)",
    "APAAR ID",
    "Passport No. (if available)",
    "Identification Mark (if any)",
    "Previous participation in sports (if any)",
    "Games to participate",

    // 6. Target Admission Details
    "Admission sought for class",
    "DIET Registration No.",

    // 7. Academic Examinations Records (10th/11th/8th/9th)
    "Admission Type (Class 11th)",
    "Reason for Provisional (Class 11th)",
    "Board Registration No. (Class 10th)",
    "Exam Roll Number of Class 10th",
    "Year of Passing Class 10th",
    "Year of Appearing (Class 10th)",
    "Total Marks Obtained in Class 10th",
    "Total Max. Marks in Class 10th",
    "Name of Previous School (Class 10th)",
    "Board (Class 10th)",

    "Admission Type (Class 12th)",
    "Reason for Provisional (Class 12th)",
    "Board Registration No. (Class 11th)",
    "Exam Roll Number of Class 11th",
    "Year of Passing Class 11th",
    "Year of Appearing (Class 11th)",
    "Total Marks Obtained in Class 11th",
    "Total Max. Marks in Class 11th",
    "Name of Previous School (Class 11th)",
    "Board (Class 11th)",

    "Year of Passing Class 8th",
    "Name of Previous School (Class 8th)",
    "Board (Class 8th)",
    "Total Marks Obtained in Class 8th",
    "Total Max. Marks in Class 8th",
    "Name of Previous Complex Head",
    "Board Registration No. (Class 9th)",
    "Year of Passing Class 9th",
    "Name of Previous School (Class 9th)",
    "Board (Class 9th)",
    "Total Max. Marks in Class 9th",
    "Total Marks Obtained in Class 9th",

    // 8. Scholarship & Bank Details
    "Whether scholarship received in previous academic year",
    "Type of scholarship received",
    "Amount received (INR)",
    "Bank Account No.",
    "Name of Bank",
    "IFSC code",
    "Vocational subject in previous class",
    "Percentage Obtained in Vocational Subject",

    // 9. Stream & Subject Selections
    "Stream for Class 11th",
    "Stream opted in Class 11th",
    "Stream & Subjects for Class 12th",
    "Subjects to be taken in Class 11th",
    "Subjects Studied in Class 10th",
    "Subjects to Reappear (Class 10th)",
    "Subjects Studied in Class 11th",
    "Subjects to Reappear (Class 11th)",

    // 10. Photo Upload
    "Student Photo",
    "id card photo",
    "Remarks/Feedback (if any)"
  ];

  const getFieldOrderIndex = (name) => {
    const idx = FIELD_ORDER_LIST.indexOf(name);
    return idx !== -1 ? idx : 999;
  };

  const categorizeField = (fieldName) => {
    if (!fieldName) return 'personal';
    if (fieldTabMap[fieldName]) return fieldTabMap[fieldName];

    const lower = fieldName.toLowerCase();
    if (lower.includes('photo')) return 'personal'; // Photo lives in Personal tab
    if (lower.includes('declaration')) return 'personal';
    if (lower.includes('remarks') || lower.includes('feedback')) return 'subjects';
    if (lower.includes('subjects to be taken') || lower.includes('subjects studied') || lower.includes('stream')) return 'subjects';
    if (lower.includes('marks') || lower.includes('board') || lower.includes('school') || lower.includes('roll') || lower.includes('bank')) return 'academic';
    return 'personal';
  };

  const tabs = [
    { id: 'personal', label: '1. Personal Details' },
    { id: 'academic', label: '2. Academic Details' },
    { id: 'subjects', label: '3. Subject Selection & Feedback' },
  ];

  const handleFinalSubmit = async (e) => {
    e.preventDefault();
    setAlert(null);

    const errors = {};
    let firstErrorField = null;

    const addError = (name, msg) => {
      if (!errors[name]) {
        errors[name] = msg;
        if (!firstErrorField) firstErrorField = name;
      }
    };

    // ── HARDCODED ESSENTIAL FIELD VALIDATION ──
    // These run regardless of formStructure availability.
    const cls = selectedClass;

    // Personal essentials
    if (!formData["Student's Name (as per school records)"]?.trim())
      addError("Student's Name (as per school records)", "Student's full name is required");
    if (!formData["DoB (as per school records)"]?.trim())
      addError("DoB (as per school records)", "Date of Birth is required");
    if (!formData["Gender"])
      addError("Gender", "Gender is required");
    if (!formData["Father's/Guardian's Name (as per school records)"]?.trim())
      addError("Father's/Guardian's Name (as per school records)", "Father's / Guardian's name is required");
    if (!formData["Mother's Name (as per school records)"]?.trim())
      addError("Mother's Name (as per school records)", "Mother's name is required");

    // Mobile validation
    const mobile = String(formData["Mobile No. (with working WhatsApp)"] || '').replace(/[^0-9]/g, '');
    if (!mobile) addError("Mobile No. (with working WhatsApp)", "WhatsApp mobile number is required");
    else if (mobile.length !== 10) addError("Mobile No. (with working WhatsApp)", "Mobile number must be exactly 10 digits");

    const parentMobile = String(formData["Parent's Mobile No. (must be working)"] || '').replace(/[^0-9]/g, '');
    if (parentMobile && parentMobile.length !== 10)
      addError("Parent's Mobile No. (must be working)", "Parent's mobile must be exactly 10 digits");

    // Aadhar
    const aadhar = String(formData["Aadhar No."] || '').replace(/[^0-9]/g, '');
    if (!aadhar) addError("Aadhar No.", "Aadhar number is required");
    else if (aadhar.length !== 12) addError("Aadhar No.", "Aadhar number must be exactly 12 digits");

    // Address
    if (!formData["Name of your village"]?.trim()) addError("Name of your village", "Village / locality name is required");
    if (!formData["District"]?.trim()) addError("District", "District is required");
    const pin = String(formData["PIN code"] || '').replace(/[^0-9]/g, '');
    if (pin && pin.length !== 6) addError("PIN code", "PIN code must be exactly 6 digits");

    // Academic essentials
    if (!formData["Admission sought for class"])
      addError("Admission sought for class", "Please select the class for admission");

    // Board registration number (class-dependent)
    if (cls?.includes('11') || cls?.includes('12')) {
      if (!formData["Board Registration No. (Class 10th)"]?.trim() && !formData["Board Registration No. (Class 11th)"]?.trim())
        addError("Board Registration No. (Class 10th)", "Board Registration Number is required");
    }

    // Marks validation
    ['Class 10th', 'Class 11th', 'Class 8th', 'Class 9th'].forEach(clsLabel => {
      const obtained = parseFloat(formData[`Total Marks Obtained in ${clsLabel}`]);
      const maxMarks = parseFloat(formData[`Total Max. Marks in ${clsLabel}`]);
      if (!isNaN(obtained) && !isNaN(maxMarks) && maxMarks > 0 && obtained > maxMarks) {
        addError(`Total Marks Obtained in ${clsLabel}`, `Marks Obtained (${obtained}) cannot exceed Max Marks (${maxMarks})`);
      }
    });

    // IFSC validation (only if bank account entered)
    const ifsc = String(formData["IFSC code"] || '').trim().toUpperCase();
    if (ifsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc))
      addError("IFSC code", "Invalid IFSC code format (e.g. SBIN0001234)");

    // ── DYNAMIC required-field check from formStructure ──
    formStructure.forEach(field => {
      const name = field.fieldName || field.name || field['Field Name'];
      const required = field.required || field['Is Required?'] === 'TRUE';
      const type = field.fieldType || field.type || field['Field Type'] || '';
      if (type.startsWith('autogen')) return;
      if (name === 'Declaration') return;
      if (!isVisible(field)) return;
      if (!required) return;
      if (errors[name]) return; // already caught by hardcoded check
      const val = formData[name];
      if (val === undefined || val === null || val === '' || val === false || val === 'FALSE') {
        addError(name, 'This field is required');
      }
    });

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      const errorTab = categorizeField(firstErrorField);
      setActiveTab(errorTab);
      // Count errors per tab for summary
      const tabErrorCounts = {};
      Object.keys(errors).forEach(name => {
        const t = categorizeField(name);
        tabErrorCounts[t] = (tabErrorCounts[t] || 0) + 1;
      });
      const tabSummary = tabs
        .filter(t => tabErrorCounts[t.id])
        .map(t => `${t.label} (${tabErrorCounts[t.id]} error${tabErrorCounts[t.id] > 1 ? 's' : ''})`)
        .join(', ');
      setAlert({
        type: 'error',
        text: `Please fix ${Object.keys(errors).length} error(s) before submitting. Issues found in: ${tabSummary}. First issue: "${firstErrorField}" — ${errors[firstErrorField]}`
      });
      // Scroll to first error field
      setTimeout(() => {
        const el = document.querySelector(`[data-field-name="${CSS.escape(firstErrorField)}"]`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
      return;
    }

    setFieldErrors({});
    setShowPreviewModal(true);
  };

  const executeFinalSubmission = async () => {
    setShowPreviewModal(false);
    setIsSubmitting(true);
    try {
      const studentPhoto = formData['Student Photo'] || formData['photo_id'] || formData['photo'] || '';
      const currentUser = sessionManager.getUser() || { email: formData['Email Address'] || '' };

      const formNo = String(formData['Form Number'] || formData['FormNo'] || `FORM_${Date.now()}`);

      const payloadData = {
        ...formData,
        'Form Number': formNo,
        'Student Photo': studentPhoto,
        'photo_id': studentPhoto,
        'photoUrl': studentPhoto,
        Status: 'Submitted',
        submittedAt: new Date().toISOString()
      };

      const res = await appsScriptApi.saveApplication(payloadData);
      if (res && res.success !== false) {
        // Consume form number in database counter
        consumeFormNumber(formNo).catch(e => console.warn('consumeFormNumber note:', e));

        // Clear local draft from sessionStorage
        try { sessionStorage.removeItem('hss_admission_draft'); } catch(e) {}

        setAlert({ type: 'success', text: `Application #${formNo} submitted successfully to official database! Redirecting...` });

        // Trigger browser PDF generator automatically
        try {
          generateStudentAdmissionPdf(payloadData);
        } catch (pdfErr) {
          console.warn('PDF generator trigger note:', pdfErr);
        }

        setTimeout(() => {
          navigate('/portal/student');
        }, 1500);
      } else {
        setAlert({ type: 'error', text: res?.error || res?.message || 'Submission failed.' });
      }
    } catch (err) {
      setAlert({ type: 'error', text: err.userMessage || err.message || 'Submission failed.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full min-h-[85vh] py-8 px-4 sm:px-6" style={{ backgroundColor: 'var(--bg-page, #f8fafc)' }}>
      <SEO
        title="Online Admission Application"
        description="Fill out the official online admission form for Govt HSS Shangus."
        path="/portal/student/application"
      />

      {/* Instructions Modal Overlay (Only shown when form is editable) */}
      {showInstructions && !isFormLocked && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setShowInstructions(false); }}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="w-full max-w-xl rounded-3xl p-6 sm:p-8 border shadow-2xl space-y-5 animate-fadeIn" style={{ backgroundColor: 'var(--bg-card, #ffffff)', borderColor: 'var(--border-ui, #e2e8f0)' }}>
            <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: 'var(--border-ui, #e2e8f0)' }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-500/10 flex items-center justify-center text-teal-600">
                  <Info size={22} />
                </div>
                <div>
                  <h3 className="font-extrabold text-lg" style={{ color: 'var(--text-main, #0f172a)' }}>
                    Instructions for Admission
                  </h3>
                  <p className="text-xs text-slate-400">Please read carefully before proceeding to the form</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowInstructions(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                title="Close Instructions"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3 text-xs leading-relaxed" style={{ color: 'var(--text-main, #334155)' }}>
              <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <CheckCircle size={16} className="text-teal-500 flex-shrink-0 mt-0.5" />
                <span>Ensure all personal details (Name, Parentage, DoB) match your official school records exactly.</span>
              </div>
              <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <CheckCircle size={16} className="text-teal-500 flex-shrink-0 mt-0.5" />
                <span>Active mobile number (with WhatsApp) and parent's contact are mandatory for all communications.</span>
              </div>
              <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <CheckCircle size={16} className="text-teal-500 flex-shrink-0 mt-0.5" />
                <span>Upload a clear, recent Passport-size photograph (Max 200 KB) for your identity card.</span>
              </div>
            </div>

            <div className="pt-2">
              <label className="flex items-start gap-3 p-3.5 rounded-2xl bg-teal-500/10 border border-teal-500/30 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={hasConfirmedInstructions}
                  onChange={(e) => setHasConfirmedInstructions(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded text-teal-600 focus:ring-teal-500 cursor-pointer"
                />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-snug">
                  I have read all instructions carefully and agree to follow the best practices for admission form submission.
                </span>
              </label>
            </div>

            <button
              disabled={!hasConfirmedInstructions}
              onClick={() => setShowInstructions(false)}
              className="w-full py-3.5 px-6 rounded-2xl font-extrabold text-sm text-white bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-md cursor-pointer transition-all flex items-center justify-center gap-2"
            >
              <span>I Confirm and Proceed to Application Form</span>
              <span>→</span>
            </button>
          </div>
        </div>
      )}

      {/* Application Review & Confirmation Modal (Shown before final submit) */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-3xl rounded-3xl p-5 sm:p-7 border shadow-2xl space-y-6 my-auto max-h-[90vh] overflow-y-auto animate-fadeIn bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100">
            <div className="flex items-center justify-between border-b pb-4 border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-teal-500/10 flex items-center justify-center text-teal-600">
                  <Eye size={22} />
                </div>
                <div>
                  <h3 className="font-black text-base sm:text-lg text-slate-900 dark:text-white">
                    Application Summary & Final Verification
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Verify your details carefully. Click <strong>Edit Details</strong> to make changes or <strong>Confirm & Submit</strong>.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Top Identity Card Header */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-teal-500/10 via-slate-500/5 to-amber-500/10 border border-teal-500/20 flex flex-col sm:flex-row items-center gap-4">
              <div className="w-24 h-28 rounded-2xl border-2 border-teal-500/40 overflow-hidden bg-slate-200 dark:bg-slate-800 shadow-md flex-shrink-0">
                {formData['Student Photo'] ? (
                  <img src={formData['Student Photo']} alt="Student Preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 text-[10px] font-bold">
                    <Camera size={24} />
                    <span>No Photo</span>
                  </div>
                )}
              </div>
              <div className="flex-1 space-y-1 text-center sm:text-left">
                <div className="text-lg font-black text-slate-900 dark:text-white">
                  {formData["Student's Name (as per school records)"] || formData["Student's Name"] || 'N/A'}
                </div>
                <div className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  Father: {formData["Father's/Guardian's Name (as per school records)"] || 'N/A'} | Mother: {formData["Mother's Name (as per school records)"] || 'N/A'}
                </div>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-teal-500/20 text-teal-600 border border-teal-500/30">
                    Class {formData["Admission sought for class"] || '11th'} ({formData["Stream for Class 11th"] || formData["Stream opted in Class 11th"] || 'General'})
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/20 text-amber-600 border border-amber-500/30">
                    DoB: {formData["DoB (as per school records)"] || 'N/A'}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-500/20 text-purple-600 border border-purple-500/30">
                    Gender: {formData["Gender"] || 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            {/* Application Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              {/* Contact & Address */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="font-extrabold text-slate-900 dark:text-white border-b pb-1.5 border-slate-200 dark:border-slate-700">
                  📍 Contact & Address
                </div>
                <div className="space-y-1 text-slate-600 dark:text-slate-300">
                  <div><strong>Mobile:</strong> {formData["Mobile No. (with working WhatsApp)"] || 'N/A'}</div>
                  <div><strong>Parent Contact:</strong> {formData["Parent's Mobile No. (must be working)"] || 'N/A'}</div>
                  <div><strong>Email:</strong> {formData["Email Address"] || 'N/A'}</div>
                  <div><strong>Village:</strong> {formData["Name of your village"] || 'N/A'}, Block: {formData["Block"] || 'Shangus'}</div>
                  <div><strong>District/PIN:</strong> {formData["District"] || 'Anantnag'} - {formData["PIN code"] || '192201'}</div>
                </div>
              </div>

              {/* Academic Details */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="font-extrabold text-slate-900 dark:text-white border-b pb-1.5 border-slate-200 dark:border-slate-700">
                  🎓 Examination & Marks
                </div>
                <div className="space-y-1 text-slate-600 dark:text-slate-300">
                  <div><strong>Prev. School:</strong> {formData["Name of Previous School (Class 10th)"] || formData["Name of Previous School (Class 11th)"] || 'N/A'}</div>
                  <div><strong>Board Reg No:</strong> {formData["Board Registration No. (Class 10th)"] || formData["Board Registration No. (Class 11th)"] || 'N/A'}</div>
                  <div><strong>Exam Roll No:</strong> {formData["Exam Roll Number of Class 10th"] || formData["Exam Roll Number of Class 11th"] || 'N/A'}</div>
                  <div><strong>Marks Obtained:</strong> {formData["Total Marks Obtained in Class 10th"] || formData["Total Marks Obtained in Class 11th"] || 'N/A'} / {formData["Total Max. Marks in Class 10th"] || formData["Total Max. Marks in Class 11th"] || 500}</div>
                </div>
              </div>

              {/* Selected Subjects */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2 sm:col-span-2">
                <div className="font-extrabold text-slate-900 dark:text-white border-b pb-1.5 border-slate-200 dark:border-slate-700">
                  📖 Chosen Subjects
                </div>
                <div className="text-teal-700 dark:text-teal-400 font-bold">
                  {formData["Subjects to be taken in Class 11th"] || formData["Subjects Studied in Class 11th"] || formData["Subjects to be taken in Class 9th"] || formData["Subjects to be taken in Class 10th"] || 'None selected'}
                </div>
              </div>

              {/* Bank & Aadhaar Details */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2 sm:col-span-2">
                <div className="font-extrabold text-slate-900 dark:text-white border-b pb-1.5 border-slate-200 dark:border-slate-700">
                  🏦 Bank Account & Identifiers
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-slate-600 dark:text-slate-300">
                  <div><strong>Aadhaar No:</strong> {formData["Aadhar No."] || 'N/A'}</div>
                  <div><strong>Bank Account:</strong> {formData["Bank Account No."] || 'N/A'}</div>
                  <div><strong>IFSC Code:</strong> {formData["IFSC code"] || 'N/A'}</div>
                </div>
              </div>
            </div>

            {/* Declaration Block */}
            <div className="p-4 rounded-2xl border text-xs leading-relaxed" style={{ backgroundColor: 'rgba(13,148,136,0.06)', borderColor: 'rgba(13,148,136,0.25)', color: 'var(--text-main,#334155)' }}>
              <div className="font-extrabold text-sm mb-2 flex items-center gap-2" style={{ color: '#0d9488' }}>
                <CheckCircle size={16} /> Declaration
              </div>
              <p>
                I, <strong>{formData["Student's Name (as per school records)"] || 'the applicant'}</strong>, hereby declare that all information furnished in this admission application is true, complete, and correct to the best of my knowledge and belief. I understand that any false statement or misrepresentation may lead to cancellation of my admission. I agree to abide by the rules and regulations of Govt. Higher Secondary School Shangus and submit to the authority of the Principal in all matters relating to discipline and academic conduct.
              </p>
              <p className="mt-2 font-semibold">
                By clicking <strong>"Confirm &amp; Final Submit Application"</strong> below, I confirm the above declaration and authorise the school to process my admission application.
              </p>
            </div>

            {/* Modal Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                className="w-full sm:w-auto px-5 py-3 rounded-2xl font-extrabold text-xs text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Edit3 size={16} /> Edit Details
              </button>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={executeFinalSubmission}
                className="w-full sm:w-auto px-7 py-3.5 rounded-2xl font-black text-xs text-white bg-teal-600 hover:bg-teal-500 disabled:opacity-50 shadow-lg shadow-teal-500/20 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" /> Submitting...
                  </>
                ) : (
                  <>
                    <Send size={16} /> Confirm & Final Submit Application →
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto space-y-6">
        {/* Navigation Header */}
        <div className="flex items-center justify-between">
          <Link
            to="/portal/student"
            className="inline-flex items-center gap-1.5 text-xs font-bold hover:underline"
            style={{ color: 'var(--teal-accent, #0d9488)' }}
          >
            <ArrowLeft size={16} /> Back to Dashboard
          </Link>
          {!isFormLocked && (
            <button
              onClick={() => setShowInstructions(true)}
              className="text-xs font-semibold text-slate-400 hover:text-slate-600 flex items-center gap-1 cursor-pointer"
            >
              <HelpCircle size={14} /> Instructions
            </button>
          )}
        </div>

        {/* Form Container Card with Subtle School Logo Watermark */}
        <div className="relative overflow-hidden rounded-3xl p-6 sm:p-8 border shadow-xl space-y-6" style={{ backgroundColor: 'var(--bg-card, #ffffff)', borderColor: 'var(--border-ui, #e2e8f0)' }}>
          
          {/* School Logo Watermark */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.03] dark:opacity-[0.05] select-none z-0">
            <img src="/logo512.png" alt="" className="w-80 h-80 sm:w-96 sm:h-96 object-contain filter grayscale" />
          </div>

          <div className="relative z-10 space-y-6">
          {/* Header Info Banner */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b pb-4" style={{ borderColor: 'var(--border-ui, #e2e8f0)' }}>
            <div>
              <h1 className="text-xl font-extrabold" style={{ color: 'var(--text-main, #0f172a)' }}>
                Online Admission Application
              </h1>
              <div className="text-xs text-slate-400 mt-0.5">
                Form #{formData['Form Number'] || 'New'} • Class: {selectedClass} {selectedStream ? `(${selectedStream})` : ''}
              </div>
            </div>

            {/* Quick Action Top Buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl text-xs font-bold border flex items-center gap-1.5 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
                style={{ borderColor: 'var(--border-ui, #cbd5e1)', color: 'var(--text-main, #334155)' }}
              >
                <Save size={14} /> Save Draft
              </button>
            </div>
          </div>

          {/* Floating / Sticky Alert Toast Notification */}
          {alert && (
            <div className={`p-4 rounded-2xl text-xs font-semibold flex items-start justify-between gap-3 animate-fadeIn border shadow-sm ${
              alert.type === 'error'
                ? 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300'
                : alert.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                : 'bg-teal-500/10 border-teal-500/30 text-teal-700 dark:text-teal-300'
            }`}>
              <div className="flex items-start gap-2.5">
                {alert.type === 'error' ? <AlertCircle size={18} className="flex-shrink-0 text-red-500 mt-0.5" /> : <CheckCircle size={18} className="flex-shrink-0 text-teal-500 mt-0.5" />}
                <span className="leading-relaxed">{alert.text}</span>
              </div>
              <button
                type="button"
                onClick={() => setAlert(null)}
                className="p-1 hover:bg-black/10 rounded-lg transition-colors cursor-pointer text-slate-400 hover:text-slate-600"
                title="Dismiss Notification"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 p-1 rounded-2xl border text-xs font-bold overflow-x-auto" style={{ backgroundColor: 'var(--bg-secondary, #f1f5f9)', borderColor: 'var(--border-ui, #cbd5e1)' }}>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`py-2 px-3.5 rounded-xl transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === tab.id ? 'bg-teal-500 text-white shadow-sm' : 'hover:opacity-80'
                }`}
                style={activeTab !== tab.id ? { color: 'var(--text-main, #334155)' } : {}}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Locked Application Banner */}
          {isFormLocked && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-semibold flex items-center justify-between gap-3 animate-fadeIn mb-4">
              <div className="flex items-center gap-2">
                <AlertCircle size={16} className="text-amber-500 flex-shrink-0" />
                <span>Your application has been submitted and locked for verification. Editing is disabled.</span>
              </div>
              <Link
                to="/portal/student"
                className="px-3 py-1.5 rounded-xl bg-amber-500 text-white font-bold text-[11px] whitespace-nowrap hover:bg-amber-600 transition-colors"
              >
                Back to Dashboard
              </Link>
            </div>
          )}

          {/* Main Form Fields */}
          {loading ? (
            <ModernLoader
              text="Initializing Admission Application"
              subtext="Loading dynamic form schema, streams, and your saved profile records..."
            />
          ) : (
            <form onSubmit={handleFinalSubmit} className="space-y-6">
              {(() => {
                const activeFields = formStructure.filter(field => {
                  const type = field.fieldType || field.type || field['Field Type'] || '';
                  if (type.startsWith('autogen')) return false;
                  const name = field.fieldName || field.name || field['Field Name'];
                  // Declaration is shown in the submission confirmation modal, not in the form
                  if (name === 'Declaration') return false;
                  return isVisible(field) && categorizeField(name) === activeTab;
                });

                // Sort fields strictly by standard educational form order (Personal Details First)
                activeFields.sort((a, b) => {
                  const nameA = a.fieldName || a.name || a['Field Name'];
                  const nameB = b.fieldName || b.name || b['Field Name'];
                  return getFieldOrderIndex(nameA) - getFieldOrderIndex(nameB);
                });

                // Group active fields by sub-section
                const grouped = {};
                activeFields.forEach(field => {
                  const name = field.fieldName || field.name || field['Field Name'];
                  const sec = fieldSectionMap[name] || '📌 General Details';
                  if (!grouped[sec]) grouped[sec] = [];
                  grouped[sec].push(field);
                });

                const isFullWidthField = (field, name) => {
                  const type = field.fieldType || field.type || field['Field Type'] || '';
                  const lower = String(name || '').toLowerCase();
                  return (
                    type === 'image' ||
                    type === 'file' ||
                    type === 'textarea' ||
                    type === 'checkbox_dynamic' ||
                    type === 'checkbox_declaration' ||
                    lower.includes('photo') ||
                    lower.includes('remarks') ||
                    lower.includes('feedback')
                  );
                };

                return Object.entries(grouped).map(([sectionTitle, fields]) => (
                  <div key={sectionTitle} className="p-4 sm:p-5 rounded-2xl border bg-slate-50/70 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
                    <div className="font-black text-xs sm:text-sm text-slate-800 dark:text-slate-200 flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-teal-500"></span>
                      <span>{sectionTitle}</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {fields.map((field, idx) => {
                        const name = field.fieldName || field.name || field['Field Name'];
                        return (
                          <div key={idx} className={isFullWidthField(field, name) ? 'col-span-1 sm:col-span-2' : 'col-span-1'}>
                            <DynamicFormField
                              config={field}
                              value={formData[name] || ''}
                              onChange={handleFieldChange}
                              subjectsConfig={subjectsConfig}
                              selectedStream={selectedStream}
                              disabled={isSubmitting || isFormLocked}
                              error={fieldErrors[name]}
                              formData={formData}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ));
              })()}

              {/* Bottom Actions Bar */}
              <div className="flex items-center justify-between border-t pt-4" style={{ borderColor: 'var(--border-ui, #e2e8f0)' }}>
                {isFormLocked ? (
                  <div className="w-full text-center text-xs font-bold text-slate-400 py-2">
                    Form submission locked. Contact administration if you need to unlock and edit details.
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleSaveDraft}
                      disabled={isSubmitting}
                      className="px-5 py-3 rounded-2xl font-bold text-xs border flex items-center gap-1.5 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
                      style={{ borderColor: 'var(--border-ui, #cbd5e1)', color: 'var(--text-main, #334155)' }}
                    >
                      <Save size={16} /> Save Draft
                    </button>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-6 py-3.5 rounded-2xl font-extrabold text-xs text-white bg-teal-500 hover:bg-teal-400 shadow-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <>
                          <RefreshCw size={16} className="animate-spin" /> Submitting...
                        </>
                      ) : (
                        <>
                          <Send size={16} /> Finalize & Submit Application
                        </>
                      )}
                    </button>
                  </>
                )}
              </div>
            </form>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}
