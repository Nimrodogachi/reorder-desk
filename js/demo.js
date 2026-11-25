/*
 * Demo data for Reorder Desk. Every order is marked demo, so the app never
 * opens WhatsApp for these made-up customers. Dates are set relative to today
 * so each list has something to show.
 */
(function (root) {
  'use strict';
  function build(today, C) {
    var products = [
      { name: 'Dog food 3kg', lastsDays: 20 },
      { name: 'Cat litter 10L', lastsDays: 25 },
      { name: 'Coffee beans 500g', lastsDays: 30 },
      { name: 'Baby wipes (3 pack)', lastsDays: 14 },
      { name: 'Face serum 30ml', lastsDays: 45 }
    ];
    // [name, product, days ago, qty, amount]
    var rows = [
      ['Wanjiku Kamau (demo)', 'Dog food 3kg', 1, 1, 2450],
      ['Amina Hassan (demo)', 'Coffee beans 500g', 2, 1, 1350],
      ['Otieno Ouma (demo)', 'Coffee beans 500g', 28, 1, 1350],
      ['Achieng Atieno (demo)', 'Baby wipes (3 pack)', 12, 1, 690],
      ['Mutua Musyoka (demo)', 'Cat litter 10L', 60, 1, 1800],
      ['Mutua Musyoka (demo)', 'Cat litter 10L', 35, 1, 1800],
      ['Kiprop Cheruiyot (demo)', 'Dog food 3kg', 70, 1, 2450],
      ['Njeri Mwangi (demo)', 'Face serum 30ml', 38, 1, 3200],
      ['Wafula Barasa (demo)', 'Dog food 3kg', 15, 2, 4900],
      ['Chebet Rotich (demo)', 'Baby wipes (3 pack)', 40, 1, 690],
      ['Chebet Rotich (demo)', 'Baby wipes (3 pack)', 26, 1, 690]
    ];
    var orders = rows.map(function (r, i) {
      return {
        id: 'demo-o' + i,
        name: r[0],
        phone: '2547000001' + (i < 10 ? '0' + i : i),
        product: r[1],
        date: C.addDays(today, -r[2]),
        qty: r[3],
        amount: r[4],
        demo: true
      };
    });
    // Chebet got a reminder 27 days ago and ordered again the next day.
    var log = [{
      id: 'demo-l1', type: 'reorder', orderId: 'demo-o9', phone: orders[9].phone,
      product: orders[9].product, at: C.addDays(today, -27), demo: true
    }];
    // Same customer shares one number across their orders.
    orders[5].phone = orders[4].phone;
    orders[10].phone = orders[9].phone;
    return { products: products, orders: orders, log: log };
  }
  root.ReorderDemo = { build: build };
}(typeof self !== 'undefined' ? self : this));
