/*
 * Reorder Desk app: screens, storage and buttons.
 * All data lives in this browser's localStorage. Nothing is sent anywhere.
 * MIT License. See LICENSE.
 */
(function () {
  'use strict';
  var C = window.ReorderCore;
  var STORAGE_KEY = 'reorder-desk:v1';
  var TYPE_LABEL = { thankYou: 'Thank-you', reorder: 'Reorder reminder', winBack: 'Win-back' };

  /* ---------- state ---------- */

  function emptyState() {
    return {
      version: 1,
      settings: Object.assign({}, C.DEFAULT_SETTINGS),
      products: [],
      orders: [],
      optOut: [],
      log: [],
      templates: JSON.parse(JSON.stringify(C.DEFAULT_TEMPLATES))
    };
  }

  function upgrade(raw) {
    var st = emptyState();
    if (!raw || typeof raw !== 'object') return st;
    st.settings = Object.assign({}, C.DEFAULT_SETTINGS, raw.settings || {});
    st.products = Array.isArray(raw.products) ? raw.products : [];
    st.orders = Array.isArray(raw.orders) ? raw.orders : [];
    st.optOut = Array.isArray(raw.optOut) ? raw.optOut : [];
    st.log = Array.isArray(raw.log) ? raw.log : [];
    ['en', 'sw'].forEach(function (lang) {
      st.templates[lang] = Object.assign({}, C.DEFAULT_TEMPLATES[lang], (raw.templates && raw.templates[lang]) || {});
    });
    st.products.forEach(function (p) { if (!p.id) p.id = C.makeId(); });
    st.orders.forEach(function (o) { if (!o.id) o.id = C.makeId(); });
    return st;
  }

  var storageOk = true;
  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return upgrade(raw ? JSON.parse(raw) : null);
    } catch (e) {
      storageOk = false;
      return emptyState();
    }
  }

  var state = load();

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      storageOk = true;
    } catch (e) {
      storageOk = false;
    }
    var w = $('#storageWarning');
    w.hidden = storageOk;
    if (!storageOk) w.textContent = 'This browser is not saving your data (private mode or storage full). Download a backup in Settings before you close this page.';
  }

  /* ---------- helpers ---------- */

  function $(sel, el) { return (el || document).querySelector(sel); }
  function $all(sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); }
  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function today() { return C.todayISO(); }
  function money(n) { return 'KES ' + Math.round(n || 0).toLocaleString('en-KE'); }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

  var toastTimer = null;
  function toast(html, undo) {
    var t = $('#toast');
    t.innerHTML = html + (undo ? ' <button type="button" class="link-btn" id="toastUndo">Undo</button>' : '');
    t.hidden = false;
    if (undo) $('#toastUndo').onclick = function () { undo(); t.hidden = true; };
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, undo ? 7000 : 3500);
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return fallbackCopy(text); });
    }
    return Promise.resolve(fallbackCopy(text));
  }
  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }

  function download(filename, text, type) {
    var blob = new Blob([text], { type: type || 'text/plain' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  function findProduct(name) {
    var key = String(name || '').trim().toLowerCase();
    return state.products.filter(function (p) { return p.name.trim().toLowerCase() === key; })[0];
  }

  function ensureProducts(names) {
    var added = 0;
    names.forEach(function (n) {
      if (n && !findProduct(n)) { state.products.push({ id: C.makeId(), name: n.trim(), lastsDays: null }); added++; }
    });
    return added;
  }

  function hasRealOrders() { return state.orders.some(function (o) { return !o.demo; }); }
  function hasDemo() { return state.orders.some(function (o) { return o.demo; }); }

  /* ---------- tabs ---------- */

  var currentTab = 'today';
  function showTab(name) {
    currentTab = name;
    $all('.tabs button').forEach(function (b) {
      if (b.getAttribute('data-tab') === name) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    });
    $all('.tab').forEach(function (s) { s.hidden = s.id !== 'tab-' + name; });
    render();
    try { history.replaceState(null, '', '#' + name); } catch (e) { /* file:// */ }
  }

  /* ---------- TODAY ---------- */

  function itemCard(item) {
    var msg = C.buildMessage(item, state.settings, state.templates);
    var phoneText = C.formatPhone(item.phone);
    var when;
    if (item.type === 'thankYou') when = 'Ordered ' + C.formatShortDate(item.orderDate) + (item.daysLate ? ' (' + plural(item.daysLate, 'day', 'days') + ' ago)' : ' (today)');
    else if (item.type === 'reorder') when = 'Bought ' + C.formatShortDate(item.orderDate) + '. Due ' + C.formatShortDate(item.dueOn) + (item.daysLate ? ', ' + plural(item.daysLate, 'day', 'days') + ' late' : ', today');
    else when = 'Last order ' + C.formatShortDate(item.orderDate) + ', quiet since';
    var key = item.type + '|' + item.orderId;
    return '<article class="item ' + item.type + '" data-key="' + esc(key) + '">' +
      '<div class="item-head"><div><div class="who">' + esc(item.name || 'Customer') + (item.demo ? ' <span class="tag">demo</span>' : '') + '</div>' +
      '<div class="muted small">' + esc(phoneText) + ' · ' + esc(item.product) + '</div></div>' +
      '<span class="pill ' + item.type + '">' + esc(TYPE_LABEL[item.type]) + '</span></div>' +
      '<div class="muted small">' + esc(when) + '</div>' +
      '<details class="msg"><summary>Message</summary><p>' + esc(msg) + '</p></details>' +
      '<div class="btn-row">' +
      '<a class="btn wa" href="' + esc(C.waLink(item.phone, msg)) + '" target="_blank" rel="noopener" data-action="send" data-key="' + esc(key) + '">Send on WhatsApp</a>' +
      '<button type="button" class="btn small ghost" data-action="copy" data-key="' + esc(key) + '">Copy</button>' +
      '<button type="button" class="btn small ghost" data-action="skip" data-key="' + esc(key) + '">Skip</button>' +
      '<button type="button" class="btn small ghost" data-action="stop" data-key="' + esc(key) + '" title="Customer asked you to stop">STOP</button>' +
      '</div></article>';
  }

  var lastQueue = null;
  function queueItem(key) {
    if (!lastQueue) return null;
    var all = lastQueue.thankYou.concat(lastQueue.reorder, lastQueue.winBack);
    return all.filter(function (i) { return i.type + '|' + i.orderId === key; })[0] || null;
  }

  function renderToday() {
    var t = today();
    var q = C.buildQueue(state, t);
    lastQueue = q;
    var total = q.thankYou.length + q.reorder.length + q.winBack.length;
    var badge = $('#badgeToday');
    badge.hidden = total === 0;
    badge.textContent = total;
    var el = $('#todayContent');

    if (!state.orders.length) {
      el.innerHTML = '<div class="card hero">' +
        '<h2>Bring customers back for their next order</h2>' +
        '<p>Reorder Desk tells you, every day, which customers to thank, which ones are about to run out, and which ones have gone quiet. Tap once and the message opens in WhatsApp, ready to send.</p>' +
        '<ol class="steps"><li><b>Add your products</b> and how many days each one lasts.</li>' +
        '<li><b>Add or import your orders</b> (name, WhatsApp number, product, date).</li>' +
        '<li><b>Open Today</b> each morning and send the messages it lists.</li></ol>' +
        '<div class="btn-row"><button type="button" class="btn" data-action="go" data-tab="products">Start with my products</button>' +
        '<button type="button" class="btn ghost" data-action="load-demo">Try it with demo data</button></div>' +
        '<p class="muted small">No sign-up, no server. Your customer list never leaves this device.</p></div>';
      return;
    }

    var html = '';
    html += '<div class="counters">' +
      counter('Thank-yous', q.thankYou.length, 'thankYou') +
      counter('Reorder reminders', q.reorder.length, 'reorder') +
      counter('Win-backs', q.winBack.length, 'winBack') +
      counter('Coming up (' + state.settings.upcomingDays + ' days)', q.upcoming.length, 'upcoming') +
      '</div>';

    if (hasDemo()) {
      html += '<div class="notice">You are looking at demo customers. WhatsApp will not open for them. <button type="button" class="link-btn" data-action="clear-demo">Remove demo data</button></div>';
    }
    if (q.needsDays.length) {
      html += '<div class="notice warn">' + plural(q.needsDays.length, 'product needs', 'products need') + ' a "days it lasts" number before reminders can be worked out: ' +
        esc(q.needsDays.join(', ')) + '. <button type="button" class="link-btn" data-action="go" data-tab="products">Fix in Products</button></div>';
    }

    if (!total) {
      html += '<div class="card"><h2>All done for today</h2><p class="muted">Nobody needs a message right now.' +
        (q.upcoming.length ? ' The next reminders are below.' : '') + '</p></div>';
    }
    html += section('Thank-yous', 'Say thanks after a first order. It makes the next message feel normal.', q.thankYou);
    html += section('Reorder reminders', 'These customers are about to run out.', q.reorder);
    html += section('Win-backs', 'These customers have gone quiet. One friendly check-in.', q.winBack);

    if (q.upcoming.length) {
      html += '<div class="card"><h2>Coming up</h2><ul class="plain">' + q.upcoming.map(function (i) {
        return '<li><b>' + esc(C.formatShortDate(i.dueOn)) + '</b> · ' + esc(i.name || C.formatPhone(i.phone)) + ' · ' + esc(i.product) + '</li>';
      }).join('') + '</ul></div>';
    }

    var doneToday = state.log.filter(function (l) { return l.at === t; });
    if (doneToday.length) {
      html += '<div class="card"><h2>Done today</h2><ul class="plain">' + doneToday.map(function (l) {
        return '<li>' + esc(l.skipped ? 'Skipped' : 'Sent') + ' · ' + esc(TYPE_LABEL[l.type]) + ' · ' + esc(l.name || C.formatPhone(l.phone)) +
          ' <button type="button" class="link-btn" data-action="undo-log" data-id="' + esc(l.id) + '">Undo</button></li>';
      }).join('') + '</ul></div>';
    }
    if (q.optedOut) html += '<p class="muted small">' + plural(q.optedOut, 'customer is', 'customers are') + ' on your STOP list and will not be suggested.</p>';
    el.innerHTML = html;
  }

  function counter(label, n, type) {
    return '<div class="counter ' + type + '"><div class="num">' + n + '</div><div class="lbl">' + esc(label) + '</div></div>';
  }

  function section(title, hint, items) {
    if (!items.length) return '';
    return '<div class="card"><h2>' + esc(title) + ' <span class="muted">(' + items.length + ')</span></h2><p class="muted small">' + esc(hint) + '</p>' +
      items.map(itemCard).join('') + '</div>';
  }

  function logItem(item, skipped) {
    var entry = {
      id: C.makeId(), type: item.type, orderId: item.orderId, phone: item.phone, name: item.name,
      product: item.product, at: today()
    };
    if (skipped) entry.skipped = true;
    if (item.demo) entry.demo = true;
    state.log.push(entry);
    save();
    return entry;
  }

  function undoLog(id) {
    state.log = state.log.filter(function (l) { return l.id !== id; });
    save();
    render();
  }

  /* ---------- ORDERS ---------- */

  function renderOrders() {
    $('#productList').innerHTML = state.products.map(function (p) { return '<option value="' + esc(p.name) + '">'; }).join('');
    var dateInput = $('#orderForm').elements.date;
    if (!dateInput.value) dateInput.value = today();
    var term = ($('#orderSearch').value || '').trim().toLowerCase();
    var list = state.orders.slice().sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
    if (term) {
      list = list.filter(function (o) {
        return [o.name, o.phone, C.formatPhone(o.phone), o.product].join(' ').toLowerCase().indexOf(term) >= 0;
      });
    }
    $('#orderCount').textContent = '(' + state.orders.length + ')';
    var shown = list.slice(0, 100);
    if (!shown.length) {
      $('#orderTable').innerHTML = '<p class="muted">' + (state.orders.length ? 'No orders match.' : 'No orders yet.') + '</p>';
      return;
    }
    $('#orderTable').innerHTML = '<div class="table-wrap"><table><thead><tr><th>Date</th><th>Customer</th><th>Product</th><th>Qty</th><th>Amount</th><th></th></tr></thead><tbody>' +
      shown.map(function (o) {
        return '<tr><td>' + esc(C.formatShortDate(o.date)) + ' ' + esc(o.date.slice(0, 4)) + '</td><td>' + esc(o.name || '') + (o.demo ? ' <span class="tag">demo</span>' : '') +
          '<div class="muted small">' + esc(C.formatPhone(o.phone)) + '</div></td><td>' + esc(o.product) + '</td><td>' + esc(o.qty || 1) + '</td><td>' +
          (o.amount ? esc(money(o.amount)) : '') + '</td><td><button type="button" class="link-btn" data-action="delete-order" data-id="' + esc(o.id) + '" aria-label="Delete order">Delete</button></td></tr>';
      }).join('') + '</tbody></table></div>' +
      (list.length > shown.length ? '<p class="muted small">Showing the newest 100 of ' + list.length + '. Search to find older ones.</p>' : '');
  }

  function onOrderSubmit(e) {
    e.preventDefault();
    var f = e.target;
    var msg = $('#orderFormMsg');
    var phone = C.normalizePhone(f.elements.phone.value, state.settings.countryCode);
    if (!phone.ok) { msg.textContent = 'Check the WhatsApp number: ' + phone.reason + '.'; msg.className = 'form-msg err'; f.elements.phone.focus(); return; }
    var date = C.parseDate(f.elements.date.value);
    if (!date) { msg.textContent = 'Check the order date.'; msg.className = 'form-msg err'; return; }
    var product = f.elements.product.value.trim();
    var order = {
      id: C.makeId(), name: f.elements.name.value.trim(), phone: phone.digits, product: product, date: date,
      qty: Math.max(1, parseFloat(f.elements.qty.value) || 1),
      amount: f.elements.amount.value ? parseFloat(String(f.elements.amount.value).replace(/[^\d.]/g, '')) || null : null
    };
    var dupe = state.orders.some(function (o) { return C.orderKey(o) === C.orderKey(order); });
    if (dupe) { msg.textContent = 'This order is already saved.'; msg.className = 'form-msg err'; return; }
    state.orders.push(order);
    var newProduct = ensureProducts([product]);
    save();
    f.elements.name.value = ''; f.elements.phone.value = ''; f.elements.amount.value = ''; f.elements.qty.value = 1; f.elements.consent.checked = false;
    msg.className = 'form-msg ok';
    msg.textContent = 'Saved.' + (newProduct ? ' New product "' + product + '" added: set how many days it lasts in Products.' : '');
    render();
  }

  function importCsvText(text) {
    var out = $('#importResult');
    if (!$('#csvConsent').checked) {
      out.innerHTML = '<p class="form-msg err">Tick the box to confirm these customers agreed to hear from your shop.</p>';
      return;
    }
    var r = C.importOrders(text, { countryCode: state.settings.countryCode, existing: state.orders });
    if (r.missingColumns.length) {
      out.innerHTML = '<p class="form-msg err">The file needs these columns: ' + esc(r.missingColumns.join(', ')) + '. Check the first row of your file.</p>';
      return;
    }
    r.orders.forEach(function (o) { o.id = C.makeId(); state.orders.push(o); });
    var names = {};
    r.orders.forEach(function (o) { names[o.product] = true; });
    var newProducts = ensureProducts(Object.keys(names));
    save();
    var html = '<p class="form-msg ok">Imported ' + plural(r.orders.length, 'order', 'orders') + '.' +
      (r.duplicates ? ' Skipped ' + plural(r.duplicates, 'duplicate', 'duplicates') + '.' : '') +
      (newProducts ? ' Added ' + plural(newProducts, 'new product', 'new products') + ': set their days in Products.' : '') + '</p>';
    if (r.errors.length) {
      html += '<details class="errors"><summary>' + plural(r.errors.length, 'row', 'rows') + ' could not be read</summary><ul>' +
        r.errors.slice(0, 50).map(function (e) { return '<li>Row ' + e.line + ': ' + esc(e.reason) + '</li>'; }).join('') + '</ul></details>';
    }
    out.innerHTML = html;
    $('#csvText').value = '';
    $('#csvFile').value = '';
    $('#csvConsent').checked = false;
    render();
  }

  function onImport() {
    var file = $('#csvFile').files[0];
    if (file) {
      var reader = new FileReader();
      reader.onload = function () { importCsvText(String(reader.result || '')); };
      reader.readAsText(file);
    } else if ($('#csvText').value.trim()) {
      importCsvText($('#csvText').value);
    } else {
      $('#importResult').innerHTML = '<p class="form-msg err">Choose a CSV file or paste CSV text first.</p>';
    }
  }

  function exportOrders() {
    var rows = [['name', 'phone', 'product', 'date', 'qty', 'amount']].concat(
      state.orders.filter(function (o) { return !o.demo; }).map(function (o) {
        return [o.name, '+' + o.phone, o.product, o.date, o.qty || 1, o.amount === null || o.amount === undefined ? '' : o.amount];
      }));
    download('reorder-desk-orders-' + today() + '.csv', C.toCSV(rows), 'text/csv');
  }

  /* ---------- PRODUCTS ---------- */

  function renderProducts() {
    $('#leadDaysText').textContent = state.settings.leadDays;
    var counts = {};
    state.orders.forEach(function (o) { var k = o.product.trim().toLowerCase(); counts[k] = (counts[k] || 0) + 1; });
    var list = state.products.slice().sort(function (a, b) {
      var am = +a.lastsDays > 0 ? 1 : 0; var bm = +b.lastsDays > 0 ? 1 : 0;
      if (am !== bm) return am - bm; // missing days first
      return a.name.localeCompare(b.name);
    });
    if (!list.length) { $('#productTable').innerHTML = '<p class="muted">No products yet.</p>'; return; }
    $('#productTable').innerHTML = '<div class="card"><h2>Your products</h2><div class="table-wrap"><table><thead><tr><th>Product</th><th>Days it lasts</th><th>Reminder on day</th><th>Orders</th><th></th></tr></thead><tbody>' +
      list.map(function (p) {
        var ok = +p.lastsDays > 0;
        var remindDay = ok ? Math.max(1, p.lastsDays - state.settings.leadDays) : null;
        return '<tr' + (ok ? '' : ' class="missing"') + '><td>' + esc(p.name) + '</td>' +
          '<td><input class="days-input" type="number" min="1" step="1" value="' + (ok ? esc(p.lastsDays) : '') + '" data-action="set-days" data-id="' + esc(p.id) + '" aria-label="Days ' + esc(p.name) + ' lasts" placeholder="days"></td>' +
          '<td>' + (ok ? 'Day ' + remindDay : '<span class="muted">set days</span>') + '</td>' +
          '<td>' + (counts[p.name.trim().toLowerCase()] || 0) + '</td>' +
          '<td><button type="button" class="link-btn" data-action="delete-product" data-id="' + esc(p.id) + '">Delete</button></td></tr>';
      }).join('') + '</tbody></table></div></div>';
  }

  function onProductSubmit(e) {
    e.preventDefault();
    var f = e.target;
    var name = f.elements.name.value.trim();
    var days = parseInt(f.elements.lastsDays.value, 10);
    if (!name || !(days > 0)) return;
    var existing = findProduct(name);
    if (existing) existing.lastsDays = days;
    else state.products.push({ id: C.makeId(), name: name, lastsDays: days });
    save();
    f.reset();
    toast('Saved ' + esc(name) + '.');
    render();
  }

  function updateCalc() {
    var pack = parseFloat($('#calcPack').value);
    var daily = parseFloat($('#calcDaily').value);
    $('#calcOut').textContent = pack > 0 && daily > 0 ? Math.floor(pack / daily) + ' days' : '–';
  }

  /* ---------- MESSAGES ---------- */

  function renderMessages() {
    var lang = state.settings.lang === 'sw' ? 'sw' : 'en';
    $('#langSelect').value = lang;
    var sample = { name: 'Wanjiku Kamau', product: (state.products[0] && state.products[0].name) || 'Dog food 3kg', orderDate: today(), lastsDays: 20 };
    var hints = {
      thankYou: 'Sent within a few days of a first order.',
      reorder: 'Sent a few days before the product runs out.',
      winBack: 'Sent when a customer has been quiet for about twice the product\'s life.'
    };
    var active = document.activeElement && document.activeElement.getAttribute('data-template');
    if (active) return; // do not redraw while typing
    $('#templateEditors').innerHTML = ['thankYou', 'reorder', 'winBack'].map(function (type) {
      var tpl = state.templates[lang][type];
      var preview = C.buildMessage(Object.assign({ type: type }, sample), state.settings, state.templates);
      return '<div class="card"><h2>' + esc(TYPE_LABEL[type]) + '</h2><p class="muted small">' + esc(hints[type]) + '</p>' +
        '<label class="visually-hidden" for="tpl-' + type + '">' + esc(TYPE_LABEL[type]) + ' message</label>' +
        '<textarea id="tpl-' + type + '" rows="4" data-template="' + type + '">' + esc(tpl) + '</textarea>' +
        '<div class="preview"><div class="muted small">Preview</div><p id="prev-' + type + '">' + esc(preview) + '</p></div>' +
        (tpl.indexOf('STOP') < 0 ? '<p class="form-msg err">Add a line that tells customers how to stop these messages.</p>' : '') +
        '<button type="button" class="link-btn" data-action="reset-template" data-type="' + type + '">Reset to the original</button></div>';
    }).join('');
  }

  function onTemplateInput(e) {
    var type = e.target.getAttribute('data-template');
    if (!type) return;
    var lang = state.settings.lang === 'sw' ? 'sw' : 'en';
    state.templates[lang][type] = e.target.value;
    save();
    var sample = { type: type, name: 'Wanjiku Kamau', product: (state.products[0] && state.products[0].name) || 'Dog food 3kg', orderDate: today(), lastsDays: 20 };
    var p = $('#prev-' + type);
    if (p) p.textContent = C.buildMessage(sample, state.settings, state.templates);
  }

  /* ---------- REPORT ---------- */

  function renderReport() {
    var demoOnly = !hasRealOrders() && hasDemo();
    var s = C.computeStats(state, today(), { includeDemo: demoOnly });
    var el = $('#reportContent');
    if (!s.orders) { el.innerHTML = '<p class="muted">Add some orders to see your report.</p>'; return; }
    var sent = s.sentLast30.thankYou + s.sentLast30.reorder + s.sentLast30.winBack;
    el.innerHTML = (demoOnly ? '<div class="notice">This report uses demo data.</div>' : '') +
      '<div class="counters">' +
      '<div class="counter"><div class="num">' + s.customers + '</div><div class="lbl">Customers</div></div>' +
      '<div class="counter"><div class="num">' + s.repeatRate + '%</div><div class="lbl">Ordered more than once</div></div>' +
      '<div class="counter"><div class="num">' + sent + '</div><div class="lbl">Messages sent, last 30 days</div></div>' +
      '<div class="counter"><div class="num">' + s.ordersAfterMessage + '</div><div class="lbl">Orders within ' + s.followUpWindowDays + ' days of a reminder or win-back</div></div>' +
      '</div>' +
      '<div class="card"><h2>What this means</h2><ul class="plain">' +
      '<li>' + plural(s.repeatCustomers, 'customer has', 'customers have') + ' ordered on two or more days, out of ' + s.customers + '.</li>' +
      '<li>Last 30 days: ' + s.sentLast30.thankYou + ' thank-yous, ' + s.sentLast30.reorder + ' reorder reminders, ' + s.sentLast30.winBack + ' win-backs.</li>' +
      '<li>' + plural(s.ordersAfterMessage, 'order', 'orders') + (s.amountAfterMessage ? ' worth ' + money(s.amountAfterMessage) : '') +
      ' came in within ' + s.followUpWindowDays + ' days after a reminder or win-back. This shows timing, not proof that the message caused the order.</li>' +
      '</ul><p class="muted small">Tip: compare your repeat rate month by month. If it climbs after you start sending reminders, they are working.</p></div>';
  }

  /* ---------- SETTINGS ---------- */

  function renderSettings() {
    var f = $('#settingsForm');
    var s = state.settings;
    if (!f.contains(document.activeElement)) {
      f.elements.shopName.value = s.shopName || '';
      f.elements.countryCode.value = s.countryCode || '254';
      f.elements.leadDays.value = s.leadDays;
      f.elements.winBackMultiplier.value = s.winBackMultiplier;
      f.elements.thankYouWindowDays.value = s.thankYouWindowDays;
      f.elements.upcomingDays.value = s.upcomingDays;
      f.elements.followUpWindowDays.value = s.followUpWindowDays;
      f.elements.thankYouFirstOrderOnly.checked = !!s.thankYouFirstOrderOnly;
      f.elements.showPromo.checked = !!s.showPromo;
    }
    $('#optOutList').innerHTML = state.optOut.length ? '<ul class="plain">' + state.optOut.map(function (p) {
      return '<li>' + esc(C.formatPhone(p)) + ' <button type="button" class="link-btn" data-action="remove-optout" data-phone="' + esc(p) + '">Remove</button></li>';
    }).join('') + '</ul>' : '<p class="muted small">Nobody on the STOP list.</p>';
  }

  function num(v, def, min, max) {
    var n = parseFloat(v);
    if (!isFinite(n)) return def;
    return Math.min(max, Math.max(min, n));
  }

  function onSettingsSubmit(e) {
    e.preventDefault();
    var f = e.target;
    var d = C.DEFAULT_SETTINGS;
    var s = state.settings;
    s.shopName = f.elements.shopName.value.trim();
    s.countryCode = (f.elements.countryCode.value || '254').replace(/\D/g, '') || '254';
    s.leadDays = num(f.elements.leadDays.value, d.leadDays, 0, 30);
    s.winBackMultiplier = num(f.elements.winBackMultiplier.value, d.winBackMultiplier, 1.5, 6);
    s.thankYouWindowDays = num(f.elements.thankYouWindowDays.value, d.thankYouWindowDays, 0, 14);
    s.upcomingDays = num(f.elements.upcomingDays.value, d.upcomingDays, 1, 30);
    s.followUpWindowDays = num(f.elements.followUpWindowDays.value, d.followUpWindowDays, 1, 60);
    s.thankYouFirstOrderOnly = f.elements.thankYouFirstOrderOnly.checked;
    s.showPromo = f.elements.showPromo.checked;
    save();
    $('#settingsMsg').textContent = 'Saved.';
    $('#settingsMsg').className = 'form-msg ok';
    render();
  }

  function addOptOut(phoneDigits) {
    if (state.optOut.indexOf(phoneDigits) < 0) state.optOut.push(phoneDigits);
    save();
  }

  function loadDemo() {
    var d = window.ReorderDemo.build(today(), C);
    state.orders = state.orders.filter(function (o) { return !o.demo; });
    state.log = state.log.filter(function (l) { return !l.demo; });
    d.products.forEach(function (p) {
      var existing = findProduct(p.name);
      if (!existing) state.products.push({ id: C.makeId(), name: p.name, lastsDays: p.lastsDays, demo: true });
    });
    state.orders = state.orders.concat(d.orders);
    state.log = state.log.concat(d.log);
    if (!state.settings.shopName) state.settings.shopName = 'Demo Pet & Home';
    save();
    showTab('today');
    toast('Demo data loaded. WhatsApp will not open for demo customers.');
  }

  function clearDemo() {
    state.orders = state.orders.filter(function (o) { return !o.demo; });
    state.log = state.log.filter(function (l) { return !l.demo; });
    var used = {};
    state.orders.forEach(function (o) { used[o.product.trim().toLowerCase()] = true; });
    state.products = state.products.filter(function (p) { return !p.demo || used[p.name.trim().toLowerCase()]; });
    if (state.settings.shopName === 'Demo Pet & Home') state.settings.shopName = '';
    save();
    render();
    toast('Demo data removed.');
  }

  function backup() {
    download('reorder-desk-backup-' + today() + '.json', JSON.stringify(state, null, 2), 'application/json');
  }

  function restore(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(String(reader.result || ''));
        if (!data || !Array.isArray(data.orders)) throw new Error('not a backup');
        if (!confirm('Replace everything on this device with this backup (' + plural(data.orders.length, 'order', 'orders') + ')?')) return;
        state = upgrade(data);
        save();
        render();
        toast('Backup restored.');
      } catch (e) {
        toast('That file is not a Reorder Desk backup.');
      }
      $('#restoreFile').value = '';
    };
    reader.readAsText(file);
  }

  /* ---------- render ---------- */

  function render() {
    var s = state.settings;
    $('#shopLine').textContent = s.shopName || 'Set your shop name in Settings';
    var t = new Date();
    $('#todayLine').textContent = t.toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short' });
    $('#promo').hidden = !s.showPromo;
    renderToday();
    if (currentTab === 'orders') renderOrders();
    if (currentTab === 'products') renderProducts();
    if (currentTab === 'messages') renderMessages();
    if (currentTab === 'report') renderReport();
    if (currentTab === 'settings') renderSettings();
  }

  /* ---------- events ---------- */

  document.addEventListener('click', function (e) {
    var tabBtn = e.target.closest('.tabs button[data-tab]');
    if (tabBtn) { showTab(tabBtn.getAttribute('data-tab')); return; }
    var el = e.target.closest('[data-action]');
    if (!el) return;
    var action = el.getAttribute('data-action');
    var key = el.getAttribute('data-key');
    var item;
    switch (action) {
      case 'go':
        showTab(el.getAttribute('data-tab'));
        break;
      case 'send':
        item = queueItem(key);
        if (!item) return;
        if (item.demo) {
          e.preventDefault();
          copyText(C.buildMessage(item, state.settings, state.templates));
          var demoEntry = logItem(item, false);
          render();
          toast('Demo customer: WhatsApp did not open. The message is copied.', function () { undoLog(demoEntry.id); });
          return;
        }
        var entry = logItem(item, false);
        // Let the link open WhatsApp, then refresh the list.
        setTimeout(function () {
          render();
          toast('Marked as sent to ' + esc(item.name || C.formatPhone(item.phone)) + '.', function () { undoLog(entry.id); });
        }, 50);
        break;
      case 'copy':
        item = queueItem(key);
        if (!item) return;
        copyText(C.buildMessage(item, state.settings, state.templates)).then(function (ok) {
          toast(ok ? 'Message copied.' : 'Could not copy. Open "Message" and copy it by hand.');
        });
        break;
      case 'skip':
        item = queueItem(key);
        if (!item) return;
        var skipEntry = logItem(item, true);
        render();
        toast('Skipped.', function () { undoLog(skipEntry.id); });
        break;
      case 'stop':
        item = queueItem(key);
        if (!item) return;
        if (!confirm('Add ' + (item.name || C.formatPhone(item.phone)) + ' to the STOP list? They will not be suggested again.')) return;
        addOptOut(item.phone);
        render();
        toast('Added to the STOP list.', function () {
          state.optOut = state.optOut.filter(function (p) { return p !== item.phone; });
          save();
          render();
        });
        break;
      case 'undo-log':
        undoLog(el.getAttribute('data-id'));
        break;
      case 'import-csv':
        onImport();
        break;
      case 'export-orders':
        exportOrders();
        break;
      case 'delete-order':
        var id = el.getAttribute('data-id');
        var o = state.orders.filter(function (x) { return x.id === id; })[0];
        if (!o || !confirm('Delete this order (' + (o.name || C.formatPhone(o.phone)) + ', ' + o.product + ')?')) return;
        state.orders = state.orders.filter(function (x) { return x.id !== id; });
        save();
        render();
        break;
      case 'delete-product':
        var pid = el.getAttribute('data-id');
        var p = state.products.filter(function (x) { return x.id === pid; })[0];
        if (!p || !confirm('Delete the product "' + p.name + '"? Its orders stay, but get no reminders until you add it again.')) return;
        state.products = state.products.filter(function (x) { return x.id !== pid; });
        save();
        render();
        break;
      case 'reset-template':
        var type = el.getAttribute('data-type');
        var lang = state.settings.lang === 'sw' ? 'sw' : 'en';
        state.templates[lang][type] = C.DEFAULT_TEMPLATES[lang][type];
        save();
        renderMessages();
        break;
      case 'remove-optout':
        var ph = el.getAttribute('data-phone');
        state.optOut = state.optOut.filter(function (x) { return x !== ph; });
        save();
        render();
        break;
      case 'backup':
        backup();
        break;
      case 'load-demo':
        loadDemo();
        break;
      case 'clear-demo':
        clearDemo();
        break;
      case 'clear-all':
        if (!confirm('Delete all orders, products, messages and settings on this device? Download a backup first if you might need them.')) return;
        state = emptyState();
        save();
        showTab('today');
        toast('Everything deleted.');
        break;
    }
  });

  document.addEventListener('change', function (e) {
    var el = e.target;
    if (el.getAttribute('data-action') === 'set-days') {
      var p = state.products.filter(function (x) { return x.id === el.getAttribute('data-id'); })[0];
      if (!p) return;
      var v = parseInt(el.value, 10);
      p.lastsDays = v > 0 ? v : null;
      save();
      render();
      toast('Saved ' + esc(p.name) + (v > 0 ? ': ' + v + ' days.' : '.'));
    }
    if (el.id === 'langSelect') {
      state.settings.lang = el.value === 'sw' ? 'sw' : 'en';
      save();
      render();
    }
    if (el.id === 'restoreFile' && el.files[0]) restore(el.files[0]);
  });

  document.addEventListener('input', function (e) {
    if (e.target.getAttribute('data-template')) onTemplateInput(e);
    if (e.target.id === 'orderSearch') renderOrders();
    if (e.target.id === 'calcPack' || e.target.id === 'calcDaily') updateCalc();
  });

  $('#orderForm').addEventListener('submit', onOrderSubmit);
  $('#productForm').addEventListener('submit', onProductSubmit);
  $('#settingsForm').addEventListener('submit', onSettingsSubmit);
  $('#optOutForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var r = C.normalizePhone($('#optOutPhone').value, state.settings.countryCode);
    if (!r.ok) { toast('Check that number: ' + esc(r.reason) + '.'); return; }
    addOptOut(r.digits);
    $('#optOutPhone').value = '';
    render();
  });

  // Re-check the list when the phone wakes up on a new day.
  document.addEventListener('visibilitychange', function () { if (!document.hidden) render(); });

  var start = (location.hash || '').replace('#', '');
  save();
  showTab(['today', 'orders', 'products', 'messages', 'report', 'settings'].indexOf(start) >= 0 ? start : 'today');

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register('sw.js').catch(function () { /* offline cache is optional */ });
  }
}());
