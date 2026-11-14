import { readNutritionNumber } from '@/entities/nutrition';
import { toLocalDateKey } from '@/shared/lib/dates.ts';
import React, { useMemo, useState, useEffect } from 'react';
import {
  Camera,
  Trash2,
  Sparkles,
  Flame,
  CheckCircle2,
  Upload,
  Utensils,
  AlertTriangle,
  FileText,
  RefreshCw,
  Droplets,
  Pencil,
  Calendar,
  Copy,
  RotateCcw,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../shared/api/client.ts';
import { Card, Button, Input, Textarea } from '../../../shared/ui/index.ts';
import { useTranslation } from '../../../shared/lib/i18n/i18n.ts';
import { usePageSEO } from '../../../shared/lib/seo/usePageSEO.ts';
import { useAuthStore } from '../../../entities/user/model/authStore.ts';
import {
  SmartPhotoPickerModal,
  CompressedPhoto,
} from '../../../shared/ui/photo-picker/SmartPhotoPickerModal.tsx';

interface MealItem {
  name: string;
  portion: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

interface MealAnalysisResult {
  meal_name: string;
  visual_description?: string;
  items: MealItem[];
  total_calories: number;
  total_protein_g: number;
  total_carbs_g: number;
  total_fat_g: number;
  confidence: string;
  health_score: number;
  advice: string;
}

interface MealLog {
  id: string;
  user_id: string;
  meal_type: string;
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  photo_url?: string;
  items?: MealItem[];
  logged_at: string;
}

interface DailyNutritionSummary {
  date: string;
  total_calories: number;
  total_protein_g: number;
  total_carbs_g: number;
  total_fat_g: number;
  target_calories: number;
  target_protein_g: number;
  target_carbs_g: number;
  target_fat_g: number;
  meals: MealLog[];
}

export const NutritionPage: React.FC = () => {
  usePageSEO({ pageKey: 'nutrition', canonicalPath: '/nutrition' });
  const { t, language } = useTranslation();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  // Water Tracker State
  const [selectedDate, setSelectedDate] = useState(() => toLocalDateKey(new Date()));
  const todayKey = selectedDate;
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const waterStorageKey = user?.id ? `np_water_${user.id}_${todayKey}` : `np_water_${todayKey}`;
  const [waterMl, setWaterMl] = useState<number>(() => {
    const stored = Number(localStorage.getItem(waterStorageKey) || '0');
    return Number.isFinite(stored) ? Math.max(0, stored) : 0;
  });
  useEffect(() => {
    const stored = Number(localStorage.getItem(waterStorageKey) || '0');
    setWaterMl(Number.isFinite(stored) ? Math.max(0, stored) : 0);
  }, [waterStorageKey]);
  const targetWaterMl = 2500;
  const waterPct = Math.min(100, Math.round((waterMl / targetWaterMl) * 100));

  const addWater = (amount: number) => {
    const updated = Math.max(0, waterMl + amount);
    setWaterMl(updated);
    localStorage.setItem(waterStorageKey, updated.toString());
  };

  // Inline builder & draft state
  const [activeLogTab, setActiveLogTab] = useState<'photo' | 'text' | 'manual'>('photo');
  const [selectedMealType, setSelectedMealType] = useState<string>('lunch');

  const [textDescription, setTextDescription] = useState('');
  const [textResult, setTextResult] = useState<MealAnalysisResult | null>(null);

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [scanNotes, setScanNotes] = useState('');
  const [scanResult, setScanResult] = useState<MealAnalysisResult | null>(null);

  const [editingMealId, setEditingMealId] = useState<string | null>(null);
  const [draftItems, setDraftItems] = useState<MealItem[]>([]);
  const [editMealName, setEditMealName] = useState('');
  const [editCalories, setEditCalories] = useState('');
  const [editProtein, setEditProtein] = useState('');
  const [editCarbs, setEditCarbs] = useState('');
  const [editFat, setEditFat] = useState('');

  const [isPhotoPickerOpen, setIsPhotoPickerOpen] = useState(false);

  // Today formatted date + timezone badge
  const { formattedDate, tzLabel } = useMemo(() => {
    const now = new Date();
    const locale = language === 'ru' ? 'ru-RU' : language === 'uz' ? 'uz-Latn-UZ' : 'en-US';
    const dateStr = new Intl.DateTimeFormat(locale, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    }).format(now);
    const offsetMinutes = -now.getTimezoneOffset();
    const offsetSign = offsetMinutes >= 0 ? '+' : '-';
    const absHours = Math.floor(Math.abs(offsetMinutes) / 60);
    const absMins = Math.abs(offsetMinutes) % 60;
    const tz = absMins === 0 ? `UTC${offsetSign}${absHours}` : `UTC${offsetSign}${absHours}:${String(absMins).padStart(2, '0')}`;
    return { formattedDate: dateStr, tzLabel: tz };
  }, [language]);

  // Fetch today's nutrition
  const { data: summary, isLoading } = useQuery<DailyNutritionSummary>({
    queryKey: ['nutrition', 'day', user?.id, selectedDate, timezone],
    queryFn: () => apiClient.get(`/nutrition/today?${new URLSearchParams({ date: selectedDate, timezone })}`),
  });

  const resetDraft = () => {
    setEditingMealId(null);
    setSelectedImage(null);
    setScanResult(null);
    setTextResult(null);
    setScanNotes('');
    setTextDescription('');
    setDraftItems([]);
    setEditMealName('');
    setEditCalories('');
    setEditProtein('');
    setEditCarbs('');
    setEditFat('');
  };

  // Analyze Photo Mutation
  const analyzeMutation = useMutation({
    mutationFn: (data: { image_base64: string; notes?: string; language?: string }) =>
      apiClient.post<MealAnalysisResult>('/nutrition/analyze-photo', {
        ...data,
        language,
      }),
    onSuccess: (data) => {
      setScanResult(data);
      setDraftItems(data.items || []);
      setEditMealName(data.meal_name || '');
      setEditCalories(String(data.total_calories || 0));
      setEditProtein(String(data.total_protein_g || 0));
      setEditCarbs(String(data.total_carbs_g || 0));
      setEditFat(String(data.total_fat_g || 0));
    },
  });

  // Analyze Text Mutation
  const analyzeTextMutation = useMutation({
    mutationFn: (data: { description: string; language?: string }) =>
      apiClient.post<MealAnalysisResult>('/nutrition/estimate-text', {
        ...data,
        language,
      }),
    onSuccess: (data) => {
      setTextResult(data);
      setDraftItems(data.items || []);
      setEditMealName(data.meal_name || '');
      setEditCalories(String(data.total_calories || 0));
      setEditProtein(String(data.total_protein_g || 0));
      setEditCarbs(String(data.total_carbs_g || 0));
      setEditFat(String(data.total_fat_g || 0));
    },
  });

  // Save Meal Mutation
  const saveMealMutation = useMutation({
    mutationFn: (mealData: Partial<MealLog>) =>
      apiClient.post<MealLog>('/nutrition/meals', mealData),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['nutrition'] });
      void queryClient.invalidateQueries({ queryKey: ['coach-insights'] });
    },
  });

  // Delete Meal Mutation
  const deleteMealMutation = useMutation({
    mutationFn: (mealId: string) => apiClient.delete(`/nutrition/meals/${mealId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['nutrition'] });
      void queryClient.invalidateQueries({ queryKey: ['coach-insights'] });
    },
  });

  // Photo captured callback from SmartPhotoPickerModal
  const handlePhotoCaptured = (photo: CompressedPhoto) => {
    setEditingMealId(null);
    setSelectedImage(photo.dataUrl);
    setScanResult(null);
    setTextResult(null);
    setDraftItems([]);
    setActiveLogTab('photo');

    analyzeMutation.mutate({
      image_base64: photo.dataUrl,
      notes: scanNotes,
      language,
    });
  };

  const handleEditMeal = (meal: MealLog) => {
    setEditingMealId(meal.id);
    setSelectedMealType(meal.meal_type || 'lunch');
    setSelectedImage(meal.photo_url || null);
    setScanResult(null);
    setTextResult(null);
    setDraftItems(meal.items || []);
    setEditMealName(meal.name);
    setEditCalories(String(meal.calories));
    setEditProtein(String(meal.protein_g));
    setEditCarbs(String(meal.carbs_g));
    setEditFat(String(meal.fat_g));
    setActiveLogTab('manual');
  };

  const selectedLoggedAt = () =>
    selectedDate === toLocalDateKey(new Date())
      ? new Date().toISOString()
      : new Date(`${selectedDate}T12:00:00`).toISOString();

  const handleSaveMeal = async () => {
    // Explicit zero is a valid correction to an AI estimate.
    const manual = activeLogTab === 'manual';
    const result = manual ? null : activeLogTab === 'photo' ? scanResult : textResult;
    const mealName = editMealName.trim() || result?.meal_name || t('nutrition.logMeal');
    const cals = Math.round(readNutritionNumber(editCalories, manual ? 0 : result?.total_calories));
    const protein = readNutritionNumber(editProtein, manual ? 0 : result?.total_protein_g);
    const carbs = readNutritionNumber(editCarbs, manual ? 0 : result?.total_carbs_g);
    const fat = readNutritionNumber(editFat, manual ? 0 : result?.total_fat_g);

    const itemsToSave =
      draftItems.length > 0
        ? draftItems
        : activeLogTab === 'photo'
          ? scanResult?.items || []
          : activeLogTab === 'text'
            ? textResult?.items || []
            : [];

    const prevId = editingMealId;

    try {
      await saveMealMutation.mutateAsync({
        logged_at: selectedLoggedAt(),
        meal_type: selectedMealType,
        name: mealName,
        calories: cals,
        protein_g: protein,
        carbs_g: carbs,
        fat_g: fat,
        photo_url: selectedImage || undefined,
        items: itemsToSave,
      });

      if (prevId) {
        await deleteMealMutation.mutateAsync(prevId);
      }
      resetDraft();
    } catch {
      // Error surfaced cleanly via saveMealMutation.isError
    }
  };

  // User Profile Nutrition Targets
  const targetCals =
    user?.target_calories ||
    Number(localStorage.getItem('np_nutrition_target_calories')) ||
    summary?.target_calories ||
    2500;

  const targetProtein =
    user?.target_protein_g ||
    Number(localStorage.getItem('np_nutrition_target_protein_g')) ||
    summary?.target_protein_g ||
    170;

  const targetCarbs =
    user?.target_carbs_g ||
    Number(localStorage.getItem('np_nutrition_target_carbs_g')) ||
    summary?.target_carbs_g ||
    280;

  const targetFat =
    user?.target_fat_g ||
    Number(localStorage.getItem('np_nutrition_target_fat_g')) ||
    summary?.target_fat_g ||
    70;

  // Calculations
  const totalCals = summary?.total_calories || 0;
  const remCals = targetCals - totalCals;
  const calsPct = targetCals > 0 ? Math.min(100, Math.round((totalCals / targetCals) * 100)) : 0;

  const totalProtein = Math.round(summary?.total_protein_g || 0);
  const proteinPct = targetProtein > 0 ? Math.min(100, Math.round((totalProtein / targetProtein) * 100)) : 0;

  const totalCarbs = Math.round(summary?.total_carbs_g || 0);
  const carbsPct = targetCarbs > 0 ? Math.min(100, Math.round((totalCarbs / targetCarbs) * 100)) : 0;

  const totalFat = Math.round(summary?.total_fat_g || 0);
  const fatPct = targetFat > 0 ? Math.min(100, Math.round((totalFat / targetFat) * 100)) : 0;

  // Quick food presets based on language
  const foodPresets = [
    { label: t('nutrition.presetPlov'), val: t('nutrition.presetPlovVal') },
    { label: t('nutrition.presetChicken'), val: t('nutrition.presetChickenVal') },
    { label: t('nutrition.presetEggs'), val: t('nutrition.presetEggsVal') },
    { label: t('nutrition.presetSteak'), val: t('nutrition.presetSteakVal') },
    { label: t('nutrition.presetSamsa'), val: t('nutrition.presetSamsaVal') },
    { label: t('nutrition.presetOatmeal'), val: t('nutrition.presetOatmealVal') },
    { label: t('nutrition.presetShawarma'), val: t('nutrition.presetShawarmaVal') },
    { label: t('nutrition.presetCottage'), val: t('nutrition.presetCottageVal') },
  ];

  const activeResult = activeLogTab === 'photo' ? scanResult : activeLogTab === 'text' ? textResult : null;
  const hasDraftValues =
    editMealName.trim().length > 0 ||
    (parseInt(editCalories, 10) || 0) > 0 ||
    (parseFloat(editProtein) || 0) > 0 ||
    (parseFloat(editCarbs) || 0) > 0 ||
    (parseFloat(editFat) || 0) > 0;

  const macroBars = [
    {
      key: 'energy',
      label: t('nutrition.energyLabel'),
      current: totalCals,
      target: targetCals,
      unit: t('nutrition.kcalUnit'),
      pct: calsPct,
      over: totalCals > targetCals,
    },
    {
      key: 'protein',
      label: t('nutrition.protein'),
      current: totalProtein,
      target: targetProtein,
      unit: t('nutrition.gramUnit'),
      pct: proteinPct,
      over: false,
    },
    {
      key: 'carbs',
      label: t('nutrition.carbs'),
      current: totalCarbs,
      target: targetCarbs,
      unit: t('nutrition.gramUnit'),
      pct: carbsPct,
      over: totalCarbs > targetCarbs,
    },
    {
      key: 'fat',
      label: t('nutrition.fat'),
      current: totalFat,
      target: targetFat,
      unit: t('nutrition.gramUnit'),
      pct: fatPct,
      over: totalFat > targetFat,
    },
  ];

  const mealsList = summary?.meals || [];
  const waterGlasses = Math.floor(waterMl / 250);

  return (
    <div className="space-y-5 pb-12 max-w-6xl mx-auto">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-[10px] bg-[#022c22] border border-[#064e3b] flex items-center justify-center text-[#34d399] shrink-0">
            <Utensils className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-[22px] sm:text-[26px] font-semibold tracking-[-0.02em] text-[#fafafa] leading-tight">
              {t('nutrition.title')}
            </h1>
            <p className="text-[13px] text-[#a3a3a3] mt-0.5">
              {t('nutrition.subtitle')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="min-h-[44px] px-3.5 rounded-[10px] bg-[#171717] border border-[#404040] flex items-center gap-2 text-[13px] text-[#a3a3a3] font-mono tabular-nums">
            <Calendar className="w-4 h-4 text-[#34d399] shrink-0" />
            <span className="capitalize text-[#fafafa] font-medium font-sans">{formattedDate}</span>
            <span className="text-[#404040]">·</span>
            <span>{tzLabel}</span>
          </div>

          <Button
            variant="primary"
            size="md"
            onClick={() => {
              setActiveLogTab('photo');
              setIsPhotoPickerOpen(true);
            }}
            className="gap-1.5"
          >
            <Camera className="w-4 h-4" />
            <span className="hidden sm:inline">{t('nutrition.byPhoto')}</span>
          </Button>
        </div>
      </div>

      {/* 2. Daily Balance Hero + Diary Date Picker */}
      <Card className="p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-[#262626]">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-[#34d399]" />
              <h2 className="text-[15px] font-semibold text-[#fafafa]">
                {t('nutrition.balanceTitle')}
              </h2>
            </div>
            <p className="text-[12px] text-[#a3a3a3]">
              {remCals >= 0 ? t('nutrition.remainingForDay') : t('nutrition.exceeded')}
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <label htmlFor="nutrition-diary-date" className="sr-only">
              {t('nutrition.selectedDate')}
            </label>
            <input
              id="nutrition-diary-date"
              type="date"
              aria-label={t('nutrition.selectedDate')}
              value={selectedDate}
              onChange={(event) => {
                if (/^\d{4}-\d{2}-\d{2}$/.test(event.target.value)) setSelectedDate(event.target.value);
              }}
              className="min-h-[44px] px-3 rounded-[10px] bg-[#0a0a0a] border border-[#404040] text-[13px] font-mono tabular-nums text-[#fafafa] focus:outline-none focus:border-[#34d399]"
            />
          </div>

          <div className="flex items-center gap-4 bg-[#0a0a0a] border border-[#262626] rounded-[10px] px-3.5 py-2 self-start sm:self-auto">
            <div>
              <span className="text-[11px] text-[#737373] block">{t('nutrition.consumed')}</span>
              <span className="text-[14px] font-semibold text-[#fafafa] font-mono tabular-nums">
                {totalCals.toLocaleString()} {t('nutrition.kcalUnit')}
              </span>
            </div>
            <div className="w-px h-7 bg-[#262626]" />
            <div>
              <span className="text-[11px] text-[#737373] block">{t('nutrition.target')}</span>
              <span className="text-[14px] font-medium text-[#a3a3a3] font-mono tabular-nums">
                {targetCals.toLocaleString()} {t('nutrition.kcalUnit')}
              </span>
            </div>
            <div className="w-px h-7 bg-[#262626]" />
            <div>
              <span className="text-[11px] text-[#737373] block">
                {remCals >= 0 ? t('nutrition.remaining') : t('nutrition.exceeded')}
              </span>
              <span
                className={`text-[15px] font-semibold font-mono tabular-nums ${
                  remCals >= 0 ? 'text-[#34d399]' : 'text-amber-400'
                }`}
              >
                {remCals >= 0 ? remCals.toLocaleString() : `+${Math.abs(remCals).toLocaleString()}`} {t('nutrition.kcalUnit')}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {macroBars.map((item) => (
            <div
              key={item.key}
              className="p-3.5 rounded-[10px] bg-[#0a0a0a] border border-[#262626] space-y-2.5"
            >
              <div className="flex items-center justify-between text-[12px]">
                <span className="font-medium text-[#a3a3a3]">{item.label}</span>
                <span
                  className={`font-mono font-semibold tabular-nums ${
                    item.over ? 'text-amber-400' : 'text-[#34d399]'
                  }`}
                >
                  {item.pct}%
                </span>
              </div>

              <div className="flex items-baseline justify-between font-mono tabular-nums">
                <span className="text-[18px] font-semibold text-[#fafafa]">
                  {item.current}
                  <span className="text-[12px] font-normal text-[#a3a3a3] ml-1">{item.unit}</span>
                </span>
                <span className="text-[12px] text-[#737373]">
                  / {item.target} {item.unit}
                </span>
              </div>

              <div className="h-1.5 w-full rounded-full bg-[#262626] overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    item.over ? 'bg-amber-400' : 'bg-[#34d399]'
                  }`}
                  style={{ width: `${item.pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* 3. Main Two-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {/* Left Column: Meals Log + Water Tracker */}
        <div className="space-y-4">
          {/* Meals Card */}
          <Card className="p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#262626] pb-3">
              <div className="flex items-center gap-2">
                <h2 className="text-[15px] font-semibold text-[#fafafa]">
                  {t('nutrition.mealsToday')}
                </h2>
                <span className="text-[12px] font-mono font-medium tabular-nums text-[#34d399] bg-[#022c22] border border-[#064e3b] px-2.5 py-0.5 rounded-full">
                  {mealsList.length}
                </span>
              </div>
            </div>

            {isLoading ? (
              <div className="space-y-2.5">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-20 bg-[#262626]/60 rounded-[10px] animate-pulse border border-[#262626]"
                  />
                ))}
              </div>
            ) : mealsList.length === 0 ? (
              <div className="text-center py-8 px-4 border border-dashed border-[#404040] rounded-[10px] bg-[#0a0a0a] space-y-2.5">
                <div className="w-10 h-10 rounded-[10px] bg-[#171717] border border-[#262626] flex items-center justify-center mx-auto text-[#737373]">
                  <Utensils className="w-5 h-5" />
                </div>
                <h3 className="text-[14px] font-semibold text-[#fafafa]">{t('nutrition.noMeals')}</h3>
                <p className="text-[12px] text-[#a3a3a3] max-w-sm mx-auto leading-relaxed">
                  {t('nutrition.noMealsDesc')}
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {mealsList.map((meal) => {
                  const mealTime = meal.logged_at
                    ? new Date(meal.logged_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '';
                  const isBeingEdited = editingMealId === meal.id;

                  return (
                    <div
                      key={meal.id}
                      className={`p-3.5 rounded-[10px] bg-[#0a0a0a] border transition-colors space-y-3 ${
                        isBeingEdited ? 'border-[#34d399]' : 'border-[#262626]'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {meal.photo_url ? (
                          <img
                            src={meal.photo_url}
                            alt={meal.name}
                            className="w-12 h-12 rounded-[10px] object-cover border border-[#404040] shrink-0"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-[10px] bg-[#171717] border border-[#262626] flex items-center justify-center text-[#34d399] shrink-0">
                            <Utensils className="w-5 h-5" />
                          </div>
                        )}

                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[11px] font-medium text-[#34d399] bg-[#022c22] border border-[#064e3b] px-2 py-0.5 rounded-[6px]">
                              {t(`nutrition.${meal.meal_type}` as Parameters<typeof t>[0]) || meal.meal_type}
                            </span>
                            {mealTime && (
                              <span className="text-[11px] text-[#737373] font-mono tabular-nums">
                                {mealTime}
                              </span>
                            )}
                          </div>

                          <h4 className="text-[14px] font-semibold text-[#fafafa] truncate">
                            {meal.name}
                          </h4>

                          <div className="flex items-center gap-2 text-[12px] font-mono tabular-nums flex-wrap text-[#a3a3a3]">
                            <span className="text-[#fafafa] font-semibold">
                              {meal.calories} {t('nutrition.kcalUnit')}
                            </span>
                            <span className="text-[#404040]">·</span>
                            <span>
                              {t('nutrition.protein').slice(0, 1)}: {meal.protein_g}
                              {t('nutrition.gramUnit')}
                            </span>
                            <span className="text-[#404040]">·</span>
                            <span>
                              {t('nutrition.carbs').slice(0, 1)}: {meal.carbs_g}
                              {t('nutrition.gramUnit')}
                            </span>
                            <span className="text-[#404040]">·</span>
                            <span>
                              {t('nutrition.fat').slice(0, 1)}: {meal.fat_g}
                              {t('nutrition.gramUnit')}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t border-[#262626] flex-wrap">
                        <button
                          type="button"
                          onClick={() => handleEditMeal(meal)}
                          className="min-h-[44px] px-3 rounded-[10px] bg-[#171717] hover:bg-[#262626] border border-[#404040] text-[12px] font-medium text-[#fafafa] flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5 text-[#a3a3a3]" />
                          <span>{t('nutrition.editBtn')}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            saveMealMutation.mutate({
                              logged_at: selectedLoggedAt(),
                              meal_type: meal.meal_type,
                              name: meal.name,
                              calories: meal.calories,
                              protein_g: meal.protein_g,
                              carbs_g: meal.carbs_g,
                              fat_g: meal.fat_g,
                              photo_url: meal.photo_url,
                              items: meal.items || [],
                            })
                          }
                          disabled={saveMealMutation.isPending}
                          className="min-h-[44px] px-3 rounded-[10px] bg-[#171717] hover:bg-[#262626] border border-[#404040] text-[12px] font-medium text-[#fafafa] flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <Copy className="w-3.5 h-3.5 text-[#34d399]" />
                          <span>{t('nutrition.repeatBtn')}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (editingMealId === meal.id) {
                              resetDraft();
                            }
                            deleteMealMutation.mutate(meal.id);
                          }}
                          disabled={deleteMealMutation.isPending}
                          className="min-h-[44px] min-w-[44px] px-3 ml-auto rounded-[10px] bg-[#171717] hover:bg-red-950/30 border border-[#404040] hover:border-red-500/40 text-[12px] font-medium text-[#a3a3a3] hover:text-red-400 flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                          title={t('common.delete')}
                          aria-label={t('common.delete')}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Water Card */}
          <Card className="p-4 sm:p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-[10px] bg-[#022c22] border border-[#064e3b] text-[#34d399] flex items-center justify-center shrink-0">
                  <Droplets className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-[15px] font-semibold text-[#fafafa]">
                    {t('nutrition.waterTitle')}
                  </h3>
                  <p className="text-[12px] text-[#a3a3a3]">
                    {t('nutrition.waterServings', {
                      glasses: waterGlasses,
                      target: targetWaterMl,
                    })}
                  </p>
                </div>
              </div>

              <div className="text-right font-mono tabular-nums">
                <span className="text-[16px] font-semibold text-[#fafafa]">
                  {waterMl}
                </span>
                <span className="text-[12px] text-[#737373] ml-1">
                  / {targetWaterMl} {t('nutrition.mlUnit')}
                </span>
                <div className="text-[11px] font-medium text-[#34d399]">
                  {waterPct}%
                </div>
              </div>
            </div>

            <div className="h-2 w-full rounded-full bg-[#262626] overflow-hidden">
              <div
                className="h-full rounded-full bg-[#34d399] transition-all duration-300"
                style={{ width: `${waterPct}%` }}
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => addWater(250)}
                className="min-h-[44px] px-3 rounded-[10px] bg-[#022c22] hover:bg-[#064e3b] border border-[#064e3b] text-[#34d399] text-[13px] font-semibold transition-colors cursor-pointer"
              >
                {t('nutrition.waterAdd250')}
              </button>

              <button
                type="button"
                onClick={() => addWater(-250)}
                disabled={waterMl <= 0}
                className="min-h-[44px] px-3 rounded-[10px] bg-[#0a0a0a] hover:bg-[#262626] border border-[#404040] text-[#fafafa] text-[13px] font-medium transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {t('nutrition.waterSub250')}
              </button>

              <button
                type="button"
                onClick={() => {
                  setWaterMl(0);
                  localStorage.setItem(waterStorageKey, '0');
                }}
                disabled={waterMl <= 0}
                className="min-h-[44px] px-3 rounded-[10px] bg-[#0a0a0a] hover:bg-[#262626] border border-[#404040] text-[#a3a3a3] hover:text-[#fafafa] text-[13px] font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{t('nutrition.waterReset')}</span>
              </button>
            </div>
          </Card>
        </div>

        {/* Right Column: Inline Add Food + Review Draft */}
        <div className="space-y-4">
          {/* Add Food Card */}
          <Card className="p-4 sm:p-5 space-y-4">
            <div className="space-y-1">
              <h2 className="text-[15px] font-semibold text-[#fafafa]">
                {t('nutrition.addFoodTitle')}
              </h2>
              <p className="text-[12px] text-[#a3a3a3]">
                {t('nutrition.addFoodSubtitle')}
              </p>
            </div>

            {/* Method Selector: Photo | Text | Manual */}
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setActiveLogTab('photo')}
                className={`min-h-[44px] px-3 rounded-[10px] text-[13px] font-medium border flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                  activeLogTab === 'photo'
                    ? 'bg-[#022c22] text-[#34d399] border-[#064e3b]'
                    : 'bg-[#0a0a0a] text-[#a3a3a3] border-[#404040] hover:text-[#fafafa]'
                }`}
              >
                <Camera className="w-4 h-4 shrink-0" />
                <span>{t('nutrition.byPhoto')}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveLogTab('text')}
                className={`min-h-[44px] px-3 rounded-[10px] text-[13px] font-medium border flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                  activeLogTab === 'text'
                    ? 'bg-[#022c22] text-[#34d399] border-[#064e3b]'
                    : 'bg-[#0a0a0a] text-[#a3a3a3] border-[#404040] hover:text-[#fafafa]'
                }`}
              >
                <FileText className="w-4 h-4 shrink-0" />
                <span>{t('nutrition.byText')}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveLogTab('manual')}
                className={`min-h-[44px] px-3 rounded-[10px] text-[13px] font-medium border flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                  activeLogTab === 'manual'
                    ? 'bg-[#022c22] text-[#34d399] border-[#064e3b]'
                    : 'bg-[#0a0a0a] text-[#a3a3a3] border-[#404040] hover:text-[#fafafa]'
                }`}
              >
                <Pencil className="w-4 h-4 shrink-0" />
                <span>{t('nutrition.byManual')}</span>
              </button>
            </div>

            {/* Meal Type Selector */}
            <div className="space-y-1.5">
              <label className="block text-[12px] font-medium text-[#a3a3a3]">
                {t('nutrition.mealType')}
              </label>
              <div className="grid grid-cols-4 gap-2">
                {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setSelectedMealType(type)}
                    className={`min-h-[44px] px-2 rounded-[10px] text-[12px] font-medium border transition-colors cursor-pointer truncate ${
                      selectedMealType === type
                        ? 'bg-[#022c22] text-[#34d399] border-[#064e3b]'
                        : 'bg-[#0a0a0a] text-[#a3a3a3] border-[#404040] hover:text-[#fafafa]'
                    }`}
                  >
                    {t(`nutrition.${type}`)}
                  </button>
                ))}
              </div>
            </div>

            {/* Mode 1: Photo */}
            {activeLogTab === 'photo' && (
              <div className="space-y-3">
                {selectedImage ? (
                  <div className="relative rounded-[10px] overflow-hidden border border-[#404040] bg-[#0a0a0a]">
                    <img
                      src={selectedImage}
                      alt={t('nutrition.mealName')}
                      className="w-full h-44 object-cover"
                    />
                    <div className="p-2.5 bg-[#0a0a0a] border-t border-[#262626] flex items-center justify-between gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setIsPhotoPickerOpen(true)}
                        className="min-h-[44px] px-3 rounded-[10px] bg-[#171717] hover:bg-[#262626] border border-[#404040] text-[12px] font-medium text-[#fafafa] flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Camera className="w-4 h-4 text-[#34d399]" />
                        <span>{t('nutrition.changePhoto')}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          analyzeMutation.mutate({
                            image_base64: selectedImage,
                            notes: scanNotes,
                            language,
                          })
                        }
                        disabled={analyzeMutation.isPending}
                        className="min-h-[44px] px-3 rounded-[10px] bg-[#022c22] hover:bg-[#064e3b] border border-[#064e3b] text-[12px] font-medium text-[#34d399] flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw
                          className={`w-3.5 h-3.5 ${analyzeMutation.isPending ? 'animate-spin' : ''}`}
                        />
                        <span>{t('nutrition.recalculate')}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsPhotoPickerOpen(true)}
                    className="w-full min-h-[132px] border border-dashed border-[#404040] hover:border-[#34d399] rounded-[10px] p-5 text-center cursor-pointer bg-[#0a0a0a] transition-colors flex flex-col items-center justify-center gap-2"
                  >
                    <div className="w-10 h-10 rounded-[10px] bg-[#022c22] border border-[#064e3b] flex items-center justify-center text-[#34d399]">
                      <Upload className="w-5 h-5" />
                    </div>
                    <span className="text-[13px] font-medium text-[#fafafa]">
                      {t('nutrition.photoUploadHint')}
                    </span>
                    <span className="text-[12px] text-[#737373] max-w-xs">
                      {t('nutrition.photoHintShort')}
                    </span>
                  </button>
                )}

                <Input
                  label={t('nutrition.notesLabel')}
                  placeholder={t('nutrition.notesPlaceholder')}
                  value={scanNotes}
                  onChange={(e) => setScanNotes(e.target.value)}
                />

                {analyzeMutation.isPending && (
                  <div className="p-3 rounded-[10px] bg-[#022c22] border border-[#064e3b] flex items-center gap-2.5 text-[13px] text-[#34d399]">
                    <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
                    <span>{t('nutrition.analyzing')}</span>
                  </div>
                )}

                {analyzeMutation.isError && (
                  <div className="p-3 rounded-[10px] bg-amber-950/30 border border-amber-500/40 text-[12px] text-amber-300 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{t('nutrition.analyzePhotoError')}</span>
                  </div>
                )}
              </div>
            )}

            {/* Mode 2: Text */}
            {activeLogTab === 'text' && (
              <div className="space-y-3">
                <Textarea
                  rows={3}
                  placeholder={t('nutrition.textPlaceholder')}
                  value={textDescription}
                  onChange={(e) => setTextDescription(e.target.value)}
                />

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-[#737373]">
                    <span>{t('nutrition.quickPresets')}</span>
                    <span>{t('nutrition.quickInsert')}</span>
                  </div>
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {foodPresets.map((chip, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setEditingMealId(null);
                          setTextDescription(chip.val);
                          analyzeTextMutation.mutate({
                            description: chip.val,
                            language,
                          });
                        }}
                        className="min-h-[44px] px-3 rounded-[10px] text-[12px] font-medium bg-[#0a0a0a] hover:bg-[#262626] text-[#fafafa] border border-[#404040] whitespace-nowrap shrink-0 transition-colors cursor-pointer"
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>
                </div>

                <Button
                  variant="primary"
                  size="md"
                  className="w-full font-semibold"
                  disabled={!textDescription.trim() || analyzeTextMutation.isPending}
                  onClick={() => {
                    setEditingMealId(null);
                    analyzeTextMutation.mutate({
                      description: textDescription.trim(),
                      language,
                    });
                  }}
                >
                  {analyzeTextMutation.isPending ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      <span>{t('nutrition.analyzingText')}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      <span>{t('nutrition.estimateBtn')}</span>
                    </>
                  )}
                </Button>

                {analyzeTextMutation.isError && (
                  <div className="p-3 rounded-[10px] bg-amber-950/30 border border-amber-500/40 text-[12px] text-amber-300 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{t('nutrition.analyzeTextError')}</span>
                  </div>
                )}
              </div>
            )}

            {/* Mode 3: Manual hint */}
            {activeLogTab === 'manual' && (
              <div className="p-3 rounded-[10px] bg-[#0a0a0a] border border-[#262626] text-[12px] text-[#a3a3a3] leading-relaxed">
                {t('nutrition.draftSubtitle')}
              </div>
            )}
          </Card>

          {/* Draft Review Card */}
          <Card className="p-4 sm:p-5 space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-[#262626] pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-[15px] font-semibold text-[#fafafa]">
                    {editingMealId ? t('nutrition.editDraftTitle') : t('nutrition.draftTitle')}
                  </h2>
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-[6px] bg-[#022c22] border border-[#064e3b] text-[#34d399]">
                    {editingMealId ? t('nutrition.editBtn') : t('nutrition.draftBadge')}
                  </span>
                </div>
                <p className="text-[12px] text-[#a3a3a3] mt-0.5">
                  {hasDraftValues ? t('nutrition.draftSubtitle') : t('nutrition.draftEmptyHint')}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <Input
                label={t('nutrition.mealName')}
                placeholder={t('nutrition.mealPlaceholder')}
                value={editMealName}
                onChange={(e) => setEditMealName(e.target.value)}
              />

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <Input
                  label={`${t('nutrition.calories')} (${t('nutrition.kcalUnit')})`}
                  type="number"
                  min={0}
                  placeholder="0"
                  value={editCalories}
                  onChange={(e) => setEditCalories(e.target.value)}
                  className="font-mono tabular-nums"
                />

                <Input
                  label={`${t('nutrition.protein')} (${t('nutrition.gramUnit')})`}
                  type="number"
                  min={0}
                  step="0.1"
                  placeholder="0"
                  value={editProtein}
                  onChange={(e) => setEditProtein(e.target.value)}
                  className="font-mono tabular-nums"
                />

                <Input
                  label={`${t('nutrition.carbs')} (${t('nutrition.gramUnit')})`}
                  type="number"
                  min={0}
                  step="0.1"
                  placeholder="0"
                  value={editCarbs}
                  onChange={(e) => setEditCarbs(e.target.value)}
                  className="font-mono tabular-nums"
                />

                <Input
                  label={`${t('nutrition.fat')} (${t('nutrition.gramUnit')})`}
                  type="number"
                  min={0}
                  step="0.1"
                  placeholder="0"
                  value={editFat}
                  onChange={(e) => setEditFat(e.target.value)}
                  className="font-mono tabular-nums"
                />
              </div>

              {/* Detected Items */}
              {draftItems.length > 0 && (
                <div className="p-3 rounded-[10px] bg-[#0a0a0a] border border-[#262626] space-y-2">
                  <div className="text-[12px] font-medium text-[#a3a3a3]">
                    {t('nutrition.detectedItems')}
                  </div>
                  <div className="space-y-1.5">
                    {draftItems.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between gap-2 text-[12px] py-1 border-b border-[#262626] last:border-b-0"
                      >
                        <div className="min-w-0 truncate">
                          <span className="text-[#fafafa] font-medium">{item.name}</span>
                          {item.portion && (
                            <span className="text-[#737373] ml-1.5">({item.portion})</span>
                          )}
                        </div>
                        <span className="font-mono tabular-nums text-[#a3a3a3] shrink-0">
                          {item.calories} {t('nutrition.kcalUnit')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Advice */}
              {activeResult?.advice && (
                <div className="p-3 rounded-[10px] bg-[#0a0a0a] border border-[#262626] flex items-start gap-2.5 text-[12px] text-[#a3a3a3] leading-relaxed">
                  <Sparkles className="w-4 h-4 text-[#34d399] shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[#fafafa] font-medium block mb-0.5">
                      {t('nutrition.aiAdvice')}
                    </span>
                    {activeResult.advice}
                  </div>
                </div>
              )}

              {saveMealMutation.isError && (
                <div className="p-3 rounded-[10px] bg-red-950/30 border border-red-500/40 text-[12px] text-red-400 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{t('nutrition.saveError')}</span>
                </div>
              )}

              <div className="flex items-center gap-2.5 pt-1">
                <Button
                  variant="outline"
                  size="md"
                  onClick={resetDraft}
                  disabled={saveMealMutation.isPending}
                >
                  {t('common.cancel')}
                </Button>

                <Button
                  variant="primary"
                  size="md"
                  onClick={handleSaveMeal}
                  disabled={!hasDraftValues || saveMealMutation.isPending || deleteMealMutation.isPending}
                  className="flex-1 font-semibold gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{editingMealId ? t('common.save') : t('nutrition.confirmBtn')}</span>
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Smart Low-Memory Photo Picker Modal */}
      <SmartPhotoPickerModal
        isOpen={isPhotoPickerOpen}
        onClose={() => setIsPhotoPickerOpen(false)}
        onPhotoSelected={handlePhotoCaptured}
      />
    </div>
  );
};

export default NutritionPage;
