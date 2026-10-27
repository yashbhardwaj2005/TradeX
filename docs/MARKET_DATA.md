# Market data provider decision

Reviewed 27 October 2026 using provider-owned sources.

## Included implementation

TradeX deliberately ships with `MARKET_PROVIDER=simulated`. Its catalogue uses NSE-style normalized identifiers for learning, not a claim of actual exchange connectivity. Quotes, candles and volume are deterministic synthetic data, explicitly marked `source: simulated` and `isSimulated: true`. The simulator runs irrespective of exchange hours and returns `marketStatus: SIMULATION`. A change of provider is a deliberate server configuration/code change, never an automatic outage fallback.

## External provider evaluation

Alpha Vantage's [API documentation](https://www.alphavantage.co/documentation/) includes Indian **BSE** daily-data examples. That does not verify comprehensive NSE support for TradeX's symbols, available quote entitlements, exchange calendars or API delivery guarantees. Its [support page](https://www.alphavantage.co/support/) describes a default free allowance of 25 requests per day and additional access for verified educational/open-source projects. This app has not obtained that verification. An ordinary small daily quota is insufficient for continuously polling a stock dashboard and worker.

Its [terms](https://www.alphavantage.co/terms_of_service/) distinguish personal/non-commercial access from other uses and direct commercial users to contact the provider. A public multi-user portfolio project must not assume its API key includes display/redistribution rights. No paid plan or public-display license was purchased, no NSE quote coverage was verified, and no external-data adapter is represented as operational. Current paid pricing and permitted usage must be confirmed directly before selecting a plan.

## Adapter contract

Implement a server-only provider with:

```js
{
  name: 'verified-provider-name',
  search: async (query) => [{ symbol, ticker, name, sector, color }],
  quote: async (symbol) => ({
    symbol, ticker, name, sector, price, previousClose, change,
    changePercent, timestamp, source, isSimulated: false,
    marketStatus, currency: 'INR', open, high, low, volume
  }),
  history: async (symbol, range) => ({
    symbol, range, source, isSimulated: false,
    candles: [{ time: 'YYYY-MM-DD', open, high, low, close, volume }]
  })
}
```

All monetary outputs must be safe integer paise. Map provider exchange suffixes explicitly; preserve actual quote timestamps and delay/provenance. Validate missing/invalid symbols rather than synthesizing quotes. Implement provider-specific timeout, quota-aware caching/backoff, entitlement/authentication errors and exchange closure rules. Adjust the executable-quote policy for delayed/EOD data intentionally; do not simply relax freshness and call the resulting execution live.

Store credentials only in backend environment variables. Extend the validated provider enum and UI provenance display, and test the adapter with recorded contractual fixtures. Trading tests should continue to use deterministic injected quotes. Obtain written coverage/redistribution confirmation before exposing licensed data to multiple users.
