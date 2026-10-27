import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, ArrowDownRight, Search } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { PageTitle, Loading, ErrorState, StockAvatar, Empty } from '../components/Shared';
import { money, percent } from '../utils/format';
export default function Trade({ onTrade }) {
  const [q, setQ] = useState('');
  const { data, error, isPending, refetch } = useApi('/stocks', undefined, {
    refetchInterval: 15000,
  });
  return (
    <>
      <PageTitle
        eyebrow="PUT YOUR IDEAS INTO PRACTICE"
        title="Trade"
        description="Find your stock. Choose your direction. Make your move."
      />
      <div className="notice neutral-notice">
        Every trade uses virtual funds and clearly labeled simulated prices. No broker connection,
        deposits, or real securities.
      </div>
      <div className="trade-search">
        <Search size={17} />
        <input
          placeholder="Search company or symbol…"
          aria-label="Search trade stocks"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      {isPending ? (
        <Loading />
      ) : error ? (
        <ErrorState error={error} retry={refetch} />
      ) : (
        <div className="trade-stock-grid">
          {data
            .filter((s) => `${s.name} ${s.ticker}`.toLowerCase().includes(q.toLowerCase()))
            .map((s) => (
              <section className="panel trade-stock-card" key={s.symbol}>
                <Link to={`/stocks/${s.symbol}`} className="stock-cell">
                  <StockAvatar stock={s} />
                  <span>
                    <strong>{s.ticker}</strong>
                    <small>{s.name}</small>
                  </span>
                  <ArrowUpRight size={14} />
                </Link>
                <div className="trade-card-price">
                  <strong>{money(s.price)}</strong>
                  <span className={s.change >= 0 ? 'positive' : 'negative'}>
                    {percent(s.changePercent)}
                  </span>
                </div>
                <div className="trade-card-actions">
                  <button
                    className="small-button buy-button"
                    onClick={() => onTrade(s.symbol, 'BUY')}
                  >
                    Buy <ArrowUpRight size={13} />
                  </button>
                  <button
                    className="small-button sell-outline"
                    onClick={() => onTrade(s.symbol, 'SELL')}
                  >
                    Sell <ArrowDownRight size={13} />
                  </button>
                </div>
              </section>
            ))}
        </div>
      )}
    </>
  );
}
