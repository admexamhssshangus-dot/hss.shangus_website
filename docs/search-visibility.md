# Search visibility: Google, Bing and Yahoo

The September 8, 2026 screenshots show that Google already indexes the homepage,
with its logo and description, but labels the site “Netlify”. The five URLs in
Search Console's “Discovered – currently not indexed” report have not yet been
crawled. That report alone does not establish a penalty, server overload or a
specific technical cause.

Live HTML checks confirmed that `/`, `/about` and `/academics` all returned 200
with the homepage title and canonical URL, and a loading screen. That conflicting
initial canonical and dependence on JavaScript are technical weaknesses to fix;
they do not prove why Google deferred crawling.

## What the build now produces

- Ten public pages with distinct titles, descriptions, canonicals, social metadata,
  school/website/page schema and relevant breadcrumbs in the initial HTML.
- Public page overviews and ordinary navigation links that work without JavaScript.
  These are summaries of stable school information, not a snapshot of the full
  application. Live notices, CMS content, fees and admission availability still
  load in React. The build never reads private records or remote databases.
- The preferred `WebSite` name “HSS Shangus”, matching Open Graph and page branding.
  Unsupported site-search actions and unverified social/geographic assertions
  have been removed. No structured data can force sitelinks or a knowledge panel.
- A sitemap derived from the same public route list. It omits verification and
  private workspaces, and does not invent last-modified dates for live content.
- HTTP and browser `noindex` signals for private workspaces and student verification.
  The public `/login` gateway remains indexable. Robots permits crawling these
  pages so search engines can see noindex; authentication remains the access control.
- Canonical redirects for public aliases, and a generic app shell for other routes.
  Offline navigation caches pages separately instead of sharing one page's HTML.

Maintain public descriptions and summaries in `src/seo/siteSeo.js` when school
information changes. Update `public/sitemap.xml` if public routes change; the build
verifies it against the generated sitemap. New CMS pages need to be added to this
configuration to receive initial HTML. Run `npm run build` and `npm run seo:check`.

## After the manual push and successful Netlify deployment

1. Open `/about`, `/academics`, `/admissions`, `/notices` and `/login` directly.
   View page source: each should have its own canonical, title and visible overview.
   Confirm `/sitemap.xml` returns XML and `/portal/login` returns `X-Robots-Tag: noindex, follow`.
2. In Google Search Console, submit or resubmit
   `https://hssshangus.netlify.app/sitemap.xml`. Use URL Inspection → Test Live URL
   on the homepage and key public pages, inspect the rendered result, and request
   indexing once for each. Monitor Google's selected canonical and crawl dates.
   A live test or indexing request does not guarantee inclusion or sitelinks.
3. In [Bing Webmaster Tools](https://www.bing.com/webmasters/), choose **Import from
   Google Search Console**, sign in as the verified school owner, and select this
   site. This imports verification and sitemaps. Alternatively verify manually
   using Bing's exact supplied XML file or meta tag; do not invent a verification
   token. Confirm the sitemap is processed and inspect the key URLs in Bing.
4. Yahoo directs site owners to submit through Bing Webmaster Tools; there is no
   separate Yahoo verification tag needed. Yahoo says inclusion can take 6–8 weeks
   or longer. This is not a promised deadline.
5. For the school information/map panel, check or claim the existing Google Maps /
   Business Profile using the authorized school account, avoiding duplicate
   listings. Ensure its website points to this exact site and its name, address,
   phone and school photos are accurate. Google decides whether a panel appears.
   Reviews for general-education schools serving ages 6–18 may be disabled by Google;
   the university's star ratings are not a feature to reproduce in school schema.

No webmaster account submissions or Business Profile edits were performed as part
of the local code changes. No push or deployment was performed. Search results only
change after deployment, recrawling and search-engine processing; timing and display
are controlled by each search engine. A Netlify subdomain can be indexed and can
have a site name; purchasing a domain is not a prerequisite for these fixes.

## Official references

- [Google sitelinks](https://developers.google.com/search/docs/appearance/sitelinks)
- [Google site names](https://developers.google.com/search/docs/appearance/site-names)
- [JavaScript SEO basics](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)
- [Page indexing report](https://support.google.com/webmasters/answer/7440203)
- [Bing verification and Search Console import](https://www.bing.com/webmasters/help/add-and-verify-site-12184f8b)
- [Yahoo website submission](https://in.help.yahoo.com/kb/SLN2217.html)
- [Google school reviews policy](https://support.google.com/business/answer/10313341)
