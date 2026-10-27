import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Search, ArrowUpRight, ChartCandlestick, Activity, Star } from 'lucide-react';
import { useApi, useAction } from '../hooks/useApi';
import { money, percent, number } from '../utils/format';
import {
  Loading,
  ErrorState,
  Empty,
  PageTitle,
  StockAvatar,
  SourceNote,
} from '../components/Shared';
import StockChart from '../components/StockChart';
export function Markets() {
  const [q, setQ] = useState('');
  const [sector, setSector] = useState('All stocks');
  const { data, error, isPending, refetch } = useApi('/stocks', undefined, {
    refetchInterval: 15000,
  });
  if (isPending) return <Loading />;
  if (error) return <ErrorState error={error} retry={refetch} />;
  const sectors = ['All stocks', ...new Set(data.map((s) => s.sector))];
  const filtered = data.filter(
    (s) =>
      `${s.name} ${s.symbol}`.toLowerCase().includes(q.toLowerCase()) &&
      (sector === 'All stocks' || s.sector === sector),
  );
  return (
    <>
      <PageTitle
        eyebrow="DISCOVER YOUR NEXT MOVE"
        title="Markets"
        description="A world of opportunity. Start with a closer look."
      />
      <div className="market-highlights">
        {data.slice(0, 3).map((s) => (
          <Link to={`/stocks/${s.symbol}`} className="panel highlight" key={s.symbol}>
            <div className="flex-between">
              <span>{s.name}</span>
              <ArrowUpRight size={16} />
            </div>
            <strong>{money(s.price)}</strong>
            <span className={s.change >= 0 ? 'positive' : 'negative'}>
              {percent(s.changePercent)} <small>simulated day change</small>
            </span>
          </Link>
        ))}
      </div>
      <section className="panel">
        <div className="table-toolbar">
          <div className="tabs scroll-tabs">
            {sectors.map((s) => (
              <button className={sector === s ? 'active' : ''} onClick={() => setSector(s)} key={s}>
                {s}
              </button>
            ))}
          </div>
          <div className="search-field">
            <Search size={15} />
            <input
              aria-label="Search markets"
              placeholder="Search stocks"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>COMPANY</th>
                <th>SECTOR</th>
                <th className="numeric">LAST PRICE</th>
                <th className="numeric">DAY CHANGE</th>
                <th className="numeric">VOLUME</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
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
                  <td className="muted">{s.sector}</td>
                  <td className="numeric">{money(s.price)}</td>
                  <td className={`numeric ${s.change >= 0 ? 'positive' : 'negative'}`}>
                    {percent(s.changePercent)}
                  </td>
                  <td className="numeric muted">{number(s.volume)}</td>
                  <td>
                    <Link to={`/stocks/${s.symbol}`} className="table-link">
                      Explore <ArrowUpRight size={13} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length && (
            <Empty
              title="No stocks found"
              description="Try another company name, symbol, or sector."
            />
          )}
        </div>
        <SourceNote timestamp={data[0]?.timestamp} />
      </section>
    </>
  );
}
export function StockDetails({ onTrade }) {
  const { symbol } = useParams();
  const [range, setRange] = useState('1M');
  const [type, setType] = useState('candles');
  const quote = useApi(`/stocks/${symbol}`, undefined, { refetchInterval: 15000 });
  const history = useApi(`/stocks/${symbol}/history`, { range });
  const watchlist = useApi('/watchlist');
  const watch = useAction({ success: 'Watchlist updated.' });
  if (quote.isPending) return <Loading />;
  if (quote.error) return <ErrorState error={quote.error} retry={quote.refetch} />;
  const s = quote.data;
  return (
    <>
      <PageTitle
        eyebrow={`${s.sector.toUpperCase()} / NSE · SIMULATED`}
        title={s.name}
        description={`${s.ticker} · Indian equity · All prices are synthetic`}
      >
        <button
          className="button"
          disabled={watch.isPending}
          onClick={() =>
            watch.mutate({
              method: watchlist.data?.symbols.includes(symbol) ? 'delete' : 'post',
              path: watchlist.data?.symbols.includes(symbol)
                ? `/watchlist/${symbol}`
                : '/watchlist',
              data: watchlist.data?.symbols.includes(symbol) ? undefined : { symbol },
            })
          }
        >
          <Star
            size={15}
            fill={watchlist.data?.symbols.includes(symbol) ? 'currentColor' : 'none'}
          />
          <span className="watch-button-label">Watchlist</span>
        </button>
        <button className="button primary" onClick={() => onTrade(s.symbol, 'BUY')}>
          Buy shares <ArrowUpRight size={15} />
        </button>
        <button className="button" onClick={() => onTrade(s.symbol, 'SELL')}>
          Sell shares
        </button>
      </PageTitle>
      <section className="panel stock-detail">
        <div className="flex-between">
          <div className="stock-price">
            {money(s.price)}
            <span className={s.change >= 0 ? 'positive' : 'negative'}>
              {percent(s.changePercent)} today
            </span>
          </div>
          <div className="chart-controls">
            <div className="tabs">
              {['1W', '1M', '3M', '6M', '1Y'].map((r) => (
                <button key={r} className={r === range ? 'active' : ''} onClick={() => setRange(r)}>
                  {r}
                </button>
              ))}
            </div>
            <button
              className="icon-button"
              aria-label="Toggle chart type"
              onClick={() => setType(type === 'candles' ? 'area' : 'candles')}
            >
              {type === 'candles' ? <Activity size={18} /> : <ChartCandlestick size={18} />}
            </button>
          </div>
        </div>
        {history.isPending ? (
          <Loading />
        ) : history.error ? (
          <ErrorState error={history.error} retry={history.refetch} />
        ) : (
          <StockChart candles={history.data.candles} type={type} height={380} />
        )}
        <SourceNote timestamp={s.timestamp} />
      </section>
      <div className="stats-grid quote-stats">
        {[
          ['Open', money(s.open)],
          ['Previous close', money(s.previousClose)],
          ['Day high', money(s.high)],
          ['Day low', money(s.low)],
          ['Volume', number(s.volume)],
          ['Data source', 'Simulation'],
        ].map(([label, value]) => (
          <div className="panel" key={label}>
            <small>{label}</small>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
    </>
  );
}
