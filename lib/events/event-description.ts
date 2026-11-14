/**
 * Event creation stores the public tagline and rich description together because
 * the events table has no dedicated tagline column. Keep this format stable so
 * public pages and older saved event descriptions continue to work.
 */
export function composeEventDescription(tagline: string, description: string) {
  return [tagline.trim(), description.trim()].filter(Boolean).join('\n\n');
}

function plainText(value: string) {
  return value.replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/\s+/g, ' ').trim();
}

function looksLikeTagline(value: string) {
  const text = plainText(value);
  return Boolean(text && text.length <= 180);
}

export function splitEventDescription(value: string | null | undefined) {
  const source = value?.trim() ?? '';
  if (!source) return { tagline: '', description: '' };

  const separator = /\r?\n\s*\r?\n/.exec(source);
  if (separator && separator.index >= 0) {
    const tagline = source.slice(0, separator.index).trim();
    const description = source.slice(separator.index + separator[0].length).trim();
    if (looksLikeTagline(tagline)) return { tagline: plainText(tagline), description };
  }

  // Match the public event card's legacy tagline heuristic, but preserve longer
  // legacy descriptions intact in the rich text editor.
  if (!separator && looksLikeTagline(source)) return { tagline: plainText(source), description: '' };
  return { tagline: '', description: source };
}
