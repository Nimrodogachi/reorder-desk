# Contributing to Reorder Desk

Thank you for helping small shops bring their customers back.

## Ground rules

- Keep it simple: plain HTML, CSS and JavaScript, no build step, no framework.
- Keep it private: no server calls, no analytics, no third-party scripts. Customer data must never leave the device.
- Keep it light: it has to run well on a low-cost Android phone on a slow connection.
- Respect customers: every default message must include a way to stop.

## Project layout

```
index.html          the page
css/styles.css      styles (light and dark)
js/core.js          pure logic: dates, phone numbers, CSV, timing, queue, stats
js/app.js           screens, buttons and storage
js/demo.js          made-up demo customers
sw.js               offline cache
tests/              node:test tests (core) and jsdom smoke tests (ui)
```

Put any logic that can be tested in `js/core.js` and add a test in `tests/core.test.js`.

## Running tests

```bash
npm test                          # no install needed
npm install && npm run test:ui    # page tests
```

## Translations

Message templates live in `DEFAULT_TEMPLATES` in `js/core.js`. New languages and better Kiswahili wording are very welcome: open a pull request and say which region the wording suits.

## Reporting a problem

Open an issue with your phone model, browser, and what you expected to happen. Never paste real customer names or numbers into an issue.
