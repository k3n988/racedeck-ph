export function publicRegistrationPath(event: { slug: string; organizer: { slug: string | null } | null }) {
  const eventSlug = encodeURIComponent(event.slug);
  const organizationSlug = event.organizer?.slug?.trim();
  return organizationSlug
    ? `/register/${encodeURIComponent(organizationSlug)}/${eventSlug}`
    : `/register/${eventSlug}`;
}
