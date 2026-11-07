/**
 * All data lives in a SQLite file inside the app's private storage on the phone.
 * Nothing is sent to any server.
 */
import * as SQLite from 'expo-sqlite';
import type { CategoryId } from './categories';

export type ExpenseSource = 'manual' | 'chat' | 'sms' | 'share';

export type Expense = {
  id: number;
  amount: number;
  category: CategoryId;
  note: string;
  merchant: string | null;
  date: number;
  source: ExpenseSource;
  raw: string | null;
  smsId: string | null;
  createdAt: number;
};

export type NewExpense = Omit<Expense, 'id' | 'createdAt' | 'merchant' | 'raw' | 'smsId'> &
  Partial<Pick<Expense, 'merchant' | 'raw' | 'smsId'>>;

type Row = {
  id: number;
  amount: number;
  category: string;
  note: string;
  merchant: string | null;
  date: number;
  source: string;
  raw: string | null;
  sms_id: string | null;
  created_at: number;
};

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
const listeners = new Set<() => void>();

/** Subscribe to any data change (insert/update/delete). Returns an unsubscribe function. */
export function onDataChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emitChange() {
  listeners.forEach((fn) => fn());
}

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('expenses.db');
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS expenses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          amount REAL NOT NULL,
          category TEXT NOT NULL,
          note TEXT NOT NULL DEFAULT '',
          merchant TEXT,
          date INTEGER NOT NULL,
          source TEXT NOT NULL DEFAULT 'manual',
          raw TEXT,
          sms_id TEXT UNIQUE,
          created_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
        CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS sms_ignored (sms_id TEXT PRIMARY KEY NOT NULL);
        CREATE TABLE IF NOT EXISTS chat (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          role TEXT NOT NULL,
          text TEXT NOT NULL,
          created_at INTEGER NOT NULL
        );
      `);
      return db;
    })();
  }
  return dbPromise;
}

function fromRow(r: Row): Expense {
  return {
    id: r.id,
    amount: r.amount,
    category: r.category as CategoryId,
    note: r.note,
    merchant: r.merchant,
    date: r.date,
    source: r.source as ExpenseSource,
    raw: r.raw,
    smsId: r.sms_id,
    createdAt: r.created_at,
  };
}

export async function addExpense(e: NewExpense): Promise<number> {
  const db = await getDb();
  const res = await db.runAsync(
    `INSERT OR IGNORE INTO expenses (amount, category, note, merchant, date, source, raw, sms_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    e.amount, e.category, e.note, e.merchant ?? null, e.date, e.source, e.raw ?? null, e.smsId ?? null, Date.now(),
  );
  emitChange();
  return res.lastInsertRowId;
}

export async function updateExpense(id: number, e: Partial<NewExpense>): Promise<void> {
  const db = await getDb();
  const current = await db.getFirstAsync<Row>('SELECT * FROM expenses WHERE id = ?', id);
  if (!current) return;
  const merged = { ...fromRow(current), ...e };
  await db.runAsync(
    'UPDATE expenses SET amount = ?, category = ?, note = ?, merchant = ?, date = ? WHERE id = ?',
    merged.amount, merged.category, merged.note, merged.merchant, merged.date, id,
  );
  emitChange();
}

export async function deleteExpense(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM expenses WHERE id = ?', id);
  emitChange();
}

export async function getExpense(id: number): Promise<Expense | null> {
  const db = await getDb();
  const r = await db.getFirstAsync<Row>('SELECT * FROM expenses WHERE id = ?', id);
  return r ? fromRow(r) : null;
}

export async function listExpenses(from: number, to: number): Promise<Expense[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Row>(
    'SELECT * FROM expenses WHERE date >= ? AND date < ? ORDER BY date DESC, id DESC',
    from, to,
  );
  return rows.map(fromRow);
}

export async function listAllExpenses(): Promise<Expense[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Row>('SELECT * FROM expenses ORDER BY date DESC, id DESC');
  return rows.map(fromRow);
}

export async function sumBetween(from: number, to: number): Promise<number> {
  const db = await getDb();
  const r = await db.getFirstAsync<{ total: number | null }>(
    'SELECT SUM(amount) AS total FROM expenses WHERE date >= ? AND date < ?',
    from, to,
  );
  return r?.total ?? 0;
}

export async function deleteAllExpenses(): Promise<void> {
  const db = await getDb();
  await db.execAsync('DELETE FROM expenses; DELETE FROM sms_ignored; DELETE FROM chat;');
  emitChange();
}

// ---- SMS bookkeeping ----

/** SMS ids that are already imported or that the user chose to ignore. */
export async function getHandledSmsIds(): Promise<Set<string>> {
  const db = await getDb();
  const a = await db.getAllAsync<{ id: string }>('SELECT sms_id AS id FROM expenses WHERE sms_id IS NOT NULL');
  const b = await db.getAllAsync<{ id: string }>('SELECT sms_id AS id FROM sms_ignored');
  return new Set([...a, ...b].map((r) => r.id));
}

export async function ignoreSms(ids: string[]): Promise<void> {
  const db = await getDb();
  for (const id of ids) {
    await db.runAsync('INSERT OR IGNORE INTO sms_ignored (sms_id) VALUES (?)', id);
  }
  emitChange();
}

/** Removes imported expenses that came from the given SMS ids. Returns how many were removed. */
export async function deleteExpensesBySmsIds(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const db = await getDb();
  let removed = 0;
  for (const id of ids) {
    const r = await db.runAsync('DELETE FROM expenses WHERE sms_id = ?', id);
    removed += r.changes;
  }
  if (removed > 0) emitChange();
  return removed;
}

export async function countIgnoredSms(): Promise<number> {
  const db = await getDb();
  const r = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM sms_ignored');
  return r?.n ?? 0;
}

export async function clearIgnoredSms(): Promise<void> {
  const db = await getDb();
  await db.execAsync('DELETE FROM sms_ignored;');
  emitChange();
}

// ---- Settings ----

export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  const r = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', key);
  return r?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', key, value);
  emitChange();
}

// ---- Chat history ----

export type ChatMessage = { id: number; role: 'me' | 'bot'; text: string; createdAt: number };

export async function addChatMessage(role: ChatMessage['role'], text: string): Promise<ChatMessage> {
  const db = await getDb();
  const createdAt = Date.now();
  const res = await db.runAsync('INSERT INTO chat (role, text, created_at) VALUES (?, ?, ?)', role, text, createdAt);
  return { id: res.lastInsertRowId, role, text, createdAt };
}

export async function listChatMessages(limit = 200): Promise<ChatMessage[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ id: number; role: string; text: string; created_at: number }>(
    'SELECT * FROM (SELECT * FROM chat ORDER BY id DESC LIMIT ?) ORDER BY id ASC',
    limit,
  );
  return rows.map((r) => ({ id: r.id, role: r.role as ChatMessage['role'], text: r.text, createdAt: r.created_at }));
}

export async function clearChat(): Promise<void> {
  const db = await getDb();
  await db.execAsync('DELETE FROM chat;');
}
