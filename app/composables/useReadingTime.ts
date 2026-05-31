/**
 * Parses a Supabase `recorded_at` timestamp to a Date.
 *
 * Supabase returns strings like "2026-05-29 16:38:45.493887+00" — the space
 * instead of T and the bare +00 offset are non-standard and cause Safari (and
 * some Chrome versions) to treat the value as local time instead of UTC,
 * making readings appear hours older than they are and triggering false
 * "offline" status.
 */
export function parseRecordedAt(s: string): Date {
  return new Date(
    s
      .replace(' ', 'T')           // space → T (ISO 8601 separator)
      .replace(/\+00$/, '+00:00')  // bare +00 → +00:00
  )
}
