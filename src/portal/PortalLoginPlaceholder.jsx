import React from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import SEO from '../components/SEO';

/**
 * PortalLoginPlaceholder — Temporary placeholder for Phase 2.
 * Will be replaced with the full login page.
 */
export default function PortalLoginPlaceholder() {
  const { onLoginSuccess } = useOutletContext();

  return (
    <div style={{
      minHeight: '80vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      backgroundColor: 'var(--bg-page, #f8fafc)',
    }}>
      <SEO
        title="Portal Login"
        description="HSS Shangus Student, Teacher & Admin Portal Login"
        path="/portal/login"
      />
      <div style={{
        maxWidth: '480px',
        width: '100%',
        textAlign: 'center',
        padding: '3rem 2rem',
        borderRadius: '1.5rem',
        backgroundColor: 'var(--bg-card, #ffffff)',
        border: '1px solid var(--border-ui, #e2e8f0)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.06)',
      }}>
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '1rem',
          background: 'linear-gradient(135deg, #0d9488, #6366f1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1.5rem auto',
          fontSize: '1.8rem',
        }}>
          🔐
        </div>
        <h2 style={{
          fontSize: '1.5rem',
          fontWeight: 800,
          color: 'var(--text-main, #1e293b)',
          margin: '0 0 0.5rem 0',
        }}>
          Portal Login
        </h2>
        <p style={{
          fontSize: '0.9rem',
          color: 'var(--text-muted, #64748b)',
          margin: '0 0 1.5rem 0',
          lineHeight: 1.5,
        }}>
          The new React-based login portal is under construction.<br />
          Full login, registration, and dashboard pages will be added in Phase 2.
        </p>
        <div style={{
          padding: '1rem',
          borderRadius: '0.75rem',
          background: 'rgba(13, 148, 136, 0.06)',
          border: '1px solid rgba(13, 148, 136, 0.15)',
          fontSize: '0.8rem',
          color: 'var(--text-muted, #64748b)',
        }}>
          <strong style={{ color: 'var(--teal-accent, #0d9488)' }}>Phase 1 Complete ✓</strong><br />
          API Bridge Layer is ready. The React app can now communicate with the Apps Script backend.
        </div>
        <div style={{ marginTop: '1.5rem' }}>
          <Link
            to="/login"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.7rem 1.5rem',
              borderRadius: '0.75rem',
              backgroundColor: 'var(--teal-accent, #0d9488)',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '0.9rem',
              textDecoration: 'none',
              transition: 'opacity 0.2s',
            }}
          >
            Use Current Portal →
          </Link>
        </div>
      </div>
    </div>
  );
}
