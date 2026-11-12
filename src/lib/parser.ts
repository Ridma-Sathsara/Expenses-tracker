/**
 * Turns messages into cash-out (expense) and cash-in (income) entries.
 *
 * Two kinds of input are understood:
 *  1. Bank / card / wallet SMS alerts, e.g.
 *     "Your A/C XXXX1234 debited for LKR 2,500.00 at KEELLS SUPER on 05/11. Avl Bal LKR 40,000.00"
 *  2. Quick chat-style notes, e.g. "lunch 1200", "450 coffee", "uber 1.2k #transport yesterday"
 *
 * Everything here is pure TypeScript with no React Native imports, so it can be unit tested in Node.
 */
import { CategoryId, type EntryType, guessCategory, isCategoryId, isIncomeCategory } from './categories';

export type ParsedExpense = {
  /** 'expense' = cash out, 'income' = cash in. */
  type: EntryType;
  amount: number;
  currency: string | null;
  note: string;
  merchant: string | null;
  category: CategoryId;
  date: number; // epoch ms
};

export type BankSmsResult =
  | { kind: 'debit'; expense: ParsedExpense }
  /** Money coming in; `expense.type` is 'income'. */
  | { kind: 'credit'; expense: ParsedExpense }
  /** Has an amount but no clear debit wording — offered to the user, unticked. */
  | { kind: 'maybe'; expense: ParsedExpense }
  | { kind: 'ignored'; reason: string };

const CURRENCY_TOKENS: Record<string, string> = {
  lkr: 'LKR', slr: 'LKR', slrs: 'LKR', rs: 'Rs', 'rs.': 'Rs', inr: 'INR', '₹': 'INR', usd: 'USD', '$': 'USD',
  eur: 'EUR', '€': 'EUR', gbp: 'GBP', '£': 'GBP', aed: 'AED', sgd: 'SGD', aud: 'AUD', cad: 'CAD',
  pkr: 'PKR', bdt: 'BDT', npr: 'NPR', myr: 'MYR', rm: 'MYR', php: 'PHP', idr: 'IDR', thb: 'THB',
  kes: 'KES', ngn: 'NGN', zar: 'ZAR', qar: 'QAR', sar: 'SAR', omr: 'OMR', kwd: 'KWD', bhd: 'BHD',
  jpy: 'JPY', '¥': 'JPY', cny: 'CNY', mvr: 'MVR',
};

const CUR = '(LKR|SLRs?|Rs\\.?|INR|USD|EUR|GBP|AED|SGD|AUD|CAD|PKR|BDT|NPR|MYR|RM|PHP|IDR|THB|KES|NGN|ZAR|QAR|SAR|OMR|KWD|BHD|JPY|CNY|MVR|[$₹€£¥])';
const NUM = '(\\d{1,3}(?:,\\d{2,3})+(?:\\.\\d{1,2})?|\\d+(?:\\.\\d{1,2})?)';
const AMOUNT_RE = new RegExp(`${CUR}\\s?${NUM}|${NUM}\\s?${CUR}(?![a-z])`, 'gi');

// Only a real OTP message: an OTP word next to the code itself. Alerts that merely end with
// "never share your OTP" are still transactions.
const OTP_RE = /\b(otp|one[\s-]?time[\s-]?(password|pin|code)|verification code|security code|passcode)\b(?:[^.!]|\.(?=\d)){0,60}?(\bis|:|-)\W{0,3}\d{4,8}\b|\b\d{4,8}\b\W{0,3}is your\b.{0,30}\b(otp|code|password|pin)\b/i;
// Clear signs of money going out.
const DEBIT_RE = /\b(debited|debit|spent|purchased?|paid|payment|withdrawn|withdrawal|charged|deducted|sent|used at|used for|trx|dr)\b/i;
// Weaker signs; only count when nothing in the message says money came in.
const WEAK_DEBIT_RE = /\b(txn|transaction|transfer(red)?|ceft|slips|atm|e-?commerce|pos|amt|merchant)\b/i;
const CREDIT_RE = /\b(credited|received from|deposited|deposit|refund(ed)?|reversed|reversal|cashback|salary|cr)\b/i;
const PROMO_RE = /\b(offer|discount|\d+%|win|winner|promo|deal|sale|up ?to|reload now|dial|click|https?:|www\.|visit|t&c|hurry|limited time|valid (till|until)|free)\b/i;
const LABELLED_AMOUNT_RE = new RegExp(`\\b(?:amt|amount|value)\\s*[:=]?\\s*${NUM}`, 'i');
const BALANCE_BEFORE_RE = /(bal(ance)?|avl|avail(able)?|limit|lmt|outstanding|due|min(imum)?)\W*(is|:|of)?\W*$/i;

