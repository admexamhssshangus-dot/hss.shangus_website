import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import PublicResultLookup from './PublicResultLookup';
import { publicLookup } from '../services/backendEndpoint';
jest.mock('../services/backendEndpoint', () => ({ publicLookup: jest.fn() }));
jest.mock('react-router-dom', () => ({ Link: 'a', useSearchParams: () => [new URLSearchParams()] }));
jest.mock('../components/SEO', () => () => null);
import {
  getSubjectPerformanceDescriptor,
  getOverallResultDescriptor
} from './PublicResultLookup';

test('unavailable configuration is explained and cannot submit an empty evaluation', async () => {
  publicLookup.mockRejectedValue(new Error('Assessment service unavailable.'));
  const warning = jest.spyOn(console, 'warn').mockImplementation(() => {});
  render(<PublicResultLookup />);
  expect(await screen.findByText('Assessment service unavailable.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Search Result' })).toBeDisabled();
  warning.mockRestore();
});

test('subject performance descriptor uses encouraging and progressive labels instead of Fail/Re-appear', () => {
  // Low score (3/50): Needs Improvement, not Fail or Re-appear
  const low = getSubjectPerformanceDescriptor(3, 50, 18, false);
  expect(low.status).toBe('Needs Improvement');
  expect(low.isPass).toBe(false);

  // Passing grades
  const pass = getSubjectPerformanceDescriptor(20, 50, 18, false);
  expect(pass.status).toBe('Satisfactory');
  expect(pass.isPass).toBe(true);

  const good = getSubjectPerformanceDescriptor(30, 50, 18, false);
  expect(good.status).toBe('Good');

  const veryGood = getSubjectPerformanceDescriptor(38, 50, 18, false);
  expect(veryGood.status).toBe('Very Good');

  const excellent = getSubjectPerformanceDescriptor(45, 50, 18, false);
  expect(excellent.status).toBe('Excellent');
});

test('overall result descriptor handles partial evaluation as In Progress without premature Re-appear', () => {
  // Only 1 of 6 subjects tabulated with low score (Mozim Ahmad Allie case)
  const partial = getOverallResultDescriptor(1, 6, 3, 50, true, false);
  expect(partial.resultStatus).toBe('IN PROGRESS');
  expect(partial.division).toContain('In Progress');
  expect(partial.division).not.toContain('Re-Appear');

  // Fully tabulated with a subject needing improvement
  const completeFail = getOverallResultDescriptor(6, 6, 150, 300, true, false);
  expect(completeFail.resultStatus).toBe('NEEDS IMPROVEMENT');
  expect(completeFail.division).toBe('Scope for Improvement');
  expect(completeFail.resultStatus).not.toBe('RE-APPEAR');
  expect(completeFail.resultStatus).not.toBe('FAIL');
});

