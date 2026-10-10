import React, { useState } from 'react';
import {
  User,
  Mail,
  Calendar,
  Shield,
  Dumbbell,
  Trophy,
  Flame,
  Clock,
  Download,
  LogOut,
  Save,
  CheckCircle2,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/entities/user/model/authStore.ts';
import { apiClient } from '@/shared/api/client.ts';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/shared/ui';
import { Button } from '@/shared/ui';
import { Input } from '@/shared/ui';
import { Switch } from '@/shared/ui';
import { UserAvatar } from '@/entities/user/ui/UserAvatar.tsx';
import { BMICalculatorCard } from '@/features/bmi-calculator/ui/BMICalculatorCard.tsx';
import { LanguageSwitchToggle } from '@/features/switch-language/ui/LanguageSwitchToggle.tsx';
import { PWAInstallButton } from '@/features/pwa-install/ui/PWAInstallButton.tsx';
import { BodyTargetProgressCard } from '@/features/body-target-progress/ui/BodyTargetProgressCard.tsx';
import { useTranslation } from '@/shared/lib/i18n/i18n.ts';

interface ProfilePageProps {
  onNavigateToBody?: () => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({ onNavigateToBody }) => {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const setUnitPreference = useAuthStore((s) => s.setUnitPreference);
  const updateUserStats = useAuthStore((s) => s.updateUserStats);
  const { t } = useTranslation();

  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [unitPref, setUnitPref] = useState<'kg' | 'lb'>(user?.unit_preference || 'kg');
  const [defaultRestSecs, setDefaultRestSecs] = useState<number>(() => {
    return Number(localStorage.getItem('np_default_rest_secs') || '90');
  });
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    return localStorage.getItem('np_sound_enabled') !== 'false';
  });
  const [profileTargetCalories, setProfileTargetCalories] = useState<string>(() => {
    return String(user?.target_calories || localStorage.getItem('np_nutrition_target_calories') || '2500');
  });
  const [profileTargetProtein, setProfileTargetProtein] = useState<string>(() => {
    return String(user?.target_protein_g || localStorage.getItem('np_nutrition_target_protein_g') || '170');
  });
  const [profileTargetCarbs, setProfileTargetCarbs] = useState<string>(() => {
    return String(user?.target_carbs_g || localStorage.getItem('np_nutrition_target_carbs_g') || '280');
  });
  const [profileTargetFat, setProfileTargetFat] = useState<string>(() => {
    return String(user?.target_fat_g || localStorage.getItem('np_nutrition_target_fat_g') || '70');
  });
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Fetch summary stats
  const { data: workoutsData } = useQuery<{ items: any[] }>({
    queryKey: ['workouts', 'history'],
    queryFn: () => apiClient.get('/workouts?limit=100'),
  });

  const { data: recordsData } = useQuery<any[]>({
    queryKey: ['progress', 'records'],
    queryFn: () => apiClient.get('/progress/records'),
  });

  const totalWorkouts = workoutsData?.items?.length || 0;
  const totalVolumeKg = (workoutsData?.items || []).reduce(
    (acc, w) => acc + (w.total_volume_kg || 0),
    0
  );
  const totalPRs = (recordsData || []).reduce(
    (acc, group) => acc + (group.records?.length || 1),
    0
  );

  // Mutation to update unit preference
  const updateUnitMutation = useMutation({
    mutationFn: (unit: 'kg' | 'lb') =>
      apiClient.put('/profile/unit-preference', { unit_preference: unit }),
    onSuccess: (_, unit) => {
      setUnitPreference(unit);
      void queryClient.invalidateQueries();
    },
  });

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('np_default_rest_secs', defaultRestSecs.toString());
    localStorage.setItem('np_sound_enabled', soundEnabled.toString());

    const parsedCal = parseInt(profileTargetCalories, 10) || 2500;
    const parsedP = parseFloat(profileTargetProtein) || 170;
    const parsedC = parseFloat(profileTargetCarbs) || 280;
    const parsedF = parseFloat(profileTargetFat) || 70;

    localStorage.setItem('np_nutrition_target_calories', parsedCal.toString());
    localStorage.setItem('np_nutrition_target_protein_g', parsedP.toString());
    localStorage.setItem('np_nutrition_target_carbs_g', parsedC.toString());
    localStorage.setItem('np_nutrition_target_fat_g', parsedF.toString());

    updateUserStats({
      display_name: displayName,
      target_calories: parsedCal,
      target_protein_g: parsedP,
      target_carbs_g: parsedC,
      target_fat_g: parsedF,
    });

    void queryClient.invalidateQueries({ queryKey: ['nutrition', 'today'] });

    if (unitPref !== user?.unit_preference) {
      updateUnitMutation.mutate(unitPref);
    }

    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleExportData = () => {
    const exportObject = {
      user,
      export_date: new Date().toISOString(),
      workouts: workoutsData?.items || [],
      records: recordsData || [],
    };
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportObject, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `neverpaidhealth_backup_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Profile Header Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-dark-850 via-dark-800 to-brand-950/40 border border-dark-700/80 p-6 sm:p-8 shadow-2xl">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          <div className="relative">
            <UserAvatar user={user} size="lg" className="w-20 h-20 text-2xl ring-4 ring-brand-500/20 shadow-xl" />
            <div className="absolute -bottom-1 -right-1 bg-brand-500 text-dark-950 rounded-full p-1.5 shadow-md">
              <Shield className="w-4 h-4 fill-current" />
            </div>
          </div>

          <div className="flex-1 text-center sm:text-left space-y-2">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                {user?.display_name || 'Athlete'}
              </h1>
            </div>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs text-zinc-400">
              <span className="flex items-center gap-1.5">
                <Mail className="w-4 h-4 text-zinc-500" />
                {user?.email}
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-zinc-500" />
                Joined {user?.created_at ? new Date(user.created_at).toLocaleDateString('ru-RU', { month: 'short', year: 'numeric' }) : 'Recently'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="danger"
              size="sm"
              onClick={logout}
              className="text-xs gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>

      {/* Athletics Summary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="flex items-center gap-3.5 p-4.5 bg-dark-800/80 border-dark-700/70">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
            <Dumbbell className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-white tracking-tight font-mono">{totalWorkouts}</div>
            <div className="text-xs text-zinc-400 font-medium">Completed Workouts</div>
          </div>
        </Card>

        <Card className="flex items-center gap-3.5 p-4.5 bg-dark-800/80 border-dark-700/70">
          <div className="w-12 h-12 rounded-2xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400 shrink-0">
            <Flame className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-brand-400 tracking-tight font-mono">
              {totalVolumeKg > 1000 ? `${(totalVolumeKg / 1000).toFixed(1)} T` : `${totalVolumeKg.toFixed(0)} kg`}
            </div>
            <div className="text-xs text-zinc-400 font-medium">Total Volume Lifted</div>
          </div>
        </Card>

        <Card className="flex items-center gap-3.5 p-4.5 bg-dark-800/80 border-dark-700/70">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
            <Trophy className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-amber-400 tracking-tight font-mono">{totalPRs}</div>
            <div className="text-xs text-zinc-400 font-medium">Personal Records</div>
          </div>
        </Card>
      </div>

      {/* Body Target & Weight Progress Tracker Card */}
      <BodyTargetProgressCard onNavigateToBody={onNavigateToBody} />

      {/* Body Stats & BMI Calculator Card */}
      <BMICalculatorCard />

      {/* Settings Form */}
      <Card className="space-y-6">
        <CardHeader>
          <div>
            <CardTitle>
              <User className="w-5 h-5 text-brand-400" />
              Athlete Profile & Preferences
            </CardTitle>
            <CardDescription>
              Configure display name, default rest timers, language, and nutrition targets.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSaveSettings} className="space-y-5">
            {/* Display Name */}
            <div className="max-w-md">
              <Input
                label="Display Name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your athlete name or moniker"
              />
            </div>

            {/* Language Preference */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider block">
                {t('profile.languagePreference')}
              </label>
              <LanguageSwitchToggle variant="inline" />
            </div>

            {/* Unit System */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider block">
                {t('profile.unitPreference')}
              </label>
              <div className="grid grid-cols-2 gap-3 max-w-sm">
                <button
                  type="button"
                  onClick={() => setUnitPref('kg')}
                  className={`py-2.5 px-4 rounded-xl border text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    unitPref === 'kg'
                      ? 'bg-brand-500/15 border-brand-500 text-brand-400 shadow-md shadow-brand-500/10'
                      : 'bg-dark-900 border-dark-700 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Metric (KG / Kilograms)
                </button>
                <button
                  type="button"
                  onClick={() => setUnitPref('lb')}
                  className={`py-2.5 px-4 rounded-xl border text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    unitPref === 'lb'
                      ? 'bg-brand-500/15 border-brand-500 text-brand-400 shadow-md shadow-brand-500/10'
                      : 'bg-dark-900 border-dark-700 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Imperial (LB / Pounds)
                </button>
              </div>
            </div>

            {/* Default Rest Timer */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-zinc-400" />
                {t('profile.defaultRestTimer')}
              </label>
              <div className="grid grid-cols-5 gap-2 max-w-md">
                {[30, 60, 90, 120, 180].map((secs) => (
                  <button
                    key={secs}
                    type="button"
                    onClick={() => setDefaultRestSecs(secs)}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      defaultRestSecs === secs
                        ? 'bg-brand-500 border-brand-400 text-dark-950 shadow-sm'
                        : 'bg-dark-900 border-dark-700 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {secs >= 60 ? `${secs / 60}m` : `${secs}s`}
                  </button>
                ))}
              </div>
            </div>

            {/* Target Daily Nutrition & Macros */}
            <div className="space-y-3 pt-3 border-t border-dark-750">
              <div>
                <label className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-brand-400" />
                  {t('profile.nutritionTargetsTitle')}
                </label>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  {t('profile.nutritionTargetsDesc')}
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl">
                <div>
                  <label className="text-[10px] uppercase font-bold text-brand-400 block mb-1">
                    {t('profile.caloriesKcal')}
                  </label>
                  <Input
                    type="number"
                    value={profileTargetCalories}
                    onChange={(e) => setProfileTargetCalories(e.target.value)}
                    className="font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-emerald-400 block mb-1">
                    {t('profile.proteinG')}
                  </label>
                  <Input
                    type="number"
                    value={profileTargetProtein}
                    onChange={(e) => setProfileTargetProtein(e.target.value)}
                    className="font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-blue-400 block mb-1">
                    {t('profile.carbsG')}
                  </label>
                  <Input
                    type="number"
                    value={profileTargetCarbs}
                    onChange={(e) => setProfileTargetCarbs(e.target.value)}
                    className="font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-amber-400 block mb-1">
                    {t('profile.fatG')}
                  </label>
                  <Input
                    type="number"
                    value={profileTargetFat}
                    onChange={(e) => setProfileTargetFat(e.target.value)}
                    className="font-mono font-bold"
                  />
                </div>
              </div>
            </div>

            {/* Sound Notification Switch */}
            <div className="p-4 rounded-2xl bg-dark-900/70 border border-dark-700/70 max-w-lg">
              <Switch
                isSelected={soundEnabled}
                onValueChange={setSoundEnabled}
                label="Rest Timer Sound & Vibrate"
                description="Play audio chime when rest countdown reaches zero"
                color="primary"
              />
            </div>

            {/* Save Button */}
            <div className="flex items-center gap-3 pt-2">
              <Button
                type="submit"
                variant="primary"
                className="gap-2 px-6"
                disabled={updateUnitMutation.isPending}
                isLoading={updateUnitMutation.isPending}
              >
                <Save className="w-4 h-4" />
                Save Preferences
              </Button>
              {saveSuccess && (
                <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold animate-fade-in">
                  <CheckCircle2 className="w-4 h-4" /> Settings Saved!
                </span>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* PWA App Installation Option */}
      <PWAInstallButton variant="card" />

      {/* Data Backup & Privacy */}
      <Card className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
            <Download className="w-4 h-4 text-zinc-400" />
            Data Export & Backup
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            Export all your workout logs, sets, and personal records in standard JSON format.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleExportData}
          className="gap-1.5 shrink-0 text-xs"
        >
          <Download className="w-3.5 h-3.5" />
          Export My Data (JSON)
        </Button>
      </Card>
    </div>
  );
};
export default ProfilePage