const MERCHANT_TAIL = String.raw`([A-Za-z0-9][A-Za-z0-9&'.*\-_/ ]{1,40}?)(?=\s+(?:on|via|ref|using|with|from|dated|date|avl|avail|bal|card|a\/c|acct|txn|at|is|has|was|for|successful(ly)?|success|completed|complete|done|type|thank)\b|\s*[,;:(!]|\.(?:\s|$)|\s*$|\s+\d)`;
// Tried in priority order: "at X" is the strongest merchant signal, "for X" the weakest.
const MERCHANT_RES = [
  new RegExp(String.raw`(?:\bat|@)\s*` + MERCHANT_TAIL, 'i'),
  new RegExp(String.raw`\b(?:to|towards|in favou?r of|merchant:?)\s+` + MERCHANT_TAIL, 'i'),
  new RegExp(String.raw`\bfor\s+(?:a\s+)?` + MERCHANT_TAIL, 'i'),
];
const SOURCE_RE = new RegExp(String.raw`\b(?:from|by)\s+` + MERCHANT_TAIL, 'i');
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

/** Who sent the money in a credit alert ("... from SAMAN PERERA"). */
function findSource(text: string): string | null {
  return cleanMerchant(text.match(SOURCE_RE)?.[1]);
}

function findMerchant(text: string): string | null {
  for (const re of MERCHANT_RES) {
    const m = cleanMerchant(text.match(re)?.[1]);
    if (m) return m;
  }
  return null;
}

// Sampath Bank transaction alerts (sender SAMPATHTXN) have one fixed layout:
//   LKR 8,000.00 debited from AC **2750 for eCom Sri Lanka Telecom PLC Co 70000004 11/11/2026 13:00:45 To Inq Call ...
//   LKR 6,985.00 debited from AC **2750 via POS at ASB INNOVATION (PVT) L KA 20400902 08/11/2026 14:16:47 ...
//   LKR 7,000.00 credited to AC **2750 for to my 11/11/2026 12:59:03 ...
const SAMPATH_RE =
  /^LKR\s?([\d,]+(?:\.\d{1,2})?) (debited from|credited to) AC \S+(?: (?:via (\w+) at|for) (.*?))?\s*(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})/i;

/**
 * Exact parser for Sampath Bank alerts. Returns null when the text is not in that layout,
 * so the generic parser can try it.
 */
export function parseSampathTxn(text: string, fallbackDate: number): BankSmsResult | null {
  const m = text.match(SAMPATH_RE);
  if (!m) return null;
  const amount = parseNumber(m[1]);
  if (!(amount > 0)) return null;
  const type: EntryType = /credited/i.test(m[2]) ? 'income' : 'expense';
  // Description: drop the channel prefix ("eCom") and the trailing terminal/reference number.
  const description = (m[4] ?? '')
    .replace(/^(ecom|pos|atm|online)\s+/i, '')
    .replace(/\s+\d{6,}$/, '')
    .trim();
  // The time printed in the message is when the transaction happened; prefer it over the SMS arrival time.
  const stamped = new Date(+m[7], +m[6] - 1, +m[5], +m[8], +m[9], +m[10]).getTime();
  const date = Number.isNaN(stamped) ? fallbackDate : stamped;
  const fallbackNote = type === 'income' ? 'Money received' : m[3] ? `${m[3].toUpperCase()} payment` : 'Bank payment';
  return {
    kind: type === 'income' ? 'credit' : 'debit',
    expense: {
      type,
      amount,
      currency: 'LKR',
      merchant: description || null,
      note: description ? description[0].toUpperCase() + description.slice(1) : fallbackNote,
      category: guessCategory(description, type),
      date,
    },
  };
}

