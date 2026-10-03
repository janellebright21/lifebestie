import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

type Mode = 'signin' | 'signup' | 'forgot' | 'reset';

interface AuthPageProps {
  initialMode?: Mode;
  onResetComplete?: () => void;
}

export default function AuthPage({ initialMode, onResetComplete }: AuthPageProps = {}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<Mode>(initialMode ?? 'signin');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Check URL for recovery token (Supabase redirects to ?type=recovery)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('type') === 'recovery') {
      setMode('reset');
    }
  }, []);

  async function handleSubmit() {
    setMessage(null);
    setError(null);

    if (mode === 'forgot') {
      if (!email) return;
      setLoading(true);
      const { error: forgotErr } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/?type=recovery`,
      });
      setLoading(false);
      if (forgotErr) {
        setError(forgotErr.message);
        return;
      }
      setMessage('Check your email for a password reset link.');
      return;
    }

    if (mode === 'reset') {
      if (!password) return;
      setLoading(true);
      const { error: updateErr } = await supabase.auth.updateUser({ password });
      setLoading(false);
      if (updateErr) {
        setError(updateErr.message);
        return;
      }
      setMessage('Password updated! You can now sign in.');
      if (onResetComplete) {
        onResetComplete();
      } else {
        setMode('signin');
      }
      return;
    }

    if (!email || !password) return;
    setLoading(true);

    const { error: authErr } =
      mode === 'signup'
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (authErr) {
      setError(authErr.message);
      return;
    }

    if (mode === 'signup') {
      setMessage('Account created! Check your email if confirmation is required.');
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 to-sky-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-sm border border-pink-100 p-6 space-y-4">
        <div className="text-center">
          <div className="text-4xl mb-2">💛</div>
          <h1 className="text-2xl font-bold text-gray-800">LifeBestie</h1>
          <p className="text-sm text-gray-400 mt-1">
            {mode === 'forgot' && 'Reset your password'}
            {mode === 'reset' && 'Set a new password'}
            {mode === 'signin' && 'Your calm little helper for home, work, kids, and life.'}
            {mode === 'signup' && 'Create your account to get started.'}
          </p>
        </div>

        {message && (
          <div className="bg-emerald-50 rounded-xl px-4 py-3 text-sm text-emerald-700">
            {message}
          </div>
        )}

        {error && (
          <div className="bg-red-50 rounded-xl px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Email field — shown for all modes */}
        {mode !== 'reset' && (
          <input
            className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm outline-none border border-transparent focus:border-sky-200"
            placeholder="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        )}

        {/* Password field — hidden for forgot mode */}
        {mode !== 'forgot' && (
          <input
            className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm outline-none border border-transparent focus:border-sky-200"
            placeholder={mode === 'reset' ? 'New password' : 'Password'}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        )}

        <button
          onClick={handleSubmit}
          disabled={loading || (mode !== 'forgot' && (!email || !password)) || (mode === 'forgot' && !email)}
          className="w-full bg-sky-500 text-white rounded-xl py-3 text-sm font-semibold disabled:opacity-40"
        >
          {loading ? 'Please wait…' :
            mode === 'signin' ? 'Sign In' :
            mode === 'signup' ? 'Create Account' :
            mode === 'forgot' ? 'Send Reset Link' :
            'Update Password'
          }
        </button>

        {/* Mode switching links */}
        <div className="flex flex-col gap-2 text-center">
          {mode === 'signin' && (
            <>
              <button onClick={() => setMode('signup')} className="text-sm text-gray-500">
                Don't have an account? Create one
              </button>
              <button onClick={() => { setMode('forgot'); setMessage(null); setError(null); }} className="text-xs text-gray-400">
                Forgot password?
              </button>
            </>
          )}
          {mode === 'signup' && (
            <button onClick={() => setMode('signin')} className="text-sm text-gray-500">
              Already have an account? Sign in
            </button>
          )}
          {mode === 'forgot' && (
            <button onClick={() => { setMode('signin'); setMessage(null); setError(null); }} className="text-sm text-gray-500">
              Back to sign in
            </button>
          )}
          {mode === 'reset' && (
            <button onClick={() => { setMode('signin'); setMessage(null); setError(null); }} className="text-sm text-gray-500">
              Back to sign in
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
