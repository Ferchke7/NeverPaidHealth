import React, { useState, useMemo } from 'react';
import {
  Dumbbell,
  Trophy,
  Flame,
  Download,
  LogOut,
  Save,
  CheckCircle2,
  ThumbsUp,
  MessageSquare,
  Plus,
  Shield,
  ArrowRight,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/entities/user/model/authStore.ts';
import { apiClient } from '@/shared/api/client.ts';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/shared/ui';
import { Button } from '@/shared/ui';
import { Input } from '@/shared/ui';
import { Switch } from '@/shared/ui';
import { UserAvatar } from '@/entities/user/ui/UserAvatar.tsx';
import { LanguageSwitchToggle } from '@/features/switch-language/ui/LanguageSwitchToggle.tsx';
import { PWAInstallButton } from '@/features/pwa-install/ui/PWAInstallButton.tsx';
import { FeedbackModal } from '@/features/feedback/ui/FeedbackModal.tsx';
import { useTranslation } from '@/shared/lib/i18n/i18n.ts';

interface ProfilePageProps {
  onNavigateToBody?: () => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({ onNavigateToBody }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const setUnitPreference = useAuthStore((s) => s.setUnitPreference);
  const updateUserStats = useAuthStore((s) => s.updateUserStats);
  const { t, language } = useTranslation();

  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [unitPref, setUnitPref] = useState<'kg' | 'lb'>(user?.unit_preference || 'kg');
  const [defaultRestSecs, setDefaultRestSecs] = useState<number>(() => {
    return Number(localStorage.getItem('np_default_rest_secs') || '90');
  });
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    return localStorage.getItem('np_sound_enabled') !== 'false';
  });
  const [profileTargetCalories, setProfileTargetCalories] = useState<string>(() => {
    return String(
      user?.target_calories || localStorage.getItem('np_nutrition_target_calories') || '2500'
    );
  });
  const [profileTargetProtein, setProfileTargetProtein] = useState<string>(() => {
    return String(
      user?.target_protein_g || localStorage.getItem('np_nutrition_target_protein_g') || '170'
    );
  });
  const [profileTargetCarbs, setProfileTargetCarbs] = useState<string>(() => {
    return String(
      user?.target_carbs_g || localStorage.getItem('np_nutrition_target_carbs_g') || '280'
    );
  });
  const [profileTargetFat, setProfileTargetFat] = useState<string>(() => {
    return String(
      user?.target_fat_g || localStorage.getItem('np_nutrition_target_fat_g') || '70'
    );
  });
  const [targetWeightKgInput, setTargetWeightKgInput] = useState<string>(() => {
    const val = user?.target_weight_kg || localStorage.getItem('np_target_weight_kg') || '';
    return val ? String(val) : '';
  });
  const [heightCmInput, setHeightCmInput] = useState<string>(() => {
    const val = user?.height_cm || localStorage.getItem('np_saved_height_cm') || '';
    return val ? String(val) : '';
  });
  const [ageYearsInput, setAgeYearsInput] = useState<string>(() => {
    if (user?.birth_year) {
      return String(Math.max(12, new Date().getFullYear() - user.birth_year));
    }
    return localStorage.getItem('np_age_years') || '';
  });
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  const labels = useMemo(() => {
    if (language === 'ru') {
      return {
        joined: 'С нами с',
        signOut: 'Выйти',
        completedWorkouts: 'Тренировки',
        totalVolume: 'Общий тоннаж',
        personalRecords: 'Рекорды (PR)',
        displayNameLabel: 'Имя',
        displayNamePlaceholder: 'Ваше имя или никнейм',
        metricKg: 'Метрическая (KG)',
        imperialLb: 'Имперская (LB)',
        soundLabel: 'Звук таймера отдыха',
        soundDesc: 'Звуковой сигнал по окончании отдыха между подходами',
        savedMsg: 'Сохранено!',
        exportTitle: 'JSON-экспорт тренировок',
        exportDesc: 'Скачать историю тренировок, подходов и личных рекордов.',
        exportBtn: 'Скачать JSON',
      };
    }
    if (language === 'uz') {
      return {
        joined: 'Ro‘yxatdan o‘tgan:',
        signOut: 'Chiqish',
        completedWorkouts: 'Mashg‘ulotlar',
        totalVolume: 'Umumiy tonnaj',
        personalRecords: 'Rekordlar (PR)',
        displayNameLabel: 'Ismingiz',
        displayNamePlaceholder: 'Ism yoki taxallus',
        metricKg: 'Metrik (KG)',
        imperialLb: 'Imperial (LB)',
        soundLabel: 'Dam olish taymeri ovozi',
        soundDesc: 'Taymer tugaganda ovozli signal chalish',
        savedMsg: 'Saqlandi!',
        exportTitle: 'Ma’lumotlarni eksport qilish (JSON)',
        exportDesc: 'Barcha mashg‘ulotlar va rekordlarni JSON formatda yuklash.',
        exportBtn: 'JSON yuklab olish',
      };
    }
    return {
      joined: 'Joined',
      signOut: 'Sign Out',
      completedWorkouts: 'Workouts',
      totalVolume: 'Total Volume',
      personalRecords: 'Personal Records',
      displayNameLabel: 'Display Name',
      displayNamePlaceholder: 'Your athlete name',
      metricKg: 'Metric (KG)',
      imperialLb: 'Imperial (LB)',
      soundLabel: 'Rest Timer Sound',
      soundDesc: 'Play audio chime when rest countdown finishes',
      savedMsg: 'Settings Saved!',
      exportTitle: 'Workout JSON Export',
      exportDesc: 'Download your complete workout logs, sets, and personal records.',
      exportBtn: 'Export JSON',
    };
  }, [language]);

  // Summary queries
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

  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);

  const { data: platformStats } = useQuery<{
    total_workouts: number;
    total_tonnage_kg: number;
    total_programs: number;
    total_installs: number;
    total_feedbacks: number;
    total_reviews: number;
    active_athletes_30d: number;
  }>({
    queryKey: ['platform', 'stats'],
    queryFn: () => apiClient.get('/platform/stats'),
  });

  const { data: rawFeedbacks = [], refetch: refetchFeedbacks } = useQuery<any[]>({
    queryKey: ['feedback'],
    queryFn: () => apiClient.get('/feedback'),
  });
  const feedbacks = Array.isArray(rawFeedbacks) ? rawFeedbacks : [];

  const upvoteMutation = useMutation({
    mutationFn: (feedbackId: string) => apiClient.post(`/feedback/${feedbackId}/upvote`),
    onSuccess: () => {
      void refetchFeedbacks();
    },
  });

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
    const parsedTargetWeight = parseFloat(targetWeightKgInput);
    const parsedHeight = parseFloat(heightCmInput);
    const parsedAge = parseInt(ageYearsInput, 10);

    localStorage.setItem('np_nutrition_target_calories', parsedCal.toString());
    localStorage.setItem('np_nutrition_target_protein_g', parsedP.toString());
    localStorage.setItem('np_nutrition_target_carbs_g', parsedC.toString());
    localStorage.setItem('np_nutrition_target_fat_g', parsedF.toString());

    if (!isNaN(parsedTargetWeight) && parsedTargetWeight > 0) {
      localStorage.setItem('np_target_weight_kg', parsedTargetWeight.toString());
    }
    if (!isNaN(parsedHeight) && parsedHeight > 0) {
      localStorage.setItem('np_saved_height_cm', parsedHeight.toString());
    }
    if (!isNaN(parsedAge) && parsedAge > 0) {
      localStorage.setItem('np_age_years', parsedAge.toString());
    }

    updateUserStats({
      display_name: displayName,
      target_calories: parsedCal,
      target_protein_g: parsedP,
      target_carbs_g: parsedC,
      target_fat_g: parsedF,
      ...(!isNaN(parsedTargetWeight) && parsedTargetWeight > 0
        ? { target_weight_kg: parsedTargetWeight }
        : {}),
      ...(!isNaN(parsedHeight) && parsedHeight > 0 ? { height_cm: parsedHeight } : {}),
      ...(!isNaN(parsedAge) && parsedAge > 0
        ? { birth_year: new Date().getFullYear() - parsedAge }
        : {}),
    });

    void queryClient.invalidateQueries({ queryKey: ['nutrition', 'today'] });
    void queryClient.invalidateQueries({ queryKey: ['body-trend'] });

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
    const dataStr =
      'data:text/json;charset=utf-8,' +
      encodeURIComponent(JSON.stringify(exportObject, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute(
      'download',
      `neverpaidhealth_backup_${new Date().toISOString().slice(0, 10)}.json`
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const macroP = parseFloat(profileTargetProtein) || 0;
  const macroC = parseFloat(profileTargetCarbs) || 0;
  const macroF = parseFloat(profileTargetFat) || 0;
  const formulaKcal = Math.round(macroP * 4 + macroC * 4 + macroF * 9);

  return (
    <div className="space-y-6">
      {/* 1. Page Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-[#fafafa] tracking-tight">
          {t('profile.title')}
        </h1>
        <p className="text-sm text-[#a3a3a3] mt-1">{t('profile.subtitle')}</p>
      </div>

      {/* 2. Athlete KPI Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="p-4 sm:p-5 bg-[#171717] border-[#404040] flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-[10px] bg-[#0a0a0a] border border-[#262626] flex items-center justify-center text-[#34d399] shrink-0">
            <Dumbbell className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold font-mono tabular-nums text-[#fafafa]">
              {totalWorkouts}
            </div>
            <div className="text-xs text-[#a3a3a3]">{labels.completedWorkouts}</div>
          </div>
        </Card>

        <Card className="p-4 sm:p-5 bg-[#171717] border-[#404040] flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-[10px] bg-[#0a0a0a] border border-[#262626] flex items-center justify-center text-[#34d399] shrink-0">
            <Flame className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold font-mono tabular-nums text-[#34d399]">
              {(totalVolumeKg / 1000).toFixed(1)} t
            </div>
            <div className="text-xs text-[#a3a3a3]">{labels.totalVolume}</div>
          </div>
        </Card>

        <Card className="p-4 sm:p-5 bg-[#171717] border-[#404040] flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-[10px] bg-[#0a0a0a] border border-[#262626] flex items-center justify-center text-[#34d399] shrink-0">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold font-mono tabular-nums text-[#fafafa]">
              {totalPRs}
            </div>
            <div className="text-xs text-[#a3a3a3]">{labels.personalRecords}</div>
          </div>
        </Card>
      </div>

      {/* 3. Preferences Form: Account + Workouts + Nutrition/Body Targets */}
      <form onSubmit={handleSaveSettings} className="space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          {/* Card A: Account */}
          <Card className="p-4 sm:p-5 bg-[#171717] border-[#404040] space-y-4">
            <CardHeader className="pb-3 border-b border-[#262626] mb-0">
              <CardTitle className="text-base">{t('profile.accountCard')}</CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-3.5 p-3 rounded-[12px] bg-[#0a0a0a] border border-[#262626]">
                <UserAvatar user={user} size="lg" className="w-14 h-14 text-xl shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-base font-semibold text-[#fafafa] truncate">
                    {displayName || user?.display_name || 'NeverPaidHealth Athlete'}
                  </div>
                  <div className="text-xs text-[#a3a3a3] truncate">{user?.email}</div>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[6px] bg-[#022c22] border border-[#064e3b] text-[11px] font-medium text-[#34d399]">
                      <Shield className="w-3 h-3" />
                      {t('profile.googleAuth')}
                    </span>
                    {user?.created_at && (
                      <span className="text-[11px] font-mono tabular-nums text-[#737373]">
                        {labels.joined} {new Date(user.created_at).getFullYear()}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <Input
                label={labels.displayNameLabel}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={labels.displayNamePlaceholder}
              />

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-[#a3a3a3]">
                  {t('profile.languagePreference')}
                </label>
                <LanguageSwitchToggle variant="inline" />
              </div>
            </CardContent>
          </Card>

          {/* Card B: Workouts & Rest Timer */}
          <Card className="p-4 sm:p-5 bg-[#171717] border-[#404040] space-y-4">
            <CardHeader className="pb-3 border-b border-[#262626] mb-0">
              <CardTitle className="text-base">{t('profile.workoutsCard')}</CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-[#a3a3a3]">
                  {t('profile.unitPreference')}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setUnitPref('kg')}
                    className={`min-h-[44px] px-3 rounded-[10px] border text-xs font-semibold transition-colors cursor-pointer ${
                      unitPref === 'kg'
                        ? 'bg-[#022c22] border-[#064e3b] text-[#34d399]'
                        : 'bg-[#0a0a0a] border-[#404040] text-[#a3a3a3] hover:text-[#fafafa]'
                    }`}
                  >
                    {labels.metricKg}
                  </button>
                  <button
                    type="button"
                    onClick={() => setUnitPref('lb')}
                    className={`min-h-[44px] px-3 rounded-[10px] border text-xs font-semibold transition-colors cursor-pointer ${
                      unitPref === 'lb'
                        ? 'bg-[#022c22] border-[#064e3b] text-[#34d399]'
                        : 'bg-[#0a0a0a] border-[#404040] text-[#a3a3a3] hover:text-[#fafafa]'
                    }`}
                  >
                    {labels.imperialLb}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-[#a3a3a3]">
                  {t('profile.defaultRestTimer')}
                </label>
                <div className="grid grid-cols-5 gap-1.5">
                  {[30, 60, 90, 120, 180].map((secs) => (
                    <button
                      key={secs}
                      type="button"
                      onClick={() => setDefaultRestSecs(secs)}
                      className={`min-h-[44px] rounded-[10px] text-xs font-mono tabular-nums font-semibold border transition-colors cursor-pointer ${
                        defaultRestSecs === secs
                          ? 'bg-[#022c22] border-[#064e3b] text-[#34d399]'
                          : 'bg-[#0a0a0a] border-[#404040] text-[#a3a3a3] hover:text-[#fafafa]'
                      }`}
                    >
                      {secs}s
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3.5 rounded-[12px] bg-[#0a0a0a] border border-[#262626] flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-[#fafafa]">{labels.soundLabel}</div>
                  <div className="text-xs text-[#a3a3a3] mt-0.5">{labels.soundDesc}</div>
                </div>
                <Switch isSelected={soundEnabled} onValueChange={setSoundEnabled} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Full-Width Card: Nutrition & Body Targets */}
        <Card className="p-4 sm:p-5 bg-[#171717] border-[#404040] space-y-4">
          <CardHeader className="pb-3 border-b border-[#262626] mb-0 flex flex-col sm:flex-row sm:items-center items-start justify-between gap-1.5">
            <CardTitle className="text-base">{t('profile.targetsCard')}</CardTitle>
            <CardDescription>{t('profile.nutritionTargetsDesc')}</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Input
                type="number"
                label={t('profile.caloriesKcal')}
                value={profileTargetCalories}
                onChange={(e) => setProfileTargetCalories(e.target.value)}
                min="800"
                max="10000"
              />
              <Input
                type="number"
                label={t('profile.proteinG')}
                value={profileTargetProtein}
                onChange={(e) => setProfileTargetProtein(e.target.value)}
                min="20"
                max="600"
              />
              <Input
                type="number"
                label={t('profile.carbsG')}
                value={profileTargetCarbs}
                onChange={(e) => setProfileTargetCarbs(e.target.value)}
                min="0"
                max="1200"
              />
              <Input
                type="number"
                label={t('profile.fatG')}
                value={profileTargetFat}
                onChange={(e) => setProfileTargetFat(e.target.value)}
                min="10"
                max="400"
              />
            </div>

            <div className="px-3.5 py-2.5 rounded-[10px] bg-[#0a0a0a] border border-[#262626] flex flex-wrap items-center justify-between gap-2 text-xs font-mono tabular-nums">
              <span className="text-[#a3a3a3]">
                {Math.round(macroP)}×4 + {Math.round(macroC)}×4 + {Math.round(macroF)}×9
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[#34d399] font-semibold">
                  = {formulaKcal} {t('nutrition.kcalUnit')}
                </span>
                {formulaKcal > 0 && String(formulaKcal) !== profileTargetCalories && (
                  <button
                    type="button"
                    onClick={() => setProfileTargetCalories(String(formulaKcal))}
                    className="min-h-[44px] px-2.5 -my-2 rounded-[8px] border border-[#404040] bg-[#171717] hover:border-[#34d399]/60 text-[11px] font-sans text-[#fafafa] cursor-pointer"
                  >
                    = {formulaKcal}
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input
                type="number"
                step="0.1"
                label={t('profile.targetWeightKg')}
                value={targetWeightKgInput}
                onChange={(e) => setTargetWeightKgInput(e.target.value)}
                placeholder="75.0"
              />
              <Input
                type="number"
                step="1"
                label={t('profile.heightCm')}
                value={heightCmInput}
                onChange={(e) => setHeightCmInput(e.target.value)}
                placeholder="180"
              />
              <Input
                type="number"
                step="1"
                label={t('profile.ageYears')}
                value={ageYearsInput}
                onChange={(e) => setAgeYearsInput(e.target.value)}
                placeholder="26"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#262626]">
              <div className="text-xs">
                {saveSuccess && (
                  <span className="inline-flex items-center gap-1.5 text-[#34d399] font-medium">
                    <CheckCircle2 className="w-4 h-4" />
                    {labels.savedMsg}
                  </span>
                )}
              </div>

              <Button type="submit" variant="primary" size="md">
                <Save className="w-4 h-4 mr-1.5" />
                {t('profile.savePreferences')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>

      {/* 4. Bottom 2-Column Grid: Data & App + Community Feedback */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {/* Left: Data, Navigation, PWA & Explicit Sign Out */}
        <Card className="p-4 sm:p-5 bg-[#171717] border-[#404040] space-y-4">
          <CardHeader className="pb-3 border-b border-[#262626] mb-0">
            <CardTitle className="text-base">{t('profile.dataAndApp')}</CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => (onNavigateToBody ? onNavigateToBody() : navigate('/body'))}
                className="min-h-[44px] px-3.5 py-2.5 rounded-[10px] bg-[#0a0a0a] border border-[#404040] hover:border-[#34d399]/60 flex items-center justify-between text-xs font-medium text-[#fafafa] transition-colors cursor-pointer"
              >
                <span>{t('profile.quickNavBody')}</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#34d399]" />
              </button>

              <button
                type="button"
                onClick={() => navigate('/history')}
                className="min-h-[44px] px-3.5 py-2.5 rounded-[10px] bg-[#0a0a0a] border border-[#404040] hover:border-[#34d399]/60 flex items-center justify-between text-xs font-medium text-[#fafafa] transition-colors cursor-pointer"
              >
                <span>{t('profile.quickNavHistory')}</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#34d399]" />
              </button>
            </div>

            <div className="p-3.5 rounded-[12px] bg-[#0a0a0a] border border-[#262626] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-medium text-[#fafafa]">{labels.exportTitle}</div>
                <div className="text-xs text-[#a3a3a3] mt-0.5">{labels.exportDesc}</div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={handleExportData}
                className="shrink-0 w-full sm:w-auto justify-center"
              >
                <Download className="w-4 h-4 mr-1.5" />
                {labels.exportBtn}
              </Button>
            </div>

            <PWAInstallButton variant="card" />

            {/* Explicit 2-step Sign Out Confirmation */}
            {!confirmSignOut ? (
              <Button
                type="button"
                variant="outline"
                className="w-full text-red-400 border-[#404040] hover:border-red-900 hover:bg-red-950/30"
                onClick={() => setConfirmSignOut(true)}
              >
                <LogOut className="w-4 h-4 mr-1.5" />
                {t('profile.signOutTrigger')}
              </Button>
            ) : (
              <div className="p-3.5 rounded-[12px] bg-[#0a0a0a] border border-red-900 space-y-2.5">
                <div>
                  <div className="text-sm font-semibold text-[#fafafa]">
                    {t('profile.signOutPromptTitle')}
                  </div>
                  <div className="text-xs text-[#a3a3a3] mt-0.5">
                    {t('profile.signOutPromptDesc')}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => setConfirmSignOut(false)}
                  >
                    {t('common.cancel')}
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    className="flex-1"
                    onClick={() => logout()}
                  >
                    <LogOut className="w-3.5 h-3.5 mr-1.5" />
                    {labels.signOut}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right: Community Ideas & Platform Telemetry */}
        <Card className="p-4 sm:p-5 bg-[#171717] border-[#404040] space-y-4">
          <CardHeader className="pb-3 border-b border-[#262626] mb-0 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-[#34d399]" />
                {t('profile.feedbackTitle')}
              </CardTitle>
              <CardDescription className="mt-0.5">
                {t('profile.feedbackSubtitle')}
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={() => setIsFeedbackModalOpen(true)}
              className="shrink-0 w-full sm:w-auto justify-center"
            >
              <Plus className="w-4 h-4 mr-1" />
              {t('profile.viewAndVote')}
            </Button>
          </CardHeader>

          <CardContent className="space-y-3">
            {platformStats && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="p-2.5 rounded-[10px] bg-[#0a0a0a] border border-[#262626]">
                  <div className="text-[11px] text-[#a3a3a3]">30d</div>
                  <div className="text-sm font-mono tabular-nums font-semibold text-[#fafafa] mt-0.5">
                    {platformStats.active_athletes_30d ?? 1}
                  </div>
                </div>
                <div className="p-2.5 rounded-[10px] bg-[#0a0a0a] border border-[#262626]">
                  <div className="text-[11px] text-[#a3a3a3]">{labels.completedWorkouts}</div>
                  <div className="text-sm font-mono tabular-nums font-semibold text-[#fafafa] mt-0.5">
                    {platformStats.total_workouts ?? 0}
                  </div>
                </div>
                <div className="p-2.5 rounded-[10px] bg-[#0a0a0a] border border-[#262626]">
                  <div className="text-[11px] text-[#a3a3a3]">{labels.totalVolume}</div>
                  <div className="text-sm font-mono tabular-nums font-semibold text-[#34d399] mt-0.5">
                    {(platformStats.total_tonnage_kg ?? 0) > 1000
                      ? `${((platformStats.total_tonnage_kg ?? 0) / 1000).toFixed(1)} t`
                      : `${platformStats.total_tonnage_kg ?? 0} kg`}
                  </div>
                </div>
                <div className="p-2.5 rounded-[10px] bg-[#0a0a0a] border border-[#262626]">
                  <div className="text-[11px] text-[#a3a3a3]">PWA</div>
                  <div className="text-sm font-mono tabular-nums font-semibold text-[#fafafa] mt-0.5">
                    {platformStats.total_installs ?? 0}
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
              {feedbacks.length === 0 ? (
                <div className="p-5 rounded-[10px] bg-[#0a0a0a] border border-[#262626] text-center text-xs text-[#a3a3a3]">
                  {t('profile.communityIdeas')}
                </div>
              ) : (
                feedbacks.slice(0, 10).map((fb) => (
                  <div
                    key={fb.id}
                    className="p-3 rounded-[10px] bg-[#0a0a0a] border border-[#262626] flex items-start justify-between gap-3"
                  >
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                            fb.category === 'bug'
                              ? 'bg-red-950/40 text-red-400 border-red-900'
                              : fb.category === 'feature'
                              ? 'bg-amber-950/40 text-amber-400 border-amber-900'
                              : 'bg-[#022c22] text-[#34d399] border-[#064e3b]'
                          }`}
                        >
                          {fb.category === 'bug'
                            ? 'Bug'
                            : fb.category === 'feature'
                            ? 'Idea'
                            : 'UI/UX'}
                        </span>
                        <h4 className="text-xs font-semibold text-[#fafafa] truncate">
                          {fb.title}
                        </h4>
                      </div>

                      <p className="text-xs text-[#a3a3a3] leading-relaxed">{fb.description}</p>

                      <div className="text-[11px] font-mono tabular-nums text-[#737373] flex items-center gap-2">
                        <span className="font-sans">{fb.author_name || fb.user_name || t('coach.athleteDefault')}</span>
                        <span>·</span>
                        <span>{new Date(fb.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => upvoteMutation.mutate(fb.id)}
                      className="min-w-[44px] min-h-[44px] px-2.5 py-1.5 rounded-[10px] bg-[#171717] hover:bg-[#022c22] border border-[#404040] hover:border-[#064e3b] text-[#a3a3a3] hover:text-[#34d399] flex flex-col items-center justify-center shrink-0 transition-colors cursor-pointer"
                    >
                      <ThumbsUp className="w-3.5 h-3.5" />
                      <span className="text-[11px] font-semibold font-mono tabular-nums mt-0.5">
                        {fb.upvotes_count ?? fb.upvotes ?? 0}
                      </span>
                    </button>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <FeedbackModal
        isOpen={isFeedbackModalOpen}
        onClose={() => setIsFeedbackModalOpen(false)}
      />
    </div>
  );
};

export default ProfilePage;
