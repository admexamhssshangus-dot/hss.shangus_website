const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');
const { SITE_ORIGIN, PUBLIC_PAGES } = require('../src/seo/siteSeo');
const build = path.resolve(__dirname, '../build');
const read = (name) => fs.readFileSync(path.join(build, name), 'utf8');

async function check() {
  const sitemap = new JSDOM(read('sitemap.xml'), { contentType: 'text/xml' }).window.document;
  const urls = [...sitemap.querySelectorAll('loc')].map((node) => node.textContent);
  assert.equal(new Set(urls).size, urls.length, 'Sitemap must not contain duplicate URLs');
  assert.deepEqual(urls, Object.keys(PUBLIC_PAGES).map((route) => `${SITE_ORIGIN}${route}`));
  assert.equal(read('sitemap.xml'), fs.readFileSync(path.resolve(__dirname, '../public/sitemap.xml'), 'utf8'), 'Source sitemap must match public routes');
  const titles = new Set();
  const descriptions = new Set();
  const redirects = read('_redirects');

  for (const url of urls) {
    const route = new URL(url).pathname;
    const html = read(route === '/' ? 'index.html' : `${route.slice(1)}.html`);
    const doc = new JSDOM(html).window.document;
    assert.equal(doc.querySelectorAll('title').length, 1, `${route}: duplicate title`);
    assert.equal(doc.querySelectorAll('link[rel="canonical"]').length, 1, `${route}: duplicate canonical`);
    assert.equal(doc.querySelector('link[rel="canonical"]').href, url);
    assert.equal(doc.querySelectorAll('meta[name="description"]').length, 1);
    assert.match(doc.querySelector('meta[name="robots"]').content, /^index, follow/);
    assert.equal(doc.querySelector('meta[property="og:url"]').content, url);
    assert.equal(doc.querySelector('meta[property="og:title"]').content, doc.title);
    assert.equal(doc.querySelector('meta[name="twitter:title"]').content, doc.title);
    assert.equal(doc.querySelector('meta[property="og:site_name"]').content, 'HSS Shangus');
    assert.equal(doc.querySelectorAll('#root h1').length, 1, `${route}: missing crawlable heading`);
    assert.ok(doc.querySelector('#root main').textContent.length > 180, `${route}: missing page overview`);
    assert.ok(doc.querySelector('#root nav a[href="/admissions"]'), `${route}: missing crawlable navigation`);
    assert.ok(doc.querySelector('script[defer][src*="/static/js/"]'), `${route}: React bootstrap missing`);
    assert.ok(doc.querySelector('meta[name="google-site-verification"]'), 'Preserve Search Console verification');
    assert.equal(doc.querySelectorAll('script[type="application/ld+json"]').length, 1);
    const graph = JSON.parse(doc.querySelector('#hss-structured-data').textContent)['@graph'];
    assert.equal(graph.find((item) => item['@type'] === 'WebSite').name, 'HSS Shangus');
    assert.equal(graph.find((item) => item['@type'] === 'WebPage').url, url);
    assert.ok(!html.includes('search_term_string'), 'Do not advertise a nonexistent site search');
    const breadcrumb = graph.find((item) => item['@type'] === 'BreadcrumbList');
    if (route === '/') assert.equal(breadcrumb, undefined);
    else {
      assert.equal(breadcrumb.itemListElement.length, 2);
      assert.ok(fs.existsSync(path.join(build, route.slice(1), 'index.html')), `${route}: missing directory index.html`);
      assert.ok(redirects.includes(`${route}.html ${route} 301!`), `${route}: .html not normalized to canonical`);
      assert.ok(redirects.includes(`${route}/ ${route} 301!`), `${route}: trailing slash not normalized`);
    }
    titles.add(doc.title);
    descriptions.add(doc.querySelector('meta[name="description"]').content);
  }
  assert.equal(titles.size, urls.length, 'Public titles must be distinct');
  assert.equal(descriptions.size, urls.length, 'Public descriptions must be distinct');
  const shellDoc = new JSDOM(read('app-shell.html')).window.document;
  assert.equal(shellDoc.querySelector('link[rel="canonical"]'), null, 'SPA fallback must not canonicalize unknown routes to home');
  assert.equal(shellDoc.querySelector('meta[name="robots"]'), null, 'Do not preempt indexing of dynamic public pages');
  assert.equal(shellDoc.querySelector('script[type="application/ld+json"]'), null);
  assert.ok(redirects.includes('/contact-us /contact 301!'));
  assert.ok(redirects.includes('/verify /verify-student 301!'));
  assert.ok(redirects.trim().endsWith('/* /app-shell.html 200'));
  assert.ok(redirects.indexOf('/slides/admins.json') < redirects.indexOf('/* /app-shell.html'), 'Preserve privacy-removal rules');
  const robots = read('robots.txt');
  assert.ok(robots.includes('User-agent: *'));
  assert.ok(robots.includes(`Sitemap: ${SITE_ORIGIN}/sitemap.xml`));
  assert.ok(!urls.some((url) => /\/portal|\/admin|\/verify/.test(url)), 'Private and verification pages stay out of sitemap');
  const config = fs.readFileSync(path.resolve(__dirname, '../netlify.toml'), 'utf8');
  for (const route of ['/portal', '/portal/*', '/admin', '/admin/*', '/verify-student', '/verify-student/*']) {
    const block = config.split('[[headers]]').find((item) => item.includes(`for = "${route}"`));
    assert.ok(block?.includes('X-Robots-Tag = "noindex, follow"'), `${route}: missing HTTP noindex`);
  }

  // Exercise the service worker: two page visits must retain distinct offline
  // HTML, and an uncached route must receive the generic shell, never another page.
  const stored = new Map([['/app-shell.html', new Response('generic shell')]]);
  const cacheKey = (request) => new URL(typeof request === 'string' ? request : request.url, SITE_ORIGIN).pathname;
  const cache = { put: async (request, response) => stored.set(cacheKey(request), response) };
  const handlers = {};
  let offline = false;
  vm.runInNewContext(read('service-worker.js'), {
    self: { location: { origin: SITE_ORIGIN }, addEventListener: (type, handler) => { handlers[type] = handler; } },
    caches: { open: async () => cache, match: async (request) => stored.get(cacheKey(request))?.clone() },
    URL,
    fetch: async (request) => {
      if (offline) throw new Error('offline');
      return new Response(cacheKey(request), { headers: { 'Cache-Control': request.url.includes('/portal') ? 'no-store' : 'public' } });
    }
  });
  async function navigate(route) {
    let response;
    const work = [];
    handlers.fetch({
      request: { method: 'GET', mode: 'navigate', credentials: 'same-origin', url: `${SITE_ORIGIN}${route}` },
      respondWith: (promise) => { response = promise; }, waitUntil: (promise) => work.push(promise)
    });
    const result = await response;
    await Promise.all(work);
    return result.text();
  }
  await navigate('/about');
  await navigate('/admissions');
  await navigate('/portal/login');
  assert.ok(!stored.has('/portal/login'));
  offline = true;
  assert.equal(await navigate('/about'), '/about');
  assert.equal(await navigate('/admissions'), '/admissions');
  assert.equal(await navigate('/uncached-page'), 'generic shell');
  console.log(`SEO checks passed: ${urls.length} pages, static metadata/content, sitemap, routing, privacy headers and offline navigation.`);
}

check().catch((error) => { console.error(error); process.exitCode = 1; });
