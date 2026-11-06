/**
 * Turns messages into expenses.
 *
 * Two kinds of input are understood:
 *  1. Bank / card / wallet SMS alerts, e.g.
 *     "Your A/C XXXX1234 debited for LKR 2,500.00 at KEELLS SUPER on 05/11. Avl Bal LKR 40,000.00"
 *  2. Quick chat-style notes, e.g. "lunch 1200", "450 coffee", "uber 1.2k #transport yesterday"
 *
 * Everything here is pure TypeScript with no React Native imports, so it can be unit tested in Node.
 */
import { CategoryId, guessCategory, isCategoryId } from './categories';

export type ParsedExpense = {
  amount: number;
  currency: string | null;
  note: string;
  merchant: string | null;
  category: CategoryId;
  date: number; // epoch ms
};

export type BankSmsResult =
  | { kind: 'debit'; expense: ParsedExpense }
  | { kind: 'credit'; amount: number }
  | { kind: 'ignored'; reason: string };

const CURRENCY_TOKENS: Record<string, string> = {
  lkr: 'LKR', slr: 'LKR', rs: 'Rs', 'rs.': 'Rs', inr: 'INR', '₹': 'INR', usd: 'USD', '$': 'USD',
  eur: 'EUR', '€': 'EUR', gbp: 'GBP', '£': 'GBP', aed: 'AED', sgd: 'SGD', aud: 'AUD', cad: 'CAD',
  pkr: 'PKR', bdt: 'BDT', npr: 'NPR', myr: 'MYR', rm: 'MYR', php: 'PHP', idr: 'IDR', thb: 'THB',
  kes: 'KES', ngn: 'NGN', zar: 'ZAR', qar: 'QAR', sar: 'SAR', omr: 'OMR', kwd: 'KWD', bhd: 'BHD',
  jpy: 'JPY', '¥': 'JPY', cny: 'CNY', mvr: 'MVR',
};

const CUR = '(LKR|SLR|Rs\\.?|INR|USD|EUR|GBP|AED|SGD|AUD|CAD|PKR|BDT|NPR|MYR|RM|PHP|IDR|THB|KES|NGN|ZAR|QAR|SAR|OMR|KWD|BHD|JPY|CNY|MVR|[$₹€£¥])';
const NUM = '(\\d{1,3}(?:,\\d{2,3})+(?:\\.\\d{1,2})?|\\d+(?:\\.\\d{1,2})?)';
const AMOUNT_RE = new RegExp(`${CUR}\\s?${NUM}|${NUM}\\s?${CUR}(?![a-z])`, 'gi');

const OTP_RE = /\b(otp|one[\s-]?time[\s-]?(password|pin|code)|verification code|security code|do not share)\b/i;
const DEBIT_RE = /\b(debited|debit|spent|purchase[ds]?|paid|payment of|withdrawn|withdrawal|charged|deducted|sent|txn of|transaction of|pos\b|used at|used for|trx)\b/i;
const CREDIT_RE = /\b(credited|received|deposited|deposit|refund(ed)?|reversed|reversal|cashback|salary)\b/i;
const BALANCE_BEFORE_RE = /(bal(ance)?|avl|avail(able)?|limit|outstanding|due|min(imum)?)\W*(is|:|of)?\W*$/i;

const MERCHANT_TAIL = String.raw`([A-Za-z0-9][A-Za-z0-9&'.*\-_/ ]{1,40}?)(?=\s+(?:on|via|ref|using|with|from|dated|date|avl|avail|bal|card|a\/c|acct|txn|at|is|has|was|for)\b|\s*[.,;:(]|\s*$|\s+\d)`;
// Tried in priority order: "at X" is the strongest merchant signal, "for X" the weakest.
const MERCHANT_RES = [
  new RegExp(String.raw`(?:\bat|@)\s*` + MERCHANT_TAIL, 'i'),
  new RegExp(String.raw`\b(?:to|towards|in favou?r of|merchant:?)\s+` + MERCHANT_TAIL, 'i'),
  new RegExp(String.raw`\bfor\s+(?:a\s+)?` + MERCHANT_TAIL, 'i'),
];
const NOT_MERCHANT_RE = new RegExp(`^(${CUR}|\\d|your\\b|the\\b|a\\/c|acct|account|card|x{2,})`, 'i');

export function parseNumber(raw: string): number {
  return Number(raw.replace(/,/g, ''));
}

export function normalizeCurrency(token: string | undefined | null): string | null {
  if (!token) return null;
  return CURRENCY_TOKENS[token.toLowerCase()] ?? token.toUpperCase();
}

type AmountMatch = { amount: number; currency: string | null; index: number };

/** All money amounts in `text`, skipping ones that are clearly balances / limits. */
export function findAmounts(text: string): AmountMatch[] {
  const out: AmountMatch[] = [];
  AMOUNT_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = AMOUNT_RE.exec(text))) {
    const currency = normalizeCurrency(m[1] ?? m[4]);
    const amount = parseNumber(m[2] ?? m[3]);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const before = text.slice(Math.max(0, m.index - 30), m.index);
    if (BALANCE_BEFORE_RE.test(before)) continue;
    out.push({ amount, currency, index: m.index });
  }
  return out;
}

