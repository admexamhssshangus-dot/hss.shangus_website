import { useEffect } from 'react';

export default function SEO({ title, description, image, path }) {
  useEffect(() => {
    // 1. Update Document Title
    const baseTitle = "Govt. Higher Secondary School Shangus";
    document.title = title ? `${title} | ${baseTitle}` : baseTitle;

    // 2. Set helper for updating/creating meta tags
    const setMetaTag = (attrName, attrVal, contentVal) => {
      if (!contentVal) return;
      let el = document.querySelector(`meta[${attrName}="${attrVal}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attrName, attrVal);
        document.head.appendChild(el);
      }
      el.setAttribute('content', contentVal);
    };

    // 3. URLs & Image normalization
    const pathname = path || window.location.pathname;
    const currentUrl = `https://hssshangus.netlify.app${pathname}`;
    
    let absImageUrl = "https://hssshangus.netlify.app/slides/1.jpg";
    if (image) {
      if (image.startsWith('http')) {
        absImageUrl = image;
      } else {
        absImageUrl = `https://hssshangus.netlify.app${image.startsWith('/') ? '' : '/'}${image}`;
      }
    }

    // Default search snippet thumbnail (optimized small size)
    let absThumbnailUrl = "https://hssshangus.netlify.app/slides/searchtn.jpg";
    if (image) {
      absThumbnailUrl = absImageUrl;
    }

    // 4. Update basic metadata
    setMetaTag('name', 'description', description);
    setMetaTag('name', 'thumbnail', absThumbnailUrl);

    // 5. Update Canonical URL Link
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', currentUrl);

    // 6. Update Open Graph Meta Tags
    setMetaTag('property', 'og:type', 'website');
    setMetaTag('property', 'og:title', title ? `${title} | HSS Shangus` : baseTitle);
    setMetaTag('property', 'og:description', description);
    setMetaTag('property', 'og:url', currentUrl);
    setMetaTag('property', 'og:image', absImageUrl);
    setMetaTag('property', 'og:site_name', 'HSS Shangus');

    // 7. Update Twitter Meta Tags
    setMetaTag('name', 'twitter:card', 'summary_large_image');
    setMetaTag('name', 'twitter:title', title ? `${title} | HSS Shangus` : baseTitle);
    setMetaTag('name', 'twitter:description', description);
    setMetaTag('name', 'twitter:image', absImageUrl);

    // 8. Handle JSON-LD Breadcrumbs for non-home pages
    if (pathname !== '/') {
      let pageName = "";
      if (pathname === '/about') pageName = "About Us";
      else if (pathname === '/academics') pageName = "Academics";
      else if (pathname === '/admissions') pageName = "Admissions";
      else if (pathname === '/notices') pageName = "Notice Board";
      else {
        // Clean path formatting: /my-page-name -> My Page Name
        const cleanName = pathname.replace(/^\/+|\/+$/g, '').replace(/[-_]/g, ' ');
        pageName = cleanName.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
      }

      const breadcrumbSchema = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
          {
            "@type": "ListItem",
            "position": 1,
            "name": "Home",
            "item": "https://hssshangus.netlify.app/"
          },
          {
            "@type": "ListItem",
            "position": 2,
            "name": pageName,
            "item": currentUrl
          }
        ]
      };

      let script = document.querySelector('script[data-seo-breadcrumb]');
      if (!script) {
        script = document.createElement('script');
        script.type = 'application/ld+json';
        script.setAttribute('data-seo-breadcrumb', 'true');
        document.head.appendChild(script);
      }
      script.text = JSON.stringify(breadcrumbSchema);
    } else {
      // Remove breadcrumb if on Home
      const script = document.querySelector('script[data-seo-breadcrumb]');
      if (script) script.remove();
    }
  }, [title, description, image, path]);

  return null;
}
