// Client-side double-submit CSRF helper: read the non-httpOnly staff_csrf
// cookie and echo it back as the x-csrf-token header on state-changing calls.
export function withCsrf(headers: Record<string, string>): Record<string, string> {
  const csrf = readCookie("staff_csrf");
  return csrf ? { ...headers, "x-csrf-token": csrf } : headers;
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const prefix = `${name}=`;
  for (const part of document.cookie.split("; ")) {
    if (part.startsWith(prefix))
      return decodeURIComponent(part.slice(prefix.length));
  }
  return null;
}
