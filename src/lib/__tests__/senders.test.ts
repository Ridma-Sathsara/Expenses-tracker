import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_BLOCKED_SENDERS, isBlockedSender, mergeNewDefaults } from '../senders';

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

test('SAMPATHOTP is blocked by default, other Sampath senders are not', () => {
  const D = DEFAULT_BLOCKED_SENDERS;
  assert.equal(isBlockedSender('SampathOTP', 'LKR 500 debited', D), true);
  assert.equal(isBlockedSender('SAMPATH-OTP', 'Your OTP is 123456', D), true);
  assert.equal(isBlockedSender('SAMPATH', 'LKR 500 debited at KEELLS', D), false);
  assert.equal(isBlockedSender('SampathBank', 'LKR 500 debited at KEELLS', D), false);
});

test('new defaults are added once to a saved list', () => {
  assert.deepEqual(mergeNewDefaults(['COMBANK', 'HNB'], ['COMBANK']), ['COMBANK', 'HNB', 'SAMPATHOTP']);
  // user unblocked COMBANK earlier: it stays unblocked
  assert.deepEqual(mergeNewDefaults(['HNB'], ['COMBANK']), ['HNB', 'SAMPATHOTP']);
  // already offered: nothing forced back
  assert.deepEqual(mergeNewDefaults(['HNB'], ['COMBANK', 'SAMPATHOTP']), ['HNB']);
});
