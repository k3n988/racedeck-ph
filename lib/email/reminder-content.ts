const PREFIX = 'racedeck-reminder:v1:';

export type ReminderContent = {
  subject: string;
  body: string;
  body_format: 'text' | 'html';
  dispatched_at: string | null;
};

export function encodeReminderContent(content: ReminderContent): string {
  return `${PREFIX}${JSON.stringify(content)}`;
}

export function decodeReminderContent(value: string | null, eventName: string): ReminderContent {
  if (value?.startsWith(PREFIX)) {
    try {
      const parsed = JSON.parse(value.slice(PREFIX.length)) as Partial<ReminderContent>;
      if (typeof parsed.subject === 'string' && typeof parsed.body === 'string') {
        return {
          subject: parsed.subject,
          body: parsed.body,
          body_format: parsed.body_format === 'html' ? 'html' : 'text',
          dispatched_at: typeof parsed.dispatched_at === 'string' ? parsed.dispatched_at : null,
        };
      }
    } catch {
      // Fall back to safe defaults if an older or malformed value is encountered.
    }
  }
  return {
    subject: `Reminder: ${eventName}`,
    body: value?.trim() || `This is a reminder that ${eventName} is coming up. Please review your registration for event details.`,
    body_format: 'text',
    dispatched_at: null,
  };
}

export function sanitizeReminderHtml(value: string): string {
  const withoutActiveContent = value
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\s*(script|style|iframe|object|svg|math)\b[^>]*>[\s\S]*?<\/\s*\1\s*>/gi, '');
  return withoutActiveContent.replace(/<[^>]*>/g, (tag) => {
    const parsed = tag.match(/^<\s*(\/?)\s*([a-z0-9]+)\b[^>]*>$/i);
    if (!parsed) return '';
    const [, closing, rawName] = parsed;
    const name = rawName.toLowerCase();
    if (name === 'b' || name === 'strong') return closing ? '</strong>' : '<strong>';
    if (name === 'br') return closing ? '' : '<br>';
    if (name === 'p' || name === 'div' || name === 'ul' || name === 'ol' || name === 'li') return closing ? `</${name}>` : `<${name}>`;
    return '';
  });
}

export function reminderHtmlToPlainText(value: string): string {
  return sanitizeReminderHtml(value)
    .replace(/<\s*br\s*>/gi, '\n')
    .replace(/<\/(p|div|li)>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

export function reminderTextToHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
}
