/**
 * Only SMS from these senders are ever turned into entries; every other SMS is ignored.
 * The user can edit the list on the SMS screen.
 */
export const DEFAULT_TRACKED_SENDERS = ['SAMPATHTXN'];

function norm(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Clean up user input: "Sampath-Txn " -> "SAMPATHTXN". Returns '' if nothing usable. */
export function normalizeSender(s: string): string {
  return norm(s);
}

/**
 * True if the SMS sender is on the tracked list. Compares the sender ID only (never the message
 * text), ignoring case, spaces and punctuation, and allowing operator prefixes like "AD-SAMPATHTXN".
 * An empty list tracks nothing.
 */
export function isTrackedSender(address: string | null, tracked: string[]): boolean {
  const from = norm(address ?? '');
  if (!from) return false;
  return tracked.some((s) => {
    const key = norm(s);
    return key.length > 0 && from.includes(key);
  });
}
