export const MAX_INLINE_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_RICH_CONTENT_LENGTH = 50_000;
export const INLINE_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function validateInlineImage(file: Pick<File, 'size' | 'type'>) {
  if (!file.size) return 'The selected image is empty.';
  if (file.size > MAX_INLINE_IMAGE_BYTES) return 'Images must be 10 MB or smaller.';
  if (!INLINE_IMAGE_TYPES.has(file.type)) return 'Choose a JPG, PNG, or WEBP image.';
  return null;
}

export function richContentLength(content: string) {
  return content
    .replace(/\s+src\s*=\s*(["'])data:image\/[^"']*\1/gi, ' src=""')
    .length;
}

export function normalizeRichTextUrl(value: string, type: 'link' | 'image' = 'link') {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (type === 'image' && /^(?:\/|#|\?)/.test(trimmed)) return null;
  if (type === 'link' && (/^(?:\/|#|\?)/.test(trimmed))) return trimmed;

  const candidate = /^[a-z][a-z\d+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(candidate);
    const allowedProtocols = type === 'image' ? ['http:', 'https:'] : ['http:', 'https:', 'mailto:', 'tel:'];
    if (!allowedProtocols.includes(parsed.protocol)) return null;
    if (['http:', 'https:'].includes(parsed.protocol) && !parsed.hostname) return null;
    return candidate;
  } catch {
    return null;
  }
}
