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

  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [isTextModalOpen, setIsTextModalOpen] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);

  // Text estimation state
  const [textDescription, setTextDescription] = useState('');
  const [textResult, setTextResult] = useState<MealAnalysisResult | null>(null);

  // Scan state
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [scanNotes, setScanNotes] = useState('');
  const [scanResult, setScanResult] = useState<MealAnalysisResult | null>(null);
  const [selectedMealType, setSelectedMealType] = useState<string>('lunch');

  // Editable scan / text result fields
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
      void queryClient.invalidateQueries({ queryKey: ['coach', 'insights'] });
      setIsScanModalOpen(false);
      setIsTextModalOpen(false);
      setIsManualModalOpen(false);
      setSelectedImage(null);
      setScanResult(null);
      setTextResult(null);
      setScanNotes('');
      setTextDescription('');
      setManualName('');
    },
  });

  // Delete Meal Mutation
  const deleteMealMutation = useMutation({
    mutationFn: (mealId: string) => apiClient.delete(`/nutrition/meals/${mealId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['nutrition', 'today'] });
      void queryClient.invalidateQueries({ queryKey: ['coach', 'insights'] });
    },
  });

  // Photo captured callback from SmartPhotoPickerModal
  const handlePhotoCaptured = (photo: CompressedPhoto) => {
    setSelectedImage(photo.dataUrl);
    setScanResult(null);
    setIsScanModalOpen(true);

    analyzeMutation.mutate({
      image_base64: photo.dataUrl,
      notes: scanNotes,
      language,
    });
  };

  const handleSaveScanResult = () => {
    if (!scanResult && !editMealName) return;
    saveMealMutation.mutate({
      meal_type: selectedMealType,
      name: editMealName || scanResult?.meal_name || 'Meal',
      calories: parseInt(editCalories, 10) || scanResult?.total_calories || 0,
      protein_g: parseFloat(editProtein) || scanResult?.total_protein_g || 0,
      carbs_g: parseFloat(editCarbs) || scanResult?.total_carbs_g || 0,
      fat_g: parseFloat(editFat) || scanResult?.total_fat_g || 0,
      photo_url: selectedImage || undefined,
      items: scanResult?.items || [],
    });
  };

  const handleSaveTextResult = () => {
    if (!textResult && !editMealName) return;
    saveMealMutation.mutate({
      meal_type: selectedMealType,
      name: editMealName || textResult?.meal_name || 'Meal',
      calories: parseInt(editCalories, 10) || textResult?.total_calories || 0,
      protein_g: parseFloat(editProtein) || textResult?.total_protein_g || 0,
      carbs_g: parseFloat(editCarbs) || textResult?.total_carbs_g || 0,
      fat_g: parseFloat(editFat) || textResult?.total_fat_g || 0,
      items: textResult?.items || [],
    });
  };

  const handleSaveManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualName.trim()) return;

    saveMealMutation.mutate({
      meal_type: selectedMealType,
      name: manualName.trim(),
      calories: parseInt(manualCalories, 10) || 0,
      protein_g: parseFloat(manualProtein) || 0,
      carbs_g: parseFloat(manualCarbs) || 0,
      fat_g: parseFloat(manualFat) || 0,
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
  const remProtein = targetProtein - totalProtein;
  const proteinPct = Math.min(100, Math.round((totalProtein / targetProtein) * 100));

  const totalCarbs = Math.round(summary?.total_carbs_g || 0);
  const remCarbs = targetCarbs - totalCarbs;
  const carbsPct = Math.min(100, Math.round((totalCarbs / targetCarbs) * 100));

  const totalFat = Math.round(summary?.total_fat_g || 0);
  const remFat = targetFat - totalFat;
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
    <div className="space-y-5 animate-fade-in pb-12">
      {/* 1. Header with Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-white flex items-center gap-2">
            <Utensils className="w-5 h-5 text-brand-400" />
            <span>{t('nutrition.title')}</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-400 border border-brand-500/30 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-brand-400" />
              Gemini AI
            </span>
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            {t('nutrition.subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            className="text-xs flex items-center gap-1.5"
            onClick={() => setIsManualModalOpen(true)}
          >
            <Plus className="w-4 h-4 text-zinc-400" />
            <span>{t('nutrition.addManual')}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="text-xs flex items-center gap-1.5 border-brand-500/40 text-brand-300 hover:bg-brand-500/10"
            onClick={() => {
              setTextResult(null);
              setIsTextModalOpen(true);
            }}
          >
            <FileText className="w-4 h-4 text-brand-400" />
            <span>{t('nutrition.estimateText')}</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            className="text-xs font-bold flex items-center gap-1.5 shadow-md shadow-brand-500/20"
            onClick={() => setIsPhotoPickerOpen(true)}
          >
            <Camera className="w-4 h-4" />
            <span>{t('nutrition.snapPhoto')}</span>
          </Button>
        </div>
      </div>

      {/* 2. Top Hero: Remaining for Today & Macro Dashboard */}
      <Card className="p-4 sm:p-5 bg-gradient-to-br from-dark-850 via-dark-850 to-brand-950/30 border-dark-700/90 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-dark-700/80">
          <div>
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-brand-400" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                {t('nutrition.remainingToday')}
              </h2>
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span
                className={`text-2xl sm:text-3xl font-extrabold font-mono tracking-tight ${
                  remCals >= 0 ? 'text-brand-400' : 'text-amber-400'
                }`}
              >
                {remCals >= 0 ? `+${remCals.toLocaleString()}` : `-${Math.abs(remCals).toLocaleString()}`}
              </span>
              <span className="text-xs sm:text-sm font-semibold text-zinc-400 font-mono">
                {t('nutrition.remainingKcal')}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono bg-dark-900/80 px-3.5 py-2 rounded-xl border border-dark-700">
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Calories */}
          <div className="p-3.5 rounded-2xl bg-dark-900/90 border border-brand-500/20 flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-zinc-300 flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-brand-400" />
                {t('nutrition.calories')}
              </span>
              <span className="font-mono font-bold text-brand-400">{calsPct}%</span>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between text-xs font-mono">
                <span className="font-extrabold text-white">{totalCals}</span>
                <span className="text-zinc-500">/ {targetCals}</span>
              </div>
              <ProgressBar value={calsPct} color="primary" size="sm" />
              <div className="text-[10px] font-mono text-zinc-400">
                {remCals >= 0 ? `+${remCals} ${t('nutrition.remainingKcal')}` : `${remCals} ${t('nutrition.exceeded')}`}
              </div>
            </div>
          </div>

          {/* Protein */}
          <div className="p-3.5 rounded-2xl bg-dark-900/90 border border-emerald-500/20 flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-emerald-400">{t('nutrition.protein')}</span>
              <span className="font-mono font-bold text-emerald-400">{proteinPct}%</span>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between text-xs font-mono">
                <span className="font-extrabold text-white">{totalProtein}g</span>
                <span className="text-zinc-500">/ {targetProtein}g</span>
              </div>
              <ProgressBar value={proteinPct} color="success" size="sm" />
              <div className="text-[10px] font-mono text-emerald-400/90">
                {remProtein >= 0 ? `+${remProtein}g ${t('nutrition.remainingG')}` : t('nutrition.targetMet')}
              </div>
            </div>
          </div>

          {/* Carbs */}
          <div className="p-3.5 rounded-2xl bg-dark-900/90 border border-blue-500/20 flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-blue-400">{t('nutrition.carbs')}</span>
              <span className="font-mono font-bold text-blue-400">{carbsPct}%</span>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between text-xs font-mono">
                <span className="font-extrabold text-white">{totalCarbs}g</span>
                <span className="text-zinc-500">/ {targetCarbs}g</span>
              </div>
              <ProgressBar value={carbsPct} color="primary" size="sm" />
              <div className="text-[10px] font-mono text-blue-400/90">
                {remCarbs >= 0 ? `+${remCarbs}g ${t('nutrition.remainingG')}` : `${remCarbs}g`}
              </div>
            </div>
          </div>

          {/* Fat */}
          <div className="p-3.5 rounded-2xl bg-dark-900/90 border border-amber-500/20 flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-amber-400">{t('nutrition.fat')}</span>
              <span className="font-mono font-bold text-amber-400">{fatPct}%</span>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between text-xs font-mono">
                <span className="font-extrabold text-white">{totalFat}g</span>
                <span className="text-zinc-500">/ {targetFat}g</span>
              </div>
              <ProgressBar value={fatPct} color="warning" size="sm" />
              <div className="text-[10px] font-mono text-amber-400/90">
                {remFat >= 0 ? `+${remFat}g ${t('nutrition.remainingG')}` : `${remFat}g`}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* 3. Daily Meal Logs Timeline */}
      <div className="space-y-3">
        <div className="flex items-center justify-between border-b border-dark-800 pb-2">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <span>{t('nutrition.mealsToday')}</span>
            <span className="text-xs font-mono font-bold text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded-full border border-brand-500/20">
              {summary?.meals?.length || 0}
            </span>
          </h2>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-dark-800/60 rounded-2xl animate-pulse border border-dark-700" />
            ))}
          </div>
        ) : !summary?.meals || summary.meals.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-dark-800 rounded-3xl p-6 bg-dark-900/40">
            <Utensils className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-zinc-300">{t('nutrition.noMeals')}</h3>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto mt-1 mb-5">
              {t('nutrition.noMealsDesc')}
            </p>

            <div className="flex items-center justify-center gap-3 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setTextResult(null);
                  setIsTextModalOpen(true);
                }}
                className="text-xs font-bold border-brand-500/30 text-brand-300"
              >
                <FileText className="w-3.5 h-3.5 mr-1 text-brand-400" />
                {t('nutrition.estimateText')}
              </Button>

              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsPhotoPickerOpen(true)}
                className="text-xs font-bold"
              >
                <Camera className="w-3.5 h-3.5 mr-1" />
                {t('nutrition.snapPhoto')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {summary.meals.map((meal) => (
              <Card
                key={meal.id}
                className="p-3.5 sm:p-4 bg-dark-850/90 border border-dark-700/80 hover:border-brand-500/40 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg"
              >
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  {meal.photo_url ? (
                    <img
                      src={meal.photo_url}
                      alt={meal.name}
                      className="w-14 h-14 rounded-2xl object-cover border border-dark-700 shrink-0 shadow-sm"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-2xl bg-dark-900 border border-dark-700/80 flex items-center justify-center text-brand-400 shrink-0 font-bold">
                      <Utensils className="w-6 h-6" />
                    </div>
                  )}

                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] uppercase font-bold text-brand-400 tracking-wider bg-brand-500/10 px-2 py-0.5 rounded-lg border border-brand-500/20">
                        {t(`nutrition.${meal.meal_type}` as any) || meal.meal_type}
                      </span>
                      <h4 className="text-sm font-bold text-white tracking-tight truncate">
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

                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                  <button
                    onClick={() => deleteMealMutation.mutate(meal.id)}
                    className="p-2 rounded-xl text-zinc-500 hover:text-red-400 hover:bg-red-950/20 transition-colors"
                    title={t('common.delete')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* 4. AI Text Meal Estimation Modal */}
      <Modal
        isOpen={isTextModalOpen}
        onClose={() => setIsTextModalOpen(false)}
        size="lg"
        icon={
          <div className="w-8 h-8 rounded-xl bg-brand-500/20 text-brand-400 border border-brand-500/30 flex items-center justify-center font-bold">
            <FileText className="w-4 h-4" />
          </div>
        }
        title={t('nutrition.textModalTitle')}
        subtitle={t('nutrition.textModalSubtitle')}
        footer={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsTextModalOpen(false)}
            >
              {t('common.cancel')}
            </Button>

            {textResult && (
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveTextResult}
                disabled={saveMealMutation.isPending || (!textResult && !editMealName.trim())}
                className="font-bold text-xs shadow-md shadow-brand-500/20"
              >
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                {t('nutrition.logMeal')}
              </Button>
            )}
          </>
        }
      >
        <div className="space-y-4">
          {/* Text Input Area */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
              {t('nutrition.textModalSubtitle')}
            </label>
            <div className="relative">
              <textarea
                rows={3}
                placeholder={t('nutrition.textPlaceholder')}
                value={textDescription}
                onChange={(e) => setTextDescription(e.target.value)}
                className="w-full bg-dark-900 border border-dark-700 rounded-2xl p-3.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-brand-500/80 transition-colors resize-none leading-relaxed"
              />
            </div>
          </div>

          {/* Quick Dish Selection Chips */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center justify-between">
              <span>{t('nutrition.quickPresets')}</span>
              <span className="text-[10px] text-brand-400 lowercase font-normal">{t('nutrition.quickInsert')}</span>
            </label>
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
          </div>

          {/* Estimate Action Button */}
          <div>
            <Button
              variant="primary"
              size="md"
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

          {/* Meal Type Selector */}
          <div className="space-y-1.5 pt-1">
            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
              {t('nutrition.mealType')}
            </label>
            <div className="grid grid-cols-4 gap-2">
              {['breakfast', 'lunch', 'dinner', 'snack'].map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setSelectedMealType(type)}
                  className={`text-xs py-2 rounded-xl font-bold transition-all border cursor-pointer ${
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

          {/* Calculated Nutrition Result */}
          {textResult && (
            <div className="p-4 rounded-2xl bg-dark-850 border border-brand-500/30 space-y-3.5 animate-in fade-in">
              {textResult.visual_description && (
                <div className="p-3 bg-brand-500/10 border border-brand-500/30 rounded-xl text-xs space-y-1">
                  <span className="font-bold text-brand-400 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-brand-400" />
                    {t('nutrition.whatAIsaw')}:
                  </span>
                  <p className="text-zinc-200 leading-relaxed font-medium">
                    {textResult.visual_description}
                  </p>
                </div>
              )}

              <Input
                label={t('nutrition.mealName')}
                value={editMealName}
                onChange={(e) => setEditMealName(e.target.value)}
              />

              <div className="grid grid-cols-4 gap-2 text-center font-mono">
                <div className="p-2 bg-dark-900 rounded-xl border border-dark-700">
                  <div className="text-[10px] text-zinc-500 font-sans">{t('nutrition.calories')}</div>
                  <input
                    type="number"
                    value={editCalories}
                    onChange={(e) => setEditCalories(e.target.value)}
                    className="w-full bg-transparent text-center font-bold text-brand-400 text-xs focus:outline-none"
                  />
                </div>
                <div className="p-2 bg-dark-900 rounded-xl border border-dark-700">
                  <div className="text-[10px] text-zinc-500 font-sans">{t('nutrition.protein')} (g)</div>
                  <input
                    type="number"
                    value={editProtein}
                    onChange={(e) => setEditProtein(e.target.value)}
                    className="w-full bg-transparent text-center font-bold text-emerald-400 text-xs focus:outline-none"
                  />
                </div>
                <div className="p-2 bg-dark-900 rounded-xl border border-dark-700">
                  <div className="text-[10px] text-zinc-500 font-sans">{t('nutrition.carbs')} (g)</div>
                  <input
                    type="number"
                    value={editCarbs}
                    onChange={(e) => setEditCarbs(e.target.value)}
                    className="w-full bg-transparent text-center font-bold text-blue-400 text-xs focus:outline-none"
                  />
                </div>
                <div className="p-2 bg-dark-900 rounded-xl border border-dark-700">
                  <div className="text-[10px] text-zinc-500 font-sans">{t('nutrition.fat')} (g)</div>
                  <input
                    type="number"
                    value={editFat}
                    onChange={(e) => setEditFat(e.target.value)}
                    className="w-full bg-transparent text-center font-bold text-amber-400 text-xs focus:outline-none"
                  />
                </div>
              </div>


              {textResult.items && textResult.items.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <div className="text-[11px] font-bold text-zinc-400">{t('nutrition.detectedItems')}:</div>
                  <div className="space-y-1">
                    {textResult.items.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-[11px] p-2 rounded-lg bg-dark-900/60 border border-dark-800"
                      >
                        <span className="text-zinc-200 font-medium">
                          {item.name} ({item.portion})
                        </span>
                        <span className="text-zinc-400 font-mono">
                          {item.calories} kcal • {item.protein_g}g P • {item.carbs_g}g C • {item.fat_g}g F
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {textResult.advice && (
                <p className="text-[11px] text-brand-300/90 italic bg-brand-500/5 p-2.5 rounded-xl border border-brand-500/20">
                  💡 {textResult.advice}
                </p>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* 5. AI Photo Scan Modal */}
      <Modal
        isOpen={isScanModalOpen}
        onClose={() => setIsScanModalOpen(false)}
        size="lg"
        icon={
          <div className="w-8 h-8 rounded-xl bg-brand-500/20 text-brand-400 border border-brand-500/30 flex items-center justify-center font-bold">
            <Camera className="w-4 h-4" />
          </div>
        }
        title={t('nutrition.visionModalTitle')}
        subtitle={t('nutrition.visionModalSubtitle')}
        footer={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsScanModalOpen(false)}
            >
              {t('common.cancel')}
            </Button>

            {(scanResult || analyzeMutation.isError) && (
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveScanResult}
                disabled={saveMealMutation.isPending || (!scanResult && !editMealName.trim())}
                className="font-bold text-xs shadow-md shadow-brand-500/20"
              >
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                {t('nutrition.logMeal')}
              </Button>
            )}
          </>
        }
      >
        <div className="space-y-4">
          {/* Photo Preview or Upload placeholder */}
          {selectedImage ? (
            <div className="relative rounded-2xl overflow-hidden border border-dark-700 max-h-64 flex items-center justify-center bg-dark-950">
              <img src={selectedImage} alt="Meal" className="w-full h-auto object-cover" />
              <button
                type="button"
                onClick={() => setIsPhotoPickerOpen(true)}
                className="absolute bottom-3 right-3 bg-dark-900/90 hover:bg-dark-800 text-white text-xs font-bold px-3 py-1.5 rounded-xl border border-dark-700 flex items-center gap-1.5 shadow-lg backdrop-blur cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" />
                {t('nutrition.changePhoto')}
              </button>
            </div>
          ) : (
            <div
              onClick={() => setIsPhotoPickerOpen(true)}
              className="border-2 border-dashed border-dark-700 hover:border-brand-500/50 rounded-2xl p-8 text-center cursor-pointer bg-dark-850/50 transition-all"
            >
              <Upload className="w-10 h-10 text-brand-400 mx-auto mb-2" />
              <p className="text-xs font-bold text-zinc-200">{t('nutrition.photoUploadHint')}</p>
              <p className="text-[11px] text-zinc-500 mt-1">{t('nutrition.cameraOrGallery')}</p>
            </div>
          )}

          {/* Meal Type Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
              {t('nutrition.mealType')}
            </label>
            <div className="grid grid-cols-4 gap-2">
              {['breakfast', 'lunch', 'dinner', 'snack'].map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setSelectedMealType(type)}
                  className={`text-xs py-2 rounded-xl font-bold transition-all border cursor-pointer ${
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

          {/* Quick Dish Selection Chips */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center justify-between">
              <span>{t('nutrition.quickPresets')}</span>
              <span className="text-[10px] text-brand-400 lowercase font-normal">{t('nutrition.autoCalc')}</span>
            </label>
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1">
              {foodPresets.map((chip, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setEditMealName(chip.val);
                    if (selectedImage) {
                      analyzeMutation.mutate({
                        image_base64: selectedImage,
                        notes: chip.val,
                        language,
                      });
                    }
                  }}
                  className="px-2.5 py-1 rounded-xl text-xs bg-dark-800 hover:bg-dark-750 text-zinc-300 hover:text-white border border-dark-700 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          {/* Loading / Vision Analyzing State */}
          {analyzeMutation.isPending && (
            <div className="p-4 rounded-2xl bg-dark-800 border border-brand-500/30 flex items-center gap-3 animate-pulse">
              <Sparkles className="w-5 h-5 text-brand-400 animate-spin shrink-0" />
              <div>
                <h4 className="text-xs font-bold text-brand-300">{t('nutrition.analyzing')}</h4>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  {t('nutrition.analyzingGemini')}
                </p>
              </div>
            </div>
          )}

          {/* AI Unavailable / Error State */}
          {analyzeMutation.isError && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3 animate-in fade-in">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-amber-300">{t('nutrition.visionUnavailable')}</h4>
                  <p className="text-[11px] text-zinc-300 mt-1 leading-relaxed">
                    {t('nutrition.visionUnavailableDesc')}
                  </p>
                </div>
              </div>

              <div className="space-y-3 pt-2 border-t border-amber-500/20">
                <Input
                  label={t('nutrition.mealName')}
                  placeholder={t('nutrition.mealPlaceholder')}
                  value={editMealName}
                  onChange={(e) => setEditMealName(e.target.value)}
                />

                <div className="grid grid-cols-4 gap-2 text-center font-mono">
                  <div className="p-2 bg-dark-900 rounded-xl border border-dark-700">
                    <div className="text-[10px] text-zinc-500 font-sans">{t('nutrition.calories')}</div>
                    <input
                      type="number"
                      placeholder="450"
                      value={editCalories}
                      onChange={(e) => setEditCalories(e.target.value)}
                      className="w-full bg-transparent text-center font-bold text-brand-400 text-xs focus:outline-none"
                    />
                  </div>
                  <div className="p-2 bg-dark-900 rounded-xl border border-dark-700">
                    <div className="text-[10px] text-zinc-500 font-sans">{t('nutrition.protein')} (g)</div>
                    <input
                      type="number"
                      placeholder="25"
                      value={editProtein}
                      onChange={(e) => setEditProtein(e.target.value)}
                      className="w-full bg-transparent text-center font-bold text-emerald-400 text-xs focus:outline-none"
                    />
                  </div>
                  <div className="p-2 bg-dark-900 rounded-xl border border-dark-700">
                    <div className="text-[10px] text-zinc-500 font-sans">{t('nutrition.carbs')} (g)</div>
                    <input
                      type="number"
                      placeholder="50"
                      value={editCarbs}
                      onChange={(e) => setEditCarbs(e.target.value)}
                      className="w-full bg-transparent text-center font-bold text-blue-400 text-xs focus:outline-none"
                    />
                  </div>
                  <div className="p-2 bg-dark-900 rounded-xl border border-dark-700">
                    <div className="text-[10px] text-zinc-500 font-sans">{t('nutrition.fat')} (g)</div>
                    <input
                      type="number"
                      placeholder="15"
                      value={editFat}
                      onChange={(e) => setEditFat(e.target.value)}
                      className="w-full bg-transparent text-center font-bold text-amber-400 text-xs focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* AI Vision Result with Visual Description & Editable Values */}
          {scanResult && (
            <div className="p-4 rounded-2xl bg-dark-850 border border-brand-500/30 space-y-3.5 animate-in fade-in">
              {scanResult.visual_description && (
                <div className="p-3 bg-brand-500/10 border border-brand-500/30 rounded-xl text-xs space-y-1">
                  <span className="font-bold text-brand-400 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-brand-400" />
                    {t('nutrition.whatAIsaw')}:
                  </span>
                  <p className="text-zinc-200 leading-relaxed font-medium">
                    {scanResult.visual_description}
                  </p>
                </div>
              )}

              <Input
                label={t('nutrition.mealName')}
                value={editMealName}
                onChange={(e) => setEditMealName(e.target.value)}
              />

              <div className="grid grid-cols-4 gap-2 text-center font-mono">
                <div className="p-2 bg-dark-900 rounded-xl border border-dark-700">
                  <div className="text-[10px] text-zinc-500 font-sans">{t('nutrition.calories')}</div>
                  <input
                    type="number"
                    value={editCalories}
                    onChange={(e) => setEditCalories(e.target.value)}
                    className="w-full bg-transparent text-center font-bold text-brand-400 text-xs focus:outline-none"
                  />
                </div>
                <div className="p-2 bg-dark-900 rounded-xl border border-dark-700">
                  <div className="text-[10px] text-zinc-500 font-sans">{t('nutrition.protein')} (g)</div>
                  <input
                    type="number"
                    value={editProtein}
                    onChange={(e) => setEditProtein(e.target.value)}
                    className="w-full bg-transparent text-center font-bold text-emerald-400 text-xs focus:outline-none"
                  />
                </div>
                <div className="p-2 bg-dark-900 rounded-xl border border-dark-700">
                  <div className="text-[10px] text-zinc-500 font-sans">{t('nutrition.carbs')} (g)</div>
                  <input
                    type="number"
                    value={editCarbs}
                    onChange={(e) => setEditCarbs(e.target.value)}
                    className="w-full bg-transparent text-center font-bold text-blue-400 text-xs focus:outline-none"
                  />
                </div>
                <div className="p-2 bg-dark-900 rounded-xl border border-dark-700">
                  <div className="text-[10px] text-zinc-500 font-sans">{t('nutrition.fat')} (g)</div>
                  <input
                    type="number"
                    value={editFat}
                    onChange={(e) => setEditFat(e.target.value)}
                    className="w-full bg-transparent text-center font-bold text-amber-400 text-xs focus:outline-none"
                  />
                </div>
              </div>

              {scanResult.items && scanResult.items.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <div className="text-[11px] font-bold text-zinc-400">{t('nutrition.detectedItems')}:</div>
                  <div className="space-y-1">
                    {scanResult.items.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-[11px] p-2 rounded-lg bg-dark-900/60 border border-dark-800"
                      >
                        <span className="text-zinc-200 font-medium">
                          {item.name} ({item.portion})
                        </span>
                        <span className="text-zinc-400 font-mono">
                          {item.calories} kcal • {item.protein_g}g P • {item.carbs_g}g C
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {scanResult.advice && (
                <p className="text-[11px] text-brand-300/90 italic bg-brand-500/5 p-2.5 rounded-xl border border-brand-500/20">
                  💡 {scanResult.advice}
                </p>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* 6. Manual Meal Entry Modal */}
      <Modal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        size="md"
        icon={
          <div className="w-8 h-8 rounded-xl bg-brand-500/20 text-brand-400 border border-brand-500/30 flex items-center justify-center font-bold">
            <Plus className="w-4 h-4" />
          </div>
        }
        title={t('nutrition.addManual')}
        subtitle={t('nutrition.manualModalSubtitle')}
        footer={
          <>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsManualModalOpen(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              form="manual-meal-form"
              variant="primary"
              size="sm"
              disabled={saveMealMutation.isPending || !manualName.trim()}
              className="font-bold text-xs shadow-md shadow-brand-500/20"
            >
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
              {t('nutrition.logMeal')}
            </Button>
          </>
        }
      >
        <form id="manual-meal-form" onSubmit={handleSaveManual} className="space-y-4">
          <Input
            label={t('nutrition.mealName')}
            placeholder={t('nutrition.mealPlaceholder')}
            value={manualName}
            onChange={(e) => setManualName(e.target.value)}
            required
          />

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
              {t('nutrition.mealType')}
            </label>
            <div className="grid grid-cols-4 gap-2">
              {['breakfast', 'lunch', 'dinner', 'snack'].map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setSelectedMealType(type)}
                  className={`text-xs py-2 rounded-xl font-bold transition-all border cursor-pointer ${
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

          <div className="grid grid-cols-2 gap-3">
            <Input
              label={t('nutrition.calories')}
              type="number"
              value={manualCalories}
              onChange={(e) => setManualCalories(e.target.value)}
              required
            />
            <Input
              label={`${t('nutrition.protein')} (g)`}
              type="number"
              value={manualProtein}
              onChange={(e) => setManualProtein(e.target.value)}
              required
            />
            <Input
              label={`${t('nutrition.carbs')} (g)`}
              type="number"
              value={manualCarbs}
              onChange={(e) => setManualCarbs(e.target.value)}
              required
            />
            <Input
              label={`${t('nutrition.fat')} (g)`}
              type="number"
              value={manualFat}
              onChange={(e) => setManualFat(e.target.value)}
              required
            />
          </div>
        </form>
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
