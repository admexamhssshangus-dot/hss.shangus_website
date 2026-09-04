import { toLocalDateKey, toLocalMonthKey } from './localDate';

describe('local calendar keys', () => {
  test('uses local calendar components instead of UTC components', () => {
    const localDate = new Date(2026, 8, 4, 0, 15);
    expect(toLocalDateKey(localDate)).toBe('2026-09-04');
    expect(toLocalMonthKey(localDate)).toBe('2026-09');
    expect(toLocalDateKey(new Date('2026-09-03T19:00:00Z'))).toBe('2026-09-04');
  });

  test('rejects invalid dates', () => {
    expect(toLocalDateKey('not-a-date')).toBe('');
  });
});
