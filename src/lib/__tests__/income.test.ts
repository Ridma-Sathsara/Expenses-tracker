import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBankSms, parseMessage, parseQuickEntry } from '../parser';

const NOW = new Date('2026-11-12T10:00:00').getTime();

test('credit SMS becomes a cash-in entry with source and category', () => {
  const r = parseBankSms('LKR 150,000.00 credited to your A/C XXXX1234 on 10/11. Salary NOV. Avl Bal LKR 180,000.00', NOW);
  assert.equal(r.kind, 'credit');
  if (r.kind !== 'credit') return;
  assert.equal(r.expense.type, 'income');
  assert.equal(r.expense.amount, 150000);
  assert.equal(r.expense.category, 'salary');
});

test('credit SMS: transfer from a person', () => {
  const r = parseBankSms('LKR 5,000.00 Cr to A/C 1234 on 11/11 - CEFT from SAMAN PERERA', NOW);
  assert.equal(r.kind, 'credit');
  if (r.kind !== 'credit') return;
  assert.equal(r.expense.amount, 5000);
  assert.equal(r.expense.merchant, 'SAMAN PERERA');
  assert.equal(r.expense.note, 'From SAMAN PERERA');
  assert.equal(r.expense.category, 'income');
});

test('credit SMS: refund', () => {
  const r = parseBankSms('Refund of Rs. 2,499.00 from DARAZ.LK has been credited to your card ending 1234', NOW);
  assert.equal(r.kind, 'credit');
  if (r.kind !== 'credit') return;
  assert.equal(r.expense.category, 'refund');
});

test('debit SMS stays cash out', () => {
  const r = parseBankSms('LKR 800.00 debited from A/C 1234 at KFC MAHARAGAMA', NOW);
  assert.equal(r.kind, 'debit');
  if (r.kind === 'debit') assert.equal(r.expense.type, 'expense');
});

test('quick entry: + prefix and income words', () => {
  const a = parseQuickEntry('+150000 salary', NOW)!;
  assert.deepEqual([a.type, a.amount, a.category, a.note], ['income', 150000, 'salary', 'Salary']);
  const b = parseQuickEntry('received 5000 from saman', NOW)!;
  assert.deepEqual([b.type, b.amount, b.category, b.note], ['income', 5000, 'income', 'From saman']);
  const c = parseQuickEntry('income 25k freelance project', NOW)!;
  assert.deepEqual([c.type, c.amount, c.category], ['income', 25000, 'business']);
  const d = parseQuickEntry('+2000', NOW)!;
  assert.deepEqual([d.type, d.note], ['income', 'Income']);
});

test('quick entry: ordinary lines stay cash out', () => {
  const e = parseQuickEntry('lunch 1200', NOW)!;
  assert.equal(e.type, 'expense');
  assert.equal(parseQuickEntry('loan interest 5000', NOW)!.type, 'expense');
});

test('parseMessage: shared credit alert and mixed lines', () => {
  const one = parseMessage('Dear Customer, LKR 12,000.00 has been credited to your account 1234 from ABC HOLDINGS.', NOW);
  assert.equal(one.length, 1);
  assert.equal(one[0].type, 'income');
  const mixed = parseMessage('+50000 salary\nrent 20000', NOW);
  assert.deepEqual(mixed.map((m) => m.type), ['income', 'expense']);
});
