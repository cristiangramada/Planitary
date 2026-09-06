/** Cookie that carries the browser's IANA time zone to server-rendered pages. */
export const CLIENT_TIME_ZONE_COOKIE = "planitary-time-zone";

/** Decodes the optional cookie value without allowing malformed input to throw. */
export function parseClientTimeZone(value: string | undefined): string | undefined {
  if (!value) return undefined;

  try {
    return decodeURIComponent(value);
  } catch {
    return undefined;
  }
}
