<p align="center"><img src="assets/icon.svg" width="72" height="72" alt="Reorder Desk icon"></p>

<h1 align="center">Reorder Desk</h1>

<p align="center"><b>Free WhatsApp reorder reminders for small shops.</b><br>
Every morning it tells you who to thank, who is about to run out, and who has gone quiet.<br>
One tap opens the message in WhatsApp, ready to send. No server, no sign-up, no monthly fee.</p>

<p align="center">
<a href="#quick-start">Quick start</a> ·
<a href="#how-it-works">How it works</a> ·
<a href="#why-reorder-desk">Why</a> ·
<a href="docs/shop-owner-guide.md">Shop owner guide</a> ·
<a href="#kwa-kiswahili">Kiswahili</a> ·
<a href="#done-for-you-setup">Done-for-you setup</a>
</p>

---

## The problem

Pet food, coffee, baby wipes, skincare, gas refills, animal feed: these run out on a schedule. When they run out, your customer buys again from whichever shop they see first.

Big online stores send a reminder a few days before. Small shops on WhatsApp rarely do, because nobody has time to remember which of 300 customers is due this week.

## What Reorder Desk does

| Today it shows you | When | Example message |
|---|---|---|
| **Thank-yous** | Within 3 days of a customer's first order | "Hi Wanjiku, thank you for ordering Dog food 3kg from Mbwa Bora!…" |
| **Reorder reminders** | A few days before the product runs out | "Hi Wanjiku, your Dog food 3kg should be running low about now. Shall we send the same again?…" |
| **Win-backs** | When a customer has been quiet for twice the product's life | "Hi Wanjiku, we have missed you at Mbwa Bora!…" |

Tap **Send on WhatsApp** and the message opens in WhatsApp or WhatsApp Business with the customer's number filled in. You read it, press send, done. Reorder Desk marks it as sent so it never asks twice.

### Features

- **One-tap WhatsApp** messages through `wa.me` links. Works with the free WhatsApp and WhatsApp Business apps, on Android, iPhone and computer.
- **English and Kiswahili** message templates, fully editable, with a live preview.
- **Smart timing**: set how many days each product lasts once (there is a pack-size calculator), and every reminder date is worked out for you. Buying two bags pushes the reminder out twice as far.
- **Import from a spreadsheet**: CSV from Excel, Google Sheets or your shop dashboard. Loose headers are understood (`Customer Name`, `WhatsApp Number`, `Item`, `Order Date`…), Kenyan day-first dates (`25/11/2026`) are read correctly, and duplicates are skipped.
- **Kenyan numbers just work**: `0712 345 678`, `712345678`, `+254 712 345 678` and `0112…` all become the right WhatsApp number. Other countries work too.
- **STOP list**: when a customer says stop, one tap and they are never suggested again.
- **Report**: repeat-customer rate, messages sent, and orders that came in after a reminder.
- **Private by design**: no server, no account, no analytics. Your customer list stays in your phone's browser. Download a backup any time.
- **Works offline** and installs on your home screen like an app.
- **Demo mode** to try everything with made-up customers. WhatsApp never opens for demo customers.

## Quick start

