import { sanitizeRichHtml } from './sanitizeRichHtml';

describe('sanitizeRichHtml', () => {
  test('removes executable and navigation content', () => {
    const dirty = '<p onclick="alert(1)">Hello<script>alert(2)</script><a href="javascript:alert(3)">link</a></p>';
    const clean = sanitizeRichHtml(dirty);
    expect(clean).toBe('<p>Hellolink</p>');
  });

  test('retains simple official-document formatting', () => {
    expect(sanitizeRichHtml('<p><strong>Subject:</strong> Notice</p><table><tbody><tr><td colspan="2">A</td></tr></tbody></table>'))
      .toContain('<td colspan="2">A</td>');
  });
});
