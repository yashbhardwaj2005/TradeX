import { Link } from 'react-router-dom';
import { ArrowUpRight, Star } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { SectionTitle, Empty, Loading, ErrorState, StockAvatar } from './Shared';
import { money, percent, dateTime, shortSymbol } from '../utils/format';
export default function DashboardActivity() {
  const list = useApi('/watchlist', undefined, { refetchInterval: 30000 }),
    transactions = useApi('/transactions', { limit: 4 });
  return (
    <div className="dashboard-grid recent-activity">
      <section className="panel">
        <SectionTitle
          title="Recent transactions"
          detail="Your latest virtual trades"
          action={
            <Link className="text-link" to="/transactions">
              All transactions <ArrowUpRight size={13} />
            </Link>
          }
        />
        {transactions.isPending ? (
          <Loading />
        ) : transactions.error ? (
          <ErrorState error={transactions.error} retry={transactions.refetch} />
        ) : transactions.data.items.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>ASSET</th>
                  <th>SIDE</th>
                  <th className="numeric">QTY.</th>
                  <th className="numeric">AMOUNT</th>
                  <th className="numeric">EXECUTED</th>
                </tr>
              </thead>
              <tbody>
                {transactions.data.items.map((t) => (
                  <tr key={t._id}>
                    <td>
                      <Link to={`/stocks/${t.symbol}`}>{shortSymbol(t.symbol)}</Link>
                    </td>
                    <td>
                      <span className={`side-pill ${t.side.toLowerCase()}`}>{t.side}</span>
                    </td>
                    <td className="numeric muted">{t.quantity}</td>
                    <td className="numeric">{money(t.grossAmount)}</td>
                    <td className="numeric muted">{dateTime(t.executedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="Your next move belongs here"
            description="Completed virtual trades will appear in your ledger."
          />
        )}
      </section>
      <section className="panel">
        <SectionTitle
          title="On your radar"
          detail="Your private stock watchlist"
          action={
            <Link className="text-link" to="/watchlist">
              Manage <ArrowUpRight size={13} />
            </Link>
          }
        />
        {list.isPending ? (
          <Loading />
        ) : list.error ? (
          <ErrorState error={list.error} retry={list.refetch} />
        ) : list.data.stocks.length ? (
          <div className="dashboard-watchlist">
            {list.data.stocks.slice(0, 4).map((s) => (
              <Link key={s.symbol} to={`/stocks/${s.symbol}`}>
                <StockAvatar stock={s} />
                <span>
                  <strong>{s.ticker}</strong>
                  <small>{s.name}</small>
                </span>
                <div>
                  <strong>{money(s.price)}</strong>
                  <small className={s.change >= 0 ? 'positive' : 'negative'}>
                    {percent(s.changePercent)}
                  </small>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <Empty
            title="Keep a good idea close"
            description="Add stocks to your watchlist to follow them here."
          >
            <Link className="text-link" to="/watchlist">
              Build your watchlist <Star size={12} />
            </Link>
          </Empty>
        )}
      </section>
    </div>
  );
}
