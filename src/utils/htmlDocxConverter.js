// =================================================================
// HSS SHANGUS — HTML to DOCX Element Parser & Converter
// =================================================================
// Converts rich HTML strings (tables, paragraphs, lists, bold/italic/underline,
// headings, alignment, fonts, colors) into native Microsoft Word (`docx`)
// objects for 100% native compatibility with MS Word, Google Docs, LibreOffice.
// =================================================================

import {
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle
} from 'docx';

/**
 * Convert CSS/Attribute alignment string to docx AlignmentType.
 */
function getAlignment(alignStr) {
  if (!alignStr) return AlignmentType.LEFT;
  const s = String(alignStr).toLowerCase().trim();
  if (s === 'center') return AlignmentType.CENTER;
  if (s === 'right') return AlignmentType.RIGHT;
  if (s === 'justify') return AlignmentType.JUSTIFIED;
  return AlignmentType.LEFT;
}

/**
 * Clean hex color string for docx (removes # prefix and handles named colors).
 */
function sanitizeColor(col) {
  if (!col) return undefined;
  let c = String(col).trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{6}$/.test(c)) return c.toUpperCase();
  if (/^[0-9a-fA-F]{3}$/.test(c)) {
    return (c[0] + c[0] + c[1] + c[1] + c[2] + c[2]).toUpperCase();
  }
  // Named color fallbacks
  const named = {
    maroon: '800000',
    red: 'DC2626',
    blue: '2563EB',
    navy: '0A192F',
    green: '16A34A',
    gray: '64748B',
    black: '000000'
  };
  return named[col.toLowerCase()] || undefined;
}

/**
 * Extract formatting styles from an HTML Element.
 */
function extractStyles(node, inherited = {}) {
  const styles = { ...inherited };
  if (!node || node.nodeType !== 1) return styles;

  const tag = node.tagName.toLowerCase();
  if (tag === 'strong' || tag === 'b' || tag === 'th') styles.bold = true;
  if (tag === 'em' || tag === 'i') styles.italics = true;
  if (tag === 'u' || tag === 'ins') styles.underline = true;
  if (tag === 's' || tag === 'strike' || tag === 'del') styles.strike = true;

  const inlineStyle = node.getAttribute('style') || '';
  if (/font-weight:\s*(bold|700|800|900)/i.test(inlineStyle)) styles.bold = true;
  if (/font-style:\s*italic/i.test(inlineStyle)) styles.italics = true;
  if (/text-decoration:\s*underline/i.test(inlineStyle)) styles.underline = true;
  if (/text-decoration:\s*line-through/i.test(inlineStyle)) styles.strike = true;

  const colorMatch = inlineStyle.match(/color:\s*([^;]+)/i);
  if (colorMatch) {
    const parsed = sanitizeColor(colorMatch[1]);
    if (parsed) styles.color = parsed;
  }
  if (node.hasAttribute('color')) {
    const parsed = sanitizeColor(node.getAttribute('color'));
    if (parsed) styles.color = parsed;
  }

  return styles;
}

/**
 * Parse an inline DOM subtree into an array of docx TextRun instances.
 */
function parseInlineNodes(node, inheritedStyles = {}, defaultFont = 'Calibri', defaultSize = 24) {
  const textRuns = [];

  function traverse(curr, styles) {
    if (!curr) return;

    if (curr.nodeType === 3) { // Text node
      const text = curr.nodeValue;
      if (text) {
        textRuns.push(
          new TextRun({
            text: text,
            bold: styles.bold || false,
            italics: styles.italics || false,
            underline: styles.underline ? {} : undefined,
            strike: styles.strike || false,
            color: styles.color || undefined,
            font: defaultFont,
            size: styles.size || defaultSize
          })
        );
      }
      return;
    }

    if (curr.nodeType === 1) { // Element node
      const tag = curr.tagName.toLowerCase();
      if (tag === 'br') {
        textRuns.push(new TextRun({ text: '\n', break: 1, font: defaultFont, size: defaultSize }));
        return;
      }

      const nextStyles = extractStyles(curr, styles);
      for (const child of curr.childNodes) {
        traverse(child, nextStyles);
      }
    }
  }

  traverse(node, inheritedStyles);
  return textRuns.length > 0 ? textRuns : [new TextRun({ text: ' ', font: defaultFont, size: defaultSize })];
}

