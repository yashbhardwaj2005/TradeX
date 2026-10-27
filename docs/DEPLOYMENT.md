# Deploy TradeX

The selected deployment is a Vercel frontend, Render Free Express backend and MongoDB Atlas Free database. The default `render.yaml` (also available as `render.api.yaml`) provisions the API only. A single-service alternative remains in [FREE_DEPLOYMENT.md](FREE_DEPLOYMENT.md) and `render.free.yaml`.

## Atlas

Create an Atlas cluster and application database user. Restrict network access to the backend's outbound addresses where feasible. Set the Render `MONGODB_URI` using the Atlas-provided connection string with a database name. Atlas or another replica set/sharded deployment is required; a standalone MongoDB server is not supported. The API verifies transaction-capable topology and initializes unique indexes before listening.

## Render API

For this split frontend/API layout, import this repository as a Node web service using `render.api.yaml`, or configure:

| Setting         | Value                                           |
| --------------- | ----------------------------------------------- |
| Repository root | repository root (keep npm workspaces available) |
| Build           | `npm ci --omit=dev --workspace backend`         |
| Start           | `npm start --workspace backend`                 |
| Health check    | `/api/health`                                   |
| Node            | 24.13.1 or a compatible supported Node release  |

Set `MONGODB_URI` and `CLIENT_ORIGINS=https://your-frontend.vercel.app`. Use exact origins without trailing slashes. Supply independent strong `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` values (the blueprint generates them). Set `NODE_ENV=production`, `COOKIE_SECURE=true`, `COOKIE_SAME_SITE=none`, `TRUST_PROXY=1`, `MARKET_PROVIDER=simulated`.

Use an always-running service for automatic limits/alerts. If your selected hosting sleeps or cannot keep polling active, set `WORKER_ENABLED=false` and the app will refuse those features explicitly. With multiple API instances, each can run the worker safely, although a dedicated queue is better for larger workloads. The current rate limiter uses per-process memory; production scale needs shared rate-limit storage and centralized monitoring.

The API binds `0.0.0.0` and reads the platform's `PORT`. `/api/health` exposes database readiness and configured provider/worker capability, not credentials. See the official [Express deployment guide](https://render.com/docs/deploy-node-express-app) and [port binding guide](https://render.com/tutorials/when-deploys-go-wrong/boot-and-port-binding).

## Vercel frontend

Import the same repository, choose **Vite**, and set the project's root directory to **frontend** with access to files outside that root enabled for the npm workspace. Install from the repository workspace using `npm ci` (Vercel's workspace detection can run this at the repository root); build with `npm run build` in frontend. Output directory: `dist`.

Set the build-time public environment variable:

```text
VITE_API_URL=https://your-api.onrender.com/api/v1
```

Use your actual backend origin. Do not omit `/api/v1`, put secrets in Vite variables, or hardcode localhost in the deployed client. `frontend/vercel.json` supplies the SPA rewrite needed for `/portfolio`, `/orders` and other deep links. Changing `VITE_API_URL` requires a frontend rebuild. See [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite) and [Vercel monorepos](https://vercel.com/docs/monorepos).

For reliable refresh cookies without third-party-cookie dependence, use Vercel as an API proxy instead: once Render returns its actual URL, run `node scripts/configure-vercel.mjs https://your-actual-api.onrender.com`, commit the updated `frontend/vercel.json`, and leave `VITE_API_URL` unset. Set Render's `CLIENT_ORIGINS` to the actual Vercel frontend origin. The script accepts only a public HTTPS origin and stores no credentials. In this layout the browser uses `/api/v1` on Vercel while Express and MongoDB remain on Render/Atlas.

## Cookies, CORS and CSRF

The client sets `withCredentials: true`. Cross-site Vercel/Render cookies need HTTPS, `Secure=true`, `SameSite=none` and an exact allowed frontend origin. Mutation origin/fetch-metadata checks guard cookie operations, JSON requests use a non-simple content type, and private trades also require a bearer token held in memory.

Some browsers block third-party cookies even with these settings. Prefer related custom domains (for example `app.example.com` and `api.example.com`) or a deliberately configured same-origin API reverse proxy. For same-site HTTPS domains, `COOKIE_SAME_SITE=lax` can be used with `COOKIE_SECURE=true`. Configure `CLIENT_ORIGINS` to the browser-visible application origin, not a wildcard. Preview domains need explicit entries; do not allow arbitrary preview hosts.

Logout revokes the refresh-token family. Existing ten-minute access tokens expire naturally. Cookie path is `/api/v1/auth`, host-only, HTTP-only, and shared clearing/setting attributes are consistent. The app never stores a refresh token in localStorage.

## Validate after deployment

1. Confirm `/api/health` returns 200 with a connected database.
2. Register and verify exactly ₹10,00,000 virtual cash and no holdings.
3. Reload the frontend and confirm refresh cookies restore the session without localStorage tokens.
4. Buy and sell a share; verify the holding, cash, ledger and order status agree.
5. Place a tiny-price pending buy limit, cancel it and verify no fill occurred.
6. Create an already-satisfied simulated price alert and verify exactly one notification on the next poll.
7. Visit a deep link directly, check mobile navigation and trade-dialog keyboard behavior, and sign out/reload.
8. Confirm database URI/signing secrets do not appear in frontend assets or API responses.

No paid plan, data license, domain or database credentials are included.
