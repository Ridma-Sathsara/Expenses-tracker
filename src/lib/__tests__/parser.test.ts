import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBankSms, parseMessage, parseQuickEntry } from '../parser';
import { guessCategory } from '../categories';

const NOW = new Date('2026-11-06T10:00:00').getTime();

test('bank SMS: debit with merchant, ignores balance', () => {
  const r = parseBankSms(
    'Your A/C XXXX1234 has been debited for LKR 2,500.00 at KEELLS SUPER on 05/11/26. Avl Bal LKR 40,123.45',
    NOW,
  );
  assert.equal(r.kind, 'debit');
  if (r.kind !== 'debit') return;
  assert.equal(r.expense.amount, 2500);
  assert.equal(r.expense.currency, 'LKR');
  assert.equal(r.expense.merchant, 'KEELLS SUPER');
  assert.equal(r.expense.category, 'groceries');
});

test('bank SMS: card purchase with Rs', () => {
  const r = parseBankSms('Purchase of Rs.1,250.50 made using card ending 4321 at PIZZA HUT COLOMBO on 2026-11-05', NOW);
  assert.equal(r.kind, 'debit');
  if (r.kind !== 'debit') return;
  assert.equal(r.expense.amount, 1250.5);
  assert.equal(r.expense.merchant, 'PIZZA HUT COLOMBO');
  assert.equal(r.expense.category, 'food');
});

test('bank SMS: amount after currency-less balance first', () => {
  const r = parseBankSms('Avl Bal: LKR 10,000.00. LKR 800.00 debited from A/C ending 99 for UBER TRIP.', NOW);
  assert.equal(r.kind, 'debit');
  if (r.kind !== 'debit') return;
  assert.equal(r.expense.amount, 800);
  assert.equal(r.expense.category, 'transport');
});

test('bank SMS: dollar card alert', () => {
  const r = parseBankSms('You spent $12.99 at NETFLIX.COM with your card ending 1111.', NOW);
  assert.equal(r.kind, 'debit');
  if (r.kind !== 'debit') return;
  assert.equal(r.expense.amount, 12.99);
  assert.equal(r.expense.currency, 'USD');
  assert.equal(r.expense.category, 'bills');
});

test('bank SMS: credit and OTP are not expenses', () => {
  assert.equal(parseBankSms('LKR 50,000.00 credited to your A/C XXXX1234 on 01/11. Salary.', NOW).kind, 'credit');
  assert.equal(parseBankSms('Your OTP for the transaction of LKR 5,000.00 is 123456. Do not share.', NOW).kind, 'ignored');
  assert.equal(parseBankSms('Hey are we still meeting at 5?', NOW).kind, 'ignored');
  assert.equal(parseBankSms('Hi, I owe you Rs 500 for dinner, remember?', NOW).kind, 'maybe');
});

test('quick entry: note then amount', () => {
  const e = parseQuickEntry('lunch 1200', NOW)!;
  assert.equal(e.amount, 1200);
  assert.equal(e.note, 'Lunch');
  assert.equal(e.category, 'food');
  assert.equal(e.date, NOW);
});

test('quick entry: amount first, k suffix, tag, yesterday', () => {
  const e = parseQuickEntry('1.5k taxi to office #transport yesterday', NOW)!;
  assert.equal(e.amount, 1500);
  assert.equal(e.category, 'transport');
  assert.equal(e.note, 'Taxi to office');
  assert.equal(new Date(e.date).getDate(), 5);
});

test('quick entry: currency symbol and "spent on"', () => {
  const e = parseQuickEntry('spent Rs 450 on coffee', NOW)!;
  assert.equal(e.amount, 450);
  assert.equal(e.currency, 'Rs');
  assert.equal(e.note, 'Coffee');
});

test('quick entry: no amount returns null', () => {
  assert.equal(parseQuickEntry('hello there', NOW), null);
});

test('parseMessage: multiple lines', () => {
  const list = parseMessage('coffee 450\nbus 120\nnothing here', NOW);
  assert.equal(list.length, 2);
  assert.deepEqual(list.map((e) => e.amount), [450, 120]);
});

test('parseMessage: forwarded bank SMS', () => {
  const list = parseMessage('Dear Customer, LKR 3,400.00 was debited from your account for a POS transaction at CARGILLS FOOD CITY.', NOW);
  assert.equal(list.length, 1);
  assert.equal(list[0].amount, 3400);
  assert.equal(list[0].category, 'groceries');
});

test('category guessing uses word boundaries', () => {
  assert.equal(guessCategory('steam games'), 'entertainment');
  assert.equal(guessCategory('random thing'), 'other');
});
