/**
 * School Screen auth host contract: only the canonical public origin may
 * initiate Auth.js requests through a reverse proxy. The URL itself is a
 * non-secret runtime setting; secrets remain in root-only environment files.
 */
export const SCHOOL_SCREEN_CANONICAL_HOST = "asasplus.shop";

export function readCanonicalAuthOrigin(value = process.env.AUTH_URL): URL | null {
  if (!value) return null;

  let origin: URL;
  try {
    origin = new URL(value);
  } catch {
    throw new Error("AUTH_URL must be an absolute HTTPS URL");
  }

  if (
    origin.protocol !== "https:" ||
    origin.hostname !== SCHOOL_SCREEN_CANONICAL_HOST ||
    origin.port ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash
  ) {
    throw new Error("AUTH_URL must be the canonical School Screen origin");
  }

  return origin;
}

export function isCanonicalAuthRequestHost(
  headers: Pick<Headers, "get">,
  origin = readCanonicalAuthOrigin(),
): boolean {
  if (!origin) return false;
  const forwarded = headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = (forwarded ?? headers.get("host") ?? "").toLowerCase();
  return host === origin.host;
}
