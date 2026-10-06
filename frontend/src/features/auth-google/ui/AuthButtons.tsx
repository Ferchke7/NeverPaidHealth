import React, { useState } from 'react';
import { Button } from '../../../shared/ui/button.tsx';
import { Input } from '../../../shared/ui/input.tsx';
import { apiClient } from '../../../shared/api/client.ts';
import { useAuthStore } from '../../../entities/user/model/authStore.ts';
import { AuthResponse } from '../../../entities/user/model/types.ts';

export const DevLoginModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState('athlete@neverpaid.dev');
  const [displayName, setDisplayName] = useState('Dev Athlete');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setAuth = useAuthStore((s) => s.setAuth);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await apiClient<AuthResponse>('/auth/dev-login', {
        method: 'POST',
        body: JSON.stringify({ email, display_name: displayName }),
      });
      setAuth(res.access_token, res.user);
      setIsOpen(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Dev login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Button variant="outline" size="md" className="w-full" onClick={() => setIsOpen(true)}>
        ⚡ Fast Dev Mode Login
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-dark-800 border border-dark-700 rounded-xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-base font-semibold text-zinc-100 mb-1">Local Dev Mode Login</h3>
            <p className="text-xs text-zinc-400 mb-4">Instant mock login bypass for development without Google OAuth credentials.</p>

            <form onSubmit={handleLogin} className="space-y-3">
              <Input
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Input
                label="Display Name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />

              {error && <p className="text-xs text-red-400">{error}</p>}

              <div className="flex gap-2 pt-2">
                <Button type="button" variant="ghost" className="w-full" onClick={() => setIsOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" className="w-full" disabled={loading}>
                  {loading ? 'Logging in...' : 'Sign In'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export const GoogleSignInButton: React.FC = () => {
  return (
    <Button
      variant="secondary"
      size="md"
      className="w-full flex items-center justify-center gap-2 border-dark-600 hover:bg-dark-700"
      onClick={() => alert('Google OAuth: In local development, use Fast Dev Mode Login below.')}
    >
      <svg className="w-4 h-4" viewBox="0 0 24 24">
        <path
          fill="currentColor"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        />
        <path
          fill="currentColor"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        />
        <path
          fill="currentColor"
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
        />
        <path
          fill="currentColor"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
        />
      </svg>
      Continue with Google
    </Button>
  );
};
