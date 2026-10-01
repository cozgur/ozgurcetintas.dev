// Relays what visitors do on ozgurcetintas.dev to a Telegram chat: a visit, a CV
// download, and a summary when they leave. The bot token lives here as a secret so
// the page never carries it. Forwarded: the tag from a link the owner sent (?r=),
// the referring host, the city and country that Cloudflare resolves, a random
// per-session tag and a daily unique-visitor count. Not forwarded or stored: IP
// address, network name and user agent.
const ORIGIN = 'https://ozgurcetintas.dev';
const TYPES = new Set(['visit', 'cv', 'summary']);

export default {
  async fetch(request, env) {
    const response = await handle(request, env);
    // Lets the page read the status when debugging; beacons ignore it.
    response.headers.set('Access-Control-Allow-Origin', ORIGIN);
    return response;
  },
};

async function handle(request, env) {
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
      text: describe(event, request.cf ?? {}, event.type === 'visit' ? await count(request, env) : null),
      disable_web_page_preview: true,
    }),
  });
  if (!response.ok) console.log('telegram rejected', response.status, (await response.json()).description);
  return new Response(null, { status: response.ok ? 204 : 502 });
}

function describe(event, cf, visitors) {
  const session = `#${clip(event.session, 6) || '?'}`;
  const tag = clip(event.tag, 40);
  const time = new Date().toLocaleString('en-GB', {
    timeZone: 'Europe/Amsterdam',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
  const place = [cf.city, cf.country].filter(Boolean).join(', ') || 'unknown place';

  if (event.type === 'visit') {
    const from = clip(event.referrer, 60) || 'direct';
    const device = event.device === 'mobile' ? 'mobile' : 'desktop';
    const page = event.page === 'cv' ? 'CV link' : 'site';
    const title = tag ? `🎯 ${tag} opened your ${page}` : `👀 Visit (${page})`;
    return lines(title, `from ${from} · ${device} · ${place}`, visitors, `${time} · ${session}`);
  }
  if (event.type === 'cv') return lines(`📄 CV downloaded${tag ? ` · 🎯 ${tag}` : ''}`, place, `${time} · ${session}`);

  const seconds = Math.max(0, Math.min(Math.round(Number(event.seconds) || 0), 6 * 3600));
  const duration = seconds >= 60 ? `${Math.floor(seconds / 60)}m ${seconds % 60}s` : `${seconds}s`;
  const read = list(event.sections, 8) || 'top of the page only';
  const clicked = list(event.clicks, 15) || 'nothing';
  return lines(`🧾 Left after ${duration}${tag ? ` · 🎯 ${tag}` : ''}`, `read: ${read}`, `clicked: ${clicked}`, `${time} · ${session}`);
}

// Counts unique visitors per day the way cookieless analytics do: a SHA-256 of the
// IP and user agent under a salt that changes every day, so a hash cannot be turned
// back into an IP and cannot link one day's visit to the next. Hashes expire after
// two days; only the counts remain. A counting failure never blocks the message.
async function count(request, env) {
  try {
    const day = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' });
    const twoDays = { expirationTtl: 172_800 };

    let salt = await env.VISITORS.get(`salt:${day}`);
    if (!salt) {
      salt = crypto.randomUUID();
      await env.VISITORS.put(`salt:${day}`, salt, twoDays);
    }
    const ip = request.headers.get('CF-Connecting-IP') || '';
    const agent = request.headers.get('User-Agent') || '';
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}|${ip}|${agent}`));
    const hash = [...new Uint8Array(digest).slice(0, 12)].map((b) => b.toString(16).padStart(2, '0')).join('');

    let today = Number(await env.VISITORS.get(`count:${day}`)) || 0;
    let total = Number(await env.VISITORS.get('count:total')) || 0;
    if (await env.VISITORS.get(`seen:${day}:${hash}`)) return `👤 seen earlier today · ${today} today · ${total} total`;

    today += 1;
    total += 1;
    await Promise.all([
      env.VISITORS.put(`seen:${day}:${hash}`, '1', twoDays),
      env.VISITORS.put(`count:${day}`, String(today), { expirationTtl: 34_560_000 }),
      env.VISITORS.put('count:total', String(total)),
    ]);
    return `👤 visitor #${today} today · ${total} total`;
  } catch (error) {
    console.log('count failed', error.message);
    return '';
  }
}

const clip = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '');
const list = (values, max) =>
  Array.isArray(values)
    ? values
        .slice(0, max)
        .map((v) => clip(v, 90))
        .filter(Boolean)
        .join(', ')
    : '';
const lines = (...parts) => parts.filter(Boolean).join('\n');
