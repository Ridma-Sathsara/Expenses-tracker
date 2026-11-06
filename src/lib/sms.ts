import { readInbox, hasSmsPermission, isSmsSupported, type Sms } from '../../modules/sms-reader';
import { parseBankSms, type ParsedExpense } from './parser';
import { addExpense, getHandledSmsIds, getSetting, setSetting } from './db';

export type SmsCandidate = { sms: Sms; expense: ParsedExpense };

const DAY = 24 * 60 * 60 * 1000;

/** Bank-alert SMS from the last `days` days that look like spending and are not yet imported/ignored. */
export async function findSmsExpenses(days: number): Promise<SmsCandidate[]> {
  if (!isSmsSupported || !hasSmsPermission()) return [];
  const [messages, handled] = await Promise.all([readInbox(Date.now() - days * DAY, 2000), getHandledSmsIds()]);
  const out: SmsCandidate[] = [];
  for (const sms of messages) {
    if (handled.has(sms.id)) continue;
    const r = parseBankSms(sms.body, sms.date);
    if (r.kind === 'debit') out.push({ sms, expense: r.expense });
  }
  return out;
}

export async function importSmsCandidates(list: SmsCandidate[]): Promise<number> {
  for (const { sms, expense } of list) {
    await addExpense({
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
  if ((await getSetting('smsAutoImport')) !== '1') return 0;
  const last = Number((await getSetting('smsLastSync')) ?? 0);
  // On the first run only look back 1 day; the SMS screen can import older ones.
  const since = last > 0 ? last - 60_000 : Date.now() - DAY;
  const days = (Date.now() - since) / DAY;
  const found = await findSmsExpenses(days);
  await importSmsCandidates(found);
  await setSetting('smsLastSync', String(Date.now()));
  return found.length;
}
