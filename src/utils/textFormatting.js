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
