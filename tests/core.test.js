'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/core.js');

test('normalizePhone handles common Kenyan formats', () => {
  const cases = [
    ['0712 345 678', '254712345678'],
    ['0712-345-678', '254712345678'],
    ['712345678', '254712345678'],
    ['+254 712 345 678', '254712345678'],
    ['254712345678', '254712345678'],
    ['00254712345678', '254712345678'],
    ['0112345678', '254112345678'],
    ['(0712) 345678', '254712345678']
  ];
  for (const [input, want] of cases) {
    const r = C.normalizePhone(input, '254');
    assert.equal(r.ok, true, input + ' should be valid: ' + r.reason);
    assert.equal(r.digits, want, input);
  }
});

test('normalizePhone rejects bad numbers', () => {
  assert.equal(C.normalizePhone('', '254').ok, false);
  assert.equal(C.normalizePhone('07123', '254').ok, false);
  assert.equal(C.normalizePhone('0201234567', '254').ok, false, 'Nairobi landline is not on WhatsApp');
  assert.equal(C.normalizePhone('call me', '254').ok, false);
});

test('normalizePhone keeps international numbers with +', () => {
  const r = C.normalizePhone('+256 772 123456', '254');
  assert.equal(r.ok, true);
  assert.equal(r.digits, '256772123456');
});

test('normalizePhone works for another default country', () => {
  const r = C.normalizePhone('0772 123456', '256');
  assert.equal(r.ok, true);
  assert.equal(r.digits, '256772123456');
});

test('formatPhone prints Kenyan numbers readably', () => {
  assert.equal(C.formatPhone('254712345678'), '+254 712 345 678');
});

test('parseDate reads day-first and ISO dates', () => {
  assert.equal(C.parseDate('2026-11-25'), '2026-11-25');
  assert.equal(C.parseDate('25/11/2026'), '2026-11-25');
  assert.equal(C.parseDate('5/1/2026'), '2026-01-05');
  assert.equal(C.parseDate('25-11-26'), '2026-11-25');
  assert.equal(C.parseDate('25 Nov 2026'), '2026-11-25');
  assert.equal(C.parseDate('Nov 25, 2026'), '2026-11-25');
  assert.equal(C.parseDate('25/11/2026 14:30'), '2026-11-25');
  assert.equal(C.parseDate('2026-11-25T09:00:00Z'), '2026-11-25');
  assert.equal(C.parseDate('46351'), '2026-11-25', 'Excel serial');
});

test('parseDate rejects impossible dates', () => {
  assert.equal(C.parseDate('31/02/2026'), null);
  assert.equal(C.parseDate('tomorrow'), null);
  assert.equal(C.parseDate(''), null);
});

test('addDays and daysBetween cross months and years', () => {
  assert.equal(C.addDays('2026-12-30', 3), '2027-01-02');
  assert.equal(C.daysBetween('2026-11-01', '2026-11-25'), 24);
});

test('computeSchedule follows the Repeat Foundry timing rule', () => {
  // 3 kg dog food at 150 g/day lasts 20 days: remind day 17, win back day 40.
  const s = C.computeSchedule('2026-11-01', 20, 1, {});
  assert.equal(s.remindOn, '2026-11-18');
  assert.equal(s.winBackOn, '2026-12-11');
  assert.equal(s.runsOutOn, '2026-11-21');
});

test('computeSchedule scales with quantity and never reminds before day 1', () => {
  assert.equal(C.computeSchedule('2026-11-01', 20, 2, {}).remindOn, '2026-12-08');
  assert.equal(C.computeSchedule('2026-11-01', 2, 1, {}).remindOn, '2026-11-02');
});

test('fillTemplate replaces known placeholders and tidies spaces', () => {
  assert.equal(C.fillTemplate('Hi {name}, from {shop}.', { name: 'Wanjiku', shop: 'Mbwa Bora' }), 'Hi Wanjiku, from Mbwa Bora.');
  assert.equal(C.fillTemplate('Hi {name} , ok {missing}!', { name: 'Ali' }), 'Hi Ali, ok!');
});

