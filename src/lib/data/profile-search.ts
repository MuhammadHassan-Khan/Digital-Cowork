/**
 * Pure helpers for profile discovery queries — kept free of I/O so the
 * PostgREST filter sanitization is unit-testable (ARCHITECTURE §8).
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/**
 * Strip characters that carry meaning in PostgREST filter syntax or SQL
 * LIKE patterns, cap length, and collapse whitespace. User input must never
 * alter the structure of a filter string.
 */
export function sanitizeSearchTerm(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .replace(/[%,(){}\\"'\n\r\t]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

/** Escape LIKE wildcards so a query for "100%" matches literally. */
export function toIlikePattern(term: string): string {
  return `%${term.replace(/[%_]/g, "\\$&")}%`;
}

/** Array-contains filters only work for single tokens (no spaces). */
export function skillMatchToken(term: string): string | null {
  if (!term) return null;
  if (/[\s,{}%_]/.test(term)) return null;
  return term.toLowerCase();
}