function cleanMerchant(raw: string | undefined): string | null {
  if (!raw) return null;
  const s = raw.replace(/\s{2,}/g, ' ').replace(/[*_\-/.]+$/g, '').trim();
  if (s.length < 2) return null;
  // Ignore captures like "LKR 500", "A/C XXXX1234", "your account".
  if (NOT_MERCHANT_RE.test(s)) return null;
  return s;
}

function findMerchant(text: string): string | null {
  for (const re of MERCHANT_RES) {
    const m = cleanMerchant(text.match(re)?.[1]);
    if (m) return m;
  }
  return null;
}

/**
 * Parse a bank / card / wallet SMS alert.
 * Returns `debit` for money going out, `credit` for money coming in, or `ignored`.
 */
export function parseBankSms(body: string, date: number = Date.now()): BankSmsResult {
  const text = body.replace(/\s+/g, ' ').trim();
  if (!text) return { kind: 'ignored', reason: 'empty' };
  if (OTP_RE.test(text)) return { kind: 'ignored', reason: 'otp' };

  const amounts = findAmounts(text);
  if (amounts.length === 0) return { kind: 'ignored', reason: 'no amount' };

  const debitIdx = text.search(DEBIT_RE);
  const creditIdx = text.search(CREDIT_RE);
  // Whichever keyword appears first wins ("debited ... reversal" is rare; "credited ... from" is common).
  const isDebit = debitIdx >= 0 && (creditIdx < 0 || debitIdx < creditIdx);
  const isCredit = creditIdx >= 0 && !isDebit;

  if (isCredit) return { kind: 'credit', amount: amounts[0].amount };
  if (!isDebit) return { kind: 'ignored', reason: 'not a transaction' };

  const { amount, currency } = amounts[0];
  const merchant = findMerchant(text);
  const note = merchant ?? 'Card / bank payment';
  return {
    kind: 'debit',
    expense: {
      amount,
      currency,
      merchant,
      note,
      category: merchant && guessCategory(merchant) !== 'other' ? guessCategory(merchant) : guessCategory(text),
      date,
    },
  };
}

const QUICK_NUM_RE = /^(\d+(?:[.,]\d+)?)(k)?$/i;
const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(12, 0, 0, 0); // midday avoids DST edge cases
  return d.getTime();
}

/**
 * Parse one chat-style line: "lunch 1200", "1200 lunch", "coffee 450 #food", "taxi 1.5k yesterday".
 * Returns null if no amount is found.
 */
export function parseQuickEntry(line: string, now: number = Date.now()): ParsedExpense | null {
  let text = line.trim();
  if (!text) return null;

  let date = now;
  if (/\byesterday\b/i.test(text)) {
    date = startOfDay(now - DAY_MS);
    text = text.replace(/\byesterday\b/i, ' ');
  } else if (/\btoday\b/i.test(text)) {
    text = text.replace(/\btoday\b/i, ' ');
  }

  let category: CategoryId | null = null;
  text = text.replace(/#(\w+)/g, (_, tag: string) => {
    const t = tag.toLowerCase();
    if (!category && isCategoryId(t)) category = t;
    else if (!category) category = guessCategory(t);
    return ' ';
  });

  // Currency prefixed / suffixed amounts ("Rs 500", "$12.50") take priority.
  let amount: number | null = null;
  let currency: string | null = null;
  const money = findAmounts(text)[0];
  if (money) {
    amount = money.amount;
    currency = money.currency;
    text = text.replace(AMOUNT_RE, ' ');
  } else {
    const words = text.split(/\s+/);
    const idx = words.findIndex((w) => QUICK_NUM_RE.test(w.replace(/^[^\d]+|[^\dk]+$/gi, '')));
    if (idx >= 0) {
      const m = words[idx].replace(/^[^\d]+|[^\dk]+$/gi, '').match(QUICK_NUM_RE)!;
      amount = Number(m[1].replace(',', '.')) * (m[2] ? 1000 : 1);
      words.splice(idx, 1);
      text = words.join(' ');
    }
  }
  if (amount == null || !Number.isFinite(amount) || amount <= 0) return null;

  const note = text
    .replace(/\b(spent|paid|for|on|bought)\b/gi, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return {
    amount: Math.round(amount * 100) / 100,
    currency,
    merchant: null,
    note: note ? note[0].toUpperCase() + note.slice(1) : 'Expense',
    category: category ?? guessCategory(note),
    date,
  };
}

/**
 * Parse any message: a bank SMS (single expense) or one or more quick-entry lines.
 */
export function parseMessage(text: string, now: number = Date.now()): ParsedExpense[] {
  const looksLikeBankSms =
    text.length > 40 && (DEBIT_RE.test(text) || CREDIT_RE.test(text)) && findAmounts(text).length > 0;
  if (looksLikeBankSms) {
    const r = parseBankSms(text, now);
    return r.kind === 'debit' ? [r.expense] : [];
  }
  return text
    .split(/\n|;/)
    .map((l) => parseQuickEntry(l, now))
    .filter((e): e is ParsedExpense => e !== null);
}
