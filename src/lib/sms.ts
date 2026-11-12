import { readInbox, hasSmsPermission, isSmsSupported, type Sms } from '../../modules/sms-reader';
import { parseBankSms, type ParsedExpense } from './parser';
import { addExpense, deleteExpensesBySmsIds, getHandledSmsIds, getSetting, getTrackingStart, setSetting } from './db';
import { clampFrom } from './ledger';
import { DEFAULT_TRACKED_SENDERS, isTrackedSender, normalizeSender } from './senders';

export type SmsCandidate = { sms: Sms; expense: ParsedExpense; sure: boolean };

const DAY = 24 * 60 * 60 * 1000;

export async function getTrackedSenders(): Promise<string[]> {
  const raw = await getSetting('trackedSenders');
  if (raw == null) return DEFAULT_TRACKED_SENDERS;
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : DEFAULT_TRACKED_SENDERS;
  } catch {
    return DEFAULT_TRACKED_SENDERS;
  }
}

export async function setTrackedSenders(list: string[]): Promise<void> {
  const clean = [...new Set(list.map(normalizeSender).filter(Boolean))];
  await setSetting('trackedSenders', JSON.stringify(clean));
  await removeUntrackedSenderEntries();
}

/**
 * Deletes already-imported SMS entries whose sender is not on the tracked list
 * (for example entries imported by earlier versions that read every bank SMS).
 * Entries added by hand, in chat or by sharing are never touched.
 * Runs once per change of the list (it reads the whole inbox, so not on every launch).
 */
export async function removeUntrackedSenderEntries(): Promise<number> {
  if (!isSmsSupported || !hasSmsPermission()) return 0;
  const tracked = await getTrackedSenders();
  const key = JSON.stringify(tracked);
  if ((await getSetting('trackedSendersCleaned')) === key) return 0;
  const inbox = await readInbox(0, 50000);
  const ids = inbox.filter((m) => !isTrackedSender(m.address, tracked)).map((m) => m.id);
  const removed = await deleteExpensesBySmsIds(ids);
  await setSetting('trackedSendersCleaned', key);
  return removed;
}

/**
 * SMS from tracked senders in the last `days` days — but never before the tracking start — that show
 * money going out or coming in and are not yet imported/skipped.
 * `sure: false` items have an amount but no clear "debited/credited" wording.
 */
export async function findSmsExpenses(days: number, includeMaybe = true): Promise<SmsCandidate[]> {
  if (!isSmsSupported || !hasSmsPermission()) return [];
  const [messages, handled, tracked] = await Promise.all([
    readInbox(clampFrom(Date.now() - days * DAY, await getTrackingStart()), 5000),
    getHandledSmsIds(),
    getTrackedSenders(),
  ]);
  const out: SmsCandidate[] = [];
  for (const sms of messages) {
    if (handled.has(sms.id) || !isTrackedSender(sms.address, tracked)) continue;
    const r = parseBankSms(sms.body, sms.date);
    if (r.kind === 'debit' || r.kind === 'credit') out.push({ sms, expense: r.expense, sure: true });
    else if (r.kind === 'maybe' && includeMaybe) out.push({ sms, expense: r.expense, sure: false });
  }
  return out;
}

export async function importSmsCandidates(list: SmsCandidate[]): Promise<number> {
  for (const { sms, expense } of list) {
    await addExpense({
      type: expense.type,
      amount: expense.amount,
      category: expense.category,
      note: expense.note,
      merchant: expense.merchant,
      date: expense.date,
      source: 'sms',
      raw: sms.body,
      smsId: sms.id,
    });
  }
  return list.length;
}

/**
 * When auto-import is on, log every new bank-alert SMS since the last check.
 * Called when the app starts and whenever it comes back to the foreground.
 */
export async function autoImportSms(): Promise<number> {
  if (!isSmsSupported || !hasSmsPermission()) return 0;
  await removeUntrackedSenderEntries();
  if ((await getSetting('smsAutoImport')) !== '1') return 0;
  const last = Number((await getSetting('smsLastSync')) ?? 0);
  // Versions before cash-in support only imported debits. Once, go back to the tracking start so
  // credits received since then are picked up too (already-imported and skipped SMS are not repeated).
  const backfill = (await getSetting('cashInBackfillDone')) !== '1';
  // Otherwise: on the first run only look back 1 day; the SMS screen can import older ones.
  const since = backfill ? await getTrackingStart() : last > 0 ? last - 60_000 : Date.now() - DAY;
  const days = (Date.now() - since) / DAY;
  const found = await findSmsExpenses(days, false); // auto-import only clear debits and credits
  await importSmsCandidates(found);
  await setSetting('smsLastSync', String(Date.now()));
  if (backfill) await setSetting('cashInBackfillDone', '1');
  return found.length;
}
