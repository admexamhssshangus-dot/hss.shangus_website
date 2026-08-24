import DOMPurify from 'dompurify';

const CONFIG = Object.freeze({
  ALLOWED_TAGS: [
    'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's',
    'h1', 'h2', 'h3', 'h4', 'blockquote',
    'ol', 'ul', 'li', 'table', 'thead', 'tbody', 'tfoot',
    'tr', 'th', 'td', 'span',
  ],
  ALLOWED_ATTR: ['class', 'colspan', 'rowspan', 'scope'],
  ALLOW_DATA_ATTR: false,
  FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'svg', 'math'],
  FORBID_ATTR: ['style', 'src', 'href', 'srcset', 'formaction'],
});

export function sanitizeRichHtml(value) {
  return DOMPurify.sanitize(String(value || ''), CONFIG);
}

export default sanitizeRichHtml;
