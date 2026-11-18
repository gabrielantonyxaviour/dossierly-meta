# Redirect for the old Pages site

Static deployment for the Cloudflare Pages project `dossierly` (dossierly.pages.dev). `public/_redirects` sends every path to https://dossierly.larinova.com with path and query kept (301); `public/index.html` is a meta-refresh fallback.

## Deploy (not run by the build; run it by hand)
```
npx wrangler pages deployment list --project-name dossierly   # note the current deployment id first
npx wrangler pages deploy scripts/pages-redirect/public --project-name dossierly --branch main
```

## Rollback
Re-promote the previous deployment: Cloudflare dashboard, Workers & Pages, `dossierly`, Deployments, pick the id noted above, "Rollback to this deployment" (or the Pages rollback API). The old ids are listed by `wrangler pages deployment list --project-name dossierly`.
