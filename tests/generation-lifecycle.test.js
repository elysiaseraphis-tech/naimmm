'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '../NAIM_Studio_v5_pair_rotate (9).html'), 'utf8');
const start = html.indexOf('  async function processQueue(){');
const end = html.indexOf('  function _isFatal', start);
assert.ok(start >= 0 && end > start);
const script = html.slice(start, end);

function loadQueue(render) {
  const calls = [];
  const context = {
    processing: false,
    state: 'idle',
    items: [],
    render,
    _persist: () => calls.push('persist'),
    AndroidNative: {
      generationStarted: () => calls.push('start'),
      generationFinished: () => calls.push('finish')
    }
  };
  context.window = context;
  vm.runInNewContext(script, context);
  return {context, calls};
}

test('queue completion releases the Android generation service', async () => {
  const {context, calls} = loadQueue(() => {});
  await context.processQueue();
  assert.deepEqual(calls, ['start', 'persist', 'finish']);
  assert.equal(context.processing, false);
  assert.equal(context.state, 'idle');
});

test('unexpected UI failure cannot leave the native service and wake lock running', async () => {
  let renders = 0;
  const {context, calls} = loadQueue(() => {
    if (++renders > 1) throw new Error('UI unavailable');
  });
  context.items.push({});
  await assert.rejects(context.processQueue(), /UI unavailable/);
  assert.deepEqual(calls, ['start', 'finish']);
  assert.equal(context.processing, false);
  assert.equal(context.state, 'idle');
});

test('reentrant queue processing does not stop an already active service', async () => {
  const {context, calls} = loadQueue(() => {});
  context.processing = true;
  await context.processQueue();
  assert.deepEqual(calls, []);
  assert.equal(context.processing, true);
});