/**
 * Parse an HTML <table> element into a native docx Table instance.
 */
function parseHtmlTable(tableEl, defaultFont = 'Calibri') {
  const trElements = Array.from(tableEl.querySelectorAll('tr'));
  if (trElements.length === 0) return null;

  // Determine max columns in any row
  let maxCols = 1;
  trElements.forEach(tr => {
    const cells = tr.querySelectorAll('th, td');
    if (cells.length > maxCols) maxCols = cells.length;
  });

  const colWidthPct = Math.floor(100 / Math.max(1, maxCols));

  const rows = trElements.map((tr, rowIdx) => {
    const cellElements = Array.from(tr.querySelectorAll('th, td'));
    const isHeaderRow = tr.parentElement && tr.parentElement.tagName.toLowerCase() === 'thead';

    const cells = cellElements.map(cellEl => {
      const isHeader = cellEl.tagName.toLowerCase() === 'th' || isHeaderRow;
      const cellAlignStr = cellEl.getAttribute('align') || cellEl.style.textAlign || (isHeader ? 'left' : 'left');
      const alignment = getAlignment(cellAlignStr);

      const cellTextRuns = parseInlineNodes(
        cellEl,
        isHeader ? { bold: true, size: 21 } : { size: 21 },
        defaultFont,
        21
      );

      const cellParagraph = new Paragraph({
        alignment,
        spacing: { before: 80, after: 80, line: 260 },
        children: cellTextRuns
      });

      return new TableCell({
        width: { size: colWidthPct, type: WidthType.PERCENTAGE },
        shading: isHeader ? { fill: 'F1F5F9' } : (rowIdx % 2 === 1 ? { fill: 'FAFAFA' } : undefined),
        borders: {
          top: { style: BorderStyle.SINGLE, size: 4, color: '94A3B8' },
          bottom: { style: BorderStyle.SINGLE, size: 4, color: '94A3B8' },
          left: { style: BorderStyle.SINGLE, size: 4, color: '94A3B8' },
          right: { style: BorderStyle.SINGLE, size: 4, color: '94A3B8' }
        },
        children: [cellParagraph]
      });
    });

    return new TableRow({
      tableHeader: isHeaderRow,
      children: cells
    });
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 6, color: '64748B' },
      bottom: { style: BorderStyle.SINGLE, size: 6, color: '64748B' },
      left: { style: BorderStyle.SINGLE, size: 6, color: '64748B' },
      right: { style: BorderStyle.SINGLE, size: 6, color: '64748B' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' },
      insideVertical: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' }
    },
    rows
  });
}

/**
 * Main parser: Converts an arbitrary HTML string into an array of docx Elements (Paragraphs, Tables).
 * Fully supports HTML tables, paragraphs, bold, italic, underline, lists, headings, and alignments.
 * 
 * @param {string} htmlString - HTML body content
 * @param {object} options - Options { defaultFont: 'Calibri' | 'Georgia', defaultSize: 24, defaultAlign: 'left' }
 * @returns {Array<Paragraph|Table>}
 */
