import { getCategory } from './categories';
import { addExpense, deleteExpense, type ExpenseSource, getDb, listExpenses } from './db';
import { formatDay, formatMoney, startOfDay } from './format';
import { parseMessage } from './parser';

export const HELP_TEXT = [
  'Send me your expenses like a text message:',
  '• lunch 1200',
  '• 450 coffee',
  '• taxi 1.5k #transport',
  '• groceries 3200 yesterday',
  '• several lines = several expenses',
  '• or paste / share a bank SMS alert',
  '',
  'Commands: today · week · month · recent · undo · help',
].join('\n');

const DAY = 86400000;

async function summary(label: string, from: number, to: number, currency: string): Promise<string> {
  const list = await listExpenses(from, to);
  if (list.length === 0) return `No expenses ${label}.`;
  const total = list.reduce((s, e) => s + e.amount, 0);
  const byCat = new Map<string, number>();
  for (const e of list) byCat.set(e.category, (byCat.get(e.category) ?? 0) + e.amount);
  const top = [...byCat.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, v]) => {
      const c = getCategory(id);
      return `${c.emoji} ${c.label}: ${formatMoney(v, currency)}`;
    });
  return [`📊 ${label[0].toUpperCase()}${label.slice(1)}: ${formatMoney(total, currency)} (${list.length} items)`, ...top].join('\n');
}

/** Handle one incoming message and return the bot's reply. */
export async function handleChatMessage(text: string, currency: string, source: ExpenseSource = 'chat'): Promise<string> {
  const cmd = text.trim().toLowerCase().replace(/^\//, '');
  const now = Date.now();
  const today = startOfDay(now);

  if (cmd === 'help' || cmd === '?' || cmd === 'hi' || cmd === 'hello' || cmd === 'start') return HELP_TEXT;
  if (cmd === 'today') return summary('today', today, today + DAY, currency);
  if (cmd === 'yesterday') return summary('yesterday', today - DAY, today, currency);
  if (cmd === 'week') return summary('in the last 7 days', today - 6 * DAY, today + DAY, currency);
  if (cmd === 'month') {
    const d = new Date(now);
    return summary('this month', new Date(d.getFullYear(), d.getMonth(), 1).getTime(), today + DAY, currency);
  }
  if (cmd === 'recent' || cmd === 'list') {
    const list = (await listExpenses(0, now + DAY)).slice(0, 8);
    if (list.length === 0) return 'No expenses yet.';
    return list
      .map((e) => `${getCategory(e.category).emoji} ${e.note} — ${formatMoney(e.amount, currency)} (${formatDay(e.date)})`)
      .join('\n');
  }
  if (cmd === 'undo') {
    const db = await getDb();
    const last = await db.getFirstAsync<{ id: number; note: string; amount: number }>(
      "SELECT id, note, amount FROM expenses WHERE source IN ('chat','share') ORDER BY created_at DESC, id DESC LIMIT 1",
    );
    if (!last) return 'Nothing to undo.';
    await deleteExpense(last.id);
    return `↩️ Removed “${last.note}” (${formatMoney(last.amount, currency)}).`;
  }

  const parsed = parseMessage(text, now);
  if (parsed.length === 0) {
    return "🤔 I couldn't find an amount in that. Try something like “lunch 1200”, or type help.";
  }
  const lines: string[] = [];
  for (const p of parsed) {
    await addExpense({
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
    lines.push(`✅ ${formatMoney(p.amount, currency)} — ${p.note} (${c.emoji} ${c.label}${when})`);
  }
  const d = new Date(now);
  const monthTotal = (await listExpenses(new Date(d.getFullYear(), d.getMonth(), 1).getTime(), today + DAY)).reduce(
    (s, e) => s + e.amount,
    0,
  );
  lines.push(`This month: ${formatMoney(monthTotal, currency)}. Wrong? type “undo”.`);
  return lines.join('\n');
}
