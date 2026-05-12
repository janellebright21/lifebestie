import { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function AuthPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!email || !password) return;

    setLoading(true);

    const { error } =
      mode === 'signup'
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    if (mode === 'signup') {
      alert('Account created! Check your email if confirmation is required.');
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 to-sky-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-sm border border-pink-100 p-6 space-y-4">
        <div className="text-center">
          <div className="text-4xl mb-2">💛</div>
          <h1 className="text-2xl font-bold text-gray-800">LifeBestie</h1>
          <p className="text-sm text-gray-400 mt-1">
            Your calm little helper for home, work, kids, and life.
          </p>
        </div>

        <input
          className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm outline-none border border-transparent focus:border-sky-200"
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm outline-none border border-transparent focus:border-sky-200"
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button
          onClick={handleSubmit}
          disabled={loading || !email || !password}
          className="w-full bg-sky-500 text-white rounded-xl py-3 text-sm font-semibold disabled:opacity-40"
        >
          {loading ? 'Please wait…' : mode === 'signin' ? 'Sign In' : 'Create Account'}
        </button>

        <button
          onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
          className="w-full text-sm text-gray-500"
        >
          {mode === 'signin'
            ? "Don't have an account? Create one"
            : 'Already have an account? Sign in'}
        </button>
      </div>
    </div>
  );
}