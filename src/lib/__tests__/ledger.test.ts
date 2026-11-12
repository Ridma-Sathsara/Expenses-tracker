import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cashFlow, clampFrom, DEFAULT_TRACKING_START, outlook, totalsByCategory } from '../ledger';

const e = (type: 'income' | 'expense', amount: number, category = 'x') => ({ type, amount, category, date: 0 });
const fmt = (n: number) => `Rs ${n}`;

test('cashFlow sums both directions and nets them', () => {
  const f = cashFlow([e('income', 150000), e('expense', 20000.1), e('expense', 5000.2), e('income', 5000)]);
  assert.equal(f.cashIn, 155000);
  assert.equal(f.cashOut, 25000.3);
  assert.equal(f.net, 129999.7);
  assert.equal(f.countIn, 2);
  assert.equal(f.countOut, 2);
  assert.ok(Math.abs(f.savingsRate! - 129999.7 / 155000) < 1e-9);
});

test('cashFlow: empty and expense-only', () => {
  assert.deepEqual(cashFlow([]), { cashIn: 0, cashOut: 0, net: 0, savingsRate: null, countIn: 0, countOut: 0 });
  const f = cashFlow([e('expense', 500)]);
  assert.equal(f.net, -500);
  assert.equal(f.savingsRate, null);
});

test('totalsByCategory separates directions and sorts', () => {
  const list = [e('expense', 100, 'food'), e('expense', 300, 'fuel'), e('expense', 50, 'food'), e('income', 999, 'salary')];
  assert.deepEqual(totalsByCategory(list, 'expense'), [
    { category: 'fuel', total: 300 },
    { category: 'food', total: 150 },
  ]);
  assert.deepEqual(totalsByCategory(list, 'income'), [{ category: 'salary', total: 999 }]);
});

test('tracking start is 10 Nov 2026 and clamps ranges', () => {
  const d = new Date(DEFAULT_TRACKING_START);
  assert.deepEqual([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()], [2026, 10, 10, 0]);
  const nov1 = new Date(2026, 10, 1).getTime();
  const nov20 = new Date(2026, 10, 20).getTime();
  assert.equal(clampFrom(nov1, DEFAULT_TRACKING_START), DEFAULT_TRACKING_START);
  assert.equal(clampFrom(nov20, DEFAULT_TRACKING_START), nov20);
});

test('outlook wording', () => {
  assert.match(outlook(cashFlow([]), fmt), /Fresh start/);
  assert.match(outlook(cashFlow([e('expense', 500)]), fmt), /Rs 500 out so far/);
  assert.match(outlook(cashFlow([e('income', 1000), e('expense', 250)]), fmt), /ahead by Rs 750 — keeping 75%/);
  assert.match(outlook(cashFlow([e('income', 1000), e('expense', 1200)]), fmt), /Rs 200 over/);
});
