import React from 'react';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import StudentVerificationPage from './StudentVerificationPage';
import { generateVerificationSignature } from '../utils/qrSvgGenerator';

let mockSearchParams = new URLSearchParams();
jest.mock('react-router-dom', () => ({
  Link: ({ children, to, className, ...props }) => <a href={to} className={className} {...props}>{children}</a>,
  useSearchParams: () => [mockSearchParams]
}));

jest.mock('../services/backendEndpoint', () => ({
  publicLookup: jest.fn().mockRejectedValue(new Error('Backend unavailable in test'))
}));

jest.mock('../components/SEO', () => () => <div data-testid="seo" />);

describe('StudentVerificationPage', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    sessionStorage.clear();
    mockSearchParams = new URLSearchParams();
  });

  test('renders empty prompt when no query parameters are provided', async () => {
    mockSearchParams = new URLSearchParams();
    render(<StudentVerificationPage />);

    await waitFor(() => {
      expect(screen.getByText('Official Verification Portal')).toBeInTheDocument();
    });
    expect(screen.getByText(/Scan the QR code printed on any official Student ID Card/i)).toBeInTheDocument();
  });

  test('verifies student from verified catalog by form number', async () => {
    mockSearchParams = new URLSearchParams('fNo=250001');
    render(<StudentVerificationPage />);

    await waitFor(() => {
      expect(screen.getByText(/(Student Enrollment|Official Certificate) Verified/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Sheikh Gulfam/i)).toBeInTheDocument();
    expect(screen.getByText(/Gulzar Ahmad Sheikh/i)).toBeInTheDocument();
    expect(screen.getByText(/#250001/i)).toBeInTheDocument();
  });

  test('verifies student by boardRegNo and rollNo from catalog', async () => {
    mockSearchParams = new URLSearchParams('reg=2401010000790003&roll=27');
    render(<StudentVerificationPage />);

    await waitFor(() => {
      expect(screen.getByText(/(Student Enrollment|Official Certificate) Verified/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Nidah Jan/i)).toBeInTheDocument();
    expect(screen.getByText(/Sikander Wani/i)).toBeInTheDocument();
  });

  test('verifies certificate with serial number', async () => {
    mockSearchParams = new URLSearchParams('fNo=250001&cert=HSS/2025/001&doc=Bonafide+Certificate');
    render(<StudentVerificationPage />);

    await waitFor(() => {
      expect(screen.getByText(/(Student Enrollment|Official Certificate) Verified/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Bonafide Certificate/i)).toBeInTheDocument();
    expect(screen.getByText(/HSS\/2025\/001/i)).toBeInTheDocument();
    expect(screen.getByText(/Sheikh Gulfam/i)).toBeInTheDocument();
  });

  test('verifies student via cryptographic signature for new/future records', async () => {
    const fNo = '888888';
    const reg = '8888888888';
    const roll = '888';
    const cert = 'CERT-888';
    const sig = generateVerificationSignature(reg, roll, fNo, cert);

    mockSearchParams = new URLSearchParams(
      `fNo=${fNo}&reg=${reg}&roll=${roll}&cert=${cert}&doc=Provisional+Certificate&name=Abrar+Ahmad&father=Bashir+Ahmad&sig=${sig}`
    );
    render(<StudentVerificationPage />);

    await waitFor(() => {
      expect(screen.getByText(/(Student Enrollment|Official Certificate) Verified/i)).toBeInTheDocument();
      expect(screen.getByText(/Abrar Ahmad/i)).toBeInTheDocument();
      expect(screen.getByText(/Bashir Ahmad/i)).toBeInTheDocument();
      expect(screen.getByText(/CERT-888/i)).toBeInTheDocument();
      expect(screen.getByText(/HMAC Cryptographically Verified Credential/i)).toBeInTheDocument();
    });
  });

  test('flags tampered signature with security alert', async () => {
    mockSearchParams = new URLSearchParams('fNo=999999&name=Forged+Student&sig=INVALID_TAMPERED_SIG');
    render(<StudentVerificationPage />);

    await waitFor(() => {
      expect(screen.getAllByText(/Digital Signature Mismatch/i)[0]).toBeInTheDocument();
    });
  });

  test('displays not found for non-existent unauthenticated record', async () => {
    mockSearchParams = new URLSearchParams('fNo=999999');
    render(<StudentVerificationPage />);

    await waitFor(() => {
      expect(screen.getByText(/Record Could Not Be Verified/i)).toBeInTheDocument();
    });
  });
});
