// Shared public facts and metadata for browser navigation and production HTML.
const SITE_ORIGIN = 'https://hssshangus.netlify.app';
const SITE_NAME = 'HSS Shangus';
const SCHOOL_NAME = 'Govt. Higher Secondary School Shangus';
const DEFAULT_IMAGE = `${SITE_ORIGIN}/slides/og-card.jpg`;
const PUBLIC_PAGES = {
  '/': {
    label: 'Home', title: `HSS Shangus | ${SCHOOL_NAME}`, heading: SCHOOL_NAME,
    description: 'Official website of HSS Shangus, Anantnag. Explore Science, Humanities and secondary education, admissions, notices, and student and staff services.',
    paragraphs: [
      'Govt. Higher Secondary School Shangus serves students in Shangus, Anantnag, Jammu and Kashmir. Established as a primary school in 1917, the institution attained Higher Secondary status in 2005.',
      'The school offers secondary education and higher secondary streams in Science and Humanities, supported by science laboratories, a library and sports activities.'
    ], links: ['/about', '/academics', '/admissions', '/notices', '/login', '/contact']
  },
  '/about': {
    label: 'About Us', title: `About Us | ${SITE_NAME}`, heading: 'About Our Institution',
    description: 'Discover the history of Govt. Higher Secondary School Shangus since 1917, its educational mission, leadership, campus and facilities in Anantnag.',
    paragraphs: [
      'Govt. Higher Secondary School Shangus began as a primary school in 1917. The institution progressed through upgrades in 1978–79 and attained Higher Secondary status in 2005.',
      'Located in the Kashmir Valley near Shangus Forest Lodge, the school serves communities from Kachwan to Uttresoo. Its classrooms, science laboratories and library support learning in Science, Humanities and secondary education.'
    ], links: ['/academics', '/admissions', '/contact']
  },
  '/academics': {
    label: 'Academics', title: `Academics, Streams & Faculty | ${SITE_NAME}`, heading: 'Academics, Streams & Faculty',
    description: 'Explore secondary subjects, Science and Humanities streams, subject combinations and faculty at Govt. Higher Secondary School Shangus.',
    paragraphs: [
      'Secondary subjects include English, Mathematics, Science and Social Studies, with Urdu and vocational options including Healthcare and IT & ITES.',
      'Higher secondary students can explore Science and Humanities combinations. Subjects include General English, Physics, Chemistry, Biology, Mathematics, Education, History, Political Science, Economics and Urdu.',
      'The interactive academics page provides subject combinations and the school faculty directory.'
    ], links: ['/admissions', '/about', '/contact']
  },
  '/admissions': {
    label: 'Admissions', title: `Admissions | ${SITE_NAME}`, heading: 'Admissions at HSS Shangus',
    description: 'Read admission guidance for Classes 9–12 at HSS Shangus, including online registration, required documents, class availability and fee information.',
    paragraphs: [
      'The admission process covers Classes 9, 10, 11 and 12 at Govt. Higher Secondary School Shangus. Applicants can use the student portal to register and complete their admission application.',
      'Required documents include discharge and character certificates, copies of the marks card, Aadhaar card, ration card and bank passbook, and a category certificate where applicable.',
      'Current class availability and fee details are shown in the interactive admissions page. Contact the school office for confirmation before applying.'
    ], links: ['/login', '/academics', '/notices', '/contact']
  },
  '/notices': {
    label: 'Notice Board', title: `Notice Board & Circulars | ${SITE_NAME}`, heading: 'Notice Board & Circulars',
    description: 'Read official HSS Shangus announcements, admission notifications, examination schedules, datesheets and school circulars.',
    paragraphs: [
      'The school notice board brings together official announcements, admission notifications, examination schedules, datesheets and circulars from Govt. Higher Secondary School Shangus.',
      'Current notices and archived announcements load in the interactive notice board. Contact the school office if you need help accessing a notice or confirming a deadline.'
    ], links: ['/admissions', '/academics', '/contact']
  },
  '/login': {
    label: 'Student & Staff Portal', title: `Student & Staff Portal Login | ${SITE_NAME}`, heading: 'Student & Staff Login Portal',
    description: 'Access the HSS Shangus student and staff portal for admission applications, fee receipts, examination details, roll slips and attendance services.',
    paragraphs: [
      'The public portal gateway connects students and staff to school online services. Students can access admission applications, registration records, fee receipts and examination information.',
      'Staff use the authenticated portal for faculty utilities and attendance. Sign in with your own account to access the services available to your role.'
    ], links: ['/portal/login', '/admissions', '/contact']
  },
  '/contact': {
    label: 'Contact Us', title: `Contact Us | ${SITE_NAME}`, heading: 'Contact HSS Shangus',
    description: 'Contact Govt. Higher Secondary School Shangus, Main Road, Shangus, Anantnag, Jammu and Kashmir 192201, for admissions and school enquiries.',
    paragraphs: [
      'Govt. Higher Secondary School Shangus is located on Main Road, Shangus, Tehsil Shangus, District Anantnag, Jammu and Kashmir, 192201.',
      'For admission and examination enquiries, email adm.exam.hss.shangus@gmail.com or call +91 7006034501 / +91 9682547458. The interactive contact page also includes a location map and enquiry form.'
    ], links: ['/admissions', '/notices', '/about']
  },
  '/privacy-policy': {
    label: 'Privacy Policy', title: `Privacy Policy | ${SITE_NAME}`, heading: 'Privacy Policy',
    description: 'Read how HSS Shangus handles student information, online portal data and payment information in its privacy policy.',
    paragraphs: ['The school privacy policy explains information collected through the website and student services, how that information is used, and how it is protected. Enable JavaScript to read the complete policy.'],
    links: ['/terms-and-conditions', '/contact']
  },
  '/terms-and-conditions': {
    label: 'Terms & Conditions', title: `Terms & Conditions | ${SITE_NAME}`, heading: 'Terms and Conditions',
    description: 'Read the terms governing the HSS Shangus website, admission applications, online portal services and school fee payments.',
    paragraphs: ['The school terms cover use of the website, admission applications and online fee payments. Enable JavaScript to read the complete terms before using these services.'],
    links: ['/privacy-policy', '/refund-policy', '/contact']
  },
  '/refund-policy': {
    label: 'Refund Policy', title: `Refund & Cancellation Policy | ${SITE_NAME}`, heading: 'Refund & Cancellation Policy',
    description: 'Read the HSS Shangus fee refund and cancellation policy, including guidance on duplicate payments and contacting the school for assistance.',
    paragraphs: ['The refund and cancellation policy explains when and how refunds are issued for online school fee payments. Enable JavaScript to read the complete policy, or contact the school office for assistance.'],
    links: ['/terms-and-conditions', '/contact']
  },
  '/results': {
    label: 'Results Portal', title: `Examination Results & Scorecards | ${SITE_NAME}`, heading: 'Student Examination Results Portal',
    description: 'Search and verify student examination results, academic scorecards, and performance evaluation records at Govt. Higher Secondary School Shangus.',
    paragraphs: [
      'Govt. Higher Secondary School Shangus provides an online examination result lookup service for students, parents, and academic evaluators.',
      'Enter candidate details to access comprehensive marks cards, subject-wise performance descriptors, and verified academic scorecards for secondary and higher secondary sessions.'
    ], links: ['/admissions', '/notices', '/academics', '/contact']
  },
  '/gk-test': {
    label: 'GK Test', title: `General Knowledge Test Registration | ${SITE_NAME}`, heading: 'General Knowledge Test Registration',
    description: 'Register for the General Knowledge test at Govt. Higher Secondary School Shangus. Open to students across classes with online registration and results.',
    paragraphs: [
      'Govt. Higher Secondary School Shangus organises a General Knowledge test for students. The online registration portal allows participants to sign up and receive their results digitally.',
      'Check eligibility, registration deadlines and test details on this page. Contact the school office for any queries regarding the GK test.'
    ], links: ['/admissions', '/academics', '/notices', '/contact']
  }
};
const ALIASES = {
  '/contact-us': '/contact', '/terms': '/terms-and-conditions',
  '/refund-and-cancellation-policy': '/refund-policy', '/verify': '/verify-student',
  '/preboard-results': '/results'
};
const NAVIGATION = ['/', '/about', '/academics', '/admissions', '/notices', '/login', '/contact'];
const INDEX_ROBOTS = 'index, follow, max-image-preview:large';
const NOINDEX_ROBOTS = 'noindex, follow';
function normalizePath(pathname) {
  return pathname.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
}
function getPageSeo(pathname, overrides = {}) {
  const path = normalizePath(pathname);
  const canonicalPath = ALIASES[path] || path;
  const privatePage = /^\/(portal|admin)(\/|$)/.test(path) || canonicalPath === '/verify-student';
  const fallback = {
    title: `${privatePage ? 'Online Services' : 'School Information'} | ${SITE_NAME}`,
    description: `Official ${SCHOOL_NAME} website and online services.`,
    label: privatePage ? 'Online Services' : 'School Information'
  };
  return {
    ...(PUBLIC_PAGES[canonicalPath] || fallback), ...overrides,
    canonical: `${SITE_ORIGIN}${canonicalPath}`, path: canonicalPath,
    image: overrides.image ? new URL(overrides.image, SITE_ORIGIN).href : DEFAULT_IMAGE,
    robots: privatePage ? NOINDEX_ROBOTS : INDEX_ROBOTS
  };
}
function getStructuredData(seo) {
  const graph = [
    {
      '@type': 'HighSchool', '@id': `${SITE_ORIGIN}/#school`, name: SCHOOL_NAME,
      alternateName: [SITE_NAME, 'GHSS Shangus', 'Govt HSS Shangus'],
      url: `${SITE_ORIGIN}/`, logo: `${SITE_ORIGIN}/logo.png`, image: DEFAULT_IMAGE,
      description: PUBLIC_PAGES['/'].description, foundingDate: '1917',
      email: 'adm.exam.hss.shangus@gmail.com', telephone: '+91-7006034501',
      sameAs: ['https://maps.google.com/?q=Govt+Higher+Secondary+School+Shangus'],
      address: {
        '@type': 'PostalAddress', streetAddress: 'Main Road, Shangus',
        addressLocality: 'Shangus, Anantnag', addressRegion: 'Jammu and Kashmir',
        postalCode: '192201', addressCountry: 'IN'
      },
      geo: {
        '@type': 'GeoCoordinates',
        latitude: 33.6992,
        longitude: 75.2891
      },
      contactPoint: {
        '@type': 'ContactPoint', telephone: '+91-7006034501',
        contactType: 'admissions', availableLanguage: ['English', 'Urdu', 'Hindi']
      },
      hasMap: 'https://maps.google.com/?q=Govt+Higher+Secondary+School+Shangus'
    },
    {
      '@type': 'WebSite', '@id': `${SITE_ORIGIN}/#website`, name: SITE_NAME,
      alternateName: [SCHOOL_NAME, 'GHSS Shangus', 'hssshangus.netlify.app'],
      url: `${SITE_ORIGIN}/`, publisher: { '@id': `${SITE_ORIGIN}/#school` }
    },
    {
      '@type': 'WebPage', '@id': `${seo.canonical}#webpage`, url: seo.canonical,
      name: seo.title, description: seo.description,
      isPartOf: { '@id': `${SITE_ORIGIN}/#website` }, about: { '@id': `${SITE_ORIGIN}/#school` },
      ...(seo.path !== '/' ? { breadcrumb: { '@id': `${seo.canonical}#breadcrumbs` } } : {})
    }
  ];
  if (seo.path !== '/') graph.push({
    '@type': 'BreadcrumbList', '@id': `${seo.canonical}#breadcrumbs`,
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_ORIGIN}/` },
      { '@type': 'ListItem', position: 2, name: seo.label, item: seo.canonical }
    ]
  });
  return { '@context': 'https://schema.org', '@graph': graph };
}
module.exports = {
  SITE_ORIGIN, SITE_NAME, SCHOOL_NAME, PUBLIC_PAGES, ALIASES, NAVIGATION,
  INDEX_ROBOTS, NOINDEX_ROBOTS, normalizePath, getPageSeo, getStructuredData
};
