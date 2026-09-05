import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import DynamicFormField from './DynamicFormField';

jest.mock('../student/AdmissionForm', () => ({
  normalizeSubjectTitle: value => value,
  validateSubjectSelection: () => ({ valid: true }),
}));
jest.mock('../../utils/feederSchoolsManager', () => ({
  DEFAULT_FEEDER_SCHOOLS: [], getCachedFeederSchools: () => [], loadFeederSchools: async () => [],
}));

const config = { fieldName: 'Subjects Studied in Class 10th', fieldType: 'checkbox_dynamic' };
test('subject dropdown locks compulsory subjects and saves elective selection', () => {
  const onChange = jest.fn();
  const { container } = render(<DynamicFormField config={config} onChange={onChange} />);
  expect(container.querySelector('details')).not.toHaveAttribute('open');
  expect(container.querySelector('.subject-compulsory')).toHaveTextContent('Compulsory: English, Mathematics, Science, Social Science');
  expect(screen.queryByLabelText('English (required)')).not.toBeInTheDocument();
  fireEvent.click(screen.getByLabelText('Urdu'));
  expect(onChange).toHaveBeenCalledWith(config.fieldName, 'English, Mathematics, Science, Social Science, Urdu');
});

test('reappear subjects are selectable, not compulsory, and Escape closes dropdown', () => {
  const onChange = jest.fn();
  const { container } = render(<DynamicFormField config={{ ...config, fieldName: 'Subjects to Reappear (Class 10th)' }} onChange={onChange} />);
  expect(screen.getByLabelText('English')).not.toBeDisabled();
  fireEvent.click(screen.getByLabelText('English'));
  expect(onChange).toHaveBeenCalledWith('Subjects to Reappear (Class 10th)', 'English');
  const details = container.querySelector('details');
  details.open = true;
  fireEvent.keyDown(details, { key: 'Escape' });
  expect(details).not.toHaveAttribute('open');
  expect(container.querySelector('summary')).toHaveFocus();
});

test('locked applications disable elective changes', () => {
  render(<DynamicFormField config={config} onChange={jest.fn()} disabled value="Urdu" />);
  expect(screen.getByLabelText('Urdu')).toBeChecked();
  expect(screen.getByLabelText('Urdu')).toBeDisabled();
});

test('science group instructions adjust when a Group C subject is selected', () => {
  const science = { fieldName: 'Subjects to be taken in Class 11th', fieldType: 'checkbox_dynamic' };
  const { container, rerender } = render(<DynamicFormField config={science} selectedStream="Science" onChange={jest.fn()} />);
  expect(container.querySelector('summary')).toHaveTextContent('Group BChoose 2 · 0 selected');
  rerender(<DynamicFormField config={science} selectedStream="Science" value="Biology, Healthcare" onChange={jest.fn()} />);
  expect(container.querySelector('summary')).toHaveTextContent('Group BChoose 1 · 1 selected');
  expect(container.querySelectorAll('summary')[1]).toHaveTextContent('Optional · Choose up to 1 · 1 selected');
  expect(container.querySelector('.subject-compulsory')).toHaveTextContent('General English, Physics, Chemistry');
});
