import React from 'react';

/**
 * Shared public-route loading state. Its dimensions resemble the eventual page
 * content, reducing layout shift while Firestore-backed content is resolved.
 */
export default function PublicPageSkeleton({ label = 'Loading page content…' }) {
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
