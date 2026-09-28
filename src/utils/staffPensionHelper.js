/**
 * Helper utility for determining and managing Staff Pension Schemes (NPS vs GPF)
 */
export const getStaffPensionScheme = (emp) => {
  if (!emp) return 'NPS';
  if (emp.pension_scheme) return emp.pension_scheme.toUpperCase();
  if (emp.pensionScheme) return emp.pensionScheme.toUpperCase();
  if (emp.customFields?.['Pension Scheme']) return emp.customFields['Pension Scheme'].toUpperCase();
  if (emp.customFields?.['pension_scheme']) return emp.customFields['pension_scheme'].toUpperCase();
  if (emp.customFields?.['Scheme']) return emp.customFields['Scheme'].toUpperCase();

  // Inference fallback: staff appointed in/after 2010 in J&K are under NPS
  const dojYear = parseInt(emp.doj || emp.date_of_joining || emp.appointment_date || '', 10);
  if (!isNaN(dojYear) && dojYear >= 2010) return 'NPS';
  
  if (emp.pran_no || emp.pran) return 'NPS';
  if (emp.gpf_no || emp.gpf) return 'GPF';
  return 'NPS';
};

/**
 * Apply pension scheme updates to an employee object across all standard field variants
 */
export const applyPensionSchemeToEmployee = (emp, newScheme) => {
  const scheme = (newScheme || 'NPS').toUpperCase();
  return {
    ...emp,
    pension_scheme: scheme,
    pensionScheme: scheme,
    customFields: {
      ...(emp.customFields || {}),
      'Pension Scheme': scheme,
      pension_scheme: scheme
    }
  };
};
