/**
 * HSS SHANGUS — Default Form Structure Schema & Subjects Configuration
 * Authoritative 72-column schema and subject choices used as instant Firestore/Offline fallback.
 */

export const DEFAULT_FORM_STRUCTURE = [
  // 1. Personal & Identity Details
  { "Field Name": "Student's Name (as per school records)", "Field Type": "text", "Is Required?": "TRUE", "Options / Range / Length": "60", "Help Text": "Enter your full name exactly as printed on your Class 10th Marks Card or School Leaving Certificate." },
  { "Field Name": "DoB (as per school records)", "Field Type": "date", "Is Required?": "TRUE", "Help Text": "Date of Birth must match your official matriculation certificate. Class 11th admission requires minimum 14 years as per JKBOSE guidelines." },
  { "Field Name": "Gender", "Field Type": "list", "Is Required?": "TRUE", "Options / Range / Length": "Male, Female, Transgender" },
  { "Field Name": "Father's/Guardian's Name (as per school records)", "Field Type": "text", "Is Required?": "TRUE", "Options / Range / Length": "60", "Help Text": "Enter father's or legal guardian's name matching previous school leaving records." },
  { "Field Name": "Father's/Guardian's Occupation", "Field Type": "text", "Is Required?": "FALSE", "Options / Range / Length": "60" },
  { "Field Name": "Mother's Name (as per school records)", "Field Type": "text", "Is Required?": "TRUE", "Options / Range / Length": "60", "Help Text": "Enter mother's full legal name as registered in school records." },
  { "Field Name": "Aadhar No.", "Field Type": "text_numeric", "Is Required?": "TRUE", "Options / Range / Length": "12", "Help Text": "Enter student's 12-digit UIDAI Aadhaar number. Required for DBT scholarship processing." },
  { "Field Name": "Father's Aadhar No.", "Field Type": "text_numeric", "Is Required?": "TRUE", "Options / Range / Length": "12", "Help Text": "Enter the 12-digit Aadhaar number of father or legal guardian for official verification." },
  { "Field Name": "Your Mother Tongue", "Field Type": "list", "Is Required?": "FALSE", "Options / Range / Length": "Kashmiri, Urdu, Pahari, Gujri, Gojri, Hindi, Dogri, English, Other" },
  { "Field Name": "Identification Mark (if any)", "Field Type": "text", "Is Required?": "FALSE", "Options / Range / Length": "100", "Help Text": "Specify a permanent visible identification mark (e.g. mole on right cheek, scar on forehead)." },

  // 2. Contact & Residential Address
  { "Field Name": "Mobile No. (with working WhatsApp)", "Field Type": "text_numeric", "Is Required?": "TRUE", "Options / Range / Length": "10", "Help Text": "Enter an active 10-digit mobile number with WhatsApp. All crucial school circulars, time tables, and result alerts will be delivered here." },
  { "Field Name": "Parent's Mobile No. (must be working)", "Field Type": "text_numeric", "Is Required?": "TRUE", "Options / Range / Length": "10", "Help Text": "Enter parent's or guardian's functional 10-digit mobile number for emergency notifications and SMS advisories." },
  { "Field Name": "Email Address", "Field Type": "text", "Is Required?": "TRUE", "Options / Range / Length": "80", "Help Text": "Provide a valid email address to receive admission confirmation receipts and downloadable form copies." },
  { "Field Name": "House No.", "Field Type": "text", "Is Required?": "FALSE", "Options / Range / Length": "30" },
  { "Field Name": "Name of your village", "Field Type": "text", "Is Required?": "TRUE", "Options / Range / Length": "60", "Help Text": "Enter your residential village, town, or mohalla name." },
  { "Field Name": "Block", "Field Type": "list", "Is Required?": "TRUE", "Options / Range / Length": "Shangus, Achabal, Kuthar, Breng, Anantnag, Other" },
  { "Field Name": "Tehsil", "Field Type": "list", "Is Required?": "TRUE", "Options / Range / Length": "Shangus, Anantnag, Achabal, Kokernag, Other" },
  { "Field Name": "District", "Field Type": "list", "Is Required?": "TRUE", "Options / Range / Length": "Anantnag, Kulgam, Pulwama, Shopian, Srinagar, Baramulla, Budgam, Ganderbal, Bandipora, Kupwara, Doda, Kishtwar, Ramban, Reasi, Udhampur, Jammu, Samba, Kathua, Rajouri, Poonch" },
  { "Field Name": "State/UT", "Field Type": "list", "Is Required?": "TRUE", "Options / Range / Length": "Jammu and Kashmir, Ladakh, Punjab, Himachal Pradesh, Delhi, Other" },
  { "Field Name": "PIN code", "Field Type": "text_numeric", "Is Required?": "TRUE", "Options / Range / Length": "6", "Help Text": "Enter the 6-digit postal PIN code of your local post office." },

  // 3. Physical & Social Category Profile
  { "Field Name": "Height (cm)", "Field Type": "number", "Is Required?": "FALSE", "Options / Range / Length": "3", "Placeholder": "e.g. 165" },
  { "Field Name": "Weight (kg)", "Field Type": "number", "Is Required?": "FALSE", "Options / Range / Length": "3", "Placeholder": "e.g. 55" },
  { "Field Name": "Blood Group", "Field Type": "list", "Is Required?": "FALSE", "Options / Range / Length": "A+, A-, B+, B-, O+, O-, AB+, AB-, Unknown" },
  { "Field Name": "Religion", "Field Type": "list", "Is Required?": "TRUE", "Options / Range / Length": "Islam, Hinduism, Sikhism, Christianity, Buddhism, Other" },
  { "Field Name": "Social category", "Field Type": "list", "Is Required?": "TRUE", "Options / Range / Length": "OM, RBA, SC, ST, OBC, EWS, ALC/IB, PSP", "Help Text": "Select your recognized social category (OM, RBA, SC, ST, OBC, EWS, ALC/IB, PSP). You must hold a valid certificate from the competent revenue authority." },
  { "Field Name": "Socio-economic category", "Field Type": "list", "Is Required?": "FALSE", "Options / Range / Length": "AAY, BPL, PHH, NPHH, General" },
  { "Field Name": "Whether Any Disability", "Field Type": "list", "Is Required?": "TRUE", "Options / Range / Length": "No, Yes", "Help Text": "Select 'Yes' if you have 40% or more benchmark disability to avail government fee concessions and assistive exam accommodations." },
  { "Field Name": "Type of Disability", "Field Type": "text", "Is Required?": "FALSE", "Options / Range / Length": "100", "Help Text": "Specify the nature of disability as stated in your official UDID or Medical Board certificate." },

  // 4. National & Student Identifiers & Sports
  { "Field Name": "PEN number (given by UDISE portal)", "Field Type": "text", "Is Required?": "FALSE", "Options / Range / Length": "12", "Help Text": "Permanent Education Number (PEN) is the 11-digit national student ID issued by the Ministry of Education via the UDISE+ portal." },
  { "Field Name": "APAAR ID", "Field Type": "text", "Is Required?": "FALSE", "Options / Range / Length": "16", "Help Text": "Automated Permanent Academic Account Registry (APAAR ID) is the 12-digit lifelong academic credential ID under NEP 2020 linked with DigiLocker." },
  { "Field Name": "Passport No. (if available)", "Field Type": "text", "Is Required?": "FALSE", "Options / Range / Length": "20" },
  { "Field Name": "Previous participation in sports (if any)", "Field Type": "list", "Is Required?": "FALSE", "Options / Range / Length": "School Level, Zone Level, District Level, Division Level, State Level, National Level, None" },
  { "Field Name": "Games to participate", "Field Type": "text", "Is Required?": "FALSE", "Options / Range / Length": "80" },

  // 5. Academic Details & Schooling
  { "Field Name": "Admission sought for class", "Field Type": "list", "Is Required?": "TRUE", "Options / Range / Length": "11th, 12th, 9th, 10th", "Help Text": "Select your target class of admission (11th, 12th, 10th, or 9th)." },
  { "Field Name": "DIET Registration No.", "Field Type": "text", "Is Required?": "FALSE", "Options / Range / Length": "30" },

  // Class 10th / 11th Records
  { "Field Name": "Admission Type (Class 11th)", "Field Type": "list", "Is Required?": "FALSE", "Classes": "11th", "Options / Range / Length": "Regular, Provisional", "Help Text": "Select 'Regular' if you passed Class 10th in full. Select 'Provisional' if you are appearing in bi-annual/reappear exams or awaiting result." },
  { "Field Name": "Reason for Provisional (Class 11th)", "Field Type": "list", "Is Required?": "FALSE", "Classes": "11th", "Options / Range / Length": "Reappear Candidate, Result Awaited, Document Deficient, Other", "Help Text": "Specify the reason for provisional admission (e.g. Reappear in 1–2 subjects, Result Awaited). Final admission is subject to passing." },
  { "Field Name": "Board Registration No. (Class 10th)", "Field Type": "text", "Is Required?": "FALSE", "Classes": "11th, 12th", "Options / Range / Length": "25", "Help Text": "Enter the 16-character JKBOSE registration number (e.g. 23N-1234567-89) printed on your Class 10th marks card." },
  { "Field Name": "Exam Roll Number of Class 10th", "Field Type": "text", "Is Required?": "FALSE", "Classes": "11th, 12th", "Options / Range / Length": "20", "Help Text": "Enter your 7 or 8-digit Class 10th Board Examination Roll Number." },
  { "Field Name": "Year of Passing Class 10th", "Field Type": "text", "Is Required?": "FALSE", "Classes": "11th, 12th", "Options / Range / Length": "10" },
  { "Field Name": "Year of Appearing (Class 10th)", "Field Type": "text", "Is Required?": "FALSE", "Classes": "11th", "Options / Range / Length": "10" },
  { "Field Name": "Total Marks Obtained in Class 10th", "Field Type": "number", "Is Required?": "FALSE", "Classes": "11th, 12th", "Options / Range / Length": "4", "Help Text": "Enter aggregate marks obtained out of maximum total marks in Class 10th." },
  { "Field Name": "Total Max. Marks in Class 10th", "Field Type": "number", "Is Required?": "FALSE", "Classes": "11th, 12th", "Options / Range / Length": "4", "Placeholder": "500", "Help Text": "Enter maximum aggregate marks (default 500 for JKBOSE)." },
  { "Field Name": "Name of Previous School (Class 10th)", "Field Type": "text", "Is Required?": "FALSE", "Classes": "11th, 12th", "Options / Range / Length": "120", "Help Text": "Select or type the complete name of the school or institute where you completed Class 10th." },
  { "Field Name": "Board (Class 10th)", "Field Type": "list", "Is Required?": "FALSE", "Classes": "11th, 12th", "Options / Range / Length": "JKBOSE, CBSE, ICSE, Other", "Help Text": "Select your Class 10th examining educational board (JKBOSE, CBSE, ICSE, NIOS, etc.)." },

  // Class 11th / 12th Records
  { "Field Name": "Admission Type (Class 12th)", "Field Type": "list", "Is Required?": "FALSE", "Classes": "12th", "Options / Range / Length": "Regular, Provisional", "Help Text": "Select 'Regular' if promoted/passed Class 11th. Select 'Provisional' if having backlog/reappear." },
  { "Field Name": "Reason for Provisional (Class 12th)", "Field Type": "list", "Is Required?": "FALSE", "Classes": "12th", "Options / Range / Length": "Reappear Candidate, Result Awaited, Document Deficient, Other" },
  { "Field Name": "Board Registration No. (Class 11th)", "Field Type": "text", "Is Required?": "FALSE", "Classes": "12th", "Options / Range / Length": "25", "Help Text": "Enter your Class 11th registration number allotted by JKBOSE." },
  { "Field Name": "Exam Roll Number of Class 11th", "Field Type": "text", "Is Required?": "FALSE", "Classes": "12th", "Options / Range / Length": "20" },
  { "Field Name": "Year of Passing Class 11th", "Field Type": "text", "Is Required?": "FALSE", "Classes": "12th", "Options / Range / Length": "10" },
  { "Field Name": "Year of Appearing (Class 11th)", "Field Type": "text", "Is Required?": "FALSE", "Classes": "12th", "Options / Range / Length": "10" },
  { "Field Name": "Total Marks Obtained in Class 11th", "Field Type": "number", "Is Required?": "FALSE", "Classes": "12th", "Options / Range / Length": "4" },
  { "Field Name": "Total Max. Marks in Class 11th", "Field Type": "number", "Is Required?": "FALSE", "Classes": "12th", "Options / Range / Length": "4", "Placeholder": "500" },
  { "Field Name": "Name of Previous School (Class 11th)", "Field Type": "text", "Is Required?": "FALSE", "Classes": "12th", "Options / Range / Length": "120" },
  { "Field Name": "Board (Class 11th)", "Field Type": "list", "Is Required?": "FALSE", "Classes": "12th", "Options / Range / Length": "JKBOSE, CBSE, ICSE, Other" },

  // Class 8th / 9th Records
  { "Field Name": "Year of Passing Class 8th", "Field Type": "text", "Is Required?": "FALSE", "Classes": "9th, 10th", "Options / Range / Length": "4", "Placeholder": "e.g. 2024" },
  { "Field Name": "Name of Previous School (Class 8th)", "Field Type": "text", "Is Required?": "FALSE", "Classes": "9th, 10th", "Options / Range / Length": "120" },
  { "Field Name": "Board (Class 8th)", "Field Type": "list", "Is Required?": "FALSE", "Classes": "9th, 10th", "Options / Range / Length": "JKBOSE, CBSE, ICSE, DIET, Other" },
  { "Field Name": "Total Marks Obtained in Class 8th", "Field Type": "number", "Is Required?": "FALSE", "Classes": "9th, 10th", "Options / Range / Length": "4" },
  { "Field Name": "Total Max. Marks in Class 8th", "Field Type": "number", "Is Required?": "FALSE", "Classes": "9th, 10th", "Options / Range / Length": "4", "Placeholder": "500" },
  { "Field Name": "Name of Previous Complex Head", "Field Type": "text", "Is Required?": "FALSE", "Classes": "9th, 10th", "Options / Range / Length": "80" },

  // Bank & Scholarship Details
  { "Field Name": "Whether scholarship received in previous academic year", "Field Type": "list", "Is Required?": "FALSE", "Options / Range / Length": "No, Yes" },
  { "Field Name": "Type of scholarship received", "Field Type": "text", "Is Required?": "FALSE", "Options / Range / Length": "80" },
  { "Field Name": "Amount received (INR)", "Field Type": "number", "Is Required?": "FALSE", "Options / Range / Length": "6" },
  { "Field Name": "Bank Account No.", "Field Type": "text_numeric", "Is Required?": "TRUE", "Options / Range / Length": "18", "Help Text": "Enter student's active single/joint savings bank account number (9 to 18 digits) for scholarship disbursements." },
  { "Field Name": "Name of Bank", "Field Type": "text", "Is Required?": "TRUE", "Options / Range / Length": "80", "Help Text": "Enter bank name (e.g. J&K Bank, State Bank of India). Branch must be CBS-enabled." },
  { "Field Name": "IFSC code", "Field Type": "text", "Is Required?": "TRUE", "Options / Range / Length": "11", "Help Text": "Enter the 11-character Bank Branch IFSC Code (e.g. JAKA0SHNGUS, SBIN0001234)." },
  { "Field Name": "Vocational subject in previous class", "Field Type": "list", "Is Required?": "FALSE", "Options / Range / Length": "No, Yes" },
  { "Field Name": "Percentage Obtained in Vocational Subject", "Field Type": "text", "Is Required?": "FALSE", "Options / Range / Length": "10" },

  // 6. Subject Selections
  { "Field Name": "Stream for Class 11th", "Field Type": "list", "Is Required?": "TRUE", "Classes": "11th", "Options / Range / Length": "Science, Arts, Humanities", "Help Text": "Choose your academic stream: Science or Arts/Humanities." },
  { "Field Name": "Subjects to be taken in Class 11th", "Field Type": "checkbox_dynamic", "Is Required?": "TRUE", "Classes": "11th", "Help Text": "Select 5 subjects including General English (compulsory) plus your elective and skill subjects." },
  { "Field Name": "Subjects to Reappear (Class 10th)", "Field Type": "text", "Is Required?": "FALSE", "Classes": "11th", "Options / Range / Length": "150", "Help Text": "List the subject(s) in which you have reappear/compartment in Class 10th for provisional verification." },
  { "Field Name": "Stream opted in Class 11th", "Field Type": "list", "Is Required?": "TRUE", "Classes": "12th", "Options / Range / Length": "Science, Arts, Humanities" },
  { "Field Name": "Subjects Studied in Class 11th", "Field Type": "checkbox_dynamic", "Is Required?": "TRUE", "Classes": "12th" },
  { "Field Name": "Stream & Subjects for Class 12th", "Field Type": "text", "Is Required?": "FALSE", "Classes": "12th", "Options / Range / Length": "150" },
  { "Field Name": "Subjects to Reappear (Class 11th)", "Field Type": "text", "Is Required?": "FALSE", "Classes": "12th", "Options / Range / Length": "150" },
  { "Field Name": "Subjects Studied in Class 8th", "Field Type": "text", "Is Required?": "FALSE", "Classes": "9th", "Options / Range / Length": "150" },
  { "Field Name": "Subjects to be taken in Class 9th", "Field Type": "checkbox_dynamic", "Is Required?": "TRUE", "Classes": "9th" },
  { "Field Name": "Subjects Studied in Class 9th", "Field Type": "text", "Is Required?": "FALSE", "Classes": "10th", "Options / Range / Length": "150" },
  { "Field Name": "Subjects to be taken in Class 10th", "Field Type": "checkbox_dynamic", "Is Required?": "TRUE", "Classes": "10th" },

  // 7. Docs & Declaration
  { "Field Name": "Student Photo", "Field Type": "image", "Is Required?": "TRUE", "Help Text": "Upload a clear, recent passport-size photograph with white or light background. Avoid selfies, sunglasses, or group pictures (Max file size 200 KB)." },
  { "Field Name": "Remarks/Feedback (if any)", "Field Type": "textarea", "Is Required?": "FALSE", "Options / Range / Length": "300" },
  { "Field Name": "Declaration", "Field Type": "checkbox_declaration", "Is Required?": "TRUE", "Options / Range / Length": "I hereby declare that all particulars filled in this form are correct and true to the best of my knowledge." }
];

