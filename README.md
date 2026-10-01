# ozgurcetintas.dev

Personal portfolio of Özgür Çetintaş, served by GitHub Pages from `site/`.
No build step, no framework: one HTML file, one stylesheet, the same "printed protocol"
design system as [TestPlan Studio](https://github.com/cozgur/testplan-studio).

- `site/index.html` and `site/styles.css`: the page
- `site/CNAME`: apex custom domain
- `scripts/og.html`: source of the share image `site/assets/og.png` (screenshot it at 1200×630)
- `site/app-ads.txt`: authorised sellers for the iOS games' ad inventory
- `worker/`: Cloudflare Worker that relays visits, CV downloads and link clicks to Telegram; deploy with `npx wrangler deploy` from that folder (secrets: `TELEGRAM_TOKEN`, `TELEGRAM_CHAT_ID`). Open the site once with `?me` to stop your own browser reporting.
- `.github/workflows/deploy.yml`: publishes `site/` on every push to `main`

Content changes are edits to `index.html`; the section ledger is plain markup.
