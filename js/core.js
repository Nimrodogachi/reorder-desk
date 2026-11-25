/*
 * Reorder Desk core logic.
 * Pure functions only: no DOM, no storage, no network.
 * Works in the browser (window.ReorderCore) and in Node (require) for tests.
 * MIT License. See LICENSE.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ReorderCore = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DAY_MS = 86400000;

  var DEFAULT_SETTINGS = {
    shopName: '',
    lang: 'en',
    countryCode: '254',
    leadDays: 3,
    winBackMultiplier: 2,
    thankYouWindowDays: 3,
    thankYouFirstOrderOnly: true,
    upcomingDays: 7,
    followUpWindowDays: 14,
    showPromo: true
  };

  var DEFAULT_TEMPLATES = {
    en: {
      thankYou: 'Hi {name}, thank you for ordering {product} from {shop}! If you need anything, just reply here. (Reply STOP to stop these messages.)',
      reorder: 'Hi {name}, your {product} from {shop} should be running low about now. Shall we send the same again? Reply YES and we will arrange it. (Reply STOP to stop these messages.)',
      winBack: 'Hi {name}, we have missed you at {shop}! Is there anything we can help you with? Reply with what you need and we will sort it out. (Reply STOP to stop these messages.)'
    },
    sw: {
      thankYou: 'Habari {name}, asante kwa kununua {product} kutoka {shop}! Ukihitaji chochote, jibu hapa tu. (Jibu STOP kusitisha ujumbe huu.)',
      reorder: 'Habari {name}, {product} uliyonunua kutoka {shop} huenda inakaribia kuisha. Tukuletee tena kama awali? Jibu NDIYO na tutapanga. (Jibu STOP kusitisha ujumbe huu.)',
      winBack: 'Habari {name}, tumekukosa hapa {shop}! Kuna chochote tunachoweza kukusaidia nacho? Tujibu na unachohitaji, tutakushughulikia. (Jibu STOP kusitisha ujumbe huu.)'
    }
  };

  var NAME_FALLBACK = { en: 'there', sw: 'mteja' };

  var MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

  /* ---------- dates (always 'YYYY-MM-DD', computed in UTC) ---------- */

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function makeISO(y, m, d) {
    if (!(y >= 1900 && y <= 2200 && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return null;
    var t = Date.UTC(y, m - 1, d);
    var dt = new Date(t);
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
    return y + '-' + pad2(m) + '-' + pad2(d);
  }

  function isoToTime(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    if (!m) return NaN;
    return Date.UTC(+m[1], +m[2] - 1, +m[3]);
  }

  function timeToISO(t) {
    var d = new Date(t);
    return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate());
  }

  function addDays(iso, n) { return timeToISO(isoToTime(iso) + n * DAY_MS); }

  function daysBetween(fromIso, toIso) {
    return Math.round((isoToTime(toIso) - isoToTime(fromIso)) / DAY_MS);
  }

  function todayISO(now) {
    var d = now || new Date();
    // Local calendar date of the device, not UTC.
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function expandYear(y) {
    if (y >= 100) return y;
    return y + 2000;
  }

  /**
   * Parse a date typed or exported by a shop. Day-first for slashes and dashes
   * (25/11/2026), as Kenyan shops write dates. Also accepts 2026-11-25,
   * "25 Nov 2026", "Nov 25, 2026" and Excel serial numbers (e.g. 46351).
   */
  function parseDate(input) {
    if (input === null || input === undefined) return null;
    var s = String(input).trim();
    if (!s) return null;
    var m;
    // Strip a time part such as "2026-11-25 14:03" or "25/11/2026 2:03 PM".
    s = s.replace(/[T ]\d{1,2}:\d{2}(:\d{2})?(\s?[AaPp][Mm])?.*$/, '').trim();

    if ((m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(s))) return makeISO(+m[1], +m[2], +m[3]);
    if ((m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/.exec(s))) return makeISO(expandYear(+m[3]), +m[2], +m[1]);
    if ((m = /^(\d{1,2})(?:st|nd|rd|th)?[\s-]+([A-Za-z]{3,})\.?,?[\s-]+(\d{2}|\d{4})$/.exec(s))) {
      var mi = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase());
      if (mi >= 0) return makeISO(expandYear(+m[3]), mi + 1, +m[1]);
    }
    if ((m = /^([A-Za-z]{3,})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/.exec(s))) {
      var mj = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase());
      if (mj >= 0) return makeISO(+m[3], mj + 1, +m[2]);
    }
    if ((m = /^(\d{5})$/.exec(s))) {
      // Excel serial date (days since 1899-12-30).
      var serial = +m[1];
      if (serial > 20000 && serial < 80000) return timeToISO(Date.UTC(1899, 11, 30) + serial * DAY_MS);
    }
    return null;
  }

  function formatShortDate(iso, lang) {
    var t = isoToTime(iso);
    if (isNaN(t)) return '';
    var d = new Date(t);
    var en = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var sw = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ago', 'Sep', 'Okt', 'Nov', 'Des'];
    var names = lang === 'sw' ? sw : en;
    return d.getUTCDate() + ' ' + names[d.getUTCMonth()];
  }

  /* ---------- phone numbers ---------- */

  /**
   * Turn what a shop typed into the digits WhatsApp needs (country code, no +).
   * Kenya is the default: 0712 345 678, 712345678, +254 712 345 678 and
   * 0112 345 678 all become 254712345678 / 254112345678.
   */
  function normalizePhone(input, countryCode) {
    var cc = String(countryCode || '254').replace(/\D/g, '');
    var raw = input === null || input === undefined ? '' : String(input).trim();
    if (!raw) return { ok: false, digits: '', reason: 'empty' };
    var s = raw.replace(/[\s\-().]/g, '');
    var digits;
    if (/^\+\d+$/.test(s)) digits = s.slice(1);
    else if (/^00\d+$/.test(s)) digits = s.slice(2);
    else if (/^\d+$/.test(s)) {
      if (s.charAt(0) === '0') digits = cc + s.slice(1);
      else if (s.indexOf(cc) === 0 && s.length >= cc.length + 8) digits = s;
      else digits = cc + s;
    } else {
      return { ok: false, digits: '', reason: 'not a number' };
    }
    if (cc === '254' && digits.indexOf('254') === 0) {
      if (!/^254[17]\d{8}$/.test(digits)) return { ok: false, digits: digits, reason: 'not a Kenyan mobile number' };
    }
    if (!/^\d{8,15}$/.test(digits)) return { ok: false, digits: digits, reason: 'wrong length' };
    return { ok: true, digits: digits, reason: '' };
  }

  function formatPhone(digits) {
    if (/^254\d{9}$/.test(digits)) {
      return '+254 ' + digits.slice(3, 6) + ' ' + digits.slice(6, 9) + ' ' + digits.slice(9);
    }
    return digits ? '+' + digits : '';
  }

  /* ---------- messages ---------- */

  function firstName(name) {
    var s = String(name || '').trim();
    if (!s) return '';
    return s.split(/\s+/)[0];
  }

  function fillTemplate(template, vars) {
    var out = String(template || '').replace(/\{(\w+)\}/g, function (match, key) {
      if (vars && Object.prototype.hasOwnProperty.call(vars, key) && vars[key] !== undefined && vars[key] !== null) {
        return String(vars[key]);
      }
      return '';
    });
    return out.replace(/[ \t]{2,}/g, ' ').replace(/ ([,.!?])/g, '$1').trim();
  }

  function waLink(digits, text) {
    return 'https://wa.me/' + String(digits || '').replace(/\D/g, '') + (text ? '?text=' + encodeURIComponent(text) : '');
  }

  function buildMessage(item, settings, templates) {
    var s = Object.assign({}, DEFAULT_SETTINGS, settings || {});
    var lang = s.lang === 'sw' ? 'sw' : 'en';
    var set = (templates && templates[lang]) || DEFAULT_TEMPLATES[lang];
    var template = set[item.type] || DEFAULT_TEMPLATES[lang][item.type];
    return fillTemplate(template, {
      name: firstName(item.name) || NAME_FALLBACK[lang],
      shop: s.shopName || (lang === 'sw' ? 'duka letu' : 'our shop'),
      product: item.product || '',
      date: formatShortDate(item.orderDate, lang),
      days: item.lastsDays || ''
    });
  }

  /* ---------- CSV ---------- */

  function detectDelimiter(text) {
    var firstLine = text.split(/\r?\n/)[0] || '';
    var counts = { ',': 0, ';': 0, '\t': 0 };
    var inQ = false;
    for (var i = 0; i < firstLine.length; i++) {
      var c = firstLine.charAt(i);
      if (c === '"') inQ = !inQ;
      else if (!inQ && counts.hasOwnProperty(c)) counts[c]++;
    }
    var best = ',';
    Object.keys(counts).forEach(function (k) { if (counts[k] > counts[best]) best = k; });
    return best;
  }

  function parseCSV(text) {
    var s = String(text || '').replace(/^﻿/, '');
    var delim = detectDelimiter(s);
    var rows = [];
    var row = [];
    var field = '';
    var inQ = false;
    for (var i = 0; i < s.length; i++) {
      var c = s.charAt(i);
      if (inQ) {
        if (c === '"') {
          if (s.charAt(i + 1) === '"') { field += '"'; i++; } else { inQ = false; }
        } else { field += c; }
      } else if (c === '"') {
        inQ = true;
      } else if (c === delim) {
        row.push(field); field = '';
      } else if (c === '\n' || c === '\r') {
        if (c === '\r' && s.charAt(i + 1) === '\n') i++;
        row.push(field); field = '';
        rows.push(row); row = [];
      } else {
        field += c;
      }
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (f) { return String(f).trim() !== ''; }); });
  }

  function csvEscape(v) {
    var s = v === null || v === undefined ? '' : String(v);
    // Stop spreadsheet apps from running a cell as a formula.
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function toCSV(rows) {
    return rows.map(function (r) { return r.map(csvEscape).join(','); }).join('\r\n') + '\r\n';
  }

  var HEADER_ALIASES = {
    name: ['name', 'customer', 'customer name', 'client', 'buyer', 'full name', 'jina'],
    phone: ['phone', 'phone number', 'mobile', 'mobile number', 'whatsapp', 'whatsapp number', 'number', 'tel', 'telephone', 'contact', 'simu', 'namba'],
    product: ['product', 'item', 'product name', 'item name', 'sku', 'bidhaa'],
    date: ['date', 'order date', 'ordered', 'ordered on', 'created', 'created at', 'purchase date', 'tarehe'],
    qty: ['qty', 'quantity', 'units', 'count', 'idadi'],
    amount: ['amount', 'total', 'price', 'value', 'kes', 'amount kes', 'total kes', 'bei'],
    demo: ['demo']
  };

  function mapHeaders(headerRow) {
    var map = {};
    headerRow.forEach(function (h, idx) {
      var key = String(h || '').trim().toLowerCase().replace(/[_]+/g, ' ').replace(/\s+/g, ' ');
      Object.keys(HEADER_ALIASES).forEach(function (field) {
        if (map[field] === undefined && HEADER_ALIASES[field].indexOf(key) >= 0) map[field] = idx;
      });
    });
    return map;
  }

  function parseAmount(v) {
    if (v === null || v === undefined) return null;
    var s = String(v).replace(/[^\d.\-]/g, '');
    if (!s) return null;
    var n = parseFloat(s);
    return isFinite(n) ? n : null;
  }

  function orderKey(o) {
    return [o.phone, String(o.product || '').trim().toLowerCase(), o.date, o.qty || 1].join('|');
  }

  /**
   * Read a CSV export (from a spreadsheet, a shop dashboard or a notebook typed
   * into Excel) and return clean orders. Nothing is saved here.
   */
  function importOrders(text, opts) {
    var options = opts || {};
    var cc = options.countryCode || '254';
    var existingKeys = {};
    (options.existing || []).forEach(function (o) { existingKeys[orderKey(o)] = true; });
    var rows = parseCSV(text);
    var result = { orders: [], errors: [], duplicates: 0, missingColumns: [] };
    if (!rows.length) { result.missingColumns = ['phone', 'product', 'date']; return result; }
    var map = mapHeaders(rows[0]);
    ['phone', 'product', 'date'].forEach(function (f) { if (map[f] === undefined) result.missingColumns.push(f); });
    if (result.missingColumns.length) return result;
    for (var i = 1; i < rows.length; i++) {
      var r = rows[i];
      var line = i + 1;
      var phone = normalizePhone(r[map.phone], cc);
      var product = String(r[map.product] || '').trim();
      var date = parseDate(r[map.date]);
      if (!phone.ok) { result.errors.push({ line: line, reason: 'Phone "' + (r[map.phone] || '') + '": ' + phone.reason }); continue; }
      if (!product) { result.errors.push({ line: line, reason: 'No product' }); continue; }
      if (!date) { result.errors.push({ line: line, reason: 'Date "' + (r[map.date] || '') + '" not understood' }); continue; }
      var qtyRaw = map.qty !== undefined ? parseFloat(String(r[map.qty]).replace(/[^\d.]/g, '')) : 1;
      var order = {
        name: map.name !== undefined ? String(r[map.name] || '').trim() : '',
        phone: phone.digits,
        product: product,
        date: date,
        qty: qtyRaw > 0 ? qtyRaw : 1,
        amount: map.amount !== undefined ? parseAmount(r[map.amount]) : null
      };
      if (map.demo !== undefined && /^(y|yes|true|1)$/i.test(String(r[map.demo] || '').trim())) order.demo = true;
      var key = orderKey(order);
      if (existingKeys[key]) { result.duplicates++; continue; }
      existingKeys[key] = true;
      result.orders.push(order);
    }
    return result;
  }

  /* ---------- schedule and queue ---------- */

  /**
   * Repeat Foundry timing rule:
   *   reminder day = days the product lasts (x quantity) minus leadDays, never before day 1
   *   win-back day = winBackMultiplier x days it lasts
   * Example: dog food lasting 20 days -> remind on day 17, win back on day 40.
   */
  function computeSchedule(orderDate, lastsDays, qty, settings) {
    var s = Object.assign({}, DEFAULT_SETTINGS, settings || {});
    var total = Math.max(1, Math.round((+lastsDays || 0) * Math.max(1, +qty || 1)));
    var remindOffset = Math.max(1, total - Math.max(0, +s.leadDays || 0));
    var winBackOffset = Math.max(remindOffset + 1, Math.round(total * Math.max(1, +s.winBackMultiplier || 2)));
    return {
      runsOutOn: addDays(orderDate, total),
      remindOn: addDays(orderDate, remindOffset),
      winBackOn: addDays(orderDate, winBackOffset)
    };
  }

  function productIndex(products) {
    var idx = {};
    (products || []).forEach(function (p) { idx[String(p.name || '').trim().toLowerCase()] = p; });
    return idx;
  }

  function byDate(a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; }

  /**
   * Work out who to message today.
   * state: { settings, products, orders, optOut, log }
   * Returns lists of items: { type, orderId, name, phone, product, orderDate, dueOn, daysLate, demo }
   */
  function buildQueue(state, today) {
    var st = state || {};
    var s = Object.assign({}, DEFAULT_SETTINGS, st.settings || {});
    var products = productIndex(st.products);
    var optOut = {};
    (st.optOut || []).forEach(function (p) { optOut[p] = true; });
    var log = st.log || [];
    var loggedByOrder = {};
    log.forEach(function (l) { loggedByOrder[l.type + '|' + l.orderId] = true; });

    var out = { thankYou: [], reorder: [], winBack: [], upcoming: [], needsDays: [], optedOut: 0 };
    var needsDays = {};
    var customers = {};
    (st.orders || []).forEach(function (o) {
      if (!o || !o.phone || !o.date) return;
      (customers[o.phone] = customers[o.phone] || []).push(o);
    });

    Object.keys(customers).forEach(function (phone) {
      var orders = customers[phone].slice().sort(byDate);
      if (optOut[phone]) { out.optedOut++; return; }
      var latest = orders[orders.length - 1];
      var name = '';
      for (var n = orders.length - 1; n >= 0 && !name; n--) name = orders[n].name || '';

      function item(type, o, dueOn, extra) {
        var base = {
          type: type, orderId: o.id, name: name, phone: phone, product: o.product,
          orderDate: o.date, dueOn: dueOn, daysLate: Math.max(0, daysBetween(dueOn, today)),
          demo: !!o.demo, lastsDays: extra && extra.lastsDays
        };
        return base;
      }

      // Thank-you: recent order, first order only by default.
      var thankCandidates = s.thankYouFirstOrderOnly ? [orders[0]] : orders;
      var thankedCustomer = s.thankYouFirstOrderOnly && log.some(function (l) { return l.type === 'thankYou' && l.phone === phone; });
      thankCandidates.forEach(function (o) {
        var age = daysBetween(o.date, today);
        if (age >= 0 && age <= s.thankYouWindowDays && !thankedCustomer && !loggedByOrder['thankYou|' + o.id]) {
          out.thankYou.push(item('thankYou', o, o.date));
        }
      });

      // Latest order of each product for this customer.
      var lastPerProduct = {};
      orders.forEach(function (o) { lastPerProduct[String(o.product).trim().toLowerCase()] = o; });

      // Win-back: whole customer has gone quiet since their latest order.
      var latestProduct = products[String(latest.product).trim().toLowerCase()];
      var winBackDue = false;
      if (latestProduct && +latestProduct.lastsDays > 0) {
        var ls = computeSchedule(latest.date, latestProduct.lastsDays, latest.qty, s);
        var alreadyWonBack = log.some(function (l) { return l.type === 'winBack' && l.phone === phone && l.at >= latest.date; });
        if (today >= ls.winBackOn && !alreadyWonBack) {
          out.winBack.push(item('winBack', latest, ls.winBackOn, { lastsDays: latestProduct.lastsDays }));
          winBackDue = true;
        } else if (today >= ls.winBackOn) {
          winBackDue = true; // already sent; stay quiet
        }
      }

      Object.keys(lastPerProduct).forEach(function (key) {
        var o = lastPerProduct[key];
        var p = products[key];
        if (!p || !(+p.lastsDays > 0)) { needsDays[o.product.trim()] = true; return; }
        if (winBackDue) return;
        var sc = computeSchedule(o.date, p.lastsDays, o.qty, s);
        if (loggedByOrder['reorder|' + o.id]) return;
        if (today >= sc.remindOn && today < sc.winBackOn) {
          out.reorder.push(item('reorder', o, sc.remindOn, { lastsDays: p.lastsDays }));
        } else if (today < sc.remindOn && daysBetween(today, sc.remindOn) <= s.upcomingDays) {
          out.upcoming.push(item('reorder', o, sc.remindOn, { lastsDays: p.lastsDays }));
        }
      });
    });

    out.needsDays = Object.keys(needsDays).sort();
    out.thankYou.sort(function (a, b) { return a.orderDate < b.orderDate ? 1 : -1; });
    out.reorder.sort(function (a, b) { return a.dueOn < b.dueOn ? -1 : a.dueOn > b.dueOn ? 1 : 0; });
    out.winBack.sort(function (a, b) { return a.dueOn < b.dueOn ? -1 : a.dueOn > b.dueOn ? 1 : 0; });
    out.upcoming.sort(function (a, b) { return a.dueOn < b.dueOn ? -1 : a.dueOn > b.dueOn ? 1 : 0; });
    return out;
  }

  /* ---------- stats ---------- */

  function computeStats(state, today, opts) {
    var st = state || {};
    var includeDemo = !!(opts && opts.includeDemo);
    var s = Object.assign({}, DEFAULT_SETTINGS, st.settings || {});
    var orders = (st.orders || []).filter(function (o) { return includeDemo || !o.demo; });
    var log = (st.log || []).filter(function (l) { return includeDemo || !l.demo; });
    var byCustomer = {};
    orders.forEach(function (o) { (byCustomer[o.phone] = byCustomer[o.phone] || []).push(o); });
    var phones = Object.keys(byCustomer);
    var repeat = phones.filter(function (p) {
      var dates = {};
      byCustomer[p].forEach(function (o) { dates[o.date] = true; });
      return Object.keys(dates).length >= 2;
    }).length;

    var since = addDays(today, -30);
    var sent30 = { thankYou: 0, reorder: 0, winBack: 0 };
    log.forEach(function (l) { if (l.at >= since && l.at <= today && sent30.hasOwnProperty(l.type)) sent30[l.type]++; });

    // Orders that came in within N days after a reminder or win-back.
    // This shows timing only; it does not prove the message caused the order.
    var followed = 0;
    var followedAmount = 0;
    var counted = {};
    log.forEach(function (l) {
      if (l.type !== 'reorder' && l.type !== 'winBack') return;
      var end = addDays(l.at, s.followUpWindowDays);
      (byCustomer[l.phone] || []).forEach(function (o) {
        if (o.date > l.at && o.date <= end && !counted[o.id]) {
          counted[o.id] = true;
          followed++;
          followedAmount += +o.amount || 0;
        }
      });
    });

    return {
      customers: phones.length,
      orders: orders.length,
      repeatCustomers: repeat,
      repeatRate: phones.length ? Math.round((repeat / phones.length) * 100) : 0,
      sentLast30: sent30,
      ordersAfterMessage: followed,
      amountAfterMessage: Math.round(followedAmount),
      followUpWindowDays: s.followUpWindowDays
    };
  }

  function makeId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  return {
    DEFAULT_SETTINGS: DEFAULT_SETTINGS,
    DEFAULT_TEMPLATES: DEFAULT_TEMPLATES,
    parseDate: parseDate,
    addDays: addDays,
    daysBetween: daysBetween,
    todayISO: todayISO,
    formatShortDate: formatShortDate,
    normalizePhone: normalizePhone,
    formatPhone: formatPhone,
    firstName: firstName,
    fillTemplate: fillTemplate,
    waLink: waLink,
    buildMessage: buildMessage,
    parseCSV: parseCSV,
    toCSV: toCSV,
    mapHeaders: mapHeaders,
    importOrders: importOrders,
    orderKey: orderKey,
    computeSchedule: computeSchedule,
    buildQueue: buildQueue,
    computeStats: computeStats,
    makeId: makeId
  };
}));
