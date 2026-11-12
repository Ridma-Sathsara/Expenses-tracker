/** Senders whose SMS are never treated as expenses. The user can edit this list on the SMS screen. */
export const DEFAULT_BLOCKED_SENDERS = ['COMBANK', 'SAMPATHOTP'];

/**
 * Adds defaults the user has not been offered yet to their saved list.
 * `seen` is the set of defaults already applied once, so a default the user later
 * unblocked is not forced back on.
 */
export function mergeNewDefaults(saved: string[], seen: string[]): string[] {
  const fresh = DEFAULT_BLOCKED_SENDERS.filter((d) => !seen.includes(d) && !saved.includes(d));
  return [...saved, ...fresh];
}

function norm(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Clean up user input: "ComBank " -> "COMBANK". Returns '' if nothing usable. */
export function normalizeSender(s: string): string {
  return norm(s);
}

/**
 * True if an SMS comes from a blocked sender. Matches the sender ID ("COMBANK", "ComBank-Alert", "AD-COMBANK")
 * and also messages whose text starts with the name ("COMBANK: Your card…"), which some phones show
 * under a number instead of the bank's name.
 */
export function isBlockedSender(address: string | null, body: string, blocked: string[]): boolean {
  const from = norm(address ?? '');
  const start = norm(body.slice(0, 30));
  return blocked.some((b) => {
    const key = norm(b);
    return key.length > 0 && (from.includes(key) || start.startsWith(key));
  });
}
