import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBankSms } from '../parser';

const NOW = new Date('2026-11-06T10:00:00').getTime();

// Realistic (made-up) alert formats seen from Sri Lankan banks, cards and wallets.
const DEBITS: [string, number, string | null][] = [
  ['Dear Customer, your account 1234XXXX has been debited with LKR 1,500.00 on 05/11/2026 10:15. Never share your OTP with anyone.', 1500, null],
  ['Txn Alert: LKR 2,350.00 at CARGILLS FOOD CITY on Card ending 1234. Avl Lmt LKR 150,000.00', 2350, 'CARGILLS FOOD CITY'],
  ['Your Credit Card ending 4321 was used for a transaction of LKR 3,200.00 at PIZZA HUT on 05-Nov-26', 3200, 'PIZZA HUT'],
  ['LKR 10,000.00 withdrawn from ATM at COLOMBO 07 on 05/11/26.', 10000, null],
  ['Fund Transfer of Rs. 2,000.00 to 1234XXXX was successful. Ref: 123456', 2000, null],
  ['Bill payment of LKR 3,450.00 to DIALOG AXIATA successful.', 3450, 'DIALOG AXIATA'],
  ['Amt: 1,250.00 Merchant: UBER TRIP Card: XX1234 Type: Purchase', 1250, 'UBER TRIP'],
  ['SLRs 500.00 debited from your account for SLT bill', 500, null],
  ['LKR2,500.00 has been charged to your card at DARAZ.LK', 2500, 'DARAZ.LK'],
  ['Your payment of Rs 1,980.00 for CEB account 123 has been received. Thank you', 1980, null],
  ['CEFT transfer of LKR 7,500.00 to SAMAN PERERA completed', 7500, 'SAMAN PERERA'],
  ['LankaQR payment of Rs.450.00 to TEA HUT successful', 450, 'TEA HUT'],
  ['Debit Card Txn: LKR 800.00 at KFC MAHARAGAMA', 800, 'KFC MAHARAGAMA'],
  ['Purchase Alert! LKR 1,200.00 @ SPAR', 1200, 'SPAR'],
  ['e-Commerce txn LKR 2,999.00 at NETFLIX.COM', 2999, 'NETFLIX.COM'],
  ['Avl Bal: LKR 40,000.00 Txn Amt: LKR 500.00 Dr A/C 1234', 500, null],
  ['A/C 1234XXXX Dr LKR 750.00 on 05/11 CHQ 001234', 750, null],
  ['Rs.1,500/- deducted from your FriMi wallet for payment to PICKME', 1500, 'PICKME'],
  ['Your Genie payment of LKR 650.00 to KEELLS was successful', 650, 'KEELLS'],
  ['ATM Cash Withdrawal LKR 5,000.00 BOC KANDY 05/11/26 Bal LKR 12,000.00', 5000, null],
  ['Transaction of LKR 1,000.00 is successful at ARPICO. Card ending 1234', 1000, 'ARPICO'],
  ['LKR 1,500.00 debited from A/C XXX1234 for Online Transfer. Your OTP will never be asked by the bank.', 1500, null],
];

for (const [sms, amount, merchant] of DEBITS) {
  test(`debit: ${sms.slice(0, 50)}`, () => {
    const r = parseBankSms(sms, NOW);
    assert.equal(r.kind, 'debit', `kind for: ${sms}`);
    if (r.kind !== 'debit') return;
    assert.equal(r.expense.amount, amount);
    if (merchant) assert.equal(r.expense.merchant, merchant);
  });
}

const NOT_DEBITS: [string, string][] = [
  ['Your A/C 1234XXXX has been credited with LKR 50,000.00 on 01/11. Salary', 'credit'],
  ['LKR 5,000.00 Cr to A/C 1234 on 05/11 - CEFT from SAMAN', 'credit'],
  ['123456 is your OTP for the transaction of LKR 5,000.00 at DARAZ. Do not share it.', 'ignored'],
  ['Your OTP is 482913. Valid for 3 minutes. Amount LKR 2,000.00', 'ignored'],
  ['Get 20% off up to Rs. 1,000 at Pizza Hut this weekend!', 'ignored'],
  ['Reload Rs. 100 and get 1GB free! Dial #123#', 'ignored'],
  ['Rs. 2,400.00 on 05/11 KEELLS SUPER card 1234', 'maybe'],
];

for (const [sms, kind] of NOT_DEBITS) {
  test(`not debit: ${sms.slice(0, 50)}`, () => {
    assert.equal(parseBankSms(sms, NOW).kind, kind);
  });
}
