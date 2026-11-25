'use strict';
// Smoke test of the real page in a simulated browser (jsdom).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const root = path.join(__dirname, '..');

function openApp(storage) {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8').replace(/<script[^>]*><\/script>/g, '');
  const dom = new JSDOM(html, { url: 'https://example.test/index.html', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  if (storage) for (const [k, v] of Object.entries(storage)) w.localStorage.setItem(k, v);
  w.confirm = () => true;
  w.URL.createObjectURL = () => 'blob:test';
  w.URL.revokeObjectURL = () => {};
  w.HTMLAnchorElement.prototype.click = function () {};
  for (const f of ['js/core.js', 'js/demo.js', 'js/app.js']) {
    w.eval(fs.readFileSync(path.join(root, f), 'utf8'));
  }
  return w;
}

function click(w, selector) {
  const el = w.document.querySelector(selector);
  assert.ok(el, 'missing ' + selector);
  el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));
  return el;
}

test('first visit shows the getting-started card', () => {
  const w = openApp();
  const text = w.document.querySelector('#todayContent').textContent;
  assert.match(text, /Bring customers back/);
  assert.ok(w.document.querySelector('[data-action="load-demo"]'));
});

test('demo data fills every list and never opens WhatsApp', () => {
  const w = openApp();
  click(w, '#todayContent [data-action="load-demo"]');
  const doc = w.document;
  const nums = [...doc.querySelectorAll('.counter .num')].map((n) => +n.textContent);
  assert.equal(nums.length, 4);
  assert.ok(nums[0] >= 2, 'thank-yous ' + nums[0]);
  assert.ok(nums[1] >= 3, 'reorders ' + nums[1]);
  assert.ok(nums[2] >= 1, 'win-backs ' + nums[2]);
  assert.ok(nums[3] >= 1, 'upcoming ' + nums[3]);

  const send = doc.querySelector('[data-action="send"]');
  assert.match(send.getAttribute('href'), /^https:\/\/wa\.me\/2547\d{8}\?text=/);
  const ev = new w.MouseEvent('click', { bubbles: true, cancelable: true });
  send.dispatchEvent(ev);
  assert.equal(ev.defaultPrevented, true, 'demo send must not open WhatsApp');
  assert.match(doc.querySelector('#todayContent').textContent, /Done today/);
  const saved = JSON.parse(w.localStorage.getItem('reorder-desk:v1'));
  assert.equal(saved.log.filter((l) => l.at !== undefined).length >= 2, true);
});

test('adding a real order, setting product days and seeing it due', () => {
  const w = openApp();
  const doc = w.document;
  click(w, '.tabs [data-tab="orders"]');
  const f = doc.querySelector('#orderForm');
  f.elements.name.value = 'Brian Kiptoo';
  f.elements.phone.value = '0712 345 678';
  f.elements.product.value = 'Goat feed 50kg';
  const d = new Date(); d.setDate(d.getDate() - 28);
  f.elements.date.value = d.toISOString().slice(0, 10);
  f.elements.consent.checked = true;
  f.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  assert.match(doc.querySelector('#orderFormMsg').textContent, /Saved/);
  assert.match(doc.querySelector('#orderTable').textContent, /Brian Kiptoo/);

  click(w, '.tabs [data-tab="products"]');
  const input = doc.querySelector('.days-input');
  input.value = '30';
  input.dispatchEvent(new w.Event('change', { bubbles: true }));

  click(w, '.tabs [data-tab="today"]');
  const item = doc.querySelector('.item.reorder');
  assert.ok(item, 'reorder reminder shown');
  const href = item.querySelector('[data-action="send"]').getAttribute('href');
  assert.match(href, /^https:\/\/wa\.me\/254712345678\?text=Hi%20Brian/);
});

test('CSV import needs consent, then imports and reports bad rows', () => {
  const w = openApp();
  const doc = w.document;
  click(w, '.tabs [data-tab="orders"]');
  doc.querySelector('#csvText').value = 'name,phone,product,date\nA,0712345678,Tea,01/11/2026\nB,123,Tea,01/11/2026';
  click(w, '[data-action="import-csv"]');
  assert.match(doc.querySelector('#importResult').textContent, /Tick the box/);
  doc.querySelector('#csvConsent').checked = true;
  click(w, '[data-action="import-csv"]');
  const res = doc.querySelector('#importResult').textContent;
  assert.match(res, /Imported 1 order/);
  assert.match(res, /1 row could not be read/);
});

test('STOP list removes a customer from Today', () => {
  const w = openApp();
  click(w, '#todayContent [data-action="load-demo"]');
  const before = w.document.querySelectorAll('.item').length;
  click(w, '[data-action="stop"]');
  const after = w.document.querySelectorAll('.item').length;
  assert.ok(after < before);
  assert.match(w.document.querySelector('#todayContent').textContent, /STOP list/);
});

test('settings and Kiswahili messages', () => {
  const w = openApp();
  const doc = w.document;
  click(w, '.tabs [data-tab="settings"]');
  const f = doc.querySelector('#settingsForm');
  f.elements.shopName.value = 'Duka la Mama Pima';
  f.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  assert.equal(doc.querySelector('#shopLine').textContent, 'Duka la Mama Pima');
  click(w, '.tabs [data-tab="messages"]');
  const sel = doc.querySelector('#langSelect');
  sel.value = 'sw';
  sel.dispatchEvent(new w.Event('change', { bubbles: true }));
  assert.match(doc.querySelector('#prev-reorder').textContent, /^Habari Wanjiku/);
  assert.match(doc.querySelector('#prev-reorder').textContent, /Duka la Mama Pima/);
});

test('report counts demo data only when there is no real data', () => {
  const w = openApp();
  click(w, '#todayContent [data-action="load-demo"]');
  click(w, '.tabs [data-tab="report"]');
  const t = w.document.querySelector('#reportContent').textContent;
  assert.match(t, /demo data/);
  assert.match(t, /Customers/);
});

test('backup survives a reload', () => {
  const w = openApp();
  click(w, '#todayContent [data-action="load-demo"]');
  const saved = w.localStorage.getItem('reorder-desk:v1');
  const w2 = openApp({ 'reorder-desk:v1': saved });
  assert.ok(w2.document.querySelectorAll('.item').length > 0);
});
