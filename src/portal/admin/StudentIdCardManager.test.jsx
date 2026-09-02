import React from 'react';
import { TextEncoder } from 'util';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { getDoc, setDoc } from 'firebase/firestore';
import { getCachedCollectionSync, resolveStudentPhoto, fetchStudentPhotoOnDemand } from '../../services/dbCache';
import StudentIdCardManager from './StudentIdCardManager';

jest.mock('../../services/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  getDoc: jest.fn(async () => ({ exists: () => false })),
  setDoc: jest.fn(async () => {}),
}));
jest.mock('../../services/dbCache', () => ({
  getCachedCollectionSync: jest.fn(() => []),
  resolveStudentPhoto: jest.fn(() => '/logo.png'),
  fetchStudentPhotoOnDemand: jest.fn(async () => ''),
}));
jest.mock('qrcode', () => jest.requireActual('qrcode/lib/browser'));

const originalTextEncoder = global.TextEncoder;
beforeAll(() => { global.TextEncoder = TextEncoder; });
afterAll(() => { global.TextEncoder = originalTextEncoder; });
beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
  getDoc.mockResolvedValue({ exists: () => false });
  setDoc.mockResolvedValue(undefined);
  getCachedCollectionSync.mockReturnValue([]);
  resolveStudentPhoto.mockReturnValue('/logo.png');
  fetchStudentPhotoOnDemand.mockResolvedValue('');
});

const students = [
  { id: 'a', session: '2025-26', class: '11th', stream: 'Science', classRollNo: '2', studentName: 'Aamir Test' },
  { id: 'b', session: '2026-27', class: '12th', stream: 'Humanities', classRollNo: '1', studentName: 'Bilal Test' },
];

test('session controls filter the rendered cards and an empty parent cohort clears them', async () => {
  const { rerender } = render(<StudentIdCardManager students={students} />);
  await waitFor(() => expect(getDoc).toHaveBeenCalled());
  fireEvent.click(screen.getByTitle('Layout & Filters'));
  fireEvent.change(screen.getByLabelText('ID card academic session filter'), { target: { value: '2026-27' } });
  expect(screen.queryByText('Aamir Test')).not.toBeInTheDocument();
  expect(screen.getByText('Bilal Test')).toBeInTheDocument();
  rerender(<StudentIdCardManager students={[]} />);
  await waitFor(() => expect(screen.queryByText('Bilal Test')).not.toBeInTheDocument());
});

test('deselect all removes every card and select all restores the cohort', async () => {
  render(<StudentIdCardManager students={students} />);
  await waitFor(() => expect(getDoc).toHaveBeenCalled());
  fireEvent.click(screen.getByTitle('Layout & Filters'));
  fireEvent.click(screen.getByRole('button', { name: 'Deselect All (2)' }));
  expect(screen.queryByText('Aamir Test')).not.toBeInTheDocument();
  expect(screen.queryByText('Bilal Test')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Select All' }));
  expect(screen.getByText('Aamir Test')).toBeInTheDocument();
  expect(screen.getByText('Bilal Test')).toBeInTheDocument();
});
