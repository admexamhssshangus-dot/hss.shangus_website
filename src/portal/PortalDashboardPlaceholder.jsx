import React from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import SEO from '../components/SEO';

/**
 * PortalDashboardPlaceholder — Temporary placeholder for Phase 3+.
 * Shows the authenticated user info and links back.
 */
export default function PortalDashboardPlaceholder() {
  const { user, onLogout } = useOutletContext();
  const role = user?.role || 'Student';

  const roleColors = {
    student: { bg: '#0d9488', label: 'Student' },
    teacher: { bg: '#6366f1', label: 'Teacher' },
    admin: { bg: '#f59e0b', label: 'Admin' },
    superadmin: { bg: '#ef4444', label: 'Super Admin' },
  };

  const roleKey = role.toLowerCase().replace(/\s+/g, '');
  const rc = roleColors[roleKey] || roleColors.student;

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
        title={`${rc.label} Dashboard`}
        description={`HSS Shangus ${rc.label} Dashboard`}
        path={`/portal/${roleKey}`}
      />
      <div style={{
        maxWidth: '520px',
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
          borderRadius: '50%',
          background: rc.bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1.5rem auto',
          color: '#fff',
          fontSize: '1.5rem',
          fontWeight: 800,
        }}>
          {(user?.name || 'U').charAt(0).toUpperCase()}
        </div>
        <h2 style={{
          fontSize: '1.4rem',
          fontWeight: 800,
          color: 'var(--text-main, #1e293b)',
          margin: '0 0 0.25rem 0',
        }}>
          Welcome, {user?.name || 'User'}
        </h2>
        <div style={{
          display: 'inline-block',
          padding: '0.2rem 0.75rem',
          borderRadius: '2rem',
          fontSize: '0.75rem',
          fontWeight: 700,
          background: `${rc.bg}15`,
          color: rc.bg,
          margin: '0.25rem 0 1rem 0',
        }}>
          {rc.label} Dashboard
        </div>
        <p style={{
          fontSize: '0.85rem',
          color: 'var(--text-muted, #64748b)',
          margin: '0 0 1.5rem 0',
          lineHeight: 1.5,
        }}>
          {user?.email}
        </p>
        <div style={{
          padding: '1rem',
          borderRadius: '0.75rem',
          background: 'rgba(99, 102, 241, 0.06)',
          border: '1px solid rgba(99, 102, 241, 0.15)',
          fontSize: '0.8rem',
          color: 'var(--text-muted, #64748b)',
          marginBottom: '1.5rem',
        }}>
          <strong style={{ color: '#6366f1' }}>Coming Soon</strong><br />
          The full {rc.label} dashboard with all features will be built in later phases.
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link
            to="/login"
            style={{
              padding: '0.6rem 1.2rem',
              borderRadius: '0.75rem',
              backgroundColor: 'var(--teal-accent, #0d9488)',
              color: '#fff',
              fontWeight: 700,
              fontSize: '0.85rem',
              textDecoration: 'none',
            }}
          >
            Current Portal
          </Link>
          <button
            onClick={onLogout}
            style={{
              padding: '0.6rem 1.2rem',
              borderRadius: '0.75rem',
              backgroundColor: 'transparent',
              color: 'var(--text-muted, #64748b)',
              fontWeight: 700,
              fontSize: '0.85rem',
              border: '1px solid var(--border-ui, #e2e8f0)',
              cursor: 'pointer',
            }}
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}
