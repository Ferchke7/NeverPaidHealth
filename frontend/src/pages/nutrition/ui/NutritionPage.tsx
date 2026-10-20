import React, { useState } from 'react';
import {
  Camera,
  Plus,
  Trash2,
  Sparkles,
  Flame,
  CheckCircle2,
  Upload,
  Utensils,
  Target,
  AlertTriangle,
  FileText,
  RefreshCw,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../shared/api/client.ts';
import { Card, Button, Input, Modal, ProgressBar } from '../../../shared/ui/index.ts';
import { useTranslation } from '../../../shared/lib/i18n/i18n.ts';
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
  const { t, language } = useTranslation();
  const queryClient = useQueryClient();

  // Unified logging modal state
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [activeLogTab, setActiveLogTab] = useState<'photo' | 'text' | 'manual'>('photo');

  // Text estimation state
  const [textDescription, setTextDescription] = useState('');
  const [textResult, setTextResult] = useState<MealAnalysisResult | null>(null);

  // Scan state
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [scanNotes, setScanNotes] = useState('');
  const [scanResult, setScanResult] = useState<MealAnalysisResult | null>(null);
  const [selectedMealType, setSelectedMealType] = useState<string>('lunch');

  // Editable result fields
  const [editMealName, setEditMealName] = useState('');
  const [editCalories, setEditCalories] = useState('');
  const [editProtein, setEditProtein] = useState('');
  const [editCarbs, setEditCarbs] = useState('');
  const [editFat, setEditFat] = useState('');

  // Manual log state
  const [manualName, setManualName] = useState('');
  const [manualCalories, setManualCalories] = useState('500');
  const [manualProtein, setManualProtein] = useState('35');
  const [manualCarbs, setManualCarbs] = useState('45');
  const [manualFat, setManualFat] = useState('15');

  const [isPhotoPickerOpen, setIsPhotoPickerOpen] = useState(false);

  // Fetch today's nutrition
  const { data: summary, isLoading } = useQuery<DailyNutritionSummary>({
    queryKey: ['nutrition', 'today'],
    queryFn: () => apiClient.get('/nutrition/today'),
  });

  // Analyze Photo Mutation
  const analyzeMutation = useMutation({
    mutationFn: (data: { image_base64: string; notes?: string; language?: string }) =>
      apiClient.post<MealAnalysisResult>('/nutrition/analyze-photo', {
        ...data,
        language,
      }),
    onSuccess: (data) => {
      setScanResult(data);
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
      void queryClient.invalidateQueries({ queryKey: ['nutrition', 'today'] });
      void queryClient.invalidateQueries({ queryKey: ['coach-insights'] });
      setIsLogModalOpen(false);
      setSelectedImage(null);
      setScanResult(null);
      setTextResult(null);
      setScanNotes('');
      setTextDescription('');
      setManualName('');
      setEditMealName('');
      setEditCalories('');
      setEditProtein('');
      setEditCarbs('');
      setEditFat('');
    },
  });

  // Delete Meal Mutation
  const deleteMealMutation = useMutation({
    mutationFn: (mealId: string) => apiClient.delete(`/nutrition/meals/${mealId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['nutrition', 'today'] });
      void queryClient.invalidateQueries({ queryKey: ['coach-insights'] });
    },
  });

  // Photo captured callback from SmartPhotoPickerModal
  const handlePhotoCaptured = (photo: CompressedPhoto) => {
    setSelectedImage(photo.dataUrl);
    setScanResult(null);
    setActiveLogTab('photo');
    setIsLogModalOpen(true);

    analyzeMutation.mutate({
      image_base64: photo.dataUrl,
      notes: scanNotes,
      language,
    });
  };

  const handleSaveMeal = () => {
    const mealName =
      editMealName.trim() ||
      (activeLogTab === 'manual' ? manualName.trim() : null) ||
      scanResult?.meal_name ||
      textResult?.meal_name ||
      'Meal';

    const cals =
      parseInt(editCalories, 10) ||
      (activeLogTab === 'manual' ? parseInt(manualCalories, 10) : 0) ||
      scanResult?.total_calories ||
      textResult?.total_calories ||
      0;

    const protein =
      parseFloat(editProtein) ||
      (activeLogTab === 'manual' ? parseFloat(manualProtein) : 0) ||
      scanResult?.total_protein_g ||
      textResult?.total_protein_g ||
      0;

    const carbs =
      parseFloat(editCarbs) ||
      (activeLogTab === 'manual' ? parseFloat(manualCarbs) : 0) ||
      scanResult?.total_carbs_g ||
      textResult?.total_carbs_g ||
      0;

    const fat =
      parseFloat(editFat) ||
      (activeLogTab === 'manual' ? parseFloat(manualFat) : 0) ||
      scanResult?.total_fat_g ||
      textResult?.total_fat_g ||
      0;

    saveMealMutation.mutate({
      meal_type: selectedMealType,
      name: mealName,
      calories: cals,
      protein_g: protein,
      carbs_g: carbs,
      fat_g: fat,
      photo_url: activeLogTab === 'photo' ? (selectedImage || undefined) : undefined,
      items:
        activeLogTab === 'photo'
          ? scanResult?.items || []
          : activeLogTab === 'text'
          ? textResult?.items || []
          : [],
    });
  };

  // User Profile Nutrition Targets
  const user = useAuthStore((s) => s.user);

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
  const calsPct = Math.min(100, Math.round((totalCals / targetCals) * 100));

  const totalProtein = Math.round(summary?.total_protein_g || 0);
  const proteinPct = Math.min(100, Math.round((totalProtein / targetProtein) * 100));

  const totalCarbs = Math.round(summary?.total_carbs_g || 0);
  const carbsPct = Math.min(100, Math.round((totalCarbs / targetCarbs) * 100));

  const totalFat = Math.round(summary?.total_fat_g || 0);
  const fatPct = Math.min(100, Math.round((totalFat / targetFat) * 100));

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

  return (
    <div className="space-y-4 animate-fade-in pb-12 max-w-4xl mx-auto">
      {/* 1. Header with Unified Action */}
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-brand-500/15 border border-brand-500/30 flex items-center justify-center text-brand-400 font-bold shrink-0">
            <Utensils className="w-4 h-4" />
          </div>
          <h1 className="text-lg sm:text-xl font-extrabold tracking-tight text-white flex items-center gap-2">
            <span>{t('nutrition.title')}</span>
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPhotoPickerOpen(true)}
            className="p-2 rounded-xl bg-dark-800 hover:bg-dark-750 text-brand-400 border border-dark-700 transition-all cursor-pointer shadow-sm"
            title={t('nutrition.snapPhoto')}
          >
            <Camera className="w-4 h-4" />
          </button>

          <Button
            variant="primary"
            size="sm"
            className="text-xs font-bold flex items-center gap-1.5 shadow-md shadow-brand-500/20 rounded-xl px-3.5 py-2"
            onClick={() => {
              setActiveLogTab('photo');
              setIsLogModalOpen(true);
            }}
          >
            <Plus className="w-4 h-4" />
            <span>{t('nutrition.logMeal')}</span>
          </Button>
        </div>
      </div>

      {/* 2. Top Hero: Macro & Calorie Dashboard */}
      <Card className="p-4 sm:p-5 bg-gradient-to-br from-dark-850 via-dark-850 to-brand-950/20 border-dark-700/80 shadow-xl space-y-4 rounded-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-dark-750">
          <div>
            <div className="flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-brand-400" />
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                {t('nutrition.remainingToday')}
              </h2>
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span
                className={`text-2xl sm:text-3xl font-black font-mono tracking-tight ${
                  remCals >= 0 ? 'text-brand-400' : 'text-amber-400'
                }`}
              >
                {remCals >= 0 ? `+${remCals.toLocaleString()}` : `-${Math.abs(remCals).toLocaleString()}`}
              </span>
              <span className="text-xs font-semibold text-zinc-400 font-mono">
                {t('nutrition.remainingKcal')}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono bg-dark-900/80 px-3.5 py-2 rounded-xl border border-dark-750 self-start sm:self-auto">
            <div>
              <span className="text-[10px] text-zinc-500 block">{t('nutrition.consumed')}</span>
              <span className="font-bold text-white">{totalCals.toLocaleString()} kcal</span>
            </div>
            <div className="w-px h-6 bg-dark-700" />
            <div>
              <span className="text-[10px] text-zinc-500 block">{t('nutrition.target')}</span>
              <span className="font-bold text-zinc-300">{targetCals.toLocaleString()} kcal</span>
            </div>
          </div>
        </div>

        {/* 4 Macro Cards Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          {/* Calories */}
          <div className="p-3 rounded-2xl bg-dark-900/90 border border-brand-500/20 flex flex-col justify-between space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-zinc-300 flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-brand-400" />
                {t('nutrition.calories')}
              </span>
              <span className="font-mono font-bold text-brand-400">{calsPct}%</span>
            </div>
            <div className="space-y-1">
              <div className="flex items-baseline justify-between text-xs font-mono">
                <span className="font-black text-white">{totalCals}</span>
                <span className="text-zinc-500">/ {targetCals}</span>
              </div>
              <ProgressBar value={calsPct} color="primary" size="sm" />
            </div>
          </div>

          {/* Protein */}
          <div className="p-3 rounded-2xl bg-dark-900/90 border border-emerald-500/20 flex flex-col justify-between space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-emerald-400">{t('nutrition.protein')}</span>
              <span className="font-mono font-bold text-emerald-400">{proteinPct}%</span>
            </div>
            <div className="space-y-1">
              <div className="flex items-baseline justify-between text-xs font-mono">
                <span className="font-black text-white">{totalProtein}g</span>
                <span className="text-zinc-500">/ {targetProtein}g</span>
              </div>
              <ProgressBar value={proteinPct} color="success" size="sm" />
            </div>
          </div>

          {/* Carbs */}
          <div className="p-3 rounded-2xl bg-dark-900/90 border border-blue-500/20 flex flex-col justify-between space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-blue-400">{t('nutrition.carbs')}</span>
              <span className="font-mono font-bold text-blue-400">{carbsPct}%</span>
            </div>
            <div className="space-y-1">
              <div className="flex items-baseline justify-between text-xs font-mono">
                <span className="font-black text-white">{totalCarbs}g</span>
                <span className="text-zinc-500">/ {targetCarbs}g</span>
              </div>
              <ProgressBar value={carbsPct} color="primary" size="sm" />
            </div>
          </div>

          {/* Fat */}
          <div className="p-3 rounded-2xl bg-dark-900/90 border border-amber-500/20 flex flex-col justify-between space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-amber-400">{t('nutrition.fat')}</span>
              <span className="font-mono font-bold text-amber-400">{fatPct}%</span>
            </div>
            <div className="space-y-1">
              <div className="flex items-baseline justify-between text-xs font-mono">
                <span className="font-black text-white">{totalFat}g</span>
                <span className="text-zinc-500">/ {targetFat}g</span>
              </div>
              <ProgressBar value={fatPct} color="warning" size="sm" />
            </div>
          </div>
        </div>
      </Card>

      {/* 3. Daily Meal Logs Timeline */}
      <div className="space-y-3">
        <div className="flex items-center justify-between border-b border-dark-800 pb-2">
          <h2 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
            <span>{t('nutrition.mealsToday')}</span>
            <span className="text-xs font-mono font-bold text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded-full border border-brand-500/20">
              {summary?.meals?.length || 0}
            </span>
          </h2>
        </div>

        {isLoading ? (
          <div className="space-y-2.5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-dark-800/60 rounded-2xl animate-pulse border border-dark-750" />
            ))}
          </div>
        ) : !summary?.meals || summary.meals.length === 0 ? (
          <div className="text-center py-10 border border-dashed border-dark-800 rounded-3xl p-6 bg-dark-900/40 space-y-3">
            <Utensils className="w-10 h-10 text-zinc-600 mx-auto" />
            <h3 className="text-sm font-bold text-zinc-300">{t('nutrition.noMeals')}</h3>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto">
              {t('nutrition.noMealsDesc')}
            </p>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setActiveLogTab('photo');
                setIsLogModalOpen(true);
              }}
              className="text-xs font-bold rounded-xl"
            >
              <Plus className="w-4 h-4 mr-1" />
              {t('nutrition.logMeal')}
            </Button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {summary.meals.map((meal) => (
              <Card
                key={meal.id}
                className="p-3.5 bg-dark-850/90 border border-dark-750 hover:border-brand-500/40 transition-all flex items-center justify-between gap-3 shadow-md rounded-2xl"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {meal.photo_url ? (
                    <img
                      src={meal.photo_url}
                      alt={meal.name}
                      className="w-12 h-12 rounded-xl object-cover border border-dark-700 shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-dark-900 border border-dark-750 flex items-center justify-center text-brand-400 shrink-0 font-bold">
                      <Utensils className="w-5 h-5" />
                    </div>
                  )}

                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[9px] uppercase font-bold text-brand-400 tracking-wider bg-brand-500/10 px-1.5 py-0.2 rounded border border-brand-500/20">
                        {t(`nutrition.${meal.meal_type}` as any) || meal.meal_type}
                      </span>
                      <h4 className="text-xs sm:text-sm font-bold text-white truncate">
                        {meal.name}
                      </h4>
                    </div>

                    <div className="flex items-center gap-2 text-xs font-mono flex-wrap">
                      <span className="text-white font-extrabold">{meal.calories} kcal</span>
                      <span className="text-zinc-600">•</span>
                      <span className="text-emerald-400">{meal.protein_g}g P</span>
                      <span className="text-zinc-600">•</span>
                      <span className="text-blue-400">{meal.carbs_g}g C</span>
                      <span className="text-zinc-600">•</span>
                      <span className="text-amber-400">{meal.fat_g}g F</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => deleteMealMutation.mutate(meal.id)}
                    className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-950/20 transition-colors cursor-pointer"
                    title={t('common.delete')}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* 4. Unified Log Meal Modal */}
      <Modal
        isOpen={isLogModalOpen}
        onClose={() => setIsLogModalOpen(false)}
        size="lg"
        icon={
          <div className="w-8 h-8 rounded-xl bg-brand-500/20 text-brand-400 border border-brand-500/30 flex items-center justify-center font-bold">
            <Utensils className="w-4 h-4" />
          </div>
        }
        title={t('nutrition.logMeal')}
        subtitle=""
        footer={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsLogModalOpen(false)}
            >
              {t('common.cancel')}
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={handleSaveMeal}
              disabled={saveMealMutation.isPending}
              className="font-bold text-xs shadow-md shadow-brand-500/20"
            >
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
              {t('nutrition.logMeal')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {/* Modal Tab Switcher */}
          <div className="flex items-center p-1 bg-dark-900 rounded-xl border border-dark-750 gap-1">
            <button
              type="button"
              onClick={() => setActiveLogTab('photo')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeLogTab === 'photo'
                  ? 'bg-brand-500/20 text-brand-400 border border-brand-500/40 shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>{t('nutrition.snapPhoto')}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveLogTab('text')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeLogTab === 'text'
                  ? 'bg-brand-500/20 text-brand-400 border border-brand-500/40 shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>{t('nutrition.estimateText')}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveLogTab('manual')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeLogTab === 'manual'
                  ? 'bg-brand-500/20 text-brand-400 border border-brand-500/40 shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t('nutrition.addManual')}</span>
            </button>
          </div>

          {/* Meal Type Selector */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
              {t('nutrition.mealType')}
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {['breakfast', 'lunch', 'dinner', 'snack'].map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setSelectedMealType(type)}
                  className={`text-xs py-1.5 rounded-xl font-bold transition-all border cursor-pointer ${
                    selectedMealType === type
                      ? 'bg-brand-500 text-dark-950 border-brand-500 shadow-sm'
                      : 'bg-dark-800 text-zinc-400 border-dark-700 hover:text-white'
                  }`}
                >
                  {t(`nutrition.${type}` as any)}
                </button>
              ))}
            </div>
          </div>

          {/* TAB 1: PHOTO */}
          {activeLogTab === 'photo' && (
            <div className="space-y-3">
              {selectedImage ? (
                <div className="relative rounded-2xl overflow-hidden border border-dark-700 max-h-48 flex items-center justify-center bg-dark-950">
                  <img src={selectedImage} alt="Meal" className="w-full h-auto object-cover max-h-48" />
                  <button
                    type="button"
                    onClick={() => setIsPhotoPickerOpen(true)}
                    className="absolute bottom-2.5 right-2.5 bg-dark-900/90 hover:bg-dark-800 text-white text-xs font-bold px-2.5 py-1.5 rounded-xl border border-dark-700 flex items-center gap-1 shadow-lg backdrop-blur cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>{t('nutrition.changePhoto')}</span>
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => setIsPhotoPickerOpen(true)}
                  className="border-2 border-dashed border-dark-700 hover:border-brand-500/50 rounded-2xl p-6 text-center cursor-pointer bg-dark-850/50 transition-all"
                >
                  <Upload className="w-8 h-8 text-brand-400 mx-auto mb-1.5" />
                  <p className="text-xs font-bold text-zinc-200">{t('nutrition.photoUploadHint')}</p>
                </div>
              )}

              {analyzeMutation.isPending && (
                <div className="p-3.5 rounded-xl bg-dark-800 border border-brand-500/30 flex items-center gap-2.5 animate-pulse">
                  <Sparkles className="w-4 h-4 text-brand-400 animate-spin shrink-0" />
                  <span className="text-xs font-semibold text-brand-300">{t('nutrition.analyzing')}</span>
                </div>
              )}

              {analyzeMutation.isError && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{t('nutrition.visionUnavailable')}</span>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: TEXT */}
          {activeLogTab === 'text' && (
            <div className="space-y-3">
              <textarea
                rows={2}
                placeholder={t('nutrition.textPlaceholder')}
                value={textDescription}
                onChange={(e) => setTextDescription(e.target.value)}
                className="w-full bg-dark-900 border border-dark-700 rounded-2xl p-3 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-brand-500 resize-none leading-relaxed"
              />

              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1">
                {foodPresets.map((chip, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setTextDescription(chip.val);
                      analyzeTextMutation.mutate({
                        description: chip.val,
                        language,
                      });
                    }}
                    className="px-2.5 py-1 rounded-xl text-xs bg-dark-800 hover:bg-dark-750 text-zinc-300 hover:text-white border border-dark-700 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>

              <Button
                variant="primary"
                size="sm"
                className="w-full text-xs font-bold shadow-md shadow-brand-500/20"
                disabled={!textDescription.trim() || analyzeTextMutation.isPending}
                onClick={() =>
                  analyzeTextMutation.mutate({
                    description: textDescription.trim(),
                    language,
                  })
                }
              >
                {analyzeTextMutation.isPending ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    <span>{t('nutrition.analyzingText')}</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                    <span>{t('nutrition.estimateBtn')}</span>
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Editable Meal Info & Macros (Shown in all tabs or after estimation) */}
          <div className="p-3.5 rounded-2xl bg-dark-900/90 border border-dark-750 space-y-3">
            <Input
              label={t('nutrition.mealName')}
              placeholder={t('nutrition.mealPlaceholder')}
              value={activeLogTab === 'manual' ? manualName : editMealName}
              onChange={(e) => {
                if (activeLogTab === 'manual') setManualName(e.target.value);
                else setEditMealName(e.target.value);
              }}
            />

            <div className="grid grid-cols-4 gap-2 text-center font-mono">
              <div className="p-2 bg-dark-850 rounded-xl border border-dark-700">
                <div className="text-[10px] text-zinc-500 font-sans">{t('nutrition.calories')}</div>
                <input
                  type="number"
                  placeholder="0"
                  value={activeLogTab === 'manual' ? manualCalories : editCalories}
                  onChange={(e) => {
                    if (activeLogTab === 'manual') setManualCalories(e.target.value);
                    else setEditCalories(e.target.value);
                  }}
                  className="w-full bg-transparent text-center font-bold text-brand-400 text-xs focus:outline-none"
                />
              </div>

              <div className="p-2 bg-dark-850 rounded-xl border border-dark-700">
                <div className="text-[10px] text-zinc-500 font-sans">{t('nutrition.protein')} (g)</div>
                <input
                  type="number"
                  placeholder="0"
                  value={activeLogTab === 'manual' ? manualProtein : editProtein}
                  onChange={(e) => {
                    if (activeLogTab === 'manual') setManualProtein(e.target.value);
                    else setEditProtein(e.target.value);
                  }}
                  className="w-full bg-transparent text-center font-bold text-emerald-400 text-xs focus:outline-none"
                />
              </div>

              <div className="p-2 bg-dark-850 rounded-xl border border-dark-700">
                <div className="text-[10px] text-zinc-500 font-sans">{t('nutrition.carbs')} (g)</div>
                <input
                  type="number"
                  placeholder="0"
                  value={activeLogTab === 'manual' ? manualCarbs : editCarbs}
                  onChange={(e) => {
                    if (activeLogTab === 'manual') setManualCarbs(e.target.value);
                    else setEditCarbs(e.target.value);
                  }}
                  className="w-full bg-transparent text-center font-bold text-blue-400 text-xs focus:outline-none"
                />
              </div>

              <div className="p-2 bg-dark-850 rounded-xl border border-dark-700">
                <div className="text-[10px] text-zinc-500 font-sans">{t('nutrition.fat')} (g)</div>
                <input
                  type="number"
                  placeholder="0"
                  value={activeLogTab === 'manual' ? manualFat : editFat}
                  onChange={(e) => {
                    if (activeLogTab === 'manual') setManualFat(e.target.value);
                    else setEditFat(e.target.value);
                  }}
                  className="w-full bg-transparent text-center font-bold text-amber-400 text-xs focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>
      </Modal>

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
