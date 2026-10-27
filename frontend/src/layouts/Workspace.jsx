import { useEffect, useRef, useState } from 'react';
import { NavLink, Link, useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  ChartNoAxesCombined,
  LayoutDashboard,
  Globe2,
  Wallet,
  ArrowLeftRight,
  Star,
  ClipboardList,
  History,
  ChartPie,
  Bell,
  Settings,
  Search,
  ChevronDown,
  LogOut,
  Menu,
  X,
  Command,
  ArrowUpRight,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../store/auth';
import { useApi } from '../hooks/useApi';
import { api, errorMessage } from '../services/api';
import { toast } from 'sonner';
const navigation = [
  ['Overview', '/', LayoutDashboard],
  ['Markets', '/markets', Globe2],
  ['Portfolio', '/portfolio', Wallet],
  ['Trade', '/trade', ArrowLeftRight],
  ['Watchlist', '/watchlist', Star],
  ['Orders', '/orders', ClipboardList],
  ['Transactions', '/transactions', History],
  ['Analytics', '/analytics', ChartPie],
  ['Alerts', '/alerts', Bell],
];
export default function Workspace({ children }) {
  const searchInput = useRef();
  useEffect(() => {
    const keydown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInput.current?.focus();
      }
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, []);
  const user = useAuth((s) => s.user),
    clear = useAuth((s) => s.clear),
    [menu, setMenu] = useState(false),
    [account, setAccount] = useState(false),
    [search, setSearch] = useState(''),
    [query, setQuery] = useState('');
  const location = useLocation(),
    navigate = useNavigate(),
    client = useQueryClient();
  useEffect(() => {
    const id = setTimeout(() => setQuery(search), 200);
    return () => clearTimeout(id);
  }, [search]);
  useEffect(() => {
    setMenu(false);
    setSearch('');
    setAccount(false);
  }, [location.pathname]);
  const results = useApi('/stocks/search', { q: query }, { enabled: query.length > 0 });
  const stocks = useApi('/stocks', undefined, { refetchInterval: 30000 });
  const notifications = useApi('/notifications', undefined, { refetchInterval: 15000 });
  async function logout() {
    try {
      await api.post('/auth/logout');
      clear();
      client.clear();
      navigate('/login');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }
  return (
    <div className="workspace">
      {menu && (
        <button
          className="sidebar-scrim"
          aria-label="Close navigation"
          onClick={() => setMenu(false)}
        />
      )}
      <aside className={`sidebar ${menu ? 'open' : ''}`}>
        <Link to="/" className="brand">
          <span className="brand-mark">
            <ChartNoAxesCombined size={23} />
          </span>
          TradeX<span className="brand-dot">.</span>
        </Link>
        <div className="workspace-label">
          <span className="status-dot" />
          PAPER TRADING<span>V1.0</span>
        </div>
        <div className="nav-caption">WORKSPACE</div>
        <nav>
          {navigation.map(([label, path, Icon], i) => (
            <div key={path}>
              {i === 7 && <div className="nav-caption insights-caption">INSIGHTS</div>}
              <NavLink to={path} end={path === '/'}>
                <Icon size={18} />
                {label}
                {label === 'Trade' && <span className="nav-shortcut">↗</span>}
              </NavLink>
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="practice-card">
            <span className="practice-icon">
              <ShieldCheck size={19} />
            </span>
            <strong>Real practice. Virtual money.</strong>
            <p>
              Your next great trade starts
              <br />
              with a little experience.
            </p>
            <Link to="/markets">
              Explore the markets <ArrowUpRight size={13} />
            </Link>
          </div>
          <NavLink className="settings-link" to="/settings">
            <Settings size={18} />
            Settings
          </NavLink>
          <div className="sidebar-user">
            <span className="avatar">
              {user.fullName
                .split(' ')
                .map((n) => n[0])
                .slice(0, 2)
                .join('')}
            </span>
            <div>
              <strong>{user.fullName}</strong>
              <small>Personal workspace</small>
            </div>
            <button className="icon-button" aria-label="Sign out" onClick={logout}>
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
      <div className="workspace-body">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            aria-label="Open navigation"
            onClick={() => setMenu(true)}
          >
            <Menu size={21} />
          </button>
          <div className="global-search">
            <Search size={17} />
            <input
              ref={searchInput}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setSearch('');
                if (e.key === 'Enter' && results.data?.[0])
                  navigate(`/stocks/${results.data[0].symbol}`);
              }}
              aria-label="Global stock search"
              placeholder="Search stocks, companies…"
            />
            <span className="search-key">
              <Command size={10} /> K
            </span>
            {search && (
              <div className="search-results">
                {results.isFetching ? (
                  <p>Searching…</p>
                ) : results.error ? (
                  <p>Search unavailable. Try again.</p>
                ) : results.data?.length ? (
                  results.data.slice(0, 7).map((s) => (
                    <Link to={`/stocks/${s.symbol}`} key={s.symbol}>
                      <span>
                        <strong>{s.ticker}</strong>
                        <small>{s.name}</small>
                      </span>
                      <ArrowUpRight size={14} />
                    </Link>
                  ))
                ) : (
                  <p>No matching stocks.</p>
                )}
                <button onClick={() => setSearch('')} className="search-close">
                  Close search <X size={12} />
                </button>
              </div>
            )}
          </div>
          <div className="topbar-actions">
            <span className="market-status">
              <span className="status-dot" />
              Simulation mode
            </span>
            <span className="topbar-divider" />
            <Link
              className="icon-button notification-link"
              aria-label="Notifications and alerts"
              to="/alerts"
            >
              <Bell size={19} />
              {notifications.data?.some((n) => !n.readAt) && <span className="unread-dot" />}
            </Link>
            <div className="account-control">
              <button
                className="account-button"
                onClick={() => setAccount(!account)}
                aria-expanded={account}
                aria-label="Account menu"
              >
                <span className="avatar">{user.fullName[0]}</span>
                <ChevronDown size={13} />
              </button>
              {account && (
                <div className="account-dropdown">
                  <strong>{user.fullName}</strong>
                  <small>{user.email}</small>
                  <Link to="/settings">Account settings</Link>
                  <button onClick={logout}>
                    <LogOut size={14} />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <div className="ticker-tape">
          {stocks.data?.slice(0, 6).map((s) => (
            <Link to={`/stocks/${s.symbol}`} key={s.symbol}>
              <span>{s.ticker}</span>
              <strong>
                {(s.price / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </strong>
              <span className={s.change >= 0 ? 'positive' : 'negative'}>
                {s.change >= 0 ? '+' : ''}
                {s.changePercent.toFixed(2)}%
              </span>
            </Link>
          ))}
          <span className="ticker-source">SIMULATED PRICES</span>
        </div>
        <main className="main-content">{children}</main>
        <footer className="workspace-footer">
          <span>TradeX © {new Date().getFullYear()}</span>
          <span>
            <span className="status-dot" />
            Paper trading environment · Virtual funds only
          </span>
        </footer>
      </div>
    </div>
  );
}
