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
  expect(screen.getByLabelText('English (required)')).toBeChecked();
  expect(screen.getByLabelText('English (required)')).toBeDisabled();
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
