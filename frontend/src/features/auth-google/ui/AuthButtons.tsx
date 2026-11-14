import React, { useState, useEffect, useRef } from 'react';
import { apiClient } from '../../../shared/api/client.ts';
import { useAuthStore } from '../../../entities/user/model/authStore.ts';
import { AuthResponse } from '../../../entities/user/model/types.ts';
import { ENV } from '../../../shared/config/env.ts';
import { useTranslation } from '../../../shared/lib/i18n/i18n.ts';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }) => void;
          prompt: (momentListener?: (notification: unknown) => void) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              theme?: 'outline' | 'filled_blue' | 'filled_black';
              size?: 'large' | 'medium' | 'small';
              width?: number | string;
              text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
              shape?: 'rectangular' | 'pill' | 'circle' | 'square';
              logo_alignment?: 'left' | 'center';
            }
          ) => void;
        };
      };
    };
  }
}

export const GoogleSignInButton: React.FC = () => {
  const setAuth = useAuthStore((s) => s.setAuth);
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const googleBtnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ENV.GOOGLE_CLIENT_ID) return;

    const existingScript = document.getElementById('google-gsi-client');
    if (!existingScript) {
      const script = document.createElement('script');
      script.id = 'google-gsi-client';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = initGoogle;
      document.body.appendChild(script);
    } else if (window.google) {
      initGoogle();
    }

    function initGoogle() {
      if (!window.google || !ENV.GOOGLE_CLIENT_ID) return;

      try {
        window.google.accounts.id.initialize({
          client_id: ENV.GOOGLE_CLIENT_ID,
          callback: async (response: { credential: string }) => {
            setLoading(true);
            setError(null);
            try {
              const res = await apiClient<AuthResponse>('/auth/google', {
                method: 'POST',
                body: JSON.stringify({ id_token: response.credential }),
              });
              setAuth(res.access_token, res.user);
            } catch (err: unknown) {
              setError(err instanceof Error ? err.message : 'Google authentication failed');
            } finally {
              setLoading(false);
            }
          },
          auto_select: false,
          cancel_on_tap_outside: true,
        });

        if (googleBtnRef.current) {
          googleBtnRef.current.innerHTML = '';
          window.google.accounts.id.renderButton(googleBtnRef.current, {
            theme: 'filled_black',
            size: 'large',
            width: '100%',
            text: 'continue_with',
            shape: 'rectangular',
          });
        }
      } catch (e) {
        console.warn('Google GSI init failed:', e);
      }
    }
  }, [setAuth]);

  const handleManualClick = () => {
    if (!ENV.GOOGLE_CLIENT_ID) {
      setError('Google Client ID is not configured yet.');
      return;
    }

    if (window.google) {
      window.google.accounts.id.prompt();
    } else {
      setError('Google Sign-In SDK is loading. Please try again in a moment.');
    }
  };

  const buttonText = loading
    ? t('auth.signingIn') || 'Входим…'
    : t('auth.continueWithGoogleBtn') || 'Продолжить с Google';

  return (
    <div className="space-y-3">
      {ENV.GOOGLE_CLIENT_ID ? (
        <div ref={googleBtnRef} className="w-full flex justify-center min-h-[44px]">
          <button
            type="button"
            className="w-full h-[44px] flex items-center justify-center gap-2.5 bg-[#34d399] hover:bg-[#34d399]/90 text-[#0a0a0a] rounded-[10px] px-4 font-medium text-[14px] transition-colors disabled:opacity-60 cursor-pointer"
            onClick={handleManualClick}
            disabled={loading}
          >
            <GoogleIcon />
            <span>{buttonText}</span>
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="w-full h-[44px] flex items-center justify-center gap-2.5 bg-[#34d399] hover:bg-[#34d399]/90 text-[#0a0a0a] rounded-[10px] px-4 font-medium text-[14px] transition-colors disabled:opacity-60 cursor-pointer"
          onClick={handleManualClick}
          disabled={loading}
        >
          <GoogleIcon />
          <span>{buttonText}</span>
        </button>
      )}

      {error && (
        <div className="bg-[#262626] rounded-[10px] px-4 py-3 text-[13px] text-[#fafafa]">
          {error}
        </div>
      )}
    </div>
  );
};

const GoogleIcon: React.FC = () => (
  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="currentColor"
      d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81z"
    />
  </svg>
);
