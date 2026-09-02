import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const SITE_ORIGIN = 'https://hssshangus.netlify.app';

const ROUTE_SEO_MAP = {
  '/': {
    title: 'Govt. Higher Secondary School Shangus | Official Portal',
    description: 'Official website and digital student portal of Govt. Higher Secondary School Shangus, Anantnag. Admissions, academic streams in Science & Humanities, datesheets, and online services.',
    canonical: `${SITE_ORIGIN}/`,
    breadcrumb: 'Home'
  },
  '/about': {
    title: 'About Us | Govt. Higher Secondary School Shangus',
    description: 'Learn about the rich history since 1971, leadership, esteemed faculty, smart infrastructure, vision, and mission of Govt. Higher Secondary School Shangus, Anantnag.',
    canonical: `${SITE_ORIGIN}/about`,
    breadcrumb: 'About Us'
  },
  '/admissions': {
    title: 'Admissions 2025-26 | Govt. Higher Secondary School Shangus',
    description: 'Step-by-step admissions process, online registration forms, eligibility, document checklists, and fee structures for Class 9th, 10th, 11th & 12th at HSS Shangus.',
    canonical: `${SITE_ORIGIN}/admissions`,
    breadcrumb: 'Admissions'
  },
  '/academics': {
    title: 'Academics & Subject Streams | Govt. Higher Secondary School Shangus',
    description: 'Explore academic curriculum, Science, Humanities, Commerce streams, faculty departments, smart laboratories, and JKBOSE exam syllabus at HSS Shangus.',
    canonical: `${SITE_ORIGIN}/academics`,
    breadcrumb: 'Academics'
  },
  '/notices': {
    title: 'Notice Board & Circulars | Govt. Higher Secondary School Shangus',
    description: 'Latest official announcements, JKBOSE exam datesheets, admission notifications, results, and circulars from Govt. Higher Secondary School Shangus.',
    canonical: `${SITE_ORIGIN}/notices`,
    breadcrumb: 'Notice Board'
  },
  '/login': {
    title: 'Student & Staff Portal Login | Govt. HSS Shangus',
    description: 'Access Govt. HSS Shangus digital portal for online admission forms, fee receipts, digital roll slips, attendance, and faculty academic records.',
    canonical: `${SITE_ORIGIN}/login`,
    breadcrumb: 'Portal Login'
  },
  '/contact': {
    title: 'Contact Us | Govt. Higher Secondary School Shangus',
    description: 'Get in touch with Govt. Higher Secondary School Shangus administration. Official address in Shangus, Anantnag, email, phone numbers, and location map.',
    canonical: `${SITE_ORIGIN}/contact`,
    breadcrumb: 'Contact Us'
  },
  '/contact-us': {
    title: 'Contact Us | Govt. Higher Secondary School Shangus',
    description: 'Get in touch with Govt. Higher Secondary School Shangus administration. Official address in Shangus, Anantnag, email, phone numbers, and location map.',
    canonical: `${SITE_ORIGIN}/contact`,
    breadcrumb: 'Contact Us'
  },
  '/verify-student': {
    title: 'Online Student & Certificate Verification | Govt. HSS Shangus',
    description: 'Verify authentic student admission records, Transfer Certificates (TC), and academic credentials issued by Govt. Higher Secondary School Shangus.',
    canonical: `${SITE_ORIGIN}/verify-student`,
    breadcrumb: 'Student Verification'
  },
  '/verify': {
    title: 'Online Student & Certificate Verification | Govt. HSS Shangus',
    description: 'Verify authentic student admission records, Transfer Certificates (TC), and academic credentials issued by Govt. Higher Secondary School Shangus.',
    canonical: `${SITE_ORIGIN}/verify-student`,
    breadcrumb: 'Student Verification'
  },
  '/privacy-policy': {
    title: 'Privacy Policy | Govt. Higher Secondary School Shangus',
    description: 'Privacy Policy and data protection guidelines for Govt. Higher Secondary School Shangus online portal and student services.',
    canonical: `${SITE_ORIGIN}/privacy-policy`,
    breadcrumb: 'Privacy Policy'
  },
  '/terms-and-conditions': {
    title: 'Terms & Conditions | Govt. Higher Secondary School Shangus',
    description: 'Terms and conditions governing the use of Govt. Higher Secondary School Shangus online admission portal and services.',
    canonical: `${SITE_ORIGIN}/terms-and-conditions`,
    breadcrumb: 'Terms & Conditions'
  },
  '/terms': {
    title: 'Terms & Conditions | Govt. Higher Secondary School Shangus',
    description: 'Terms and conditions governing the use of Govt. Higher Secondary School Shangus online admission portal and services.',
    canonical: `${SITE_ORIGIN}/terms-and-conditions`,
    breadcrumb: 'Terms & Conditions'
  },
  '/refund-policy': {
    title: 'Fee Refund Policy | Govt. Higher Secondary School Shangus',
    description: 'Official admission and examination fee refund policies and procedures of Govt. Higher Secondary School Shangus.',
    canonical: `${SITE_ORIGIN}/refund-policy`,
    breadcrumb: 'Refund Policy'
  },
  '/refund-and-cancellation-policy': {
    title: 'Fee Refund Policy | Govt. Higher Secondary School Shangus',
    description: 'Official admission and examination fee refund policies and procedures of Govt. Higher Secondary School Shangus.',
    canonical: `${SITE_ORIGIN}/refund-policy`,
    breadcrumb: 'Refund Policy'
  },
  '/gk-test': {
    title: 'GK Test Registration | Govt. Higher Secondary School Shangus',
    description: 'Register online for the General Knowledge & Talent Assessment Test conducted by Govt. Higher Secondary School Shangus.',
    canonical: `${SITE_ORIGIN}/gk-test`,
    breadcrumb: 'GK Test'
  }
};

