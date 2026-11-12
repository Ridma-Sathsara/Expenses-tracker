import { getCategory } from './categories';
import { addExpense, deleteExpense, type Expense, type ExpenseSource, getDb, getTrackingStart, listExpenses } from './db';
import { formatDate, formatDay, formatMoney, startOfDay } from './format';
import { balance, cashFlow, outlook, totalsByCategory } from './ledger';
import { getOpeningBalance } from './hooks';
import { parseMessage } from './parser';

export const HELP_TEXT = [
  'Send me your money in and out like a text message:',
  '',
  '💸 Cash out',
  '• lunch 1200',
  '• taxi 1.5k #transport',
  '• groceries 3200 yesterday',
  '',
  '💰 Cash in (start with + or say what it is)',
  '• +150000 salary',
  '• received 5000 from saman',
  '',
  'Several lines = several entries. You can also paste or share a bank SMS.',
  '',
  'Commands: today · week · month · balance · recent · undo · help',
].join('\n');

const DAY = 86400000;

function signed(e: Pick<Expense, 'type' | 'amount'>, currency: string): string {
  return `${e.type === 'income' ? '+' : '−'}${formatMoney(e.amount, currency)}`;
}

async function summary(label: string, from: number, to: number, currency: string): Promise<string> {
  const list = await listExpenses(from, to);
  if (list.length === 0) return `Nothing recorded ${label} yet.`;
  const money = (n: number) => formatMoney(n, currency);
  const flow = cashFlow(list);
  const top = totalsByCategory(list, 'expense')
    .slice(0, 4)
    .map(({ category, total }) => {
      const c = getCategory(category);
      return `   ${c.emoji} ${c.label}: ${money(total)}`;
    });
  return [
    `📊 ${label[0].toUpperCase()}${label.slice(1)}`,
    `💰 Cash in: ${money(flow.cashIn)} (${flow.countIn})`,
    `💸 Cash out: ${money(flow.cashOut)} (${flow.countOut})`,
    ...top,
    `🧮 Net: ${flow.net >= 0 ? '+' : '−'}${money(Math.abs(flow.net))}`,
    outlook(flow, money),
  ].join('\n');
}

/** Handle one incoming message and return the bot's reply. */
export async function handleChatMessage(text: string, currency: string, source: ExpenseSource = 'chat'): Promise<string> {
  const cmd = text.trim().toLowerCase().replace(/^\//, '');
  const now = Date.now();
  const today = startOfDay(now);
  const d = new Date(now);
  const monthStart = new Date(d.getFullYear(), d.getMonth(), 1).getTime();

  if (cmd === 'help' || cmd === '?' || cmd === 'hi' || cmd === 'hello' || cmd === 'start') return HELP_TEXT;
  if (cmd === 'today') return summary('today', today, today + DAY, currency);
  if (cmd === 'yesterday') return summary('yesterday', today - DAY, today, currency);
  if (cmd === 'week') return summary('in the last 7 days', today - 6 * DAY, today + DAY, currency);
  if (cmd === 'month') return summary('this month', monthStart, today + DAY, currency);
  if (cmd === 'balance' || cmd === 'net' || cmd === 'total' || cmd === 'all') {
    const since = formatDate(await getTrackingStart());
    const opening = await getOpeningBalance();
    const flow = cashFlow(await listExpenses(0, today + DAY));
    const money = (n: number) => formatMoney(n, currency);
    const now = balance(opening, flow);
    return [
      `🏦 Balance: ${now < 0 ? '−' : ''}${money(Math.abs(now))}`,
      `Started with ${money(opening)} on ${since}`,
      `💰 Cash in: +${money(flow.cashIn)} (${flow.countIn})`,
      `💸 Cash out: −${money(flow.cashOut)} (${flow.countOut})`,
    ].join('\n');
  }
  if (cmd === 'recent' || cmd === 'list') {
    const list = (await listExpenses(0, now + DAY)).slice(0, 8);
    if (list.length === 0) return 'Nothing recorded yet.';
    return list.map((e) => `${getCategory(e.category).emoji} ${e.note}  ${signed(e, currency)}  (${formatDay(e.date)})`).join('\n');
  }
  if (cmd === 'undo') {
    const db = await getDb();
    const last = await db.getFirstAsync<{ id: number; note: string; amount: number; type: string }>(
      "SELECT id, note, amount, type FROM expenses WHERE source IN ('chat','share') ORDER BY created_at DESC, id DESC LIMIT 1",
    );
    if (!last) return 'Nothing to undo.';
    await deleteExpense(last.id);
    return `↩️ Removed “${last.note}” (${formatMoney(last.amount, currency)}).`;
  }

  const parsed = parseMessage(text, now);
  if (parsed.length === 0) {
    return "🤔 I couldn't find an amount in that. Try “lunch 1200” or “+50000 salary”, or type help.";
  }
  const trackingStart = await getTrackingStart();
  const lines: string[] = [];
  for (const p of parsed) {
    if (p.date < trackingStart) {
      lines.push(`⏭️ Skipped “${p.note}” — it's before ${formatDate(trackingStart)}, when tracking starts.`);
      continue;
    }
    await addExpense({
      type: p.type,
      amount: p.amount,
      category: p.category,
      note: p.note,
      merchant: p.merchant,
      date: p.date,
      source,
      raw: text.length > 60 ? text : null,
    });
    const c = getCategory(p.category);
    const when = startOfDay(p.date) === today ? '' : ` · ${formatDay(p.date)}`;
    lines.push(`${p.type === 'income' ? '💰 Cash in' : '💸 Cash out'}: ${formatMoney(p.amount, currency)} — ${p.note} (${c.emoji} ${c.label}${when})`);
  }
  const flow = cashFlow(await listExpenses(monthStart, today + DAY));
  const money = (n: number) => formatMoney(n, currency);
  lines.push(`This month: in ${money(flow.cashIn)} · out ${money(flow.cashOut)} · net ${flow.net >= 0 ? '+' : '−'}${money(Math.abs(flow.net))}`);
  lines.push('Wrong? type “undo”.');
  return lines.join('\n');
}
