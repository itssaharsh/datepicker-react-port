# Behaviour tests (Kane CLI)

These 7 plain-English tests were designed by Kane CLI from the app's spec (`fixtures/datepicker-spec.md` in Ditto), passed on the original jQuery UI app, and were used by [Ditto](https://github.com/itssaharsh/ditto) to check this port until every one passed here too.

Run them against a local build:

```bash
npm run build && npx serve -l 7012 dist   # or any static server on port 7012
kane-cli testrun run tests/kane --parallel 3 < /dev/null
```

The start URL and test values come from `.testmuai/variables/ditto.json`.