export const DEFAULT_SUBJECTS_CONFIG = {
  "11th": {
    "Science": {
      "compulsory": ["General English", "Physics", "Chemistry"],
      "group1": ["Biology", "Mathematics"],
      "group2": ["Environmental Science", "Physical Education", "Healthcare", "IT and ITES"]
    },
    "Humanities": {
      "compulsory": ["General English"],
      "group1": ["Urdu", "Education", "Economics", "History", "Political Science", "Mathematics"],
      "group2": ["Environmental Science", "Physical Education", "Healthcare", "IT and ITES"]
    },
    "Arts": {
      "compulsory": ["General English"],
      "group1": ["Urdu", "Education", "Economics", "History", "Political Science", "Mathematics"],
      "group2": ["Environmental Science", "Physical Education", "Healthcare", "IT and ITES"]
    },
    "Commerce": {
      "compulsory": ["General English", "Accountancy", "Business Studies"],
      "group1": ["Economics", "Entrepreneurship", "Mathematics"],
      "group2": ["Environmental Science", "Physical Education", "Healthcare", "IT and ITES"]
    }
  },
  "12th": {
    "Science": {
      "compulsory": ["General English", "Physics", "Chemistry"],
      "group1": ["Biology", "Mathematics"],
      "group2": ["Environmental Science", "Physical Education", "Healthcare", "IT and ITES"]
    },
    "Humanities": {
      "compulsory": ["General English"],
      "group1": ["Urdu", "Education", "Economics", "History", "Political Science", "Mathematics"],
      "group2": ["Environmental Science", "Physical Education", "Healthcare", "IT and ITES"]
    },
    "Arts": {
      "compulsory": ["General English"],
      "group1": ["Urdu", "Education", "Economics", "History", "Political Science", "Mathematics"],
      "group2": ["Environmental Science", "Physical Education", "Healthcare", "IT and ITES"]
    },
    "Commerce": {
      "compulsory": ["General English", "Accountancy", "Business Studies"],
      "group1": ["Economics", "Entrepreneurship", "Mathematics"],
      "group2": ["Environmental Science", "Physical Education", "Healthcare", "IT and ITES"]
    }
  },
  "9th": {
    "General": {
      "compulsory": ["English", "Mathematics", "Science", "Social Science"],
      "group1": ["Urdu", "Arabic", "Hindi", "Kashmiri"],
      "group2": ["Healthcare", "IT and ITES"]
    }
  },
  "10th": {
    "General": {
      "compulsory": ["English", "Mathematics", "Science", "Social Science"],
      "group1": ["Urdu", "Arabic", "Hindi", "Kashmiri"],
      "group2": ["Healthcare", "IT and ITES"]
    }
  }
};


