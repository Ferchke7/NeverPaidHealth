import React from 'react';
import { useAuthStore } from '../../../entities/user/model/authStore.ts';
import { apiClient } from '../../../shared/api/client.ts';
import { UserProfile } from '../../../entities/user/model/types.ts';

export const UnitSwitchToggle: React.FC = () => {
  const unit = useAuthStore((s) => s.unitPreference);
  const setUnitPreference = useAuthStore((s) => s.setUnitPreference);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const toggleUnit = async () => {
    const nextUnit = unit === 'kg' ? 'lb' : 'kg';
    setUnitPreference(nextUnit);

    if (isAuthenticated) {
      try {
        await apiClient<UserProfile>('/profile/unit-preference', {
          method: 'PUT',
          body: JSON.stringify({ unit_preference: nextUnit }),
        });
      } catch (err) {
        console.error('Failed syncing unit preference to backend:', err);
      }
    }
  };

  return (
    <button
      onClick={toggleUnit}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-dark-800 border border-dark-700 text-xs font-semibold text-zinc-300 hover:text-white hover:border-dark-600 transition-colors"
      title="Click to toggle weight units (kg / lb)"
    >
      <span className={unit === 'kg' ? 'text-brand-500 font-bold' : 'text-zinc-500'}>KG</span>
      <span className="text-dark-600">/</span>
      <span className={unit === 'lb' ? 'text-brand-500 font-bold' : 'text-zinc-500'}>LB</span>
    </button>
  );
};
