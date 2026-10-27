import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './store/auth';
import { restoreSession } from './services/api';
import { useApi } from './hooks/useApi';
import ConnectionState from './components/ConnectionState';
import Auth from './pages/Auth';
import { Markets, StockDetails } from './pages/Markets';
import TradeDialog from './components/TradeDialog';
import Layout from './layouts/Workspace';
import { Overview, Portfolio, Analytics } from './pages/Portfolio';
import Watchlist from './pages/Watchlist';
import History from './pages/History';
import Trade from './pages/Trade';
import Settings from './pages/Settings';
import Alerts from './pages/Alerts';
function Workspace() {
  const [trade, setTrade] = useState(null),
    onTrade = (symbol, side) => setTrade({ symbol, side });
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Overview onTrade={onTrade} />} />
        <Route path="/portfolio" element={<Portfolio onTrade={onTrade} />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/stocks/:symbol" element={<StockDetails onTrade={onTrade} />} />
        <Route path="/markets" element={<Markets />} />
        <Route path="/trade" element={<Trade onTrade={onTrade} />} />
        <Route path="/watchlist" element={<Watchlist onTrade={onTrade} />} />
        <Route path="/orders" element={<History key="orders" />} />
        <Route path="/transactions" element={<History key="transactions" type="transactions" />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route
          path="*"
          element={
            <div className="not-found">
              <h1>Off the chart.</h1>
              <p>This page doesn’t exist. Your workspace is one click away.</p>
              <a className="button primary" href="/">
                Back to overview
              </a>
            </div>
          }
        />
      </Routes>
      {trade && (
        <TradeDialog
          key={`${trade.symbol}${trade.side}`}
          {...trade}
          onClose={() => setTrade(null)}
        />
      )}
    </Layout>
  );
}
export default function App() {
  const { ready, user } = useAuth();
  const [sessionError, setSessionError] = useState(null);
  const connection = useApi('/health', undefined, {
    retry: false,
    retryOnMount: false,
    refetchInterval: (query) => (query.state.status === 'error' ? 2000 : 30000),
    refetchIntervalInBackground: true,
  });
  useEffect(() => {
    if (ready || !connection.isSuccess) return;
    let cancelled = false,
      retryTimer;
    async function restore() {
      try {
        await restoreSession();
        if (!cancelled) setSessionError(null);
      } catch (error) {
        if (!cancelled && error.response?.status !== 401) {
          setSessionError(error);
          retryTimer = setTimeout(restore, 2000);
        }
      }
    }
    restore();
    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
    };
  }, [ready, connection.isSuccess]);
  if (!connection.isSuccess || !ready)
    return (
      <ConnectionState
        error={connection.error || sessionError}
        pending={connection.isFetching}
        onRetry={() => {
          setSessionError(null);
          connection.refetch();
        }}
      />
    );
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <Auth key="login" />} />
      <Route
        path="/register"
        element={user ? <Navigate to="/" /> : <Auth key="register" register />}
      />
      <Route path="/*" element={user ? <Workspace /> : <Navigate to="/login" replace />} />
    </Routes>
  );
}
