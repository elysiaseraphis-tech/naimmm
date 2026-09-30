'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '../NAIM_Studio_v5_pair_rotate (9).html'), 'utf8');
const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/gi)]
  .find((match) => match[1].includes('window.NaimAndroid ='));
assert.ok(script, 'Android UI integration exists');

function loadPage(native) {
  const toggle = {checked: false};
  const settings = {hidden: true};
  const listeners = {};
  const messages = [];
  const document = {
    documentElement: {},
    fullscreenElement: null,
    getElementById: (id) => id === 'naim-fullscreen' ? toggle : settings,
    addEventListener: (event, callback) => { listeners[event] = callback; }
  };
  const context = {document, NAIM: {toast: (message) => messages.push(message)}};
  if (native) context.AndroidNative = native;
  context.window = context;
  vm.runInNewContext(script[1], context);
  return {document, toggle, settings, listeners, messages, api: context.NaimAndroid};
}

test('fullscreen toggle uses Android immersive bridge and follows native back state', async () => {
  const calls = [];
  const page = loadPage({setFullscreen: (enabled) => calls.push(enabled)});
  page.toggle.checked = true;
  await page.api.toggleFullscreen(page.toggle);
  assert.deepEqual(calls, [true]);
  page.api.onFullscreenChanged(true);
  page.listeners.fullscreenchange();
  assert.equal(page.toggle.checked, true, 'browser events do not overwrite native fullscreen');
  page.api.onFullscreenChanged(false);
  assert.equal(page.toggle.checked, false);
  await page.api.toggleFullscreen(page.toggle);
  assert.deepEqual(calls, [true, false]);
});

test('web/PWA keeps browser fullscreen entry, exit and Escape synchronization', async () => {
  const page = loadPage();
  page.document.documentElement.requestFullscreen = async () => {
    page.document.fullscreenElement = page.document.documentElement;
  };
  page.document.exitFullscreen = async () => { page.document.fullscreenElement = null; };
  page.toggle.checked = true;
  await page.api.toggleFullscreen(page.toggle);
  assert.equal(page.toggle.checked, true);
  page.toggle.checked = false;
  await page.api.toggleFullscreen(page.toggle);
  assert.equal(page.document.fullscreenElement, null);
  page.toggle.checked = true;
  await page.api.toggleFullscreen(page.toggle);
  page.document.fullscreenElement = null;
  page.listeners.fullscreenchange();
  assert.equal(page.toggle.checked, false);
});

test('unsupported or rejected fullscreen restores the checkbox and reports failure', async () => {
  const page = loadPage();
  page.toggle.checked = true;
  await page.api.toggleFullscreen(page.toggle);
  assert.equal(page.toggle.checked, false);
  page.document.documentElement.requestFullscreen = async () => { throw new Error('Denied'); };
  page.toggle.checked = true;
  await page.api.toggleFullscreen(page.toggle);
  assert.equal(page.toggle.checked, false);
  assert.equal(page.messages.length, 2);
});

test('battery settings entry appears only when the Android bridge supports it', () => {
  let opened = 0;
  const android = loadPage({openBackgroundSettings: () => { opened++; }});
  android.listeners.DOMContentLoaded();
  assert.equal(android.settings.hidden, false);
  android.api.openBackgroundSettings();
  assert.equal(opened, 1);
  const browser = loadPage();
  browser.listeners.DOMContentLoaded();
  assert.equal(browser.settings.hidden, true);
  browser.api.openBackgroundSettings();
});

test('settings failures provide a manual route instead of throwing', () => {
  const page = loadPage({openBackgroundSettings: () => { throw new Error('Unavailable'); }});
  page.api.openBackgroundSettings();
  assert.equal(page.messages.length, 1);
});
