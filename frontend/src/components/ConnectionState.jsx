import { ChartNoAxesCombined, RefreshCw } from 'lucide-react';
export default function ConnectionState({ error, onRetry, pending }) {
  return (
    <main className="connection-screen" aria-live="polite">
      <div className="connection-card">
        <span className="brand-mark">
          <ChartNoAxesCombined size={24} />
        </span>
        <h1>{error ? 'Reconnecting to TradeX' : 'Getting your workspace ready'}</h1>
        <p>
          {error
            ? 'The service is temporarily unavailable. We’re reconnecting automatically; your account and trades are preserved.'
            : 'Connecting securely to your account and market workspace…'}
        </p>
        {import.meta.env.DEV && error && (
          <div className="connection-help">
            Start the complete local app from the project root:<code>npm run dev</code>Wait for
            “TradeX API is ready”, then this page reconnects automatically.
          </div>
        )}
        {error ? (
          <button className="button primary" disabled={pending} onClick={onRetry}>
            <RefreshCw size={15} />
            {pending ? 'Reconnecting…' : 'Reconnect now'}
          </button>
        ) : (
          <span className="loader" aria-label="Connecting" />
        )}
      </div>
    </main>
  );
}
