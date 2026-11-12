import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_TRACKED_SENDERS, isTrackedSender, normalizeSender } from '../senders';

const T = DEFAULT_TRACKED_SENDERS;

test('only SAMPATHTXN is tracked by default', () => {
  assert.deepEqual(T, ['SAMPATHTXN']);
});

test('SAMPATHTXN matches in any spelling', () => {
  for (const from of ['SAMPATHTXN', 'SampathTxn', 'Sampath-TXN', 'SAMPATH TXN', 'AD-SAMPATHTXN']) {
    assert.equal(isTrackedSender(from, T), true, from);
  }
});

test('every other sender is ignored', () => {
  for (const from of ['COMBANK', 'SAMPATHOTP', 'VishwaOTP', 'SAMPATH', 'SampathBank', 'HNB', '+94771234567', '', null]) {
    assert.equal(isTrackedSender(from, T), false, String(from));
  }
});

test('message text never makes a sender tracked; empty list tracks nothing', () => {
  assert.equal(isTrackedSender('COMBANK', T), false);
  assert.equal(isTrackedSender('SAMPATHTXN', []), false);
});

test('normalizeSender cleans user input', () => {
  assert.equal(normalizeSender(' sampath-txn '), 'SAMPATHTXN');
  assert.equal(normalizeSender(' - '), '');
});
