'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '../NAIM_Studio_v5_pair_rotate (9).html'), 'utf8');
const themeScript = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
  .find((match) => match[1].includes("const key = 'naim_color_theme';"));
assert.ok(themeScript, 'startup theme script exists');
assert.ok(themeScript.index < html.indexOf('<style>'), 'theme initializes before CSS is parsed');

function loadTheme({saved = 'classic', native = true, storageBlocked = false} = {}) {
  const calls = [];
  const listeners = {};
  const root = {dataset: {}};
  const meta = {};
  const select = {value: ''};
  let colors = {};
  const context = {
    document: {
      documentElement: root,
      querySelector: () => meta,
      getElementById: () => select,
      addEventListener: (event, callback) => { listeners[event] = callback; }
    },
    localStorage: {
      getItem: () => {
        if (storageBlocked) throw new Error('Storage unavailable');
        return saved;
      },
      setItem: () => {
        if (storageBlocked) throw new Error('Storage unavailable');
      }
    },
    getComputedStyle: () => ({getPropertyValue: (key) => colors[key] || ''})
  };
  if (native) context.AndroidNative = {setThemeColors: (...args) => calls.push(args)};
  context.window = context;
  vm.runInNewContext(themeScript[1], context);
  return {calls, root, meta, select, context, listeners, setColors: (value) => { colors = value; }};
}

test('does not send empty colors before CSS loads, then applies the saved theme', () => {
  const page = loadTheme({saved: 'amoled'});
  assert.equal(page.root.dataset.theme, 'amoled');
  assert.equal(page.meta.content, '#000000');
  assert.deepEqual(page.calls, []);
  page.setColors({'--bg': ' #000000 ', '--panel': ' #101010 '});
  page.listeners.DOMContentLoaded();
  assert.deepEqual(page.calls, [['#000000', '#101010']]);
  assert.equal(page.select.value, 'amoled');
});

test('does not call the native bridge if either CSS color is missing or whitespace', () => {
  const page = loadTheme();
  for (const colors of [
    {'--bg': '#000000'},
    {'--panel': '#101010'},
    {'--bg': ' ', '--panel': '#101010'},
    {'--bg': '#000000', '--panel': ' '}
  ]) {
    page.setColors(colors);
    page.context.setNaimTheme('classic');
  }
  assert.deepEqual(page.calls, []);
});

test('theme changes still reach the native bridge after startup', () => {
  const page = loadTheme();
  page.setColors({'--bg': '#111827', '--panel': '#1f2937'});
  page.context.setNaimTheme('slate');
  assert.equal(page.root.dataset.theme, 'slate');
  assert.equal(page.meta.content, '#111827');
  assert.equal(page.select.value, 'slate');
  assert.deepEqual(page.calls, [['#111827', '#1f2937']]);
});

test('browser startup and unavailable storage retain the default theme', () => {
  const page = loadTheme({native: false, storageBlocked: true});
  page.listeners.DOMContentLoaded();
  assert.equal(page.root.dataset.theme, 'classic');
  assert.equal(page.meta.content, '#0d0d1a');
  assert.deepEqual(page.calls, []);
});

test('unknown saved themes fall back to classic', () => {
  const page = loadTheme({saved: 'unknown'});
  page.listeners.DOMContentLoaded();
  assert.equal(page.root.dataset.theme, 'classic');
  assert.equal(page.select.value, 'classic');
});
