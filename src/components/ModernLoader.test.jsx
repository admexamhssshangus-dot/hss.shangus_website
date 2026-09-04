import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ModernLoader from './ModernLoader';

test('exposes concise determinate progress to users and assistive technology', () => {
  render(<ModernLoader moduleKey="trash" text="Deleting records…" subtext="Keep this window open." progress={37} />);
  expect(screen.getByRole('status')).toHaveTextContent('Deleting records…');
  expect(screen.getByText('Keep this window open.')).toBeVisible();
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '37');
  expect(screen.getByText('37%')).toBeVisible();
});

test('uses an accessible indeterminate progress bar without rotating filler copy', () => {
  render(<ModernLoader moduleKey="student" />);
  expect(screen.getByRole('status')).toHaveTextContent('Loading…');
  expect(screen.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow');
  expect(screen.queryByText(/encrypt|engine|synchroniz/i)).not.toBeInTheDocument();
});
