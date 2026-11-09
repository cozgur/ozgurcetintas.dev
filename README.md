# ozgurcetintas.dev

Personal portfolio of Özgür Çetintaş, served by GitHub Pages from `site/`.
No build step, no framework: one HTML file and one stylesheet (Inter, slate and blue).
Bump the `?v=` on the stylesheet link when `styles.css` changes, so browsers drop the cached copy.

- `site/index.html` and `site/styles.css`: the page
- `site/CNAME`: apex custom domain
- `scripts/og.html`: source of the share image `site/assets/og.png` (screenshot it at 1200×630)
- `site/app-ads.txt`: authorised sellers for the iOS games' ad inventory
- `worker/`: retired Cloudflare Worker that used to relay visits to Telegram. The site no longer calls it; the source stays until the deployed worker, its KV namespace and secrets are deleted.
- `.github/workflows/deploy.yml`: publishes `site/` on every push to `main`

Content changes are edits to `index.html`; the section ledger is plain markup.
