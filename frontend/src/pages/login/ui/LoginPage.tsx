import React from 'react';
import { GoogleSignInButton, DevLoginModal } from '../../../features/auth-google/ui/AuthButtons.tsx';
import { Dumbbell, ShieldCheck, Zap, Sparkles } from 'lucide-react';

export const LoginPage: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-dark-900 via-dark-900 to-black">
      <div className="max-w-md w-full space-y-8 text-center">
        {/* Logo & Title */}
        <div className="space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-brand-500/10 border border-brand-500/30 flex items-center justify-center mx-auto text-brand-500 shadow-xl shadow-brand-500/5">
            <Dumbbell className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            duda<span className="text-brand-500">.uz</span>
          </h1>
          <p className="text-sm text-zinc-400 max-w-sm mx-auto">
            The free, open, and mathematically exact workout tracker. Unlimited routines, local resilience, and instant analytics.
          </p>
        </div>

        {/* Feature Badges */}
        <div className="grid grid-cols-3 gap-2 text-left bg-dark-800/60 border border-dark-700/60 rounded-xl p-3 text-xs text-zinc-300">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-brand-500 shrink-0" />
            <span>100% Free</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Fast Gym UI</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-sky-400 shrink-0" />
            <span>Exact 1RM</span>
          </div>
        </div>

        {/* Auth Actions */}
        <div className="space-y-3 pt-2">
          <GoogleSignInButton />
          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-dark-700"></div>
            <span className="flex-shrink mx-4 text-xs uppercase tracking-widest text-zinc-500 font-semibold">Or</span>
            <div className="flex-grow border-t border-dark-700"></div>
          </div>
          <DevLoginModal />
        </div>

        <p className="text-xs text-zinc-600">
          Built with Clean Architecture, Domain-Driven Design & Khorikov testing standards.
        </p>
      </div>
    </div>
  );
};
