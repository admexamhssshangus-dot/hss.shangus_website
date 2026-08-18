import React from 'react';

/**
 * Formats news / notice titles such that any text enclosed in brackets e.g. (to be held on 10 August)
 * is rendered in a font size that is smaller by 4 points (calc(1em - 4pt)).
 */
export function formatTitleWithBrackets(title) {
  if (!title || typeof title !== 'string') return title;

  // Split title by parenthetical or bracketed substrings
  const regex = /(\([^)]+\)|\[[^\]]+\])/g;
  const parts = title.split(regex);

  if (parts.length <= 1) return title;

  return parts.map((part, i) => {
    if (!part) return null;
    if ((part.startsWith('(') && part.endsWith(')')) || (part.startsWith('[') && part.endsWith(']'))) {
      return (
        <span
          key={i}
          className="font-normal opacity-90 inline"
          style={{ fontSize: 'calc(1em - 4pt)' }}
        >
          {part}
        </span>
      );
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

/**
 * Formats a person's name (student, teacher, parent, admin) to proper Title Case.
 * Handles inputs like 'ahmad', 'AHMAD', 'aHMAD', 'ZEESHAN MUKHTAR', 'mukhtar ahmad mir'
 * and converts them cleanly to 'Ahmad', 'Zeeshan Mukhtar', 'Mukhtar Ahmad Mir'.
 */
export function toTitleCase(str) {
  if (!str || typeof str !== 'string') return '';
  const trimmed = str.trim();
  if (!trimmed || /^(—|-|N\/A|NA|null|undefined)$/i.test(trimmed)) return '—';

  let formatted = trimmed
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map(word => {
      if (!word) return '';
      // Handle words starting with parentheses e.g. (late) -> (Late)
      if (word.startsWith('(') && word.length > 1) {
        return '(' + word.charAt(1).toUpperCase() + word.slice(2);
      }
      // Handle hyphenated words e.g. mary-anne -> Mary-Anne
      if (word.includes('-')) {
        return word.split('-').map(w => w ? w.charAt(0).toUpperCase() + w.slice(1) : '').join('-');
      }
      // Handle dotted initials e.g. ab. -> Ab. or md. -> Md.
      if (word.includes('.')) {
        return word.split('.').map(w => w ? w.charAt(0).toUpperCase() + w.slice(1) : '').join('.');
      }
      // Handle slash separated names e.g. father/mother
      if (word.includes('/')) {
        return word.split('/').map(w => w ? w.charAt(0).toUpperCase() + w.slice(1) : '').join('/');
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');

  if (formatted.includes('Bilal Ahmad Magray')) {
    formatted = formatted.replace(/Bilal Ahmad Magray/gi, 'Bilal Ahmad Khandy');
  }

  return formatted;
}