test('buildMessage uses first name, language and fallbacks', () => {
  const item = { type: 'reorder', name: 'Wanjiku Kamau', product: 'Dog food 3kg' };
  const en = C.buildMessage(item, { shopName: 'Mbwa Bora', lang: 'en' });
  assert.match(en, /^Hi Wanjiku, your Dog food 3kg from Mbwa Bora/);
  assert.match(en, /STOP/);
  const sw = C.buildMessage({ type: 'thankYou', name: '', product: 'Kahawa' }, { shopName: '', lang: 'sw' });
  assert.match(sw, /^Habari mteja, asante kwa kununua Kahawa kutoka duka letu!/);
});

test('waLink encodes the message', () => {
  assert.equal(C.waLink('254712345678', 'Hi & bye'), 'https://wa.me/254712345678?text=Hi%20%26%20bye');
});

test('parseCSV handles quotes, commas, CRLF, BOM and semicolons', () => {
  const rows = C.parseCSV('﻿name,phone\r\n"Kamau, John",0712345678\r\n"Say ""hi""",0722000000\r\n');
  assert.deepEqual(rows, [['name', 'phone'], ['Kamau, John', '0712345678'], ['Say "hi"', '0722000000']]);
  assert.deepEqual(C.parseCSV('a;b\n1;2'), [['a', 'b'], ['1', '2']]);
});

test('toCSV escapes and blocks spreadsheet formulas', () => {
  assert.equal(C.toCSV([['a,b', '=SUM(1)', 'x']]), '"a,b",\'=SUM(1),x\r\n');
});

test('importOrders maps loose headers, reports errors and skips duplicates', () => {
  const csv = [
    'Customer Name,WhatsApp Number,Item,Order Date,Quantity,Total KES',
    'Wanjiku Kamau,0712 345 678,Dog food 3kg,01/11/2026,1,"2,450"',
    'Otieno,07123,Dog food 3kg,01/11/2026,1,2450',
    'Achieng,0722 000 111,,01/11/2026,1,100',
    'Kiprop,0733 000 222,Coffee 500g,someday,1,900',
    'Wanjiku Kamau,0712 345 678,Dog food 3kg,01/11/2026,1,"2,450"'
  ].join('\n');
  const r = C.importOrders(csv, { countryCode: '254' });
  assert.deepEqual(r.missingColumns, []);
  assert.equal(r.orders.length, 1);
  assert.deepEqual(r.orders[0], { name: 'Wanjiku Kamau', phone: '254712345678', product: 'Dog food 3kg', date: '2026-11-01', qty: 1, amount: 2450 });
  assert.equal(r.errors.length, 3);
  assert.equal(r.duplicates, 1);
});

test('importOrders skips orders already saved and reports missing columns', () => {
  const existing = [{ phone: '254712345678', product: 'Dog food 3kg', date: '2026-11-01', qty: 1 }];
  const r = C.importOrders('phone,product,date\n0712345678,Dog Food 3kg,2026-11-01', { existing });
  assert.equal(r.orders.length, 0);
  assert.equal(r.duplicates, 1);
  assert.deepEqual(C.importOrders('name,phone\nA,0712345678').missingColumns, ['product', 'date']);
});

test('importOrders marks demo rows', () => {
  const r = C.importOrders('phone,product,date,demo\n0712345678,Tea,2026-11-01,yes');
  assert.equal(r.orders[0].demo, true);
});

function baseState(extra) {
  return Object.assign({
    settings: { shopName: 'Mbwa Bora', leadDays: 3, winBackMultiplier: 2, thankYouWindowDays: 3, upcomingDays: 7 },
    products: [{ id: 'p1', name: 'Dog food 3kg', lastsDays: 20 }, { id: 'p2', name: 'Coffee 500g', lastsDays: 30 }],
    orders: [],
    optOut: [],
    log: []
  }, extra);
}

test('buildQueue: thank-you for a new customer, then reorder, then win-back', () => {
  const st = baseState({ orders: [{ id: 'o1', name: 'Wanjiku', phone: '254712345678', product: 'Dog food 3kg', date: '2026-11-01', qty: 1 }] });
  let q = C.buildQueue(st, '2026-11-02');
  assert.equal(q.thankYou.length, 1);
  assert.equal(q.reorder.length, 0);

  q = C.buildQueue(st, '2026-11-12');
  assert.equal(q.thankYou.length, 0, 'thank-you window passed');
  assert.equal(q.upcoming.length, 1, 'reminder due on 18 Nov is within 7 days');

  q = C.buildQueue(st, '2026-11-18');
  assert.equal(q.reorder.length, 1);
  assert.equal(q.reorder[0].dueOn, '2026-11-18');

  q = C.buildQueue(st, '2026-11-25');
  assert.equal(q.reorder[0].daysLate, 7);

  q = C.buildQueue(st, '2026-12-11');
  assert.equal(q.reorder.length, 0);
  assert.equal(q.winBack.length, 1);
});

