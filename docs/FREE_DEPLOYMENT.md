# Free TradeX deployment

Prepared 28 October 2026. The lowest-complexity free option is **one Render Free web service + a MongoDB Atlas Free cluster**. Express serves the built React frontend and API from the same HTTPS origin. Vercel is optional for this layout.

Render offers free web services but [sleeps them after 15 minutes without inbound traffic](https://render.com/docs/free). Atlas has a [free cluster tier](https://www.mongodb.com/pricing) with storage/resource limits. This is a $0 demo within those limits, not an unlimited or always-on service. No custom domain purchase is needed; use the provider-assigned URL. An always-on service requires a paid hosting plan.

## Included configuration

For this single-service alternative, use **`render.free.yaml`**, which explicitly selects `plan: free`, enables frontend serving, uses secure SameSite=Lax cookies, and disables the automatic worker. The default `render.yaml` and `render.api.yaml` select the API-only free configuration for the requested Vercel/Render deployment.

| Item              | Free configuration                                              |
| ----------------- | --------------------------------------------------------------- |
| Build             | `npm ci --include=dev && npm run build && npm prune --omit=dev` |
| Start             | `npm run start:full`                                            |
| Health            | `/api/health`                                                   |
| Database          | Atlas Free, configured through `MONGODB_URI`                    |
| Frontend API base | Leave `VITE_API_URL` unset; requests use `/api/v1`              |
| Worker            | `WORKER_ENABLED=false`                                          |
| Cookies           | `COOKIE_SECURE=true`, `COOKIE_SAME_SITE=lax`                    |

Market buying/selling, authentication, holdings, analytics, watchlists and histories work while the service is awake. Automatic limit orders, price-alert evaluation and periodic portfolio snapshots are disabled. The app states this explicitly and refuses those submissions rather than pretending a sleeping worker will execute them. Manual market-data views remain explicitly simulated. Existing account snapshots and analytics still display recorded data.

## Publish steps

1. Put the source in your GitHub repository. Exclude `node_modules`, `.env`, `.data`, local accounts and `artifacts`; the supplied `.gitignore` covers these.
2. Create an **Atlas Free** cluster and a database user restricted to the application database. Configure network access for the Render service, then copy the connection string into Render's secret environment field. Do not paste credentials into chat or commit them.
3. In Render, create a Blueprint from that repository and set the [Blueprint Path](https://render.com/docs/infrastructure-as-code) to `render.free.yaml`. Confirm the selected service is **Free** before deployment. A service name may need a unique suffix; the actual URL comes from Render.
4. Supply `MONGODB_URI` when prompted. The blueprint generates the two JWT secrets. It does not create a database or purchase anything.
5. Deploy. Render provides `RENDER_EXTERNAL_URL`, which the API uses to allow its own frontend origin. For a custom domain, set `PUBLIC_APP_URL` to that exact HTTPS origin.
6. Check `/api/health`, load `/portfolio` directly, register, sign in with the new account, buy a virtual share, reload, and sign out. The first request after idle can wait for Render to wake the service.

The GitHub, Render and Atlas integrations were found but were not connected during preparation. No remote service or public URL has been created. Once those accounts are connected, the source and configuration can be published without needing a paid plan. Public deployment uses the cloud database, not local QA accounts; no local account data is uploaded automatically.

## Alternative free layout

**Vercel Hobby frontend + Render Free API + Atlas Free** can also cost $0 for an eligible personal, non-commercial project, within each provider's limits. [Vercel's Hobby restrictions](https://vercel.com/pricing) apply. It adds a separate API URL and cross-site cookie configuration; the Render sleep and worker limitations remain. The single-origin layout above requires fewer moving parts.

Verify the prepared production path locally with `npm run build` followed by `npm run verify:deployment`. The latter starts an isolated temporary database and production server, checks static assets, SPA routes, API errors, registration followed by a separate secure-cookie login and an actual virtual buy, and stops its test services. It does not use or clear your local accounts.