/**
 * SEOHead Component: Dynamically manages document title, meta descriptions,
 * canonical links, OpenGraph metadata, and structured JSON-LD breadcrumbs for
 * seamless Google Search indexing and sitelinks generation.
 */
export default function SEOHead() {
  const { pathname } = useLocation();

  useEffect(() => {
    const cleanPath = pathname.replace(/\/$/, '') || '/';
    const seoData = ROUTE_SEO_MAP[cleanPath] || {
      title: cleanPath.startsWith('/portal')
        ? 'Portal Workspace | Govt. HSS Shangus'
        : 'Govt. Higher Secondary School Shangus',
      description: 'Official website of Govt. Higher Secondary School Shangus, Anantnag. Science, Humanities and Secondary education programs.',
      canonical: `${SITE_ORIGIN}${cleanPath}`,
      breadcrumb: cleanPath.replace(/^\//, '').replace(/-/g, ' ') || 'Home'
    };

    // 1. Update Document Title
    document.title = seoData.title;

    // 2. Update Meta Description
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.setAttribute('name', 'description');
      document.head.appendChild(metaDesc);
    }
    metaDesc.setAttribute('content', seoData.description);

    // 3. Update Canonical Link
    let canonicalLink = document.querySelector('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute('href', seoData.canonical);

    // 4. Update OpenGraph Tags
    const updateOrCreateMeta = (property, content) => {
      let el = document.querySelector(`meta[property="${property}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute('property', property);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    updateOrCreateMeta('og:title', seoData.title);
    updateOrCreateMeta('og:description', seoData.description);
    updateOrCreateMeta('og:url', seoData.canonical);

    // 5. Update Dynamic Breadcrumbs Structured Data (JSON-LD)
    let breadcrumbScript = document.getElementById('hss-page-breadcrumbs-jsonld');
    if (!breadcrumbScript) {
      breadcrumbScript = document.createElement('script');
      breadcrumbScript.id = 'hss-page-breadcrumbs-jsonld';
      breadcrumbScript.type = 'application/ld+json';
      document.head.appendChild(breadcrumbScript);
    }

    const breadcrumbsJson = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Home',
          item: `${SITE_ORIGIN}/`
        }
      ]
    };

    if (cleanPath !== '/') {
      breadcrumbsJson.itemListElement.push({
        '@type': 'ListItem',
        position: 2,
        name: seoData.breadcrumb,
        item: seoData.canonical
      });
    }

    breadcrumbScript.textContent = JSON.stringify(breadcrumbsJson);
  }, [pathname]);

  return null;
}