test('buildQueue: logged messages are not repeated', () => {
  const st = baseState({
    orders: [{ id: 'o1', name: 'Wanjiku', phone: '254712345678', product: 'Dog food 3kg', date: '2026-11-01', qty: 1 }],
    log: [{ id: 'l1', type: 'reorder', orderId: 'o1', phone: '254712345678', at: '2026-11-18' }]
  });
  assert.equal(C.buildQueue(st, '2026-11-20').reorder.length, 0);
  st.log.push({ id: 'l2', type: 'winBack', orderId: 'o1', phone: '254712345678', at: '2026-12-11' });
  assert.equal(C.buildQueue(st, '2026-12-20').winBack.length, 0);
});

test('buildQueue: a new order resets the cycle and blocks repeat thank-yous', () => {
  const st = baseState({
    orders: [
      { id: 'o1', name: 'Wanjiku', phone: '254712345678', product: 'Dog food 3kg', date: '2026-11-01', qty: 1 },
      { id: 'o2', name: 'Wanjiku', phone: '254712345678', product: 'Dog food 3kg', date: '2026-11-19', qty: 1 }
    ]
  });
  const q = C.buildQueue(st, '2026-11-20');
  assert.equal(q.thankYou.length, 0, 'second order is not a first order');
  assert.equal(q.reorder.length, 0, 'reorder for o1 no longer applies');
  assert.equal(q.upcoming.length, 0);
  const later = C.buildQueue(st, '2026-12-06');
  assert.equal(later.reorder.length, 1);
  assert.equal(later.reorder[0].orderId, 'o2');
});

test('buildQueue: buying something else keeps the customer out of win-back', () => {
  const st = baseState({
    orders: [
      { id: 'o1', name: 'Kiprop', phone: '254733000222', product: 'Dog food 3kg', date: '2026-10-01', qty: 1 },
      { id: 'o2', name: 'Kiprop', phone: '254733000222', product: 'Coffee 500g', date: '2026-11-10', qty: 1 }
    ]
  });
  const q = C.buildQueue(st, '2026-11-25');
  assert.equal(q.winBack.length, 0);
  assert.equal(q.reorder.length, 0, 'dog food win-back point passed, so its reminder is stale');
});

test('buildQueue: opted-out customers and products without days', () => {
  const st = baseState({
    orders: [
      { id: 'o1', name: 'A', phone: '254712345678', product: 'Dog food 3kg', date: '2026-11-01', qty: 1 },
      { id: 'o2', name: 'B', phone: '254722000111', product: 'Mystery box', date: '2026-11-01', qty: 1 }
    ],
    optOut: ['254712345678']
  });
  const q = C.buildQueue(st, '2026-11-18');
  assert.equal(q.optedOut, 1);
  assert.equal(q.reorder.length, 0);
  assert.deepEqual(q.needsDays, ['Mystery box']);
});

test('computeStats: repeat rate and orders after a message, demo data excluded', () => {
  const st = baseState({
    orders: [
      { id: 'o1', phone: '254712345678', product: 'Dog food 3kg', date: '2026-10-01', amount: 2450 },
      { id: 'o2', phone: '254712345678', product: 'Dog food 3kg', date: '2026-10-20', amount: 2450 },
      { id: 'o3', phone: '254722000111', product: 'Coffee 500g', date: '2026-10-05', amount: 900 },
      { id: 'o4', phone: '254799999999', product: 'Coffee 500g', date: '2026-10-05', amount: 900, demo: true }
    ],
    log: [{ id: 'l1', type: 'reorder', orderId: 'o1', phone: '254712345678', at: '2026-10-18' }]
  });
  const s = C.computeStats(st, '2026-11-01');
  assert.equal(s.customers, 2);
  assert.equal(s.repeatCustomers, 1);
  assert.equal(s.repeatRate, 50);
  assert.equal(s.ordersAfterMessage, 1);
  assert.equal(s.amountAfterMessage, 2450);
  assert.equal(s.sentLast30.reorder, 1);
});
