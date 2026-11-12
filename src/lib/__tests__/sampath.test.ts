import { test } from 'node:test';
import assert from 'node:assert/strict';
import { balance, cashFlow, DEFAULT_OPENING_BALANCE } from '../ledger';
import { parseBankSms } from '../parser';

const FOOTER = '\nTo Inq Call 0112303050\nGet protected -Do not Share OTP';
const at = (y: number, mo: number, d: number, h: number, mi: number, s: number) => new Date(y, mo - 1, d, h, mi, s).getTime();

// Real SAMPATHTXN alerts (account number as it appears, already masked by the bank).
const SMS = {
  pos: 'LKR 6,985.00 debited from AC **2750 via POS at ASB INNOVATION (PVT) L KA 20400902\n08/11/2026 14:16:47' + FOOTER,
  in1: 'LKR 7,000.00 credited to AC **2750 for to my\n11/11/2026 12:59:03' + FOOTER,
  slt: 'LKR 8,000.00 debited from AC **2750 for eCom Sri Lanka Telecom PLC Co 70000004\n11/11/2026 13:00:45' + FOOTER,
  in2: 'LKR 22,000.00 credited to AC **2750 for to my\n12/11/2026 17:13:08' + FOOTER,
  monitor: 'LKR 19,525.00 debited from AC **2750 for\nmonitor\n12/11/2026 17:27:58' + FOOTER,
};

function parse(sms: string) {
  const r = parseBankSms(sms, 0);
  assert.ok(r.kind === 'debit' || r.kind === 'credit', `kind was ${r.kind}`);
  return r.expense;
}

test('Sampath debit: eCom payment', () => {
  const e = parse(SMS.slt);
  assert.deepEqual([e.type, e.amount, e.note, e.category], ['expense', 8000, 'Sri Lanka Telecom PLC Co', 'bills']);
  assert.equal(e.date, at(2026, 11, 11, 13, 0, 45));
});

test('Sampath debit: free-text remark on its own line', () => {
  const e = parse(SMS.monitor);
  assert.deepEqual([e.type, e.amount, e.note], ['expense', 19525, 'Monitor']);
  assert.equal(e.date, at(2026, 11, 12, 17, 27, 58));
});

test('Sampath debit: POS purchase', () => {
  const e = parse(SMS.pos);
  assert.deepEqual([e.type, e.amount, e.note], ['expense', 6985, 'ASB INNOVATION (PVT) L KA']);
});

test('Sampath credit', () => {
  const e = parse(SMS.in1);
  assert.deepEqual([e.type, e.amount, e.note, e.category], ['income', 7000, 'To my', 'income']);
  assert.equal(parse(SMS.in2).amount, 22000);
});

test('footer never becomes the name, and "Do not Share OTP" does not hide the alert', () => {
  for (const sms of Object.values(SMS)) assert.doesNotMatch(parse(sms).note, /inq|call|otp/i);
});

test('the four alerts since 10 Nov net to +1,475', () => {
  const start = new Date(2026, 10, 10).getTime();
  const entries = Object.values(SMS).map(parse).filter((e) => e.date >= start);
  assert.equal(entries.length, 4); // the 8 Nov POS purchase is before the tracking start
  const flow = cashFlow(entries);
  assert.deepEqual([flow.cashIn, flow.cashOut, flow.net], [29000, 27525, 1475]);
  // Started with Rs 1,000: 1000 + 7000 - 8000 + 22000 - 19525
  assert.equal(balance(DEFAULT_OPENING_BALANCE, flow), 2475);
});
