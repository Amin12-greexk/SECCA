const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeHardwarePayload } = require('./hardware-bridge');

test('normalizeHardwarePayload parses scan payloads', () => {
  assert.deepEqual(normalizeHardwarePayload('TEI-0001-25'), {
    type: 'scan',
    value: 'TEI-0001-25',
  });
});

test('normalizeHardwarePayload parses weight payloads', () => {
  assert.deepEqual(normalizeHardwarePayload({ type: 'weight', value: '125.5' }), {
    type: 'weight',
    value: '125.5',
    stable: false,
  });
});

test('normalizeHardwarePayload parses stable weight payloads', () => {
  assert.deepEqual(normalizeHardwarePayload({ type: 'weight', value: '250.0', stable: true }), {
    type: 'weight',
    value: '250.0',
    stable: true,
  });
});

test('normalizeHardwarePayload falls back to unknown for unsupported payloads', () => {
  assert.deepEqual(normalizeHardwarePayload({ foo: 'bar' }), {
    type: 'unknown',
    value: '',
  });
});

test('normalizeHardwarePayload handles empty string', () => {
  assert.deepEqual(normalizeHardwarePayload(''), {
    type: 'unknown',
    value: '',
  });
});

// ── serial-scale parseLine tests ──────────────────────────────────
const { parseLine } = require('./serial-scale');

test('parseLine extracts weight from simple number', () => {
  const result = parseLine('123.4');
  assert.equal(result.weight, '123.4');
});

test('parseLine extracts weight from scale format "ST,GS,+  123.4  g"', () => {
  const result = parseLine('ST,GS,+  123.4  g');
  assert.equal(result.weight, '123.4');
  assert.equal(result.stable, true);
});

test('parseLine extracts weight from "  +  0.5 g"', () => {
  const result = parseLine('  +  0.5 g');
  assert.equal(result.weight, '0.5');
});

test('parseLine handles kg conversion', () => {
  const result = parseLine('1.5 kg');
  assert.equal(result.weight, '1500');
});

test('parseLine returns null for empty line', () => {
  assert.equal(parseLine(''), null);
  assert.equal(parseLine(null), null);
  assert.equal(parseLine('   '), null);
});

test('parseLine handles "US" (unstable) prefix', () => {
  const result = parseLine('US,GS,+  50.0  g');
  assert.equal(result.weight, '50');
  assert.equal(result.stable, false);
});
