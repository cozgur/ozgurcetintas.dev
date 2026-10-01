// Tells the owner, through the worker/ relay, when someone visits, downloads the CV,
// and what they read before leaving. No cookies; a random tag held for the tab's
// session groups one visitor's events. A link sent as ?r=company carries that label.
// Open the page once with ?me to stop a browser from reporting, ?me=off to undo.
(() => {
  const endpoint = 'https://site-notify.ozgur-cetintas.workers.dev/';
  const params = new URLSearchParams(location.search);
  const noop = { send() {} };
  window.siteNotify = noop;

  try {
    const me = params.get('me');
    if (me === 'off') localStorage.removeItem('notify-skip');
    else if (me !== null) localStorage.setItem('notify-skip', '1');
    if (localStorage.getItem('notify-skip')) return;
  } catch {}
  if (navigator.webdriver || /bot|crawl|spider|preview|headless|lighthouse/i.test(navigator.userAgent)) return;
  // Respect the browser's opt-out signals, as the privacy page promises.
  if (navigator.globalPrivacyControl || navigator.doNotTrack === '1') return;

  const store = (key, make) => {
    try {
      const value = sessionStorage.getItem(key) || make();
      if (value) sessionStorage.setItem(key, value);
      return value;
    } catch {
      return make();
    }
  };
  let first = false;
  const session = store('notify-session', () => {
    first = true;
    return Math.random().toString(36).slice(2, 8);
  });
  const tag = store('notify-tag', () => (params.get('r') || '').slice(0, 40));

  // fetch with keepalive rather than sendBeacon: beacons never reached the worker in
  // testing, and keepalive still lets the leaving summary outlive the page.
  const send = (event) => {
    try {
      fetch(endpoint, { method: 'POST', keepalive: true, body: JSON.stringify({ session, tag, ...event }) }).catch(() => {});
    } catch {}
  };
  const visit = (page) => {
    let referrer = '';
    try {
      const from = new URL(document.referrer);
      if (from.host !== location.host) referrer = from.host;
    } catch {}
    send({ type: 'visit', page, referrer, device: matchMedia('(pointer: coarse)').matches ? 'mobile' : 'desktop' });
  };
  window.siteNotify = { send, visit };

  // The /cv redirect page reports on its own and leaves before any summary.
  if (document.documentElement.dataset.notifyPage === 'cv') return;
  if (first) visit('site');

  const names = { impact: 'Impact', ai: 'AI', work: 'Open source', stack: 'Stack', contact: 'Contact' };
  const sections = [];
  const clicks = [];
  const seen = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const name = names[entry.target.id] || entry.target.id;
        if (entry.isIntersecting && !sections.includes(name)) sections.push(name);
      }
    },
    { threshold: 0.35 },
  );
  document.querySelectorAll('main section[id]').forEach((section) => seen.observe(section));

  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href]');
    if (!link) return;
    if (link.hasAttribute('download')) {
      clicks.push('CV');
      return send({ type: 'cv' });
    }
    const label = link.textContent.replace(/[↗↓]/g, '').replace(/\s+/g, ' ').trim();
    const url = new URL(link.href, location.href);
    if (url.protocol === 'mailto:') return clicks.push('email');
    if (url.origin === location.origin) return clicks.push(label);
    clicks.push(`${label} → ${(url.host + url.pathname).replace(/^www\./, '').replace(/\/$/, '')}`);
  });

  // Count only the time the tab is in view, and send a summary each time the
  // visitor leaves it, if anything changed since the last one.
  let visibleMs = 0;
  let since = document.visibilityState === 'visible' ? performance.now() : 0;
  let lastSent = '';
  const leave = () => {
    if (since) visibleMs += performance.now() - since;
    since = 0;
    const seconds = Math.round(visibleMs / 1000);
    const snapshot = JSON.stringify([sections, clicks]);
    if (seconds < 3 || snapshot === lastSent) return;
    lastSent = snapshot;
    send({ type: 'summary', seconds, sections, clicks });
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') since = performance.now();
    else leave();
  });
  // Safari on iOS can close a tab with pagehide and no visibilitychange.
  addEventListener('pagehide', leave);
})();
