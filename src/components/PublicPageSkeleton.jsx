import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import siteSeo from '../seo/siteSeo';

/**
 * Shared public-route loading state. Its dimensions resemble the eventual page
 * content, reducing layout shift while Firestore-backed content is resolved.
 */
export default function PublicPageSkeleton({ label = 'Loading page content…' }) {
  const { pathname } = useLocation();
  const page = siteSeo.PUBLIC_PAGES[siteSeo.getPageSeo(pathname).path];
  if (page) {
    return (
      <section className="search-overview" style={{ minHeight: 0 }}>
        <div className="search-overview__main">
          <h1>{page.heading}</h1>
          {page.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          <nav className="search-overview__links" aria-label="Related pages">
            {page.links.map((route) => (
              <Link key={route} to={route}>{siteSeo.PUBLIC_PAGES[route]?.label || 'Open Online Portal'}</Link>
            ))}
          </nav>
          <p role="status" className="search-overview__note">{label}</p>
        </div>
      </section>
    );
  }
  return (
    <div className="ui-route-loader" role="status" aria-live="polite" aria-label={label}>
      <div className="ui-route-loader__header ui-skeleton" aria-hidden="true" />
      <div className="ui-route-loader__grid" aria-hidden="true">
        <div className="ui-skeleton ui-skeleton--feature" />
        <div className="ui-skeleton-stack">
          <div className="ui-skeleton ui-skeleton--title" />
          <div className="ui-skeleton ui-skeleton--line" />
          <div className="ui-skeleton ui-skeleton--line ui-skeleton--short" />
          <div className="ui-skeleton ui-skeleton--card" />
        </div>
      </div>
      <span className="ui-route-loader__label">{label}</span>
    </div>
  );
}