/**
 * Parse a bank / card / wallet SMS alert.
 * Returns `debit` for money going out, `credit` for money coming in, or `ignored`.
 */
export function parseBankSms(body: string, date: number = Date.now()): BankSmsResult {
  const text = body.replace(/\s+/g, ' ').trim();
  if (!text) return { kind: 'ignored', reason: 'empty' };
  const sampath = parseSampathTxn(text, date);
  if (sampath) return sampath;
  if (OTP_RE.test(text)) return { kind: 'ignored', reason: 'otp' };

  let amounts = findAmounts(text);
  if (amounts.length === 0) {
    // "Amt: 1,250.00" with no currency.
    const m = text.match(LABELLED_AMOUNT_RE);
    if (m) amounts = [{ amount: parseNumber(m[1]), currency: null, index: m.index ?? 0 }];
  }
  if (amounts.length === 0 || !(amounts[0].amount > 0)) return { kind: 'ignored', reason: 'no amount' };

  const debitIdx = text.search(DEBIT_RE);
  const creditIdx = text.search(CREDIT_RE);
  // Whichever keyword appears first wins ("debited ... reversal" is rare; "credited ... from" is common).
  const isDebit =
    (debitIdx >= 0 && (creditIdx < 0 || debitIdx < creditIdx)) || (creditIdx < 0 && WEAK_DEBIT_RE.test(text));
  const isCredit = creditIdx >= 0 && !isDebit;

  const { amount, currency } = amounts[0];
  if (isCredit) {
    const from = findSource(text);
    return {
      kind: 'credit',
      expense: {
        type: 'income',
        amount,
        currency,
        merchant: from,
        note: from ? `From ${from}` : 'Money received',
        category: guessCategory(text, 'income'),
        date,
      },
    };
  }
  if (!isDebit && PROMO_RE.test(text)) return { kind: 'ignored', reason: 'promotion' };

  const merchant = findMerchant(text);
  const note = merchant ?? 'Card / bank payment';
  return {
    kind: isDebit ? 'debit' : 'maybe',
    expense: {
      type: 'expense',
      amount,
      currency,
      merchant,
      note,
      category: merchant && guessCategory(merchant) !== 'other' ? guessCategory(merchant) : guessCategory(text),
      date,
    },
  };
}

const INCOME_WORDS_RE = /\b(income|salary|received|got paid|earned|bonus|refund(ed)?|cash ?in|cashback|dividend)\b/i;
// Words that mark the line as income but add nothing to the note ("received 5000 from saman" -> "From saman").
const INCOME_FILLER_RE = /\b(income|received|got paid|earned|cash ?in)\b/gi;
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

  // Cash in: a leading "+" or words like "salary", "received", "income".
  let type: EntryType = 'expense';
  if (/^\+/.test(text) || INCOME_WORDS_RE.test(text)) {
    type = 'income';
    text = text.replace(/^\+\s*/, '').replace(INCOME_FILLER_RE, ' ');
  }

  let category: CategoryId | null = null;
  text = text.replace(/#(\w+)/g, (_, tag: string) => {
    const t = tag.toLowerCase();
    if (!category && isCategoryId(t)) {
      category = t;
      type = isIncomeCategory(t) ? 'income' : 'expense';
    } else if (!category) category = guessCategory(t, type);
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
    type,
    amount: Math.round(amount * 100) / 100,
    currency,
    merchant: null,
    note: note ? note[0].toUpperCase() + note.slice(1) : type === 'income' ? 'Income' : 'Expense',
    category: category ?? guessCategory(note, type),
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
    return r.kind === 'debit' || r.kind === 'credit' ? [r.expense] : [];
  }
  return text
    .split(/\n|;/)
    .map((l) => parseQuickEntry(l, now))
    .filter((e): e is ParsedExpense => e !== null);
}
