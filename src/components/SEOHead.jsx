import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import siteSeo from '../seo/siteSeo';
import applySeo from '../seo/applySeo';

// One owner for route metadata, including while a lazy page is still loading.
export default function SEOHead() {
  const { pathname } = useLocation();
  useEffect(() => {
    applySeo(siteSeo.getPageSeo(pathname));
  }, [pathname]);
  return null;
}
