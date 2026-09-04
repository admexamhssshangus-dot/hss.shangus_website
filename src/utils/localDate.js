/** Return a calendar date key in the user's local timezone (YYYY-MM-DD). */
export function toLocalDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Return a calendar month key in the user's local timezone (YYYY-MM). */
export function toLocalMonthKey(value = new Date()) {
  return toLocalDateKey(value).slice(0, 7);
}
