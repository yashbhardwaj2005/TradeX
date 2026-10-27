import { Fragment, useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, ArrowDownToLine } from 'lucide-react';
import { useApi, useAction } from '../hooks/useApi';
import { PageTitle, Loading, ErrorState, Empty } from '../components/Shared';
import { money, dateTime, shortSymbol } from '../utils/format';
export default function History({ type = 'orders' }) {
  const orders = type === 'orders';
  const [filters, setFilters] = useState({ page: 1, limit: 12, sort: 'desc' }),
    [expanded, setExpanded] = useState(null);
  const query = useApi(`/${type}`, filters, { refetchInterval: 15000 });
  const action = useAction({ success: 'Pending order cancelled.' });
  const filter = (key, value) => setFilters((f) => ({ ...f, [key]: value || undefined, page: 1 }));
  return (
    <>
      <PageTitle
        eyebrow="A RECORD OF EVERY DECISION"
        title={orders ? 'Orders' : 'Transactions'}
        description={
          orders
            ? 'Track your intentions from placed to filled.'
            : 'A transparent ledger of your virtual trades.'
        }
      />
      <section className="panel">
        <div className="history-filters">
          <label>
            Side
            <select
              aria-label="Filter by side"
              value={filters.side || ''}
              onChange={(e) => filter('side', e.target.value)}
            >
              <option value="">All sides</option>
              <option>BUY</option>
              <option>SELL</option>
            </select>
          </label>
          {orders && (
            <label>
              Status
              <select
                aria-label="Filter by status"
                value={filters.status || ''}
                onChange={(e) => filter('status', e.target.value)}
              >
                <option value="">All statuses</option>
                {['PENDING', 'FILLED', 'CANCELLED', 'REJECTED'].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
          )}
          <label>
            From (IST)
            <input
              aria-label="From date"
              type="date"
              value={filters.from || ''}
              max={filters.to}
              onChange={(e) => filter('from', e.target.value)}
            />
          </label>
          <label>
            To (IST)
            <input
              aria-label="To date"
              type="date"
              value={filters.to || ''}
              min={filters.from}
              onChange={(e) => filter('to', e.target.value)}
            />
          </label>
          <label>
            Sort
            <select
              aria-label="Sort history"
              value={filters.sort}
              onChange={(e) => filter('sort', e.target.value)}
            >
              <option value="desc">Newest first</option>
              <option value="asc">Oldest first</option>
            </select>
          </label>
          <button
            className="text-link"
            onClick={() => setFilters({ page: 1, limit: 12, sort: 'desc' })}
          >
            Clear filters
          </button>
        </div>
        {query.isPending ? (
          <Loading />
        ) : query.error ? (
          <ErrorState error={query.error} retry={query.refetch} />
        ) : query.data.items.length ? (
          <>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>STOCK / DATE</th>
                    <th>SIDE</th>
                    <th>TYPE</th>
                    <th className="numeric">QUANTITY</th>
                    <th className="numeric">{orders ? 'PRICE' : 'EXECUTION PRICE'}</th>
                    <th className="numeric">{orders ? 'STATUS' : 'GROSS AMOUNT'}</th>
                    <th>{orders ? '' : 'REALIZED P&L'}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {query.data.items.map((item) => (
                    <Fragment key={item._id}>
                      <tr>
                        <td>
                          <strong className="history-symbol">{shortSymbol(item.symbol)}</strong>
                          <small className="history-date">
                            {dateTime(orders ? item.createdAt : item.executedAt)}
                          </small>
                        </td>
                        <td>
                          <span className={`side-pill ${item.side.toLowerCase()}`}>
                            {item.side}
                          </span>
                        </td>
                        <td className="muted">{orders ? item.orderType : 'FILL'}</td>
                        <td className="numeric">{item.quantity}</td>
                        <td className="numeric">{money(item.executionPrice || item.limitPrice)}</td>
                        <td className="numeric">
                          {orders ? (
                            <span className={`order-status ${item.status.toLowerCase()}`}>
                              <i />
                              {item.status}
                            </span>
                          ) : (
                            money(item.grossAmount)
                          )}
                        </td>
                        <td>
                          {orders ? (
                            item.status === 'PENDING' && (
                              <button
                                className="cancel-button"
                                disabled={action.isPending}
                                onClick={() =>
                                  action.mutate({ method: 'delete', path: `/orders/${item._id}` })
                                }
                              >
                                Cancel
                              </button>
                            )
                          ) : item.side === 'SELL' ? (
                            <span className={item.realizedPnL >= 0 ? 'positive' : 'negative'}>
                              {money(item.realizedPnL)}
                            </span>
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                        <td>
                          <button
                            className="icon-button"
                            aria-expanded={expanded === item._id}
                            aria-label={`Details for ${shortSymbol(item.symbol)} ${item.side}`}
                            onClick={() => setExpanded(expanded === item._id ? null : item._id)}
                          >
                            <ChevronDown size={15} />
                          </button>
                        </td>
                      </tr>
                      {expanded === item._id && (
                        <tr className="details-row">
                          <td colSpan="8">
                            <div>
                              <span>
                                Record ID <strong>{item._id}</strong>
                              </span>
                              <span>
                                Source{' '}
                                <strong>
                                  {item.quoteSource || 'Awaiting eligible simulated quote'}
                                </strong>
                              </span>
                              {item.executedAt && (
                                <span>
                                  Executed <strong>{dateTime(item.executedAt)}</strong>
                                </span>
                              )}
                              {item.rejectionReason && (
                                <span className="negative">{item.rejectionReason}</span>
                              )}
                              {!orders && (
                                <span>
                                  Fees <strong>{money(item.fees)}</strong>
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pagination">
              <span>
                {query.data.total} {orders ? 'orders' : 'transactions'} · Page {query.data.page} of{' '}
                {query.data.totalPages || 1}
              </span>
              <div>
                <button
                  className="icon-button"
                  aria-label="Previous page"
                  disabled={filters.page <= 1}
                  onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  className="icon-button"
                  aria-label="Next page"
                  disabled={filters.page >= query.data.totalPages}
                  onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <Empty
            title={orders ? 'No orders in this view' : 'No transactions in this view'}
            description="Your trading history will appear here. Try changing the filters or place your first virtual trade."
          />
        )}
        <div className="panel-note">
          {orders
            ? 'Market orders execute at an eligible server quote. Limit orders revalidate resources when a condition is met.'
            : 'All amounts are virtual INR. Zero simulated fees. Realized P&L uses weighted-average cost.'}
        </div>
      </section>
    </>
  );
}
