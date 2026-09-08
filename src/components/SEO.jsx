import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import siteSeo from '../seo/siteSeo';
import applySeo from '../seo/applySeo';

// Optional metadata for content whose title loads dynamically (such as GK tests).
// Static public routes use shared metadata without competing page overrides.
export default function SEO({ title, description, image, path }) {
  const { pathname } = useLocation();
  useEffect(() => {
    const seo = siteSeo.getPageSeo(path || pathname);
    if (siteSeo.PUBLIC_PAGES[seo.path]) return;
    const overrides = {};
    if (title) overrides.title = title;
    if (description) overrides.description = description;
    if (image) overrides.image = image;
    applySeo(siteSeo.getPageSeo(path || pathname, overrides));
  }, [title, description, image, path, pathname]);
  return null;
}
