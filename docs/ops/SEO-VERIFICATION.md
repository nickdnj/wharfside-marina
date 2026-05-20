# SEO verification — Google Search Console + Bing Webmaster Tools

**Owner:** Nick
**Status:** Code-side automation done (STORY-16). Manual verification steps below — required once the production domain is live (STORY-17).

---

## What's automated

- `app/sitemap.ts` &rarr; `https://<host>/sitemap.xml` listing every public route
- `app/robots.ts` &rarr; `https://<host>/robots.txt` allowing all crawlers except `/admin`, `/holder`, `/api`, `/auth`, `/sign-in`, `/sign-out`, `/transient/thanks`
- Next.js metadata API populated in `src/app/layout.tsx` (title template, description, OG, Twitter card, `metadataBase`)
- Per-page `metadata` exports for every public route
- JSON-LD `LocalBusiness` + `Marina` + `WebSite` on `/`
- `NEXT_PUBLIC_SITE_URL` env var controls canonical / sitemap / robots host

---

## Manual: Google Search Console

1. Sign in to https://search.google.com/search-console as the marina-owned Google account.
2. **Add property** &rarr; URL prefix &rarr; `https://wharfsidemb.com/`.
3. Verify ownership. Two options:
   - **DNS TXT record** (preferred): copy the value Google shows, then add a TXT record at the apex of `wharfsidemb.com` via the DNS host. Wait 5–60 min and click **Verify**.
   - **HTML file**: download the file Google provides, put it at `public/<filename>.html`, deploy, then **Verify**.
4. Once verified, submit the sitemap: **Sitemaps** &rarr; enter `sitemap.xml` &rarr; submit.
5. Use **URL Inspection** on `/` to request indexing.

## Manual: Bing Webmaster Tools

1. Sign in to https://www.bing.com/webmasters with a Microsoft account.
2. If you completed Google Search Console first, choose **Import from Google Search Console** — Bing copies properties + sitemaps in one click.
3. Otherwise: **Add a site** &rarr; `https://wharfsidemb.com/` &rarr; verify via DNS TXT (same pattern as Google) or HTML file.
4. **Sitemaps** &rarr; **Submit sitemap** &rarr; `https://wharfsidemb.com/sitemap.xml`.

## Acceptance: "Wharfside Marina rules" returns this site within 90 days

Check periodically:

```
site:wharfsidemb.com
"Wharfside Marina rules"
```

If after 30 days Google has not indexed `/rules`, re-submit via URL Inspection and verify the page is not blocked by `robots.txt` (it isn't, by design).
