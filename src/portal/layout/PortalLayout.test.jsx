import React from 'react';
import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import PortalLayout from './PortalLayout';
import { auth } from '../../services/firebase';
import { onAuthStateChanged, getIdTokenResult } from 'firebase/auth';
import { resolveStaffRoleAndPerms } from '../../services/staffAuthService';
jest.mock('../../services/firebase', () => ({ auth: { currentUser: null } }));
jest.mock('firebase/auth', () => ({ onAuthStateChanged: jest.fn(), getIdTokenResult: jest.fn(), signOut: jest.fn() }));
jest.mock('../../services/staffAuthService', () => ({ resolveStaffRoleAndPerms: jest.fn(), requireVerifiedAdminSession: jest.fn(), isBootstrapSuperAdminEmail: () => false, isBootstrapAdminEmail: () => false }));
jest.mock('../../components/ModernLoader', () => () => <div>Checking session</div>);
jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn(), useLocation: () => ({ pathname: '/portal/student' }),
  Outlet: ({ context }) => <div>{context.isAuthenticated ? `Verified ${context.user.role}` : 'Unauthenticated'}</div>,
}));
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear();
  window.history.replaceState({}, '', '/portal/student');
  onAuthStateChanged.mockReturnValue(() => {});
  getIdTokenResult.mockResolvedValue({ claims: {}, token: 'verified-token' });
  auth.currentUser = null;
});
test('does not trust a cached admin session before Firebase responds', async () => {
  sessionStorage.setItem('hss_session_token', 'forged');
  sessionStorage.setItem('hss_session_user', JSON.stringify({ email: 'test@example.invalid', role: 'Admin' }));
  render(<PortalLayout />);
  expect(screen.getByText('Checking session')).toBeInTheDocument();
  await act(async () => onAuthStateChanged.mock.calls.at(-1)[1](null));
  expect(screen.getByText('Unauthenticated')).toBeInTheDocument();
});
test.each(['Student', 'Teacher', 'Admin', 'SuperAdmin'])('restores verified %s role', async role => {
  resolveStaffRoleAndPerms.mockResolvedValue({ role, perms: [] });
  auth.currentUser = { uid: 'test-uid', email: 'test@example.invalid' };
  render(<PortalLayout />);
  await act(async () => onAuthStateChanged.mock.calls.at(-1)[1](auth.currentUser));
  expect(screen.getByText(`Verified ${role}`)).toBeInTheDocument();
});
test('token verification failure does not establish a session', async () => {
  getIdTokenResult.mockRejectedValueOnce(new Error('Expired token'));
  auth.currentUser = { uid: 'test-uid', email: 'test@example.invalid' };
  render(<PortalLayout />);
  await act(async () => onAuthStateChanged.mock.calls.at(-1)[1](auth.currentUser));
  expect(screen.getByText('Unauthenticated')).toBeInTheDocument();
});

test('pending 2-step verification prevents premature session establishment', async () => {
  localStorage.setItem('hss_pending_admin_login', JSON.stringify({ email: 'admin@example.invalid', handshakeId: 'hsk_123', ts: Date.now() }));
  resolveStaffRoleAndPerms.mockResolvedValue({ role: 'Admin', perms: ['*'] });
  auth.currentUser = { uid: 'admin-uid', email: 'admin@example.invalid' };
  render(<PortalLayout />);
  await act(async () => onAuthStateChanged.mock.calls.at(-1)[1](auth.currentUser));
  expect(screen.getByText('Unauthenticated')).toBeInTheDocument();
});

test('explicit logout flag blocks session restoration', async () => {
  sessionStorage.setItem('hss_explicit_logout', 'true');
  resolveStaffRoleAndPerms.mockResolvedValue({ role: 'Admin', perms: ['*'] });
  auth.currentUser = { uid: 'admin-uid', email: 'admin@example.invalid' };
  render(<PortalLayout />);
  await act(async () => onAuthStateChanged.mock.calls.at(-1)[1](auth.currentUser));
  expect(screen.getByText('Unauthenticated')).toBeInTheDocument();
});

test('recognizes cross-tab login via storage event', async () => {
  render(<PortalLayout />);
  await act(async () => onAuthStateChanged.mock.calls.at(-1)[1](null));
  expect(screen.getByText('Unauthenticated')).toBeInTheDocument();

  // Simulate another tab logging in and saving session to localStorage
  const user = { email: 'teacher@example.invalid', role: 'Teacher', name: 'Teacher Test' };
  localStorage.setItem('hss_session_user', JSON.stringify(user));
  localStorage.setItem('hss_session_token', 'test-cross-tab-token');
  localStorage.setItem('hss_auth_state', JSON.stringify({ role: 'Teacher', name: 'Teacher Test', ts: Date.now() }));

  await act(async () => {
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'hss_session_user',
      newValue: JSON.stringify(user),
    }));
  });

  expect(screen.getByText('Verified Teacher')).toBeInTheDocument();
});

test('recognizes cross-tab logout via storage event', async () => {
  resolveStaffRoleAndPerms.mockResolvedValue({ role: 'Student', perms: [] });
  auth.currentUser = { uid: 'student-uid', email: 'student@example.invalid' };
  render(<PortalLayout />);
  await act(async () => onAuthStateChanged.mock.calls.at(-1)[1](auth.currentUser));
  expect(screen.getByText('Verified Student')).toBeInTheDocument();

  // Simulate another tab logging out
  await act(async () => {
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'hss_explicit_logout',
      newValue: 'true',
    }));
  });

  expect(screen.getByText('Unauthenticated')).toBeInTheDocument();
});

