const fs = require('node:fs');
const path = require('node:path');
const {
  SITE_ORIGIN, SITE_NAME, PUBLIC_PAGES, ALIASES, NAVIGATION, getPageSeo, getStructuredData
} = require('../src/seo/siteSeo');

const build = path.resolve(__dirname, '../build');
const template = fs.readFileSync(path.join(build, 'index.html'), 'utf8');
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));

const searchOverviewCss = fs.readFileSync(path.resolve(__dirname, '../public/search-overview.css'), 'utf8');

function renderHead(seo) {
  const meta = (attribute, name, content) => `<meta ${attribute}="${name}" content="${escapeHtml(content)}">`;
  return [
    `<title>${escapeHtml(seo.title)}</title>`,
    `<link rel="canonical" href="${seo.canonical}">`,
    meta('name', 'description', seo.description), meta('name', 'robots', seo.robots),
    meta('name', 'thumbnail', seo.image),
    `<link rel="image_src" href="${escapeHtml(seo.image)}">`,
    meta('property', 'og:site_name', SITE_NAME),
    meta('property', 'og:type', 'website'), meta('property', 'og:title', seo.title),
    meta('property', 'og:description', seo.description), meta('property', 'og:url', seo.canonical),
    meta('property', 'og:image', seo.image),
    meta('property', 'og:image:secure_url', seo.image),
    meta('property', 'og:image:width', '1200'), meta('property', 'og:image:height', '630'),
    meta('property', 'og:image:type', 'image/jpeg'), meta('property', 'og:image:alt', seo.title),
    meta('property', 'og:locale', 'en_IN'),
    meta('name', 'twitter:card', 'summary_large_image'),
    meta('name', 'twitter:title', seo.title), meta('name', 'twitter:description', seo.description),
    meta('name', 'twitter:image', seo.image),
    `<style id="search-overview-css">${searchOverviewCss}</style>`,
    `<script id="hss-structured-data" type="application/ld+json">${JSON.stringify(getStructuredData(seo)).replace(/</g, '\\u003c')}</script>`
  ].join('\n');
}

const link = (route) => `<a href="${route}">${escapeHtml(PUBLIC_PAGES[route]?.label || 'Open Online Portal')}</a>`;

function renderHydrationBar() {
  return `<a href="#main-content" class="hss-skip-link">Skip to main content</a>
  <div class="hss-hydration-indicator" aria-hidden="true" role="progressbar">
    <div class="hss-hydration-bar"></div>
  </div>`;
}

function renderOverview(page) {
  return `${renderHydrationBar()}<div class="search-overview">
    <header class="search-overview__header">
      <a href="/" class="search-overview__brand"><img src="/logo.png" width="52" height="52" alt="Govt HSS Shangus school crest"><span>HSS Shangus<small>Govt. Higher Secondary School Shangus • Estd. 1917</small></span></a>
      <nav aria-label="Main navigation">${NAVIGATION.map(link).join(' ')}</nav>
    </header>
    <main class="search-overview__main" id="main-content">
      <div class="search-overview__eyebrow">Shangus · Anantnag · Jammu and Kashmir · Estd. 1917</div>
      <h1>${escapeHtml(page.heading)}</h1>
      <figure class="search-overview__hero-media" style="margin: 0 0 24px 0; border-radius: 12px; overflow: hidden; border: 1px solid #d9e5e1; max-width: 100%;">
        <img src="/slides/og-card.webp" width="1200" height="630" alt="${escapeHtml(page.heading)} - Govt. Higher Secondary School Shangus" style="width: 100%; height: auto; display: block; object-fit: cover;" fetchpriority="high" decoding="async">
      </figure>
      ${page.paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('\n')}
      <nav aria-label="Related pages" class="search-overview__links">${page.links.map(link).join(' ')}</nav>
      <noscript><p class="search-overview__note">This page provides a public overview. Enable JavaScript for interactive services, forms and live portals.</p></noscript>
    </main>
    <footer class="search-overview__footer">${['/privacy-policy', '/terms-and-conditions', '/refund-policy', '/contact'].map(link).join(' ')}</footer>
  </div>`;
}

// The CRA template contains only a generic app shell. Each public route receives
// its own HTML overview, metadata and schema; the full React app then mounts.
// No browser session, private records or remote database access enters the build.
const shell = template
  .replace(/<title>[\s\S]*?<\/title>/i, '<title>HSS Shangus</title>')
  .replace(
    /<link href="(\/static\/css\/main\.[^"]+\.css)" rel="stylesheet">/i,
    '<link rel="preload" as="style" href="$1"><link href="$1" rel="stylesheet">'
  );
fs.writeFileSync(path.join(build, 'app-shell.html'), shell);
const routes = Object.keys(PUBLIC_PAGES);
for (const route of routes) {
  const head = shell.replace(/<title>[\s\S]*?<\/title>/i, '').replace('</head>', `${renderHead(getPageSeo(route))}</head>`);
  const html = head.replace(/<body>[\s\S]*<\/body>/i, `<body><div id="root">${renderOverview(PUBLIC_PAGES[route])}</div></body>`);
  if (html === head) throw new Error('Could not replace the CRA body with the public overview.');
  if (route === '/') {
    fs.writeFileSync(path.join(build, 'index.html'), html);
  } else {
    fs.writeFileSync(path.join(build, `${route.slice(1)}.html`), html);
    const routeDir = path.join(build, route.slice(1));
    if (!fs.existsSync(routeDir)) fs.mkdirSync(routeDir, { recursive: true });
    fs.writeFileSync(path.join(routeDir, 'index.html'), html);
  }
}

// Keep stable public URLs. Only aliases redirect; React's private/CMS routes
// continue through the generic shell, which has no homepage canonical.
const redirectsPath = path.join(build, '_redirects');
const redirects = fs.readFileSync(redirectsPath, 'utf8');
const catchAll = /^\/\*\s+\/app-shell\.html\s+200\s*$/m;
if (!catchAll.test(redirects)) throw new Error('Expected the generic SPA fallback in public/_redirects.');
const publicRules = [
  '/index.html / 301!',
  ...Object.entries(ALIASES).flatMap(([alias, canonical]) => [
    `${alias} ${canonical} 301!`, `${alias}/ ${canonical} 301!`
  ]),
  ...routes.filter((route) => route !== '/').map((route) => `${route}.html ${route} 301!`)
];
fs.writeFileSync(redirectsPath, redirects.replace(catchAll, `${publicRules.join('\n')}\n/* /app-shell.html 200\n`));

// Omit made-up lastmod dates: live notices and fees change independently of Git.
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${routes.map((route) => `  <url><loc>${SITE_ORIGIN}${route}</loc></url>`).join('\n')}\n</urlset>\n`;
fs.writeFileSync(path.join(build, 'sitemap.xml'), sitemap);
console.log(`Generated ${routes.length} public HTML pages, canonical redirects and sitemap.xml.`);
