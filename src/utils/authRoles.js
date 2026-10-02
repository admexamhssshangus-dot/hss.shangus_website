/**
 * Lightweight, zero-dependency role constants and validation helpers.
 * Strictly enforces that each email belongs to ONE and ONLY ONE role:
 * 1. SuperAdmin (Root Master Administrator)
 * 2. Admin (Standard Administrator)
 * 3. Teacher (Faculty / Educator)
 * 4. Student (Learner / Applicant)
 */

export const ROLES = Object.freeze({
  SUPER_ADMIN: 'SuperAdmin',
  STANDARD_ADMIN: 'Admin',
  TEACHER: 'Teacher',
  STUDENT: 'Student',
});

export const SUPERADMIN_EMAIL = 'adm.exam.hss.shangus@gmail.com';
export const SUPERADMIN_EMAILS = Object.freeze([
  'adm.exam.hss.shangus@gmail.com',
]);

export const BOOTSTRAP_ADMINS = Object.freeze([
  'ghssshangus74@gmail.com',
  'e.educational.24@gmail.com',
  'majidhassannajar@gmail.com',
  'bilalhcu@gmail.com',
  'shahnawaz13678@gmail.com',
  'shahnawaz@gmail.com',
]);

export function isSuperAdminEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const clean = email.trim().toLowerCase();
  return clean === SUPERADMIN_EMAIL;
}

export function isStandardAdminEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const clean = email.trim().toLowerCase();
  return BOOTSTRAP_ADMINS.includes(clean) && clean !== SUPERADMIN_EMAIL;
}

export function isBootstrapAdminEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const clean = email.trim().toLowerCase();
  return clean === SUPERADMIN_EMAIL || BOOTSTRAP_ADMINS.includes(clean);
}

// Backward-compat alias for components expecting isBootstrapSuperAdminEmail
export const isBootstrapSuperAdminEmail = isSuperAdminEmail;

/**
 * Authoritatively determines the EXACT SINGLE ROLE for an email/profile.
 * Ensures absolute mutual exclusivity between SuperAdmin, Admin, Teacher, and Student.
 */
export function getStrictCanonicalRole(email, profile = null) {
  const cleanEmail = String(email || profile?.email || '').trim().toLowerCase();
  if (isSuperAdminEmail(cleanEmail)) {
    return ROLES.SUPER_ADMIN;
  }
  if (isStandardAdminEmail(cleanEmail)) {
    return ROLES.STANDARD_ADMIN;
  }

  const rawRole = String(profile?.role || '').trim().toLowerCase();

  // Explicit Teacher / Faculty
  if (rawRole === 'teacher' || rawRole === 'faculty' || Boolean(profile?.isTeacher)) {
    return ROLES.TEACHER;
  }

  // Explicit Standard Admin
  if (rawRole === 'admin' || rawRole === 'administrator' || Boolean(profile?.isAdmin)) {
    return ROLES.STANDARD_ADMIN;
  }

  // Student / User
  return ROLES.STUDENT;
}

/**
 * Injects mutually exclusive boolean flags based on the strict canonical role.
 * Guarantees that no user object can ever have conflicting flags (e.g. isAdmin AND isTeacher).
 */
export function enforceStrictRoleAttributes(userOrProfile) {
  if (!userOrProfile) return null;
  const email = userOrProfile.email || '';
  const strictRole = getStrictCanonicalRole(email, userOrProfile);

  const isSuper = strictRole === ROLES.SUPER_ADMIN;
  const isStdAdmin = strictRole === ROLES.STANDARD_ADMIN;
  const isTeacher = strictRole === ROLES.TEACHER;
  const isStudent = strictRole === ROLES.STUDENT;

  return {
    ...userOrProfile,
    role: strictRole,
    isSuperAdmin: isSuper,
    isAdmin: isSuper || isStdAdmin,
    isTeacher: isTeacher,
    isStudent: isStudent,
    isStaff: isSuper || isStdAdmin || isTeacher,
    // Strictly clear conflicting attributes
    ...(isTeacher ? {} : {
      subject: isStudent ? (userOrProfile.subject || '') : '',
      teachingSubject: '',
      assignedSubjects: [],
      assignedClasses: [],
      tierSubjects: null,
      classSubjectMap: null,
    }),
  };
}

