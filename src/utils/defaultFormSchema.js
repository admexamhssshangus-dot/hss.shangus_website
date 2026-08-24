/**
 * HSS SHANGUS — Default Form Structure Schema & Subjects Configuration
 * Authoritative 72-column schema and subject choices used as instant Firestore/Offline fallback.
 */

export const DEFAULT_FORM_STRUCTURE = [
  // 1. Personal & Identity Details
  { "Field Name": "Student's Name (as per school records)", "Field Type": "text", "Is Required?": "TRUE", "Options / Range / Length": "60", "Help Text": "As printed on 10th Marks Card" },
  { "Field Name": "DoB (as per school records)", "Field Type": "date", "Is Required?": "TRUE", "Help Text": "Date of Birth as per school record" },
  { "Field Name": "Gender", "Field Type": "list", "Is Required?": "TRUE", "Options / Range / Length": "Male, Female, Transgender" },
  { "Field Name": "Father's/Guardian's Name (as per school records)", "Field Type": "text", "Is Required?": "TRUE", "Options / Range / Length": "60" },
  { "Field Name": "Father's/Guardian's Occupation", "Field Type": "text", "Is Required?": "FALSE", "Options / Range / Length": "60" },
  { "Field Name": "Mother's Name (as per school records)", "Field Type": "text", "Is Required?": "TRUE", "Options / Range / Length": "60" },
  { "Field Name": "Aadhar No.", "Field Type": "text_numeric", "Is Required?": "TRUE", "Options / Range / Length": "12", "Help Text": "12-digit Aadhaar Card Number" },
  { "Field Name": "Father's Aadhar No.", "Field Type": "text_numeric", "Is Required?": "TRUE", "Options / Range / Length": "12", "Help Text": "12-digit Father's Aadhaar Card Number" },
  { "Field Name": "Your Mother Tongue", "Field Type": "list", "Is Required?": "FALSE", "Options / Range / Length": "Kashmiri, Urdu, Pahari, Gujri, Gojri, Hindi, Dogri, English, Other" },
  { "Field Name": "Identification Mark (if any)", "Field Type": "text", "Is Required?": "FALSE", "Options / Range / Length": "100" },

  // 2. Contact & Residential Address
  { "Field Name": "Mobile No. (with working WhatsApp)", "Field Type": "text_numeric", "Is Required?": "TRUE", "Options / Range / Length": "10", "Help Text": "10-digit WhatsApp Mobile No." },
  { "Field Name": "Parent's Mobile No. (must be working)", "Field Type": "text_numeric", "Is Required?": "TRUE", "Options / Range / Length": "10", "Help Text": "10-digit Parent Contact No." },
  { "Field Name": "Email Address", "Field Type": "text", "Is Required?": "TRUE", "Options / Range / Length": "80", "Help Text": "Valid student/parent email address" },
  { "Field Name": "House No.", "Field Type": "text", "Is Required?": "FALSE", "Options / Range / Length": "30" },
  { "Field Name": "Name of your village", "Field Type": "text", "Is Required?": "TRUE", "Options / Range / Length": "60" },
  { "Field Name": "Block", "Field Type": "list", "Is Required?": "TRUE", "Options / Range / Length": "Shangus, Achabal, Kuthar, Breng, Anantnag, Other" },
  { "Field Name": "Tehsil", "Field Type": "list", "Is Required?": "TRUE", "Options / Range / Length": "Shangus, Anantnag, Achabal, Kokernag, Other" },
  { "Field Name": "District", "Field Type": "list", "Is Required?": "TRUE", "Options / Range / Length": "Anantnag, Kulgam, Pulwama, Shopian, Srinagar, Baramulla, Budgam, Ganderbal, Bandipora, Kupwara, Doda, Kishtwar, Ramban, Reasi, Udhampur, Jammu, Samba, Kathua, Rajouri, Poonch" },
  { "Field Name": "State/UT", "Field Type": "list", "Is Required?": "TRUE", "Options / Range / Length": "Jammu and Kashmir, Ladakh, Punjab, Himachal Pradesh, Delhi, Other" },
  { "Field Name": "PIN code", "Field Type": "text_numeric", "Is Required?": "TRUE", "Options / Range / Length": "6", "Help Text": "6-digit Postal PIN Code" },

  // 3. Physical & Social Category Profile
  { "Field Name": "Height (cm)", "Field Type": "number", "Is Required?": "FALSE", "Options / Range / Length": "3", "Placeholder": "e.g. 165" },
  { "Field Name": "Weight (kg)", "Field Type": "number", "Is Required?": "FALSE", "Options / Range / Length": "3", "Placeholder": "e.g. 55" },
  { "Field Name": "Blood Group", "Field Type": "list", "Is Required?": "FALSE", "Options / Range / Length": "A+, A-, B+, B-, O+, O-, AB+, AB-, Unknown" },
  { "Field Name": "Religion", "Field Type": "list", "Is Required?": "TRUE", "Options / Range / Length": "Islam, Hinduism, Sikhism, Christianity, Buddhism, Other" },
  { "Field Name": "Social category", "Field Type": "list", "Is Required?": "TRUE", "Options / Range / Length": "OM, RBA, SC, ST, OBC, EWS, ALC/IB, PSP" },
  { "Field Name": "Socio-economic category", "Field Type": "list", "Is Required?": "FALSE", "Options / Range / Length": "AAY, BPL, PHH, NPHH, General" },
  { "Field Name": "Whether Any Disability", "Field Type": "list", "Is Required?": "TRUE", "Options / Range / Length": "No, Yes" },
  { "Field Name": "Type of Disability", "Field Type": "text", "Is Required?": "FALSE", "Options / Range / Length": "100", "Help Text": "If Yes, specify nature of disability" },

  // 4. National & Student Identifiers & Sports
  { "Field Name": "PEN number (given by UDISE portal)", "Field Type": "text", "Is Required?": "FALSE", "Options / Range / Length": "12", "Help Text": "11 or 12-character UDISE PEN" },
  { "Field Name": "APAAR ID", "Field Type": "text", "Is Required?": "FALSE", "Options / Range / Length": "16", "Help Text": "12-digit APAAR/ABC ID" },
  { "Field Name": "Passport No. (if available)", "Field Type": "text", "Is Required?": "FALSE", "Options / Range / Length": "20" },
  { "Field Name": "Previous participation in sports (if any)", "Field Type": "list", "Is Required?": "FALSE", "Options / Range / Length": "School Level, Zone Level, District Level, Division Level, State Level, National Level, None" },
  { "Field Name": "Games to participate", "Field Type": "text", "Is Required?": "FALSE", "Options / Range / Length": "80" },

  // 5. Academic Details & Schooling
  { "Field Name": "Admission sought for class", "Field Type": "list", "Is Required?": "TRUE", "Options / Range / Length": "11th, 12th, 9th, 10th" },
  { "Field Name": "DIET Registration No.", "Field Type": "text", "Is Required?": "FALSE", "Options / Range / Length": "30" },

  // Class 10th / 11th Records
  { "Field Name": "Admission Type (Class 11th)", "Field Type": "list", "Is Required?": "FALSE", "Classes": "11th", "Options / Range / Length": "Regular, Provisional" },
  { "Field Name": "Reason for Provisional (Class 11th)", "Field Type": "list", "Is Required?": "FALSE", "Classes": "11th", "Options / Range / Length": "Reappear Candidate, Result Awaited, Document Deficient, Other" },
  { "Field Name": "Board Registration No. (Class 10th)", "Field Type": "text", "Is Required?": "FALSE", "Classes": "11th, 12th", "Options / Range / Length": "25", "Help Text": "16-digit JKBOSE Reg No." },
  { "Field Name": "Exam Roll Number of Class 10th", "Field Type": "text", "Is Required?": "FALSE", "Classes": "11th, 12th", "Options / Range / Length": "20" },
  { "Field Name": "Year of Passing Class 10th", "Field Type": "text", "Is Required?": "FALSE", "Classes": "11th, 12th", "Options / Range / Length": "10" },
  { "Field Name": "Year of Appearing (Class 10th)", "Field Type": "text", "Is Required?": "FALSE", "Classes": "11th", "Options / Range / Length": "10" },
  { "Field Name": "Total Marks Obtained in Class 10th", "Field Type": "number", "Is Required?": "FALSE", "Classes": "11th, 12th", "Options / Range / Length": "4" },
  { "Field Name": "Total Max. Marks in Class 10th", "Field Type": "number", "Is Required?": "FALSE", "Classes": "11th, 12th", "Options / Range / Length": "4", "Placeholder": "500" },
  { "Field Name": "Name of Previous School (Class 10th)", "Field Type": "text", "Is Required?": "FALSE", "Classes": "11th, 12th", "Options / Range / Length": "120" },
  { "Field Name": "Board (Class 10th)", "Field Type": "list", "Is Required?": "FALSE", "Classes": "11th, 12th", "Options / Range / Length": "JKBOSE, CBSE, ICSE, Other" },

  // Class 11th / 12th Records
  { "Field Name": "Admission Type (Class 12th)", "Field Type": "list", "Is Required?": "FALSE", "Classes": "12th", "Options / Range / Length": "Regular, Provisional" },
  { "Field Name": "Reason for Provisional (Class 12th)", "Field Type": "list", "Is Required?": "FALSE", "Classes": "12th", "Options / Range / Length": "Reappear Candidate, Result Awaited, Document Deficient, Other" },
  { "Field Name": "Board Registration No. (Class 11th)", "Field Type": "text", "Is Required?": "FALSE", "Classes": "12th", "Options / Range / Length": "25" },
  { "Field Name": "Exam Roll Number of Class 11th", "Field Type": "text", "Is Required?": "FALSE", "Classes": "12th", "Options / Range / Length": "20" },
  { "Field Name": "Year of Passing Class 11th", "Field Type": "text", "Is Required?": "FALSE", "Classes": "12th", "Options / Range / Length": "10" },
  { "Field Name": "Year of Appearing (Class 11th)", "Field Type": "text", "Is Required?": "FALSE", "Classes": "12th", "Options / Range / Length": "10" },
  { "Field Name": "Total Marks Obtained in Class 11th", "Field Type": "number", "Is Required?": "FALSE", "Classes": "12th", "Options / Range / Length": "4" },
  { "Field Name": "Total Max. Marks in Class 11th", "Field Type": "number", "Is Required?": "FALSE", "Classes": "12th", "Options / Range / Length": "4", "Placeholder": "500" },
  { "Field Name": "Name of Previous School (Class 11th)", "Field Type": "text", "Is Required?": "FALSE", "Classes": "12th", "Options / Range / Length": "120" },
  { "Field Name": "Board (Class 11th)", "Field Type": "list", "Is Required?": "FALSE", "Classes": "12th", "Options / Range / Length": "JKBOSE, CBSE, ICSE, Other" },

  // Class 8th / 9th Records
  { "Field Name": "Year of Passing Class 8th", "Field Type": "text", "Is Required?": "FALSE", "Classes": "9th, 10th", "Options / Range / Length": "10" },
  { "Field Name": "Name of Previous School (Class 8th)", "Field Type": "text", "Is Required?": "FALSE", "Classes": "9th, 10th", "Options / Range / Length": "120" },
  { "Field Name": "Board (Class 8th)", "Field Type": "text", "Is Required?": "FALSE", "Classes": "9th, 10th", "Options / Range / Length": "60" },
  { "Field Name": "Total Marks Obtained in Class 8th", "Field Type": "number", "Is Required?": "FALSE", "Classes": "9th, 10th", "Options / Range / Length": "4" },
  { "Field Name": "Total Max. Marks in Class 8th", "Field Type": "number", "Is Required?": "FALSE", "Classes": "9th, 10th", "Options / Range / Length": "4" },
  { "Field Name": "Name of Previous Complex Head", "Field Type": "text", "Is Required?": "FALSE", "Classes": "9th, 10th", "Options / Range / Length": "80" },

  // Bank & Scholarship Details
  { "Field Name": "Whether scholarship received in previous academic year", "Field Type": "list", "Is Required?": "FALSE", "Options / Range / Length": "No, Yes" },
  { "Field Name": "Type of scholarship received", "Field Type": "text", "Is Required?": "FALSE", "Options / Range / Length": "80" },
  { "Field Name": "Amount received (INR)", "Field Type": "number", "Is Required?": "FALSE", "Options / Range / Length": "6" },
  { "Field Name": "Bank Account No.", "Field Type": "text_numeric", "Is Required?": "TRUE", "Options / Range / Length": "18", "Help Text": "Student/Parent Bank Account No. (9–18 digits)" },
  { "Field Name": "Name of Bank", "Field Type": "text", "Is Required?": "TRUE", "Options / Range / Length": "80" },
  { "Field Name": "IFSC code", "Field Type": "text", "Is Required?": "TRUE", "Options / Range / Length": "11", "Help Text": "11-character Bank IFSC Code (e.g. SBIN0001234)" },
  { "Field Name": "Vocational subject in previous class", "Field Type": "list", "Is Required?": "FALSE", "Options / Range / Length": "No, Yes" },
  { "Field Name": "Percentage Obtained in Vocational Subject", "Field Type": "text", "Is Required?": "FALSE", "Options / Range / Length": "10" },

  // 6. Subject Selections
  { "Field Name": "Stream for Class 11th", "Field Type": "list", "Is Required?": "TRUE", "Classes": "11th", "Options / Range / Length": "Medical, Non-Medical, Science, Arts, Humanities, Commerce" },
  { "Field Name": "Subjects to be taken in Class 11th", "Field Type": "checkbox_dynamic", "Is Required?": "TRUE", "Classes": "11th" },
  { "Field Name": "Subjects to Reappear (Class 10th)", "Field Type": "text", "Is Required?": "FALSE", "Classes": "11th", "Options / Range / Length": "150" },
  { "Field Name": "Stream opted in Class 11th", "Field Type": "list", "Is Required?": "TRUE", "Classes": "12th", "Options / Range / Length": "Medical, Non-Medical, Science, Arts, Humanities, Commerce" },
  { "Field Name": "Subjects Studied in Class 11th", "Field Type": "checkbox_dynamic", "Is Required?": "TRUE", "Classes": "12th" },
  { "Field Name": "Stream & Subjects for Class 12th", "Field Type": "text", "Is Required?": "FALSE", "Classes": "12th", "Options / Range / Length": "150" },
  { "Field Name": "Subjects to Reappear (Class 11th)", "Field Type": "text", "Is Required?": "FALSE", "Classes": "12th", "Options / Range / Length": "150" },
  { "Field Name": "Subjects Studied in Class 8th", "Field Type": "text", "Is Required?": "FALSE", "Classes": "9th", "Options / Range / Length": "150" },
  { "Field Name": "Subjects to be taken in Class 9th", "Field Type": "checkbox_dynamic", "Is Required?": "TRUE", "Classes": "9th" },
  { "Field Name": "Subjects Studied in Class 9th", "Field Type": "text", "Is Required?": "FALSE", "Classes": "10th", "Options / Range / Length": "150" },
  { "Field Name": "Subjects to be taken in Class 10th", "Field Type": "checkbox_dynamic", "Is Required?": "TRUE", "Classes": "10th" },

  // 7. Docs & Declaration
  { "Field Name": "Student Photo", "Field Type": "image", "Is Required?": "TRUE", "Help Text": "Upload clear passport-size photo (Max 200 KB)" },
  { "Field Name": "Remarks/Feedback (if any)", "Field Type": "textarea", "Is Required?": "FALSE", "Options / Range / Length": "300" },
  { "Field Name": "Declaration", "Field Type": "checkbox_declaration", "Is Required?": "TRUE", "Options / Range / Length": "I hereby declare that all particulars filled in this form are correct and true to the best of my knowledge." }
];

