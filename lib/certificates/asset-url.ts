/**
 * Certificate PDFs are rendered server-side, so image sources must stay on the
 * configured Supabase origin to prevent organizers from making the renderer
 * fetch arbitrary internal or third-party URLs.
 */
export function isSafeCertificateAssetUrl(value: string | null | undefined): boolean {
  if (!value) return true;
  let candidate: URL;
  try { candidate = new URL(value); } catch { return false; }
  if (candidate.username || candidate.password) return false;

  const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  if (configuredUrl) {
    try {
      const configured = new URL(configuredUrl);
      if (candidate.origin === configured.origin && candidate.protocol === 'https:') return true;
      if (process.env.NODE_ENV === 'development' && candidate.origin === configured.origin && candidate.protocol === 'http:') return true;
    } catch {
      return false;
    }
  }

  return process.env.NODE_ENV === 'development'
    && candidate.protocol === 'http:'
    && ['localhost', '127.0.0.1', '::1'].includes(candidate.hostname);
}
