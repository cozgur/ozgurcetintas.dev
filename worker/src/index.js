// Relays what visitors do on ozgurcetintas.dev to a Telegram chat: a visit, a CV
// download, a link click. The bot token lives here as a secret so the page never
// carries it. Nothing identifying is forwarded: no IP, no user agent, only the
// country Cloudflare resolves, the referring host and a random per-session tag.
const ORIGIN = 'https://ozgurcetintas.dev';
const TYPES = new Set(['visit', 'cv', 'link']);

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') return new Response('Not found', { status: 404 });
    if (request.headers.get('Origin') !== ORIGIN) return new Response('Forbidden', { status: 403 });

    let event;
    try {
      event = JSON.parse(await request.text());
    } catch {
      return new Response('Bad request', { status: 400 });
    }
    if (!event || !TYPES.has(event.type)) return new Response('Bad request', { status: 400 });

    // One shared budget for the whole site, so a script that finds the endpoint
    // cannot flood the chat. The limit itself is in wrangler.toml.
    const { success } = await env.LIMITER.limit({ key: 'site' });
    if (!success) return new Response('Too many requests', { status: 429 });

    // Tolerate stray whitespace or a pasted "bot" prefix around the stored secret.
    const token = env.TELEGRAM_TOKEN.trim().replace(/^bot/, '');
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: env.TELEGRAM_CHAT_ID.trim(),
        text: describe(event, request.cf?.country),
        disable_web_page_preview: true,
      }),
    });
    if (!response.ok) console.log('telegram rejected', response.status, (await response.json()).description);
    return new Response(null, { status: response.ok ? 204 : 502 });
  },
};

function describe(event, country) {
  const tag = `#${clip(event.session, 6) || '?'}`;
  const time = new Date().toLocaleString('en-GB', {
    timeZone: 'Europe/Amsterdam',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  if (event.type === 'visit') {
    const from = clip(event.referrer, 60) || 'direct';
    const device = event.device === 'mobile' ? 'mobile' : 'desktop';
    return `👀 Visit · from ${from} · ${country || '??'} · ${device} · ${time} · ${tag}`;
  }
  if (event.type === 'cv') return `📄 CV downloaded · ${time} · ${tag}`;
  return `🔗 "${clip(event.label, 40)}" → ${clip(event.target, 80)} · ${time} · ${tag}`;
}

const clip = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '');
