import { Link } from 'react-router-dom';
import { ArrowUpRight, Wallet, ArrowDownRight, Banknote, Layers3, CircleHelp } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../store/auth';
import { money, percent, dateTime } from '../utils/format';
import {
  PageTitle,
  SectionTitle,
  Loading,
  ErrorState,
  StockAvatar,
  Empty,
  SourceNote,
} from '../components/Shared';
import { AllocationChart, PerformanceChart } from '../components/PortfolioCharts';
import StockChart from '../components/StockChart';
import DashboardActivity from '../components/DashboardActivity';
export function AccountStats({ data }) {
  const stats = [
    [
      'Total account equity',
      data.equity,
      Wallet,
      `${percent(data.returnPercent)} all-time`,
      data.totalPnL,
    ],
    ['Available virtual funds', data.cash, Banknote, 'Ready for your next move', null],
    [
      'Current holdings value',
      data.holdingsValue,
      Layers3,
      `${money(data.totalInvested, 0)} invested`,
      null,
    ],
    [
      'Unrealized profit & loss',
      data.unrealizedPnL,
      ArrowUpRight,
      `${money(data.realizedPnL)} realized`,
      data.unrealizedPnL,
    ],
  ];
  return (
    <div className="stats-grid">
      {stats.map(([label, value, Icon, detail, sign], i) => (
        <div className={`stat-card ${i === 0 ? 'featured-stat' : ''}`} key={label}>
          <div className="stat-label">
            {label}
            <Icon size={16} />
          </div>
          <strong className={i === 3 ? (value >= 0 ? 'positive' : 'negative') : ''}>
            {money(value, i === 0 ? 2 : 0)}
          </strong>
          <div className="stat-detail">
            <span className={sign !== null ? (sign >= 0 ? 'positive' : 'negative') : ''}>
              {sign !== null &&
                (sign >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />)}
              {detail}
            </span>
            {i === 0 && <span className="virtual-tag">VIRTUAL</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
export function HoldingsTable({ holdings, onTrade }) {
  if (!holdings.length)
    return (
      <Empty
        title="Room for your first investment"
        description="Explore the markets and use your virtual funds to build a portfolio."
      >
        <Link className="button" to="/markets">
          Discover stocks <ArrowUpRight size={14} />
        </Link>
      </Empty>
    );
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>ASSET</th>
            <th className="numeric">QTY.</th>
            <th className="numeric">AVG. COST</th>
            <th className="numeric">LAST PRICE</th>
            <th className="numeric">CURRENT VALUE</th>
            <th className="numeric">UNREALIZED P&L</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {holdings.map((h) => (
            <tr key={h.symbol}>
              <td>
                <Link className="stock-cell" to={`/stocks/${h.symbol}`}>
                  <StockAvatar stock={h} />
                  <span>
                    <strong>{h.ticker}</strong>
                    <small>
                      {h.name}
                      {h.isStale ? ' · stale' : ''}
                    </small>
                  </span>
                </Link>
              </td>
              <td className="numeric">{h.quantity}</td>
              <td className="numeric muted">{money(h.averageBuyPrice)}</td>
              <td className="numeric">{money(h.price)}</td>
              <td className="numeric">{money(h.currentValue)}</td>
              <td className={`numeric ${h.unrealizedPnL >= 0 ? 'positive' : 'negative'}`}>
                {money(h.unrealizedPnL)}
                <small>{percent(h.returnPercent)}</small>
              </td>
              <td>
                <button className="table-link" onClick={() => onTrade(h.symbol, 'SELL')}>
                  Sell <ArrowUpRight size={13} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function Overview({ onTrade }) {
  const user = useAuth((s) => s.user),
    portfolio = useApi('/portfolio/analytics', undefined, { refetchInterval: 15000 }),
    stocks = useApi('/stocks'),
    history = useApi('/stocks/RELIANCE.NSE/history', { range: '1M' });
  if (portfolio.isPending) return <Loading />;
  if (portfolio.error) return <ErrorState error={portfolio.error} retry={portfolio.refetch} />;
  const p = portfolio.data,
    spot = stocks.data?.[0];
  return (
    <>
      <PageTitle
        eyebrow={`WELCOME BACK, ${user.fullName.split(' ')[0].toUpperCase()}`}
        title="Your portfolio, in perspective"
        description="A little clarity. A better next move."
      >
        <span className="date-label">
          {new Date().toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}
        </span>
        <button className="button primary" onClick={() => onTrade('RELIANCE.NSE', 'BUY')}>
          New trade <ArrowUpRight size={16} />
        </button>
      </PageTitle>
      <AccountStats data={p} />
      <div className="dashboard-grid">
        <section className="panel performance-panel">
          <SectionTitle
            title="Portfolio performance"
            detail="Observed account equity · virtual INR"
            action={<span className="chip">SINCE JOINING</span>}
          />
          <div className="performance-value">
            <strong>{money(p.equity)}</strong>
            <span className={p.totalPnL >= 0 ? 'positive' : 'negative'}>
              {percent(p.returnPercent)}
              <small>all-time return</small>
            </span>
          </div>
          <PerformanceChart snapshots={p.snapshots} />
          <div className="chart-footer">
            <span>
              <i className="legend-dot" />
              Account equity
            </span>
            <span>Snapshots every 15 minutes · simulated valuations</span>
          </div>
        </section>
        <section className="panel allocation-panel">
          <SectionTitle
            title="Asset allocation"
            action={<CircleHelp size={15} className="muted" />}
          />
          <AllocationChart allocation={p.allocation} equity={p.equity} />
          <div className="allocation-footnote">A balanced view of where your capital lives.</div>
        </section>
        <section className="panel holdings-panel">
          <SectionTitle
            title="Your holdings"
            detail={`${p.holdings.length} assets in your portfolio`}
            action={
              <Link className="text-link" to="/portfolio">
                View portfolio <ArrowUpRight size={13} />
              </Link>
            }
          />
          <HoldingsTable holdings={p.holdings} onTrade={onTrade} />
        </section>
        <section className="panel spotlight-panel">
          <SectionTitle title="Market spotlight" action={<span className="chip">SIMULATED</span>} />
          {spot && (
            <>
              <Link className="stock-cell" to={`/stocks/${spot.symbol}`}>
                <StockAvatar stock={spot} />
                <span>
                  <strong>{spot.name}</strong>
                  <small>{spot.ticker} · NSE</small>
                </span>
              </Link>
              <div className="spotlight-price">
                <strong>{money(spot.price)}</strong>
                <span className={spot.change >= 0 ? 'positive' : 'negative'}>
                  {percent(spot.changePercent)}
                </span>
              </div>
            </>
          )}
          {history.data && <StockChart candles={history.data.candles} height={155} />}
          <Link to="/markets" className="spotlight-link">
            Find your next opportunity <ArrowUpRight size={14} />
          </Link>
        </section>
      </div>
      <DashboardActivity />
      <div className="practice-banner">
        <span className="banner-number">01 / THE LONG GAME</span>
        <div>
          <strong>Build conviction before you build positions.</strong>
          <p>Explore a stock. Understand the move. Make your own call.</p>
        </div>
        <Link to="/markets" className="button">
          Explore markets <ArrowUpRight size={15} />
        </Link>
      </div>
      <SourceNote timestamp={p.quoteTimestamps[0]} />
    </>
  );
}
export function Portfolio({ onTrade }) {
  const {
    data: p,
    isPending,
    error,
    refetch,
  } = useApi('/portfolio', undefined, { refetchInterval: 15000 });
  if (isPending) return <Loading />;
  if (error) return <ErrorState error={error} retry={refetch} />;
  return (
    <>
      <PageTitle title="Portfolio" description="Every position. Every possibility. One clear view.">
        <Link className="button primary" to="/markets">
          Add an investment <ArrowUpRight size={15} />
        </Link>
      </PageTitle>
      <AccountStats data={p} />
      {p.hasStaleQuotes && (
        <div className="notice">
          Some valuations use stale quotes. Trading will reject prices older than the configured
          threshold.
        </div>
      )}
      <section className="panel">
        <SectionTitle title="All holdings" detail="Weighted-average cost basis · virtual INR" />
        <HoldingsTable holdings={p.holdings} onTrade={onTrade} />
        <SourceNote timestamp={p.quoteTimestamps[0]} />
      </section>
    </>
  );
}
export function Analytics() {
  const {
    data: p,
    isPending,
    error,
    refetch,
  } = useApi('/portfolio/analytics', undefined, { refetchInterval: 30000 });
  if (isPending) return <Loading />;
  if (error) return <ErrorState error={error} retry={refetch} />;
  return (
    <>
      <PageTitle
        eyebrow="THE BIGGER PICTURE"
        title="Portfolio analytics"
        description="Go beyond the numbers. Understand your portfolio."
      />
      <AccountStats data={p} />
      <div className="dashboard-grid">
        <section className="panel">
          <SectionTitle title="Account value over time" detail="Actual recorded snapshots" />
          <PerformanceChart snapshots={p.snapshots} height={300} />
          <div className="panel-note">{p.historyNote}</div>
        </section>
        <section className="panel">
          <SectionTitle title="Capital allocation" />
          <AllocationChart allocation={p.allocation} equity={p.equity} />
        </section>
        <section className="panel">
          <SectionTitle title="Holding performance" detail="Unrealized return by stock" />
          {p.holdings.length ? (
            p.holdings.map((h) => (
              <div className="performance-row" key={h.symbol}>
                <Link to={`/stocks/${h.symbol}`}>{h.ticker}</Link>
                <div className="performance-track">
                  <i
                    style={{
                      width: `${Math.min(100, Math.max(3, Math.abs(h.returnPercent) * 5))}%`,
                      background: h.returnPercent >= 0 ? '#5fcaa4' : '#ea8490',
                    }}
                  />
                </div>
                <span className={h.returnPercent >= 0 ? 'positive' : 'negative'}>
                  {percent(h.returnPercent)}
                </span>
              </div>
            ))
          ) : (
            <Empty
              title="Performance takes a position"
              description="Your holdings will appear here after your first trade."
            />
          )}
        </section>
        <section className="panel">
          <SectionTitle title="Profit & loss" />
          <div className="pnl-breakdown">
            {[
              ['Realized P&L', p.realizedPnL],
              ['Unrealized P&L', p.unrealizedPnL],
              ['Total return', p.totalPnL],
            ].map(([l, v]) => (
              <div key={l}>
                <span>{l}</span>
                <strong className={v >= 0 ? 'positive' : 'negative'}>{money(v)}</strong>
              </div>
            ))}
          </div>
          <div className="panel-note">
            Return = (current equity − ₹10,00,000 initial virtual capital) ÷ initial capital. No
            deposits, withdrawals, dividends, taxes, or corporate actions.
          </div>
        </section>
      </div>
      <div className="best-worst">
        {[
          ['Best performer', p.bestHolding],
          ['Lowest performer', p.worstHolding],
        ].map(([title, h]) => (
          <div className="panel" key={title}>
            <small>{title}</small>
            <strong>{h ? `${h.ticker} · ${percent(h.returnPercent)}` : 'No holdings yet'}</strong>
          </div>
        ))}
      </div>
    </>
  );
}
