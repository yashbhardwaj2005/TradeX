import { useEffect, useRef, useState } from 'react';
import { X, ShieldCheck, ArrowRight, Info } from 'lucide-react';
import { toast } from 'sonner';
import { useApi, useAction } from '../hooks/useApi';
import { money, shortSymbol } from '../utils/format';
import { Loading, ErrorState } from './Shared';
export default function TradeDialog({ symbol, side: initialSide = 'BUY', onClose }) {
  const [side, setSide] = useState(initialSide),
    [quantity, setQuantity] = useState('1'),
    [orderType, setOrderType] = useState('MARKET'),
    [limitPrice, setLimitPrice] = useState('');
  const quote = useApi(`/stocks/${symbol}`, undefined, { refetchInterval: 15000 });
  const account = useApi('/auth/me');
  const config = useApi('/config');
  const replay = useRef({});
  const dialog = useRef();
  const action = useAction({
    onSuccess: (order) => {
      toast.success(
        order.status === 'FILLED'
          ? `${order.side === 'BUY' ? 'Bought' : 'Sold'} ${order.quantity} ${shortSymbol(order.symbol)} at ${money(order.executionPrice)} · virtual trade`
          : 'Limit order placed. Funds and holdings will be rechecked at execution.',
      );
      onClose();
    },
  });
  useEffect(() => {
    dialog.current?.showModal();
    const current = dialog.current;
    return () => current?.close();
  }, []);
  async function submit(e) {
    e.preventDefault();
    const data = {
      symbol,
      side,
      quantity: Number(quantity),
      orderType,
      ...(orderType === 'LIMIT' ? { limitPrice: Math.round(Number(limitPrice) * 100) } : {}),
    };
    const fingerprint = JSON.stringify(data);
    if (replay.current.fingerprint !== fingerprint)
      replay.current = { fingerprint, key: crypto.randomUUID() };
    action.mutate({ path: '/orders', data, headers: { 'Idempotency-Key': replay.current.key } });
  }
  const price = orderType === 'LIMIT' ? Math.round(Number(limitPrice) * 100) : quote.data?.price;
  return (
    <dialog
      className="trade-dialog"
      ref={dialog}
      onCancel={(e) => {
        if (action.isPending) e.preventDefault();
        else onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !action.isPending) onClose();
      }}
    >
      <div className="dialog-header">
        <span className="eyebrow">PAPER TRADE / NSE</span>
        <button
          className="icon-button"
          aria-label="Close trade dialog"
          disabled={action.isPending}
          onClick={onClose}
        >
          <X size={19} />
        </button>
      </div>
      <h2>{shortSymbol(symbol)}</h2>
      <p>{quote.data?.name || 'Stock order'}</p>
      {quote.isPending ? (
        <Loading />
      ) : quote.error ? (
        <ErrorState error={quote.error} retry={quote.refetch} />
      ) : (
        <form onSubmit={submit}>
          <fieldset disabled={action.isPending}>
            <div className="trade-side tabs">
              <button
                type="button"
                className={side === 'BUY' ? 'active buy-tab' : ''}
                onClick={() => setSide('BUY')}
              >
                Buy shares
              </button>
              <button
                type="button"
                className={side === 'SELL' ? 'active sell-tab' : ''}
                onClick={() => setSide('SELL')}
              >
                Sell shares
              </button>
            </div>
            <div className="trade-quote">
              <span>Simulated market price</span>
              <strong>{money(quote.data.price)}</strong>
            </div>
            <div className="form-grid">
              <label>
                Order type
                <select value={orderType} onChange={(e) => setOrderType(e.target.value)}>
                  <option value="MARKET">Market order</option>
                  <option value="LIMIT" disabled={!config.data?.workerEnabled}>
                    Limit order{!config.data?.workerEnabled ? ' (worker disabled)' : ''}
                  </option>
                </select>
              </label>
              <label>
                Quantity
                <input
                  type="number"
                  min="1"
                  max="100000"
                  step="1"
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </label>
            </div>
            {orderType === 'LIMIT' && (
              <label className="limit-input">
                Limit price (₹)
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max="10000000"
                  required
                  value={limitPrice}
                  onChange={(e) => setLimitPrice(e.target.value)}
                  placeholder="Price per share"
                />
              </label>
            )}
            <div className="trade-summary">
              <div>
                <span>Estimated {side === 'BUY' ? 'cost' : 'proceeds'}</span>
                <strong>{money((price || 0) * Number(quantity))}</strong>
              </div>
              <div>
                <span>Available virtual cash</span>
                <span>{account.data ? money(account.data.virtualBalance) : 'Loading…'}</span>
              </div>
              <div>
                <span>Simulation fees</span>
                <span>₹0.00</span>
              </div>
            </div>
            <p className="trade-disclosure">
              <Info size={15} />
              {orderType === 'LIMIT'
                ? 'Evaluated on simulated updates. No reservation; insufficient resources at fill time reject the order.'
                : 'Execution uses the server’s latest eligible simulated price. The final price may differ from this estimate.'}
            </p>
            <button
              className={`button wide ${side === 'BUY' ? 'primary' : 'sell-button'}`}
              disabled={action.isPending || !Number(quantity) || !account.data}
            >
              {action.isPending
                ? 'Submitting…'
                : `${side === 'BUY' ? 'Buy' : 'Sell'} ${quantity || 0} ${Number(quantity) === 1 ? 'share' : 'shares'}`}
              <ArrowRight size={16} />
            </button>
          </fieldset>
        </form>
      )}
      <div className="dialog-footer">
        <ShieldCheck size={13} />
        Virtual funds only. No real securities are traded.
      </div>
    </dialog>
  );
}
