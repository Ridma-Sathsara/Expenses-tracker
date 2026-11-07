import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isBlockedSender } from '../senders';

const B = ['COMBANK'];

test('blocks COMBANK sender ids in any form', () => {
  assert.equal(isBlockedSender('COMBANK', 'LKR 500 debited', B), true);
  assert.equal(isBlockedSender('ComBank', 'LKR 500 debited', B), true);
  assert.equal(isBlockedSender('AD-COMBANK', 'LKR 500 debited', B), true);
  assert.equal(isBlockedSender('+94112353353', 'COMBANK: LKR 500 debited at KEELLS', B), true);
});

test('does not block other banks', () => {
  assert.equal(isBlockedSender('HNB', 'LKR 500 debited', B), false);
  assert.equal(isBlockedSender('SAMPATH', 'Paid LKR 500 to COMBANK credit card', B), false);
  assert.equal(isBlockedSender(null, 'LKR 500 debited', B), false);
  assert.equal(isBlockedSender('COMBANK', 'x', []), false);
});
