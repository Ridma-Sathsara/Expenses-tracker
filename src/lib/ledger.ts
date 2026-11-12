/**
 * Pure cash-flow maths, kept separate from storage and UI so it can be unit tested.
 */
import type { EntryType } from './categories';

export type LedgerEntry = { type: EntryType; amount: number; date: number; category: string };

export type CashFlow = {
  cashIn: number;
  cashOut: number;
  /** cashIn - cashOut. Positive means money left over. */
  net: number;
  /** Share of cash in that was kept (0..1), or null when there is no cash in. */
  savingsRate: number | null;
  countIn: number;
  countOut: number;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function cashFlow(entries: readonly LedgerEntry[]): CashFlow {
  let cashIn = 0;
  let cashOut = 0;
  let countIn = 0;
  let countOut = 0;
  for (const e of entries) {
    if (e.type === 'income') {
      cashIn += e.amount;
      countIn++;
    } else {
      cashOut += e.amount;
      countOut++;
    }
  }
  cashIn = round2(cashIn);
  cashOut = round2(cashOut);
  const net = round2(cashIn - cashOut);
  return { cashIn, cashOut, net, savingsRate: cashIn > 0 ? net / cashIn : null, countIn, countOut };
}

/** Totals per category for one direction, largest first. */
export function totalsByCategory(entries: readonly LedgerEntry[], type: EntryType): { category: string; total: number }[] {
  const map = new Map<string, number>();
  for (const e of entries) if (e.type === type) map.set(e.category, (map.get(e.category) ?? 0) + e.amount);
  return [...map.entries()].map(([category, total]) => ({ category, total: round2(total) })).sort((a, b) => b.total - a.total);
}

/** The first day that counts. Anything earlier is left out of every total, list and SMS scan. */
export const DEFAULT_TRACKING_START = new Date(2026, 10, 10).getTime(); // 10 Nov 2026, local midnight

/** Money already in the account when tracking started. Editable in Settings. */
export const DEFAULT_OPENING_BALANCE = 1000;

/** What you have now: what you started with, plus everything in, minus everything out. */
export function balance(opening: number, flow: CashFlow): number {
  return round2(opening + flow.cashIn - flow.cashOut);
}

/** Clamp the start of a date range so it never reaches before the tracking start. */
export function clampFrom(from: number, trackingStart: number): number {
  return Math.max(from, trackingStart);
}

/** A short, encouraging one-line read of the numbers. */
export function outlook(flow: CashFlow, format: (n: number) => string): string {
  if (flow.countIn === 0 && flow.countOut === 0) return 'Fresh start — add your first entry.';
  if (flow.cashIn === 0) return `${format(flow.cashOut)} out so far. Add your income to see what you keep.`;
  if (flow.net > 0) {
    const pct = Math.round((flow.savingsRate ?? 0) * 100);
    return `You're ahead by ${format(flow.net)} — keeping ${pct}% of what came in. 🎉`;
  }
  if (flow.net === 0) return 'Perfectly balanced — cash in matches cash out.';
  return `${format(-flow.net)} over what came in — a few lighter days will close the gap. 💪`;
}
