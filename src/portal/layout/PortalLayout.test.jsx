import React from 'react';
import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import PortalLayout from './PortalLayout';
import { auth } from '../../services/firebase';
import { onAuthStateChanged, getIdTokenResult } from 'firebase/auth';
import { resolveStaffRoleAndPerms } from '../../services/staffAuthService';
jest.mock('../../services/firebase', () => ({ auth: { currentUser: null } }));
jest.mock('firebase/auth', () => ({ onAuthStateChanged: jest.fn(), getIdTokenResult: jest.fn(), signOut: jest.fn() }));
jest.mock('../../services/staffAuthService', () => ({ resolveStaffRoleAndPerms: jest.fn(), isBootstrapSuperAdminEmail: () => false }));
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
