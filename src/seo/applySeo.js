import siteSeo from './siteSeo';
const { SITE_NAME, getStructuredData } = siteSeo;

export default function applySeo(seo) {
  document.title = seo.title;
  const setMeta = (attribute, key, value) => {
    let element = document.head.querySelector(`meta[${attribute}="${key}"]`);
    if (!element) {
      element = document.createElement('meta');
      element.setAttribute(attribute, key);
      document.head.appendChild(element);
    }
    element.content = value;
  };
  setMeta('name', 'description', seo.description);
  setMeta('name', 'robots', seo.robots);
  setMeta('name', 'thumbnail', seo.image);
  setMeta('property', 'og:site_name', SITE_NAME);
  setMeta('property', 'og:type', 'website');
  setMeta('property', 'og:title', seo.title);
  setMeta('property', 'og:description', seo.description);
  setMeta('property', 'og:url', seo.canonical);
  setMeta('property', 'og:image', seo.image);
  setMeta('property', 'og:image:width', '1200');
  setMeta('property', 'og:image:height', '630');
  setMeta('property', 'og:image:type', 'image/jpeg');
  setMeta('property', 'og:image:alt', seo.title);
  setMeta('property', 'og:locale', 'en_IN');
  setMeta('name', 'twitter:card', 'summary_large_image');
  setMeta('name', 'twitter:title', seo.title);
  setMeta('name', 'twitter:description', seo.description);
  setMeta('name', 'twitter:image', seo.image);
  let canonical = document.head.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.rel = 'canonical';
    document.head.appendChild(canonical);
  }
  canonical.href = seo.canonical;
  let imageSrc = document.head.querySelector('link[rel="image_src"]');
  if (!imageSrc) {
    imageSrc = document.createElement('link');
    imageSrc.rel = 'image_src';
    document.head.appendChild(imageSrc);
  }
  imageSrc.href = seo.image;
  let schema = document.getElementById('hss-structured-data');
  if (!schema) {
    schema = document.createElement('script');
    schema.id = 'hss-structured-data';
    schema.type = 'application/ld+json';
    document.head.appendChild(schema);
  }
  schema.textContent = JSON.stringify(getStructuredData(seo));
}
