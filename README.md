# Lakeside Inn booking page in React, migrated off jQuery UI by Claude Code and checked by Kane CLI

The original page is a hotel booking form built on the [jQuery UI 1.13 Datepicker](https://jqueryui.com/datepicker/): linked check-in and check-out calendars, fully booked nights, a stay-length line, a date-of-birth picker with month and year menus, and an always-visible availability calendar ([the page in Ditto](https://github.com/itssaharsh/ditto/tree/master/fixtures/legacy-datepicker)). [Claude Code](https://code.claude.com) (Sonnet 5.5) rebuilt it here in React 19 + TypeScript + Vite in one headless session, without jQuery or jQuery UI: it wrote its own datepicker in [`src/datepicker/`](src/datepicker).

[Ditto](https://github.com/itssaharsh/ditto) then checked it. Kane CLI designed 12 plain-English tests from the page's spec and ran them on the jQuery UI page first; the 7 that the old page passed, and that replayed cleanly, judged this port. All 7 hold here on the first port, including jQuery UI's habit of moving an existing check-out forward when a later check-in is chosen.

The tests now live in [`tests/kane/`](tests/kane) as this app's regression suite.

```bash
npm install && npm run dev      # or: npm run build
```
