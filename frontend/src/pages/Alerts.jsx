import { useState } from 'react';
import { Bell, Plus, Trash2, CheckCheck, Check, Activity } from 'lucide-react';
import { useApi, useAction } from '../hooks/useApi';
import { PageTitle, SectionTitle, Loading, ErrorState, Empty } from '../components/Shared';
import { money, dateTime, shortSymbol } from '../utils/format';
export default function Alerts() {
  const [symbol, setSymbol] = useState('RELIANCE.NSE'),
    [condition, setCondition] = useState('GTE'),
    [target, setTarget] = useState('');
  const stocks = useApi('/stocks/search'),
    config = useApi('/config'),
    alerts = useApi('/alerts', undefined, { refetchInterval: 15000 }),
    notifications = useApi('/notifications', undefined, { refetchInterval: 15000 });
  const create = useAction({ success: 'Price alert created.', onSuccess: () => setTarget('') }),
    action = useAction({});
  return (
    <>
      <PageTitle
        eyebrow="STAY A STEP AHEAD"
        title="Alerts & notifications"
        description="Set your price. We’ll keep an eye on the simulation."
      />
      <div className="alerts-layout">
        <section className="panel alert-create">
          <SectionTitle
            title="Create a price alert"
            action={<Bell size={17} className="muted" />}
          />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate({
                path: '/alerts',
                data: { symbol, condition, targetPrice: Math.round(Number(target) * 100) },
              });
            }}
          >
            <label>
              Stock
              <select value={symbol} onChange={(e) => setSymbol(e.target.value)}>
                {stocks.data?.map((s) => (
                  <option value={s.symbol} key={s.symbol}>
                    {s.ticker} · {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Notify me when the price is
              <select value={condition} onChange={(e) => setCondition(e.target.value)}>
                <option value="GTE">At or above (≥)</option>
                <option value="LTE">At or below (≤)</option>
              </select>
            </label>
            <label>
              Target price (₹)
              <input
                required
                type="number"
                min="0.01"
                max="10000000"
                step="0.01"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="Enter target price"
              />
            </label>
            <button
              className="button primary wide"
              disabled={create.isPending || !config.data?.workerEnabled || !stocks.data?.length}
            >
              <Plus size={15} />
              {create.isPending ? 'Creating…' : 'Create alert'}
            </button>
            {config.data && !config.data.workerEnabled && (
              <p className="form-error">
                Alerts are disabled because the server worker is not configured.
              </p>
            )}
            <p className="alert-note">
              One-time, in-app alerts. Evaluated server-side on eligible simulated price updates.
            </p>
          </form>
        </section>
        <section className="panel">
          <SectionTitle
            title="Your price alerts"
            detail={`${alerts.data?.filter((a) => a.isActive).length || 0} active · one notification per alert`}
          />
          {alerts.isPending ? (
            <Loading />
          ) : alerts.error ? (
            <ErrorState error={alerts.error} retry={alerts.refetch} />
          ) : alerts.data.length ? (
            <div className="alerts-list">
              {alerts.data.map((a) => (
                <div className="alert-row" key={a._id}>
                  <span className={`alert-icon ${!a.isActive ? 'triggered' : ''}`}>
                    {a.isActive ? <Activity size={16} /> : <Check size={16} />}
                  </span>
                  <div>
                    <strong>
                      {shortSymbol(a.symbol)}{' '}
                      <span>
                        {a.condition === 'GTE' ? '≥' : '≤'} {money(a.targetPrice)}
                      </span>
                    </strong>
                    <small>
                      {a.isActive
                        ? 'Watching simulated prices'
                        : `Triggered ${dateTime(a.triggeredAt)}`}
                    </small>
                  </div>
                  <span className={`chip ${a.isActive ? '' : 'positive'}`}>
                    {a.isActive ? 'ACTIVE' : 'TRIGGERED'}
                  </span>
                  <button
                    className="icon-button"
                    disabled={action.isPending}
                    aria-label={`Delete ${shortSymbol(a.symbol)} alert`}
                    onClick={() => action.mutate({ method: 'delete', path: `/alerts/${a._id}` })}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <Empty
              title="Let the right price find you"
              description="Create an alert to watch for your target price."
            />
          )}
        </section>
      </div>
      <section className="panel notifications-panel">
        <SectionTitle
          title="Notifications"
          detail="Your latest in-app updates"
          action={<CheckCheck size={17} className="muted" />}
        />
        {notifications.isPending ? (
          <Loading />
        ) : notifications.error ? (
          <ErrorState error={notifications.error} retry={notifications.refetch} />
        ) : notifications.data.length ? (
          <div>
            {notifications.data.map((n) => (
              <div className={`notification-row ${n.readAt ? 'read' : ''}`} key={n._id}>
                <span className="notification-icon">
                  <Bell size={16} />
                </span>
                <div>
                  <strong>{n.title}</strong>
                  <p>{n.message}</p>
                  <small>{dateTime(n.createdAt)}</small>
                </div>
                {!n.readAt && (
                  <button
                    className="text-link"
                    disabled={action.isPending}
                    onClick={() =>
                      action.mutate({ method: 'patch', path: `/notifications/${n._id}/read` })
                    }
                  >
                    Mark read
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <Empty
            title="You’re all caught up"
            description="Triggered price alerts will appear here. No email or push notifications are sent."
          />
        )}
      </section>
    </>
  );
}