export function convertHtmlToDocxElements(htmlString, options = {}) {
  const {
    defaultFont = 'Calibri',
    defaultSize = 24, // 12pt
    defaultAlign = 'left',
    lineSpacing = 300
  } = options;

  if (!htmlString || typeof htmlString !== 'string' || htmlString.trim() === '') {
    return [new Paragraph({ children: [new TextRun({ text: ' ', font: defaultFont, size: defaultSize })] })];
  }

  // Use browser DOMParser
  const parser = new DOMParser();
  const parsedDoc = parser.parseFromString(`<body>${htmlString}</body>`, 'text/html');
  const body = parsedDoc.body;

  const docxElements = [];

  function processBlockNode(node) {
    if (!node) return;

    if (node.nodeType === 3) { // Bare text node outside block
      const text = node.nodeValue.trim();
      if (text) {
        docxElements.push(
          new Paragraph({
            alignment: getAlignment(defaultAlign),
            spacing: { before: 80, after: 80, line: lineSpacing },
            children: [new TextRun({ text, font: defaultFont, size: defaultSize })]
          })
        );
      }
      return;
    }

    if (node.nodeType !== 1) return;

    const tag = node.tagName.toLowerCase();

    // Table element -> Native docx Table
    if (tag === 'table') {
      const table = parseHtmlTable(node, defaultFont);
      if (table) {
        docxElements.push(table);
        // Add subtle spacing after table
        docxElements.push(new Paragraph({ spacing: { before: 120, after: 120 } }));
      }
      return;
    }

    // Horizontal Rule
    if (tag === 'hr') {
      docxElements.push(
        new Paragraph({
          spacing: { before: 140, after: 140 },
          border: {
            bottom: { style: BorderStyle.SINGLE, size: 6, color: 'CBD5E1' }
          }
        })
      );
      return;
    }

    // Headings
    if (/^h[1-6]$/.test(tag)) {
      const level = parseInt(tag[1], 10);
      const sizeMap = { 1: 34, 2: 30, 3: 26, 4: 24, 5: 22, 6: 20 };
      const alignStr = node.getAttribute('align') || node.style.textAlign || defaultAlign;
      const textRuns = parseInlineNodes(node, { bold: true, size: sizeMap[level] || 26 }, defaultFont, sizeMap[level] || 26);
      docxElements.push(
        new Paragraph({
          alignment: getAlignment(alignStr),
          spacing: { before: 200, after: 100 },
          children: textRuns
        })
      );
      return;
    }

    // Lists (<ul> / <ol>)
    if (tag === 'ul' || tag === 'ol') {
      const isOrdered = tag === 'ol';
      const listItems = Array.from(node.querySelectorAll(':scope > li'));
      listItems.forEach((li, idx) => {
        const textRuns = parseInlineNodes(li, {}, defaultFont, defaultSize);
        if (isOrdered) {
          textRuns.unshift(new TextRun({ text: `${idx + 1}. `, bold: true, font: defaultFont, size: defaultSize }));
        } else {
          textRuns.unshift(new TextRun({ text: '• ', bold: true, font: defaultFont, size: defaultSize }));
        }
        docxElements.push(
          new Paragraph({
            indent: { left: 400 },
            spacing: { before: 60, after: 60, line: lineSpacing },
            children: textRuns
          })
        );
      });
      return;
    }

    // Blockquote
    if (tag === 'blockquote') {
      const textRuns = parseInlineNodes(node, { italics: true, color: '475569' }, defaultFont, defaultSize);
      docxElements.push(
        new Paragraph({
          indent: { left: 720, right: 720 },
          spacing: { before: 120, after: 120, line: lineSpacing },
          children: textRuns
        })
      );
      return;
    }

    // Paragraphs, divs, sections, or other container blocks
    if (tag === 'p' || tag === 'div' || tag === 'section' || tag === 'article' || tag === 'header' || tag === 'footer') {
      // Check if this container directly contains a table or list
      const hasDirectTableOrList = node.querySelector('table, ul, ol');
      if (hasDirectTableOrList) {
        for (const child of node.childNodes) {
          processBlockNode(child);
        }
        return;
      }

      const alignStr = node.getAttribute('align') || node.style.textAlign || defaultAlign;
      const alignment = getAlignment(alignStr);
      const textRuns = parseInlineNodes(node, {}, defaultFont, defaultSize);

      docxElements.push(
        new Paragraph({
          alignment,
          spacing: { before: 80, after: 120, line: lineSpacing },
          children: textRuns
        })
      );
      return;
    }

    // Fallback: Inline elements placed directly under body
    const alignStr = defaultAlign;
    const textRuns = parseInlineNodes(node, {}, defaultFont, defaultSize);
    docxElements.push(
      new Paragraph({
        alignment: getAlignment(alignStr),
        spacing: { before: 80, after: 120, line: lineSpacing },
        children: textRuns
      })
    );
  }

  for (const child of body.childNodes) {
    processBlockNode(child);
  }

  return docxElements.length > 0
    ? docxElements
    : [new Paragraph({ children: [new TextRun({ text: ' ', font: defaultFont, size: defaultSize })] })];
}
