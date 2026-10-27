# Implementation checklist

TradeX uses an npm workspace (`frontend/`, `backend/`) rather than nesting another repository inside the supplied workspace. React → versioned REST controllers → services → Mongoose → MongoDB replica set. The market service owns all executable prices. All persisted monetary amounts are integer paise.

1. Foundation: install dependencies, replica-set connection, registration/login, refresh rotation, auth UI. Verify backend syntax, auth integration tests and frontend build.
2. Market: provider contract, deterministic simulated Indian stock catalogue, quote cache, search, OHLC history and stock charts. Verify market tests and build.
3. Trading: atomic wallet/holding/order/transaction changes, weighted cost basis, idempotency. Verify success/failure, contention, retry and rollback tests.
4. Portfolio: account equity, P&L, actual snapshots, dashboard and allocation. Verify accounting identities and frontend build.
5. Organization: private watchlist, paginated and filtered orders/transactions, cancellation. Verify isolation and cancellation.
6. Automation: server-side limit-order and one-time alert worker, notifications. Verify duplicate-fill and duplicate-notification prevention.
7. Delivery: complete integration tests, security/dependency review, responsive browser QA, deployment manifests and documentation.

## Local foundation

All seven implementation phases are now complete at source/API verification level. See [VERIFICATION.md](VERIFICATION.md) for the phase-by-phase checks, final runtime results and the remaining browser/hosted verification limits. Run `npm run verify` for all automated checks, or `npm run smoke` with the local app already running to exercise the full HTTP workflow.

Node.js 22.12+ (Node 24 supported). Run `npm install`, then `npm run dev:local`. The development command downloads a real MongoDB binary on first use and starts a single-node replica set. Its database lives in `backend/.data/mongodb`; it does not create demo accounts or prefill portfolios. Open the URL printed by Vite, register, and receive ₹10,00,000 virtual funds. Development signing secrets are randomly generated in memory unless supplied in `.env` and change when the local API restarts.

For Atlas or an existing replica set, copy `backend/.env.example` to `backend/.env`, provide a database URI and two independent random secrets, then run `npm run dev`. A standalone MongoDB instance is intentionally rejected. `npm test` starts an isolated temporary replica set and never connects to your application database.

The local-only workflow follows the requested MERN stack and deployment targets (Vercel, Render, Atlas); Sites/Cloudflare hosting is not used because it cannot host the requested Express/Mongoose TCP architecture.