export const DEFAULT_SUBJECTS_CONFIG = {
  "11th": {
    "Science": {
      "compulsory": ["General English", "Physics", "Chemistry"],
      "group1": ["Biology", "Mathematics", "Environmental Science"],
      "group2": ["Information Practices", "Computer Science", "Physical Education", "Urdu", "Psychology"]
    },
    "Medical": {
      "compulsory": ["General English", "Physics", "Chemistry", "Biology"],
      "group1": ["Environmental Science", "Mathematics", "Information Practices", "Urdu", "Computer Science"],
      "group2": ["Physical Education", "Public Administration", "Sociology", "Psychology"]
    },
    "Non-Medical": {
      "compulsory": ["General English", "Physics", "Chemistry", "Mathematics"],
      "group1": ["Environmental Science", "Information Practices", "Computer Science", "Urdu"],
      "group2": ["Physical Education", "Statistics", "Geology"]
    },
    "Humanities": {
      "compulsory": ["General English"],
      "group1": ["Political Science", "History", "Sociology", "Economics", "Education", "Geography", "Urdu", "Kashmiri", "Islamic Studies"],
      "group2": ["Environmental Science", "Physical Education", "Mathematics", "Computer Science", "Public Administration", "Psychology"]
    },
    "Arts": {
      "compulsory": ["General English"],
      "group1": ["Political Science", "History", "Sociology", "Economics", "Education", "Geography", "Urdu", "Kashmiri", "Islamic Studies"],
      "group2": ["Environmental Science", "Physical Education", "Mathematics", "Computer Science", "Public Administration", "Psychology"]
    },
    "Commerce": {
      "compulsory": ["General English", "Accountancy", "Business Studies"],
      "group1": ["Entrepreneurship", "Economics", "Mathematics"],
      "group2": ["Environmental Science", "Information Practices", "Physical Education"]
    }
  },
  "12th": {
    "Science": {
      "compulsory": ["General English", "Physics", "Chemistry"],
      "group1": ["Biology", "Mathematics", "Environmental Science"],
      "group2": ["Information Practices", "Computer Science", "Physical Education", "Urdu"]
    },
    "Medical": {
      "compulsory": ["General English", "Physics", "Chemistry", "Biology"],
      "group1": ["Environmental Science", "Mathematics", "Information Practices", "Urdu", "Computer Science"],
      "group2": ["Physical Education", "Public Administration", "Sociology"]
    },
    "Non-Medical": {
      "compulsory": ["General English", "Physics", "Chemistry", "Mathematics"],
      "group1": ["Environmental Science", "Information Practices", "Computer Science", "Urdu"],
      "group2": ["Physical Education", "Statistics"]
    },
    "Humanities": {
      "compulsory": ["General English"],
      "group1": ["Political Science", "History", "Sociology", "Economics", "Education", "Geography", "Urdu", "Kashmiri", "Islamic Studies"],
      "group2": ["Environmental Science", "Physical Education", "Mathematics", "Computer Science", "Public Administration"]
    },
    "Arts": {
      "compulsory": ["General English"],
      "group1": ["Political Science", "History", "Sociology", "Economics", "Education", "Geography", "Urdu", "Kashmiri", "Islamic Studies"],
      "group2": ["Environmental Science", "Physical Education", "Mathematics", "Computer Science"]
    },
    "Commerce": {
      "compulsory": ["General English", "Accountancy", "Business Studies"],
      "group1": ["Entrepreneurship", "Economics", "Mathematics"],
      "group2": ["Environmental Science", "Information Practices", "Physical Education"]
    }
  },
  "9th": {
    "General": {
      "compulsory": ["English", "Mathematics", "Science", "Social Science"],
      "languages": ["Urdu", "Kashmiri", "Hindi"],
      "vocational": ["IT & ITES", "Healthcare", "Computer Applications", "Retail", "Tourism"]
    }
  },
  "10th": {
    "General": {
      "compulsory": ["English", "Mathematics", "Science", "Social Science"],
      "languages": ["Urdu", "Kashmiri", "Hindi"],
      "vocational": ["IT & ITES", "Healthcare", "Computer Applications", "Retail", "Tourism"]
    }
  }
};

