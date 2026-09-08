import applySeo from './applySeo';
import siteSeo from './siteSeo';

const { getPageSeo, SITE_ORIGIN } = siteSeo;

beforeEach(() => { document.head.innerHTML = '<title>HSS Shangus</title>'; });

test('navigation replaces the initial page metadata and clears private noindex', () => {
  applySeo(getPageSeo('/about'));
  applySeo(getPageSeo('/portal/student'));
  expect(document.querySelector('meta[name="robots"]').content).toBe('noindex, follow');
  applySeo(getPageSeo('/admissions/'));
  expect(document.title).toBe('Admissions | HSS Shangus');
  expect(document.querySelector('link[rel="canonical"]').href).toBe(`${SITE_ORIGIN}/admissions`);
  expect(document.querySelector('meta[name="robots"]').content).toBe('index, follow, max-image-preview:large');
  expect(document.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
  expect(document.querySelectorAll('meta[name="description"]')).toHaveLength(1);
  expect(document.querySelectorAll('script[type="application/ld+json"]')).toHaveLength(1);
});

test('aliases and verification queries do not create separate indexed identities', () => {
  applySeo(getPageSeo('/contact-us/'));
  expect(document.querySelector('link[rel="canonical"]').href).toBe(`${SITE_ORIGIN}/contact`);
  applySeo(getPageSeo('/verify?student=example'));
  expect(document.querySelector('link[rel="canonical"]').href).toBe(`${SITE_ORIGIN}/verify-student`);
  expect(document.querySelector('meta[name="robots"]').content).toBe('noindex, follow');
  expect(document.getElementById('hss-structured-data').textContent).not.toContain('student=example');
});

test('returning home removes page breadcrumbs and preserves the preferred site name', () => {
  applySeo(getPageSeo('/academics'));
  applySeo(getPageSeo('/'));
  const graph = JSON.parse(document.getElementById('hss-structured-data').textContent)['@graph'];
  expect(graph.find((item) => item['@type'] === 'BreadcrumbList')).toBeUndefined();
  expect(graph.find((item) => item['@type'] === 'WebSite').name).toBe('HSS Shangus');
  expect(document.querySelector('meta[property="og:site_name"]').content).toBe('HSS Shangus');
});
