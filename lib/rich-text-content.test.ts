import { describe, expect, it } from 'vitest';
import { MAX_INLINE_IMAGE_BYTES, MAX_RICH_CONTENT_LENGTH, normalizeRichTextUrl, richContentLength, validateInlineImage } from './rich-text-content';

describe('rich text content helpers', () => {
  it('allows only non-empty JPG, PNG, and WEBP images up to 10 MB', () => {
    expect(validateInlineImage({ size: 1, type: 'image/jpeg' })).toBeNull();
    expect(validateInlineImage({ size: MAX_INLINE_IMAGE_BYTES, type: 'image/png' })).toBeNull();
    expect(validateInlineImage({ size: 0, type: 'image/png' })).toMatch(/empty/i);
    expect(validateInlineImage({ size: MAX_INLINE_IMAGE_BYTES + 1, type: 'image/webp' })).toMatch(/10 MB/i);
    expect(validateInlineImage({ size: 10, type: 'image/svg+xml' })).toMatch(/JPG, PNG, or WEBP/i);
  });

  it('counts description text and markup without charging the temporary base64 image payload', () => {
    const html = `<p>${'a'.repeat(MAX_RICH_CONTENT_LENGTH)}</p><img alt="poster" src="data:image/png;base64,${'A'.repeat(2_000_000)}">`;
    expect(richContentLength(html)).toBeLessThanOrEqual(MAX_RICH_CONTENT_LENGTH + 40);
    expect(richContentLength(`<p>${'a'.repeat(MAX_RICH_CONTENT_LENGTH + 1)}</p>`)).toBeGreaterThan(MAX_RICH_CONTENT_LENGTH);
  });

  it('normalizes ordinary links and rejects executable or unsupported protocols', () => {
    expect(normalizeRichTextUrl('example.com/rules')).toBe('https://example.com/rules');
    expect(normalizeRichTextUrl('/events/summer-race')).toBe('/events/summer-race');
    expect(normalizeRichTextUrl('mailto:info@example.com')).toBe('mailto:info@example.com');
    expect(normalizeRichTextUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeRichTextUrl('data:image/svg+xml,hello')).toBeNull();
    expect(normalizeRichTextUrl('image.example/poster.png', 'image')).toBe('https://image.example/poster.png');
    expect(normalizeRichTextUrl('/poster.png', 'image')).toBeNull();
    expect(normalizeRichTextUrl('javascript:alert(1)', 'image')).toBeNull();
  });
});