**Use it in your browser:** open [nimrodogachi.github.io/reorder-desk](https://nimrodogachi.github.io/reorder-desk/), then tap *Try it with demo data*.

**Run your own copy:**

```bash
git clone https://github.com/Nimrodogachi/reorder-desk.git
cd reorder-desk
python3 -m http.server 8080
# open http://localhost:8080
```

You can also download the ZIP and open `index.html` directly. Everything except the offline cache works from a file.

**Host it free** on GitHub Pages (Settings → Pages → Deploy from branch → `main` / root) or Netlify (drag the folder in). There is nothing to build.

**Install on a phone:** open the hosted link in Chrome, then menu → *Add to Home screen*.

## How it works

Reorder Desk uses one simple timing rule, which you can change in Settings:

```
reminder day = days the product lasts × quantity − 3 days (never before day 1)
win-back day = days the product lasts × quantity × 2
```

Example: a 3 kg bag of dog food at 150 g a day lasts 20 days. A customer who buys on 1 November gets a reminder on 18 November. If they still have not ordered anything by 11 December, they show up for a win-back.

Rules that keep it polite:

- A new order resets that customer's timer. Nobody gets reminded for something they just bought.
- A customer who buys something else is not "quiet", so they get no win-back.
- Thank-yous go only to first-time customers (you can change this).
- Every message ends with a way to stop. Customers on the STOP list are skipped.

### CSV format

Only three columns are required. Header names are flexible.

```csv
name,phone,product,date,qty,amount
Wanjiku Kamau,0712 345 678,Dog food 3kg,01/11/2026,1,2450
Otieno Ouma,+254 722 000 111,Coffee beans 500g,2026-10-28,2,2700
```

See [`sample/sample-orders-DEMO.csv`](sample/sample-orders-DEMO.csv). Rows with `demo` set to `yes` are treated as demo customers.

## Why Reorder Desk

Reorder reminders are a proven idea, but the tools that do it were built for big stores.

| | Shopify reorder-reminder apps | WhatsApp CRMs on the WhatsApp API | **Reorder Desk** |
|---|---|---|---|
| Monthly cost | About $10 to $299 a month, by plan (4 apps checked, Nov 2026) | Hosting, plus Meta's per-message fees on the WhatsApp Business Platform | **Free** |
| Channel | Mostly email | WhatsApp | **WhatsApp**, the app your customers already use |
| What you need | A Shopify store | A server and a WhatsApp Business API account | **A phone with a browser** |
| Where customer data lives | The app's servers | Your server | **Only on your device** |
| Kiswahili messages | You write them | You write them | **Built in** |
| Setup time | Store integration | Technical setup | **About 10 minutes** |

Reorder Desk sends nothing by itself. You stay in control of every message, which is also why it costs nothing to run: it opens your normal WhatsApp chat instead of using a paid messaging API.

## Consent and the law

Only message customers who agreed to hear from your shop, and stop at once when someone says stop. In Kenya, the Data Protection Act 2019 expects consent or an easy opt-out for direct marketing. Reorder Desk helps (consent tick boxes, STOP line in every template, STOP list) but this is not legal advice.

## Kwa Kiswahili

**Reorder Desk** ni programu ya bure inayokuonyesha kila siku wateja wa kushukuru, wateja ambao bidhaa zao zinakaribia kuisha, na wateja ambao hawajanunua kwa muda. Bonyeza mara moja na ujumbe unafunguka kwenye WhatsApp, tayari kutumwa. Hakuna seva, hakuna usajili, na data ya wateja wako inabaki kwenye simu yako.

1. Weka bidhaa zako na siku ngapi kila moja inadumu.
2. Ongeza oda zako, au uzilete kutoka kwenye faili la CSV (jina, namba ya WhatsApp, bidhaa, tarehe).
3. Kila asubuhi fungua **Today** na utume ujumbe ulioorodheshwa.

Chagua *Kiswahili* kwenye ukurasa wa **Messages** ili ujumbe uende kwa Kiswahili.

## Done-for-you setup

Reorder Desk is made by **[Repeat Foundry](https://repeatfoundry.netlify.app)** in Eldoret, Kenya. If you would rather have someone set up your thank-you, reorder and win-back messages for you, on WhatsApp Business, Shopify, Mailchimp, Klaviyo or WooCommerce, see the [Repeat-Order Setup](https://repeatfoundry.netlify.app).

## Support the project

If Reorder Desk brings your customers back, a star on GitHub helps other shops find it. You can also support development through the Sponsor button on this repository.

## Roadmap

- [ ] Kiswahili screens (messages are already bilingual)
- [ ] Message packs for common shop types (pet, baby, beauty, coffee, farm inputs, gas)
- [ ] Import straight from Shopify and WooCommerce order exports
- [ ] Printable "who to message this week" sheet
- [ ] Sheng and other language templates from the community

Ideas welcome in [Issues](../../issues).

## Contributing

Plain HTML, CSS and JavaScript with no build step. Tests use Node's built-in test runner.

```bash
npm test            # core logic (no install needed)
npm install && npm run test:ui   # page smoke tests in jsdom
```

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE). Free to use, change and share, including in paid work.
