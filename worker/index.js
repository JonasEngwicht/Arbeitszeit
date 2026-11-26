// Cloudflare Worker: Weiterleitungen + Sicherheits-/Cache-Header, danach statische Dateien.
const MAIN = 'derarbeitszeitrechner.de';
const REDIRECT_HOSTS = new Set(['www.derarbeitszeitrechner.de', 'derstundenrechner.de', 'www.derstundenrechner.de']);

const SECURITY = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'SAMEORIGIN',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'",
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (REDIRECT_HOSTS.has(url.hostname)) {
      url.hostname = MAIN;
      url.protocol = 'https:';
      url.port = '';
      return Response.redirect(url.toString(), 301);
    }
    // Saubere URLs: /index.html → /, /impressum.html → /impressum
    if (url.pathname === '/index.html') return Response.redirect(new URL('/', url).toString(), 301);

    const res = await env.ASSETS.fetch(request);
    const out = new Response(res.body, res);
    for (const [k, v] of Object.entries(SECURITY)) out.headers.set(k, v);
    const p = url.pathname;
    if (p.startsWith('/assets/')) out.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    else if (/\.(png|svg|ico|webmanifest)$/.test(p)) out.headers.set('Cache-Control', 'public, max-age=604800');
    else out.headers.set('Cache-Control', 'public, max-age=0, must-revalidate');
    if (url.hostname.endsWith('.workers.dev')) out.headers.set('X-Robots-Tag', 'noindex');
    return out;
  },
};
