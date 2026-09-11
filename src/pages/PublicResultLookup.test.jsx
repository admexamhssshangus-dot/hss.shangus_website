import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import PublicResultLookup from './PublicResultLookup';
import { publicLookup } from '../services/backendEndpoint';
jest.mock('../services/backendEndpoint', () => ({ publicLookup: jest.fn() }));
jest.mock('react-router-dom', () => ({ Link: 'a', useSearchParams: () => [new URLSearchParams()] }));
jest.mock('../components/SEO', () => () => null);
test('unavailable configuration is explained and cannot submit an empty evaluation', async () => {
  publicLookup.mockRejectedValue(new Error('Assessment service unavailable.'));
  const warning = jest.spyOn(console, 'warn').mockImplementation(() => {});
  render(<PublicResultLookup />);
  expect(await screen.findByText('Assessment service unavailable.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Search Result' })).toBeDisabled();
  warning.mockRestore();
});
