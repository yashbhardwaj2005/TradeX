# Verification record

Executed on 27 October 2026 on Windows with Node.js 24.13.1 and npm 11.8.0.

## TradeX rebrand and free-deployment preparation — 28 October 2026

Public branding, browser title, favicon, package names, health service name, user messages, documentation and hosting configuration were updated to TradeX. Legacy token identifiers and the existing local database name were kept compatible with current accounts. `npm run verify` passed all 44 backend tests, the production build, 14 frontend route renders and the proxy recovery check. `npm run verify:deployment` separately passed against a real isolated production-mode server/database, including built assets, NSE deep links, secure cookies, registration, a virtual buy and disabled automatic orders. The running local page returned `TradeX · Paper Trading` with a connected `tradex` API.

The default Render blueprint now explicitly selects the Free plan and serves frontend/API together with the automatic worker disabled. No remote deployment has occurred: GitHub, Render and Atlas integrations were found but remain unconnected. See [FREE_DEPLOYMENT.md](FREE_DEPLOYMENT.md) for the $0 option and its limits.

## Connection recovery follow-up

The reported connection error was reproduced as a running frontend on port 5173 with no API on port 4000 and no MongoDB listener. The old default `npm run dev` required manual database/auth configuration even though a separate zero-configuration local command existed. The default launcher now starts the complete local stack when no database URI is configured, waits for readiness, and reuses healthy services rather than creating competing instances. Existing configured databases can still be used.

The app now checks a public versioned readiness endpoint, shows a reconnect state while the API is unavailable, retries automatically, and preserves authenticated sessions during network outages. The Vite proxy returns a structured 503 during startup. A real isolated HTTP test confirms that the same proxy recovers when its API target starts. Frontend tests cover the offline screen and session preservation. Following this fix, the build, 40 backend tests, all 14 route renders, client recovery checks, proxy outage/recovery test, and real running-stack smoke workflow were verified. The frontend and API health endpoints returned 200 with a connected database. Browser access remains unavailable, so these are HTTP/render checks rather than interactive browser QA.

| Check                     | Result                                                                                                                                             |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run verify`          | Passed: backend syntax, Vite production build, 39 backend tests, frontend route/session checks                                                     |
| Backend integration tests | 39 passed, 0 failed, using real isolated MongoDB 7.0.24 replica sets and deterministic quote providers                                             |
| Frontend render checks    | All 14 routes rendered with deterministic query fixtures; includes populated/empty states across the route set                                     |
| Client session tests      | Concurrent 401 responses share one refresh; `/auth/me` retries; invalid login does not refresh; a late refresh cannot restore a signed-out session |
| `npm run smoke`           | Passed against the running Vite proxy, Express API, persistent MongoDB and actual background worker                                                |
| Local restart persistence | Before and after full launcher restart: 1 QA user and 4 executed transactions retained; second launch reached API readiness                        |
| `npm audit --omit=dev`    | 0 known vulnerabilities reported                                                                                                                   |
| Source formatting         | Prettier completed successfully                                                                                                                    |

The final smoke test exercised registration, authentication, explicitly simulated stock quotes, three buys, an idempotent replay for each buy, a sell, portfolio accounting identities, private watchlist entries, order/transaction retrieval, cancellation, an actually evaluated one-time alert, notification read state, refresh rotation and logout. Disposable QA accounts are retained in the local database; no QA credentials are printed or committed.

The test suite additionally covers overspending/overselling, parallel buys/sells, duplicate requests, changed-payload idempotency conflicts, database rollback, transient transaction retry, exact weighted cost allocation, realized P&L, portfolio cash/equity identities, genuine snapshots, user isolation, date/pagination validation, cancel/fill races, competing limit evaluators, notification deduplication, stale quotes and disabled workers. Transactions explicitly use snapshot read concern and majority write concern.

## Incremental phase checks

| Phase                                 | Completed verification                                                                                                        |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 1: setup/auth                         | 6 backend tests and frontend build                                                                                            |
| 2: market data/charts                 | 11 backend tests and frontend build                                                                                           |
| 3: trading                            | 20 backend tests and frontend build                                                                                           |
| 4: portfolio/dashboard/analytics      | 24 backend tests and frontend build                                                                                           |
| 5: watchlist/history/order management | 29 backend tests and frontend build                                                                                           |
| 6: limits/alerts/notifications        | 35 backend tests and frontend build                                                                                           |
| 7: security/reliability/delivery      | 39 backend tests, frontend rendering/session tests, final build, runtime smoke test, dependency audit and restart persistence |

During implementation the accounting suite caught an amount-validator return-value bug, which was fixed before moving past the trading phase. Runtime checks also exposed development replica-set restart recovery; the launcher now keeps MongoDB separate from API watching, uses a stable local port and waits for persisted configuration recovery. Restart persistence was subsequently verified. No prior user code existed or was overwritten.

## Verification limits

Browser inventory exposed no browser, and attempting the in-app browser returned `Browser is not available: iab`. Consequently, interactive browser behavior, pixels/layout, keyboard focus, rendered chart canvases, and mobile breakpoints have **not** been visually verified. Route rendering tests exercise React rendering, not a browser. No screenshot is fabricated or represented as captured. Vite reports two harmless upstream Zod comment-annotation notices; the production build completes and the largest emitted JavaScript chunk is below 500 kB.

No hosted deployment, Atlas account configuration or licensed external market-data API was verified. Hosting configuration and instructions are supplied, and simulation is the deliberate functioning provider.

## Manual browser checklist

Run `npm run dev:local`, open the printed Vite URL and register a fresh account.

1. Confirm the initial virtual balance, empty holdings and short/empty account-history state.
2. At desktop, tablet and 375 px mobile widths, inspect navigation, table scrolling, chart sizing, form labels and trade-modal visibility.
3. Test Ctrl/Cmd+K stock search, Enter navigation, Escape dismissal, password visibility and modal keyboard behavior.
4. Buy shares, verify cash/holdings/history update, then sell part of a position. Confirm zero simulation fees and source/timestamp labels.
5. View an invalid symbol and try a trade exceeding cash or holdings; verify helpful errors without a success toast.
6. Add/remove watchlist entries, filter/page history, open order details, place/cancel a pending limit and test a satisfied limit.
7. Create an already-satisfied alert; verify exactly one notification and the unread indicator, then mark it read.
8. Save a profile name, sign out, sign in as another account and confirm private data remains isolated.
9. Capture the overview and stock/trade views for the README screenshots section.

For production, also complete the validation steps in [DEPLOYMENT.md](DEPLOYMENT.md).
