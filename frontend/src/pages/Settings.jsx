import { useState } from 'react';
import { ShieldCheck, UserRound, Database } from 'lucide-react';
import { useAuth } from '../store/auth';
import { useApi, useAction } from '../hooks/useApi';
import { PageTitle, SectionTitle } from '../components/Shared';
export default function Settings() {
  const user = useAuth((s) => s.user),
    [fullName, setFullName] = useState(user.fullName);
  const config = useApi('/config');
  const action = useAction({
    success: 'Profile saved.',
    onSuccess: (updated) => useAuth.setState({ user: updated }),
  });
  return (
    <>
      <PageTitle title="Settings" description="Your account. Your workspace." />
      <div className="settings-grid">
        <section className="panel">
          <SectionTitle
            title="Personal profile"
            action={<UserRound size={17} className="muted" />}
          />
          <form
            className="settings-form"
            onSubmit={(e) => {
              e.preventDefault();
              action.mutate({ method: 'patch', path: '/auth/profile', data: { fullName } });
            }}
          >
            <label>
              Full name
              <input
                required
                minLength="2"
                maxLength="80"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="name"
              />
            </label>
            <label>
              Email address
              <input value={user.email} disabled />
              <span className="field-help">Your account’s sign-in identifier.</span>
            </label>
            <button
              className="button primary"
              disabled={action.isPending || fullName.trim() === user.fullName}
            >
              {action.isPending ? 'Saving…' : 'Save changes'}
            </button>
          </form>
        </section>
        <section className="panel">
          <SectionTitle
            title="Account security"
            action={<ShieldCheck size={17} className="muted" />}
          />
          <div className="settings-info">
            <div>
              <strong>Protected sessions</strong>
              <p>
                Access tokens stay in memory. Refresh sessions use HTTP-only cookies and rotate on
                every refresh.
              </p>
            </div>
            <div>
              <strong>Secure credentials</strong>
              <p>
                Your password is hashed with bcrypt. Refresh tokens are stored only as hashes on the
                server.
              </p>
            </div>
            <div>
              <strong>Virtual balance</strong>
              <p>
                Balances change through validated trades only. Accounts begin with ₹10,00,000 in
                virtual capital.
              </p>
            </div>
          </div>
        </section>
        <section className="panel">
          <SectionTitle
            title="Trading environment"
            action={<Database size={17} className="muted" />}
          />
          <div className="environment-list">
            <div>
              <span>Market data</span>
              <strong>Simulated · synthetic Indian stock prices</strong>
            </div>
            <div>
              <span>Automatic order worker</span>
              <strong>
                {config.data ? (config.data.workerEnabled ? 'Enabled' : 'Disabled') : 'Loading…'}
              </strong>
            </div>
            <div>
              <span>Cost method</span>
              <strong>Weighted average · integer paise</strong>
            </div>
            <div>
              <span>Order model</span>
              <strong>Market / limit · zero simulation fees</strong>
            </div>
          </div>
          <div className="panel-note">
            Environment settings are controlled on the server. TradeX is a paper trading
            application, not a brokerage or financial advisory service.
          </div>
        </section>
      </div>
    </>
  );
}
