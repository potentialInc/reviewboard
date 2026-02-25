'use client';

import { useState, useEffect } from 'react';
import { LogIn, Layers, User, Lock } from 'lucide-react';

export default function LoginPage() {
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Redirect already-authenticated users (lightweight check)
  useEffect(() => {
    fetch('/api/auth/me').then(r => {
      if (r.ok) return r.json();
      return null;
    }).then(data => {
      if (data?.type === 'admin') window.location.href = '/admin';
      else if (data?.type) window.location.href = '/client/projects';
    }).catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Login failed');
        return;
      }

      window.location.href = data.redirect;
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="bg-card rounded-2xl shadow-xl border border-border p-8">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/30">
                <Layers className="w-7 h-7 text-white" aria-hidden="true" />
              </div>
            </div>
            <h1 className="text-2xl font-bold font-jakarta text-foreground">Welcome to ReviewBoard</h1>
            <p className="text-sm text-muted mt-2">Enter your shared client credentials or admin key.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5" aria-label="Login form">
            <div>
              <label htmlFor="id" className="block text-sm font-medium text-foreground mb-1.5">
                Access ID
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
                <input
                  id="id"
                  type="text"
                  value={id}
                  onChange={(e) => setId(e.target.value)}
                  placeholder="e.g. ProjectAlpha882"
                  autoComplete="username"
                  aria-describedby={error ? 'login-error' : undefined}
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-white text-foreground placeholder:text-gray-400 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-colors"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  aria-describedby="password-hint"
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-white text-foreground placeholder:text-gray-400 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-colors"
                  required
                />
              </div>
              <p id="password-hint" className="text-xs text-muted mt-1.5">Password is pre-set by admin invitation.</p>
            </div>

            {error && (
              <p id="login-error" role="alert" className="text-sm text-status-open bg-status-open-bg rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary-hover focus:outline-none focus:ring-4 focus:ring-primary/20 shadow-lg shadow-primary/20 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {loading ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" role="status" aria-label="Signing in" />
              ) : (
                <LogIn className="w-4 h-4" aria-hidden="true" />
              )}
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-border text-center">
            <span className="text-xs font-medium text-muted hover:text-primary transition-colors cursor-pointer">
              Are you an Admin? Login here
            </span>
          </div>
        </div>
      </div>
    </main>
  );
}
