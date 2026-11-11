export const optionalEventLinkPlatforms = [
  { key: 'phone', label: 'Phone number' },
  { key: 'website', label: 'Website' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'tiktok', label: 'TikTok' },
  { key: 'youtube', label: 'YouTube' },
  { key: 'x', label: 'X' },
] as const;

export type OptionalEventLinkPlatform = (typeof optionalEventLinkPlatforms)[number]['key'];
export type EventSocialLinks = { facebook?: string } & Partial<Record<OptionalEventLinkPlatform, string>>;

const linkLabels: Record<OptionalEventLinkPlatform | 'facebook', string> = {
  facebook: 'Facebook',
  phone: 'Phone number',
  website: 'Website',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  x: 'X',
};

export function eventLinkIsValid(value: string): boolean {
  if (!value.trim()) return true;
  try {
    const url = new URL(value.trim());
    return ['http:', 'https:'].includes(url.protocol) && Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function eventPlatformLinkIsValid(platform: OptionalEventLinkPlatform | 'facebook', value: string): boolean {
  if (platform === 'phone') return Boolean(value.trim()) && eventPhoneIsValid(value);
  if (!value.trim() || !eventLinkIsValid(value)) return false;
  if (platform === 'website') return true;
  const hosts: Record<Exclude<OptionalEventLinkPlatform, 'website' | 'phone'> | 'facebook', readonly string[]> = {
    facebook: ['facebook.com', 'fb.com', 'fb.me'],
    instagram: ['instagram.com'],
    tiktok: ['tiktok.com'],
    youtube: ['youtube.com', 'youtu.be'],
    x: ['x.com', 'twitter.com'],
  };
  const hostname = new URL(value.trim()).hostname.toLowerCase();
  return hosts[platform].some((host) => hostname === host || hostname.endsWith(`.${host}`));
}

export function eventPhoneIsValid(value: string): boolean {
  return !value.trim() || (value.trim().length <= 24 && /^[+\d().\s-]+$/.test(value.trim()) && value.replace(/\D/g, '').length >= 7 && value.replace(/\D/g, '').length <= 15);
}

export function parseEventSocialLinks(raw: unknown): { links: EventSocialLinks; error?: string } {
  if (raw == null) return { links: {} };
  if (typeof raw !== 'object' || Array.isArray(raw)) return { links: {}, error: 'Invalid event contact links.' };
  const input = raw as Record<string, unknown>;
  const links: EventSocialLinks = {};
  for (const key of ['facebook', 'website', 'instagram', 'tiktok', 'youtube', 'x'] as const) {
    const value = input[key];
    if (value == null || value === '') continue;
    if (typeof value !== 'string' || value.trim().length > 2048 || !eventPlatformLinkIsValid(key, value)) {
      return { links: {}, error: `${linkLabels[key]} must be a valid ${key === 'website' ? 'website' : linkLabels[key]} HTTP or HTTPS URL (up to 2,048 characters).` };
    }
    links[key] = value.trim();
  }
  const phone = input.phone;
  if (phone != null && phone !== '') {
    if (typeof phone !== 'string' || !eventPhoneIsValid(phone)) return { links: {}, error: 'Phone number must contain 7 to 15 digits and only standard phone characters.' };
    links.phone = phone.trim();
  }
  return { links };
}
