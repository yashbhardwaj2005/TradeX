import { ArrowUpRight, Inbox, RefreshCw } from 'lucide-react';
import { errorMessage } from '../services/api';
export function Loading() {
  return (
    <div className="skeleton-grid" aria-label="Loading" role="status">
      {[1, 2, 3, 4].map((n) => (
        <div className="skeleton" key={n} />
      ))}
    </div>
  );
}
export function ErrorState({ error, retry }) {
  return (
    <div className="empty-state" role="alert">
      <RefreshCw />
      <h3>We couldn’t load this view.</h3>
      <p>{errorMessage(error)}</p>
      <button className="button" onClick={retry}>
        Try again
      </button>
    </div>
  );
}
export function Empty({ title, description, children }) {
  return (
    <div className="empty-state">
      <Inbox size={27} />
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </div>
  );
}
export function PageTitle({ eyebrow, title, description, children }) {
  return (
    <div className="page-title">
      <div>
        <div className="eyebrow">{eyebrow || 'YOUR TRADING WORKSPACE'}</div>
        <h1>
          {title}
          <span>.</span>
        </h1>
        {description && <p>{description}</p>}
      </div>
      <div className="page-actions">{children}</div>
    </div>
  );
}
export function SectionTitle({ title, detail, action }) {
  return (
    <div className="section-title">
      <div>
        <h2>{title}</h2>
        {detail && <span>{detail}</span>}
      </div>
      {action}
    </div>
  );
}
export function StockAvatar({ stock }) {
  return (
    <span className="stock-avatar" style={{ '--stock-color': stock.color || '#9691eb' }}>
      {(stock.ticker || stock.symbol || '?').slice(0, 2)}
    </span>
  );
}
export function SourceNote({ timestamp }) {
  return (
    <div className="source-note">
      <span className="status-dot" />
      Simulated data ·{' '}
      {timestamp
        ? `As of ${new Date(timestamp).toLocaleTimeString('en-IN')}`
        : 'Not exchange prices'}
      <a href="https://www.tradingview.com/" target="_blank" rel="noreferrer">
        Charts by TradingView <ArrowUpRight size={11} />
      </a>
    </div>
  );
}
