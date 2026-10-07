import React, { useState, useRef } from 'react';
import {
  Camera,
  Plus,
  Trash2,
  Sparkles,
  Flame,
  CheckCircle2,
  Upload,
  Utensils,
  X,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../shared/api/client.ts';
import { Card } from '../../../shared/ui/card.tsx';
import { Button } from '../../../shared/ui/button.tsx';
import { Input } from '../../../shared/ui/input.tsx';
import { useTranslation } from '../../../shared/lib/i18n/i18n.ts';

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
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);

  // Scan state
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [scanNotes, setScanNotes] = useState('');
  const [scanResult, setScanResult] = useState<MealAnalysisResult | null>(null);
  const [selectedMealType, setSelectedMealType] = useState<string>('lunch');

  // Manual log state
  const [manualName, setManualName] = useState('');
  const [manualCalories, setManualCalories] = useState('500');
  const [manualProtein, setManualProtein] = useState('35');
  const [manualCarbs, setManualCarbs] = useState('45');
  const [manualFat, setManualFat] = useState('15');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch today's nutrition
  const { data: summary, isLoading } = useQuery<DailyNutritionSummary>({
    queryKey: ['nutrition', 'today'],
    queryFn: () => apiClient.get('/nutrition/today'),
  });

  // Analyze Photo Mutation
  const analyzeMutation = useMutation({
    mutationFn: (data: { image_base64: string; notes?: string }) =>
      apiClient.post<MealAnalysisResult>('/nutrition/analyze-photo', data),
    onSuccess: (data) => {
      setScanResult(data);
    },
  });

  // Save Meal Mutation
  const saveMealMutation = useMutation({
    mutationFn: (mealData: Partial<MealLog>) =>
      apiClient.post<MealLog>('/nutrition/meals', mealData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nutrition', 'today'] });
      queryClient.invalidateQueries({ queryKey: ['coach', 'insights'] });
      setIsScanModalOpen(false);
      setIsManualModalOpen(false);
      setSelectedImage(null);
      setScanResult(null);
      setScanNotes('');
      setManualName('');
    },
  });

  // Delete Meal Mutation
  const deleteMealMutation = useMutation({
    mutationFn: (mealId: string) => apiClient.delete(`/nutrition/meals/${mealId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nutrition', 'today'] });
      queryClient.invalidateQueries({ queryKey: ['coach', 'insights'] });
    },
  });

  // Image upload handler with client-side compression to prevent large payloads
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1024;
        const MAX_HEIGHT = 1024;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.85);
        setSelectedImage(compressedBase64);
        setScanResult(null);

        // Auto trigger AI analysis
        analyzeMutation.mutate({
          image_base64: compressedBase64,
          notes: scanNotes,
        });
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSaveScanResult = () => {
    if (!scanResult) return;
    saveMealMutation.mutate({
      meal_type: selectedMealType,
      name: scanResult.meal_name || 'Meal',
      calories: scanResult.total_calories || 0,
      protein_g: scanResult.total_protein_g || 0,
      carbs_g: scanResult.total_carbs_g || 0,
      fat_g: scanResult.total_fat_g || 0,
      photo_url: selectedImage || undefined,
      items: scanResult.items || [],
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

  const totalCals = summary?.total_calories || 0;
  const targetCals = summary?.target_calories || 2500;
  const calsPct = Math.min(100, Math.round((totalCals / targetCals) * 100));

  const totalProtein = Math.round(summary?.total_protein_g || 0);
  const targetProtein = Math.round(summary?.target_protein_g || 170);
  const proteinPct = Math.min(100, Math.round((totalProtein / targetProtein) * 100));

  const totalCarbs = Math.round(summary?.total_carbs_g || 0);
  const targetCarbs = Math.round(summary?.target_carbs_g || 280);
  const carbsPct = Math.min(100, Math.round((totalCarbs / targetCarbs) * 100));

  const totalFat = Math.round(summary?.total_fat_g || 0);
  const targetFat = Math.round(summary?.target_fat_g || 70);
  const fatPct = Math.min(100, Math.round((totalFat / targetFat) * 100));

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* 1. Header with Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-white flex items-center gap-2">
            <Utensils className="w-5 h-5 text-brand-400" />
            <span>{t('nutrition.title')}</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-400 border border-brand-500/30 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-brand-400" />
              Gemini Vision AI
            </span>
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            {t('nutrition.subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="text-xs flex items-center gap-1.5"
            onClick={() => setIsManualModalOpen(true)}
          >
            <Plus className="w-4 h-4 text-brand-400" />
            <span>{t('nutrition.addManual')}</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            className="text-xs font-bold flex items-center gap-1.5 shadow-md shadow-brand-500/20"
            onClick={() => {
              setIsScanModalOpen(true);
              setTimeout(() => fileInputRef.current?.click(), 100);
            }}
          >
            <Camera className="w-4 h-4" />
            <span>{t('nutrition.snapPhoto')}</span>
          </Button>
        </div>
      </div>

      {/* Hidden File / Camera Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleImageSelect}
        className="hidden"
      />

      {/* 2. Daily Macros Progress Hub */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3.5">
        {/* Calories Card */}
        <Card className="p-4 bg-gradient-to-br from-brand-950/40 via-dark-800 to-dark-800 border-brand-500/30 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-brand-400" />
              {t('nutrition.calories')}
            </span>
            <span className="text-xs font-bold text-brand-400 font-mono">
              {calsPct}%
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-extrabold text-white font-mono">
                {totalCals.toLocaleString()}
              </span>
              <span className="text-xs text-zinc-400 font-mono">
                / {targetCals.toLocaleString()} kcal
              </span>
            </div>

            <div className="w-full bg-dark-900 h-2.5 rounded-full overflow-hidden p-0.5 border border-dark-700/60">
              <div
                className="bg-brand-500 h-full rounded-full transition-all duration-500 shadow-sm shadow-brand-500/50"
                style={{ width: `${calsPct}%` }}
              />
            </div>
          </div>
        </Card>

        {/* Protein Card */}
        <Card className="p-4 bg-dark-800/80 border-dark-700/80 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              {t('nutrition.protein')}
            </span>
            <span className="text-xs font-bold text-emerald-400 font-mono">
              {proteinPct}%
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-extrabold text-white font-mono">
                {totalProtein}g
              </span>
              <span className="text-xs text-zinc-400 font-mono">
                / {targetProtein}g
              </span>
            </div>

            <div className="w-full bg-dark-900 h-2 rounded-full overflow-hidden">
              <div
                className="bg-emerald-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${proteinPct}%` }}
              />
            </div>
          </div>
        </Card>

        {/* Carbs Card */}
        <Card className="p-4 bg-dark-800/80 border-dark-700/80 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-400">
              {t('nutrition.carbs')}
            </span>
            <span className="text-xs font-bold text-blue-400 font-mono">
              {carbsPct}%
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-extrabold text-white font-mono">
                {totalCarbs}g
              </span>
              <span className="text-xs text-zinc-400 font-mono">
                / {targetCarbs}g
              </span>
            </div>

            <div className="w-full bg-dark-900 h-2 rounded-full overflow-hidden">
              <div
                className="bg-blue-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${carbsPct}%` }}
              />
            </div>
          </div>
        </Card>

        {/* Fat Card */}
        <Card className="p-4 bg-dark-800/80 border-dark-700/80 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
              {t('nutrition.fat')}
            </span>
            <span className="text-xs font-bold text-amber-400 font-mono">
              {fatPct}%
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-extrabold text-white font-mono">
                {totalFat}g
              </span>
              <span className="text-xs text-zinc-400 font-mono">
                / {targetFat}g
              </span>
            </div>

            <div className="w-full bg-dark-900 h-2 rounded-full overflow-hidden">
              <div
                className="bg-amber-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${fatPct}%` }}
              />
            </div>
          </div>
        </Card>
      </div>

      {/* 3. Logged Meals for Today */}
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
          <div className="text-center py-16 border border-dashed border-dark-800 rounded-3xl p-6 bg-dark-900/40">
            <Utensils className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-zinc-300">{t('nutrition.noMeals')}</h3>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto mt-1 mb-4">
              {t('nutrition.noMealsDesc')}
            </p>

            <div className="flex items-center justify-center gap-3">
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setIsScanModalOpen(true);
                  setTimeout(() => fileInputRef.current?.click(), 100);
                }}
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
                className="p-4 bg-dark-800/90 border border-dark-700/80 hover:border-brand-500/40 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5 shadow-lg"
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
                      <span className="text-xs uppercase font-bold text-brand-400 tracking-wider bg-brand-500/10 px-2 py-0.5 rounded-lg border border-brand-500/20">
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

      {/* 4. AI Photo Scan Modal */}
      {isScanModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in overflow-y-auto">
          <div className="bg-dark-900 border border-dark-700 rounded-3xl max-w-lg w-full p-5 sm:p-6 space-y-4 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-dark-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-brand-500/20 text-brand-400 flex items-center justify-center font-bold">
                  <Camera className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-white">AI Meal Photo Recognition</h3>
              </div>
              <button
                onClick={() => setIsScanModalOpen(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Photo Preview or Upload placeholder */}
            {selectedImage ? (
              <div className="relative rounded-2xl overflow-hidden border border-dark-700 max-h-64 flex items-center justify-center bg-dark-950">
                <img src={selectedImage} alt="Meal" className="w-full h-auto object-cover" />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-3 right-3 bg-dark-900/90 hover:bg-dark-800 text-white text-xs font-bold px-3 py-1.5 rounded-xl border border-dark-700 flex items-center gap-1.5 shadow-lg backdrop-blur"
                >
                  <Camera className="w-3.5 h-3.5" />
                  Retake Photo
                </button>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-dark-700 hover:border-brand-500/50 rounded-2xl p-8 text-center cursor-pointer bg-dark-850/50 transition-all"
              >
                <Upload className="w-10 h-10 text-brand-400 mx-auto mb-2" />
                <p className="text-xs font-bold text-zinc-200">{t('nutrition.photoUploadHint')}</p>
                <p className="text-[11px] text-zinc-500 mt-1">Camera or Gallery (JPEG, PNG)</p>
              </div>
            )}

            {/* Meal Type Pills */}
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
                    className={`text-xs py-2 rounded-xl font-bold transition-all border ${
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

            {/* Loading / Vision Analyzing State */}
            {analyzeMutation.isPending && (
              <div className="p-4 rounded-2xl bg-dark-800 border border-brand-500/30 flex items-center gap-3 animate-pulse">
                <Sparkles className="w-5 h-5 text-brand-400 animate-spin shrink-0" />
                <div>
                  <h4 className="text-xs font-bold text-brand-300">{t('nutrition.analyzing')}</h4>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Analyzing ingredients, portion weights, and macro breakdown with Gemini Vision.
                  </p>
                </div>
              </div>
            )}

            {/* AI Vision Result */}
            {scanResult && (
              <div className="p-4 rounded-2xl bg-dark-850 border border-brand-500/30 space-y-3.5 animate-in fade-in">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold text-brand-400 uppercase tracking-wider bg-brand-500/10 px-2 py-0.5 rounded-lg border border-brand-500/20">
                      Detected Meal
                    </span>
                    <h4 className="text-sm font-extrabold text-white mt-1">
                      {scanResult.meal_name}
                    </h4>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-mono font-extrabold text-brand-400">
                      {scanResult.total_calories} kcal
                    </span>
                  </div>
                </div>

                {/* Macro breakdown pills */}
                <div className="grid grid-cols-3 gap-2 text-center font-mono">
                  <div className="p-2 bg-dark-900 rounded-xl border border-dark-700">
                    <div className="text-[10px] text-zinc-500 font-sans">Protein</div>
                    <div className="text-xs font-bold text-emerald-400">{scanResult.total_protein_g}g</div>
                  </div>
                  <div className="p-2 bg-dark-900 rounded-xl border border-dark-700">
                    <div className="text-[10px] text-zinc-500 font-sans">Carbs</div>
                    <div className="text-xs font-bold text-blue-400">{scanResult.total_carbs_g}g</div>
                  </div>
                  <div className="p-2 bg-dark-900 rounded-xl border border-dark-700">
                    <div className="text-[10px] text-zinc-500 font-sans">Fat</div>
                    <div className="text-xs font-bold text-amber-400">{scanResult.total_fat_g}g</div>
                  </div>
                </div>

                {/* Detected food ingredients */}
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
                            {item.calories} kcal • {item.protein_g}g P
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

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-dark-800">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsScanModalOpen(false)}
              >
                {t('common.cancel')}
              </Button>

              {scanResult && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSaveScanResult}
                  disabled={saveMealMutation.isPending}
                  className="font-bold text-xs"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                  {t('nutrition.logMeal')}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 5. Manual Meal Entry Modal */}
      {isManualModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-dark-900 border border-dark-700 rounded-3xl max-w-md w-full p-5 sm:p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-dark-800 pb-3">
              <h3 className="text-base font-bold text-white">{t('nutrition.addManual')}</h3>
              <button
                onClick={() => setIsManualModalOpen(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveManual} className="space-y-3.5">
              <Input
                label={t('nutrition.mealName')}
                placeholder="e.g. Oatmeal with Whey Protein & Berries"
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
                      className={`text-xs py-2 rounded-xl font-bold transition-all border ${
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
                  label={`${t('nutrition.calories')} (kcal)`}
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
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label={`${t('nutrition.carbs')} (g)`}
                  type="number"
                  value={manualCarbs}
                  onChange={(e) => setManualCarbs(e.target.value)}
                />
                <Input
                  label={`${t('nutrition.fat')} (g)`}
                  type="number"
                  value={manualFat}
                  onChange={(e) => setManualFat(e.target.value)}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-dark-800">
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
                  variant="primary"
                  size="sm"
                  disabled={!manualName.trim() || saveMealMutation.isPending}
                  className="font-bold text-xs"
                >
                  {t('nutrition.logMeal')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
