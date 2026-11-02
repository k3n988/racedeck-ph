/** Accept only same-origin path destinations for post-auth redirects. */
export function safeNextPath(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;

  try {
    const destination = new URL(value, "https://racedeck.invalid");
    if (destination.origin !== "https://racedeck.invalid") return null;
    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return null;
  }
}
