// =================================================================
// HSS SHANGUS — JKBOSE Marks, Percentage & Division Parser
// Standalone pure utility to evaluate marks, percentages, divisions,
// additional subjects (e.g. "492 / 500; MH 81"), and de-duplicate inputs.
// =================================================================

/**
 * Normalizes JKBOSE result status strings to standard tokens: 'Passed', 'Reap', 'Failed', 'Absent', or 'Qualified'.
 */
export function normalizeResultStatus(raw) {
  if (!raw) return 'Qualified';
  const text = String(raw).trim().toLowerCase();
  if (/\b(reap|re-appear|reappear|compartment|re-exam|supply)\b/.test(text)) return 'Reap';
  if (/\b(fail|failed)\b/.test(text)) return 'Failed';
  if (/\b(abs|absent)\b/.test(text)) return 'Absent';
  if (/\b(pass|passed|distinction|1st\s*div|2nd\s*div|3rd\s*div|first|second|third)\b/.test(text)) return 'Passed';
  return 'Qualified';
}

/**
 * Parse JKBOSE Marks, handle additional subjects (e.g. "492 / 500; MH 81"),
 * de-duplicate accidental repeat inputs (e.g. "492492"), and calculate percentage & division.
 */
export function parseJkboseMarks(rawMarks, fallbackMax = 500, resultStatus = 'Qualified') {
  if (rawMarks === null || rawMarks === undefined || String(rawMarks).trim() === '') {
    return {
      obtained: '',
      max: String(fallbackMax || 500),
      additionalSubject: '',
      pct: 0,
      pctStr: '—',
      division: '—',
      formattedMarks: '',
      isPassed: false,
      isReap: normalizeResultStatus(resultStatus) === 'Reap',
      isFailed: normalizeResultStatus(resultStatus) === 'Failed'
    };
  }

  let marksStr = String(rawMarks).trim().replace(/\.0+$/, '');
  const normStatus = normalizeResultStatus(resultStatus);
  const isPassed = normStatus === 'Passed';
  const isReap = normStatus === 'Reap';
  const isFailed = normStatus === 'Failed';

  // 1. Extract additional subject part (e.g. "; MH 81", "; MH 65", or "(Addl: MH 81)")
  let additionalSubject = '';
  if (marksStr.includes(';')) {
    const parts = marksStr.split(';');
    marksStr = parts[0].trim();
    additionalSubject = parts.slice(1).join(';').trim();
  } else if (/\((?:addl|additional)?:?\s*([^)]+)\)/i.test(marksStr)) {
    const match = marksStr.match(/\((?:addl|additional)?:?\s*([^)]+)\)/i);
    if (match) {
      additionalSubject = match[1].trim();
      marksStr = marksStr.replace(match[0], '').trim();
    }
  }

  // 2. Check for marks format: "obtained / max" or "obtained"
  let obtainedStr = '';
  let maxStr = String(fallbackMax || 500);

  const slashMatch = marksStr.match(/^([^/]+)\s*\/\s*(\d+)/);
  if (slashMatch) {
    obtainedStr = slashMatch[1].trim();
    maxStr = slashMatch[2].trim();
  } else {
    // If no slash, check leading numeric
    const numPrefixMatch = marksStr.match(/^(\d+)/);
    if (numPrefixMatch) {
      obtainedStr = numPrefixMatch[1].trim();
      const rest = marksStr.slice(numPrefixMatch[1].length).trim();
      if (rest && !additionalSubject && !/^(pass|passed|qual|qualified)$/i.test(rest)) {
        additionalSubject = rest.replace(/^[;,/-]\s*/, '').trim();
      }
    } else {
      obtainedStr = marksStr;
    }
  }

  // 3. De-duplicate accidental repetition (e.g. "492492" -> "492")
  const numDigitsOnly = obtainedStr.replace(/\D/g, '');
  const maxNum = parseFloat(maxStr) || 500;
  if (numDigitsOnly.length >= 4 && numDigitsOnly.length % 2 === 0) {
    const halfLen = numDigitsOnly.length / 2;
    const firstHalf = numDigitsOnly.slice(0, halfLen);
    const secondHalf = numDigitsOnly.slice(halfLen);
    if (firstHalf === secondHalf && parseFloat(numDigitsOnly) > maxNum && parseFloat(firstHalf) <= maxNum) {
      obtainedStr = firstHalf;
    }
  }

  const obtNum = parseFloat(obtainedStr);
  const isValidObt = !isNaN(obtNum) && obtNum > 0;

  // 4. Calculate Percentage & Division strictly out of core 500 marks
  let pct = 0;
  let pctStr = '—';
  let division = '—';

  if (isValidObt && maxNum > 0 && (isPassed || (!isReap && !isFailed))) {
    pct = Math.round((obtNum / maxNum) * 1000) / 10;
    pctStr = `${pct.toFixed(1)}%`;
    if (pct >= 75) division = 'Distinction';
    else if (pct >= 60) division = '1st Division';
    else if (pct >= 45) division = '2nd Division';
    else if (pct >= 33) division = '3rd Division';
    else division = 'Reappear';
  } else if (isReap || /^[A-Z]{2}(?:\s*,\s*[A-Z]{2})*$/.test(obtainedStr)) {
    division = 'Reappear';
  } else if (isFailed) {
    division = 'Failed';
  } else if (isPassed) {
    division = 'Passed';
  }

  // 5. Clean, standardized formatted marks string (e.g. "492 / 500; MH 81")
  let formattedMarks = '';
  if (isValidObt) {
    formattedMarks = `${obtNum} / ${maxNum}${additionalSubject ? `; ${additionalSubject}` : ''}`;
  } else {
    formattedMarks = String(rawMarks).trim();
    if (additionalSubject && !formattedMarks.includes(additionalSubject)) {
      formattedMarks += `; ${additionalSubject}`;
    }
  }

  return {
    obtained: isValidObt ? String(obtNum) : obtainedStr,
    max: String(maxNum),
    additionalSubject,
    pct,
    pctStr,
    division,
    formattedMarks,
    isPassed: isPassed || (isValidObt && !isReap && !isFailed),
    isReap: isReap || division === 'Reappear',
    isFailed
  };
}

/**
 * Calculates division and percentage metadata from raw marks obtained string.
 */
export function calculateDivision(marksObt, maxMarks = 500) {
  const parsed = parseJkboseMarks(marksObt, maxMarks);
  return {
    pct: parsed.pct,
    division: parsed.division,
    pctStr: parsed.pctStr,
    additionalSubject: parsed.additionalSubject,
    obtained: parsed.obtained,
    max: parsed.max,
    formattedMarks: parsed.formattedMarks
  };
}
