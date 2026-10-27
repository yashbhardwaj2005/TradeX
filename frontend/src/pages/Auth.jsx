import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowUpRight, Check, ChevronRight, ChartNoAxesCombined, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../store/auth';
import { api, errorMessage } from '../services/api';
export const loginSchema = z.object({
  email: z.string().trim().pipe(z.email('Enter a valid email')),
  password: z.string().min(1, 'Enter your password').max(72),
});
export const registrationSchema = loginSchema.extend({
  fullName: z.string().trim().min(2, 'Enter your full name').max(80),
  password: z.string().min(10, 'Use at least 10 characters').max(72),
});
export default function Auth({ register: registering = false }) {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const setSession = useAuth((s) => s.setSession);
  const [error, setError] = useState('');
  const [visible, setVisible] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(registering ? registrationSchema : loginSchema),
    shouldUnregister: true,
    defaultValues: { email: location.state?.registeredEmail || '', password: '' },
  });
  async function submit(values) {
    setError('');
    try {
      const { data } = await api.post(`/auth/${registering ? 'register' : 'login'}`, values);
      if (registering) {
        navigate('/login', { replace: true, state: { registeredEmail: values.email } });
        return;
      }
      queryClient.clear();
      setSession(data.data);
      navigate('/', { replace: true });
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  return (
    <div className="auth-page">
      <section className="auth-story">
        <Link className="brand" to="/">
          <span className="brand-mark">
            <ChartNoAxesCombined size={23} />
          </span>
          TradeX<span className="brand-dot">.</span>
        </Link>
        <div>
          <span className="eyebrow">THE MARKET IS YOUR CLASSROOM</span>
          <h1>
            Your edge starts
            <br />
            with practice<span>.</span>
          </h1>
          <p>
            A clearer view of the markets. A smarter way to build confidence. All with virtual
            money.
          </p>
          <div className="auth-benefits">
            {[
              '₹10,00,000 in virtual capital',
              'Indian stocks, one focused workspace',
              'Real decisions. Zero financial risk.',
            ].map((t) => (
              <div key={t}>
                <Check size={17} />
                {t}
              </div>
            ))}
          </div>
        </div>
        <small>PAPER TRADING ONLY · SIMULATED MARKET DATA</small>
      </section>
      <section className="auth-form-wrap">
        <div className="auth-form">
          <span className="pill">
            YOUR NEXT CHAPTER <ArrowUpRight size={12} />
          </span>
          <h2>{registering ? 'Build your market instinct.' : 'Welcome back.'}</h2>
          <p>
            {registering
              ? 'Create your free paper trading account.'
              : 'Your trading workspace is ready for you.'}
          </p>
          <form onSubmit={handleSubmit(submit)}>
            {!registering && location.state?.registeredEmail && (
              <div role="status" className="form-success">
                Account created. Sign in with your email and password to continue.
              </div>
            )}
            {registering && (
              <label>
                Full name
                <input autoComplete="name" placeholder="Your name" {...register('fullName')} />
                <em>{errors.fullName?.message}</em>
              </label>
            )}
            <label>
              Email address
              <input
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                {...register('email')}
              />
              <em>{errors.email?.message}</em>
            </label>
            <label>
              Password
              <div className="password-field">
                <input
                  type={visible ? 'text' : 'password'}
                  autoComplete={registering ? 'new-password' : 'current-password'}
                  placeholder="At least 10 characters"
                  {...register('password')}
                />
                <button
                  type="button"
                  className="icon-button"
                  aria-label={visible ? 'Hide password' : 'Show password'}
                  onClick={() => setVisible(!visible)}
                >
                  {visible ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
              <em>{errors.password?.message}</em>
            </label>
            {error && (
              <div role="alert" className="form-error">
                {error}
              </div>
            )}
            <button className="button primary wide" disabled={isSubmitting}>
              {isSubmitting ? 'Please wait…' : registering ? 'Create account' : 'Sign in'}
              <ChevronRight size={17} />
            </button>
          </form>
          <p className="auth-switch">
            {registering ? 'Already have an account?' : 'New to TradeX?'}{' '}
            <Link to={registering ? '/login' : '/register'}>
              {registering ? 'Sign in' : 'Create an account'}
            </Link>
          </p>
          <div className="auth-note">Virtual funds. No deposits. No brokerage connection.</div>
        </div>
      </section>
    </div>
  );
}
