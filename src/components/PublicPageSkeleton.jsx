import React from 'react';
import { useLocation } from 'react-router-dom';
import ModernLoader from './ModernLoader';

/**
 * Shared public-route loading state. Employs the optimized institutional
 * ModernLoader with logo pulse, animated track, and contextual branding.
 */
export default function PublicPageSkeleton({ label = 'Loading page…', moduleKey }) {
  const location = useLocation();
  const pathname = (location?.pathname || '').toLowerCase();

  const resolvedKey = moduleKey || (
    pathname.includes('admission') ? 'admissions' :
    pathname.includes('academic') ? 'academics' :
    pathname.includes('about') ? 'about' :
    pathname.includes('notice') ? 'reports' :
    pathname.includes('login') ? 'login' :
    'default'
  );

  return (
    <div className="min-h-[55vh] flex items-center justify-center py-10 px-4 w-full animate-fadeIn" role="status" aria-label={label}>
      <ModernLoader
        moduleKey={resolvedKey}
        text={label}
        className="w-full"
      />
    </div>
  );
}
