import { parseJkboseMarks, calculateDivision } from './jkboseMarksParser';

describe('JKBOSE Marks Parser & Division/Percentage Calculator', () => {
  test('calculates core percentage and distinction for candidate with additional subject (Ajvaa Ibrahim)', () => {
    const res = parseJkboseMarks('492 / 500; MH 81', 500, 'Qualified');
    expect(res.obtained).toBe('492');
    expect(res.max).toBe('500');
    expect(res.additionalSubject).toBe('MH 81');
    expect(res.pct).toBe(98.4);
    expect(res.pctStr).toBe('98.4%');
    expect(res.division).toBe('Distinction');
    expect(res.formattedMarks).toBe('492 / 500; MH 81');
  });

  test('de-duplicates accidental paste repetition (e.g. 492492 / 500; MH 81)', () => {
    const res = parseJkboseMarks('492492 / 500; MH 81', 500, 'Qualified');
    expect(res.obtained).toBe('492');
    expect(res.max).toBe('500');
    expect(res.additionalSubject).toBe('MH 81');
    expect(res.pct).toBe(98.4);
    expect(res.pctStr).toBe('98.4%');
    expect(res.division).toBe('Distinction');
    expect(res.formattedMarks).toBe('492 / 500; MH 81');
  });

  test('calculates standard 1st division and percentage for pure numeric marks', () => {
    const res = parseJkboseMarks('303', 500, 'Passed');
    expect(res.obtained).toBe('303');
    expect(res.max).toBe('500');
    expect(res.pct).toBe(60.6);
    expect(res.pctStr).toBe('60.6%');
    expect(res.division).toBe('1st Division');
  });

  test('calculates 2nd division and 3rd division accurately', () => {
    const secondDiv = parseJkboseMarks('250 / 500', 500, 'Passed');
    expect(secondDiv.pct).toBe(50.0);
    expect(secondDiv.division).toBe('2nd Division');

    const thirdDiv = parseJkboseMarks('180 / 500', 500, 'Passed');
    expect(thirdDiv.pct).toBe(36.0);
    expect(thirdDiv.division).toBe('3rd Division');
  });

  test('handles Reappear status properly without creating false divisions', () => {
    const res = parseJkboseMarks('GE, PH', 500, 'Reappear');
    expect(res.isReap).toBe(true);
    expect(res.division).toBe('Reappear');
    expect(res.pctStr).toBe('—');
  });

  test('calculateDivision wrapper correctly provides pct, division, and additional subject', () => {
    const div = calculateDivision('492 / 500; MH 81', 500);
    expect(div.division).toBe('Distinction');
    expect(div.pctStr).toBe('98.4%');
    expect(div.additionalSubject).toBe('MH 81');
    expect(div.obtained).toBe('492');
  });
});
