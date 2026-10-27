import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Star, Plus, Trash2, ArrowUpRight } from 'lucide-react';
import { useApi, useAction } from '../hooks/useApi';
import {
  PageTitle,
  Loading,
  ErrorState,
  Empty,
  StockAvatar,
  SourceNote,
} from '../components/Shared';
import { money, percent } from '../utils/format';
export default function Watchlist({ onTrade }) {
  const [q, setQ] = useState('');
  const list = useApi('/watchlist', undefined, { refetchInterval: 15000 });
  const search = useApi('/stocks/search', { q }, { enabled: q.length > 0 });
  const action = useAction({ success: 'Watchlist updated.' });
  if (list.isPending) return <Loading />;
  if (list.error) return <ErrorState error={list.error} retry={list.refetch} />;
  return (
    <>
      <PageTitle
        eyebrow="KEEP YOUR EYE ON WHAT MATTERS"
        title="Watchlist"
        description="Good opportunities deserve a second look."
      />
      <section className="panel">
        <div className="watchlist-toolbar">
          <div>
            <Star size={17} />
            <strong>{list.data.name}</strong>
            <span>{list.data.symbols.length} / 50 stocks</span>
          </div>
          <div className="watchlist-search">
            <div className="search-field">
              <Search size={15} />
              <input
                placeholder="Find a stock to add…"
                aria-label="Add stock to watchlist"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            {q && (
              <div className="watchlist-results">
                {search.data?.length ? (
                  search.data.slice(0, 7).map((s) => (
                    <button
                      key={s.symbol}
                      disabled={action.isPending || list.data.symbols.includes(s.symbol)}
                      onClick={() => {
                        action.mutate({ path: '/watchlist', data: { symbol: s.symbol } });
                        setQ('');
                      }}
                    >
                      <span>
                        <strong>{s.ticker}</strong>
                        <small>{s.name}</small>
                      </span>
                      {list.data.symbols.includes(s.symbol) ? (
                        <Star size={15} />
                      ) : (
                        <Plus size={15} />
                      )}
                    </button>
                  ))
                ) : (
                  <p>{search.isFetching ? 'Searching…' : 'No matching stocks'}</p>
                )}
                <button className="search-close" onClick={() => setQ('')}>
                  Close search
                </button>
              </div>
            )}
          </div>
        </div>
        {list.data.stocks.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>COMPANY</th>
                  <th className="numeric">LAST PRICE</th>
                  <th className="numeric">DAY CHANGE</th>
                  <th>SECTOR</th>
                  <th className="numeric">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {list.data.stocks.map((s) => (
                  <tr key={s.symbol}>
                    <td>
                      <Link className="stock-cell" to={`/stocks/${s.symbol}`}>
                        <StockAvatar stock={s} />
                        <span>
                          <strong>{s.ticker}</strong>
                          <small>{s.name}</small>
                        </span>
                      </Link>
                    </td>
                    <td className="numeric">{money(s.price)}</td>
                    <td className={`numeric ${s.change >= 0 ? 'positive' : 'negative'}`}>
                      {percent(s.changePercent)}
                    </td>
                    <td className="muted">{s.sector}</td>
                    <td>
                      <div className="row-actions">
                        <button className="small-button" onClick={() => onTrade(s.symbol, 'BUY')}>
                          Buy <ArrowUpRight size={12} />
                        </button>
                        <button
                          className="icon-button"
                          disabled={action.isPending}
                          aria-label={`Remove ${s.ticker}`}
                          onClick={() =>
                            action.mutate({ method: 'delete', path: `/watchlist/${s.symbol}` })
                          }
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="Make room for your next idea"
            description="Search for a company above and add it to your private watchlist."
          />
        )}
        <SourceNote timestamp={list.data.stocks[0]?.timestamp} />
      </section>
    </>
  );
}
