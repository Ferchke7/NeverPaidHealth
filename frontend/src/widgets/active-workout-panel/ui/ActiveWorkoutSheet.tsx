import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronDown,
  ChevronUp,
  Plus,
  Dumbbell,
  HelpCircle,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useActiveWorkoutStore } from '../../../entities/workout/model/activeWorkoutStore.ts';
import { useRestTimerStore } from '../../../entities/workout/model/restTimerStore.ts';
import { useExerciseNotesStore } from '../../../entities/workout/model/exerciseNotesStore.ts';
import { PreviousExerciseNote, SetType, WorkoutHistoryItem } from '../../../entities/workout/model/types.ts';
import { SetRow, PreviousSetData } from '../../../entities/workout/ui/SetRow.tsx';
import { ExerciseSetHistoryModal } from '../../../entities/workout/ui/ExerciseSetHistoryModal.tsx';
import { extractExerciseHistory, normalizeExerciseName, HistoricalSetRecord } from '../../../entities/workout/model/setHistory.ts';
import { ExercisePickerModal } from '../../../features/exercise-picker/ui/ExercisePickerModal.tsx';
import { Exercise } from '../../../entities/exercise/model/types.ts';
import { Button } from '../../../shared/ui/button.tsx';
import { Modal } from '../../../shared/ui/modal.tsx';
import { ProgressBar } from '../../../shared/ui/progress.tsx';
import { formatDate, formatDuration } from '../../../shared/lib/dates.ts';
import { formatWeight } from '../../../shared/lib/units.ts';
import { workoutHistoryStorage } from '../../../entities/workout/api/workoutHistoryStorage.ts';
import { useAuthStore } from '../../../entities/user/model/authStore.ts';
import { apiClient } from '../../../shared/api/client.ts';
import { WorkoutSummaryModal, FinishedWorkoutSummary } from '../../workout-summary-modal/ui/WorkoutSummaryModal.tsx';
import { ExerciseInfoModal } from '../../../features/exercise-detail/ui/ExerciseInfoModal.tsx';
import { useTranslation } from '../../../shared/lib/i18n/i18n.ts';
import { FloatingActiveWorkoutPill } from './FloatingActiveWorkoutPill.tsx';
import { playSetCompleteSound, playTaskUncheckSound } from '../../../shared/lib/audio/soundEffects.ts';

export const ActiveWorkoutSheet: React.FC = () => {
  const { t, language } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const workout = useActiveWorkoutStore((s) => s.workout);
  const isOpen = useActiveWorkoutStore((s) => s.isOpen);
  const openSheet = useActiveWorkoutStore((s) => s.openSheet);
  const closeSheet = useActiveWorkoutStore((s) => s.closeSheet);
  const addExercise = useActiveWorkoutStore((s) => s.addExercise);
  const replaceExercise = useActiveWorkoutStore((s) => s.replaceExercise);
  const removeExercise = useActiveWorkoutStore((s) => s.removeExercise);
  const addSet = useActiveWorkoutStore((s) => s.addSet);
  const updateSet = useActiveWorkoutStore((s) => s.updateSet);
  const removeSet = useActiveWorkoutStore((s) => s.removeSet);
  const updateExerciseNotes = useActiveWorkoutStore((s) => s.updateExerciseNotes);
  const updateWorkoutNotes = useActiveWorkoutStore((s) => s.updateWorkoutNotes);
  const finishWorkoutLocal = useActiveWorkoutStore((s) => s.finishWorkoutLocal);
  const discardWorkout = useActiveWorkoutStore((s) => s.discardWorkout);
  const liveVolume = useActiveWorkoutStore((s) => s.calculateLiveVolume());

  const savedLocalNotes = useExerciseNotesStore((s) => s.savedNotes);
  const readSignatures = useExerciseNotesStore((s) => s.readSignatures);
  const saveNoteForNextWorkout = useExerciseNotesStore((s) => s.saveNoteForNextWorkout);
  const markNoteAsRead = useExerciseNotesStore((s) => s.markNoteAsRead);

  const userId = useAuthStore((s) => s.user?.id);
  const unitPref = useAuthStore((s) => s.unitPreference);

  const isRestTimerActive = useRestTimerStore((s) => s.isActive);
  const totalRestDuration = useRestTimerStore((s) => s.totalDurationSeconds);
  const startRestTimer = useRestTimerStore((s) => s.startTimer);
  const stopRestTimer = useRestTimerStore((s) => s.stopTimer);
  const addRestSeconds = useRestTimerStore((s) => s.addSeconds);
  const getRemainingSeconds = useRestTimerStore((s) => s.getRemainingSeconds);

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [restRemaining, setRestRemaining] = useState(0);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [replacingInstanceId, setReplacingInstanceId] = useState<string | null>(null);
  const [isDiscardConfirmOpen, setIsDiscardConfirmOpen] = useState(false);
  const [isUnfinishedModalOpen, setIsUnfinishedModalOpen] = useState(false);
  const [isEmptySetWarningOpen, setIsEmptySetWarningOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [summary, setSummary] = useState<FinishedWorkoutSummary | null>(null);
  const [inspectingExerciseName, setInspectingExerciseName] = useState<string | null>(null);
  const [expandedNoteIds, setExpandedNoteIds] = useState<Record<string, boolean>>({});
  const [isWorkoutNoteOpen, setIsWorkoutNoteOpen] = useState(false);
  const [showAllExercises, setShowAllExercises] = useState(false);
  const [selectedSetByInstance, setSelectedSetByInstance] = useState<Record<string, string>>({});
  const [plateMathInstances, setPlateMathInstances] = useState<Record<string, boolean>>({});

  const noteLabels = {
    unreadBanner:
      language === 'uz'
        ? 'O‘tgan mashg‘ulotdan o‘qilmagan izoh'
        : language === 'en'
        ? 'Unread note from previous workout'
        : 'Непрочитанный комментарий с прошлой тренировки',
    expand: language === 'uz' ? 'Ochish' : language === 'en' ? 'Reveal' : 'Раскрыть',
    hide: language === 'uz' ? 'Yopish' : language === 'en' ? 'Hide' : 'Скрыть',
    fromPrevWorkout:
      language === 'uz'
        ? 'O‘tgan mashg‘ulotdagi eslatma'
        : language === 'en'
        ? 'Note from last session'
        : 'Заметка с прошлой тренировки',
    readBadge: language === 'uz' ? 'O‘qildi ✓' : language === 'en' ? 'Read ✓' : 'Прочитано ✓',
    leaveForNext:
      language === 'uz'
        ? 'Keyingi mashg‘ulot uchun o‘zingizga izoh qoldiring:'
        : language === 'en'
        ? 'Leave a comment for your next workout:'
        : 'Оставить комментарий себе на следующую тренировку:',
    placeholder:
      language === 'uz'
        ? 'Masalan: tor ushladim, tirsaklar 45°, keyingi safar +2.5 kg qo‘shaman...'
        : language === 'en'
        ? 'E.g. used narrow grip, elbows at 45°, bump weight by +2.5 kg next time...'
        : 'Например: брал узким хватом, локти под 45°, шло легко — в следующий раз ставь +2.5 кг...',
    workoutNoteBtn:
      language === 'uz'
        ? 'Mashg‘ulot izohi'
        : language === 'en'
        ? 'Workout Note'
        : 'Заметка к тренировке',
    workoutNotePlaceholder:
      language === 'uz'
        ? 'Keyingi shu mashg‘ulot uchun umumiy eslatma (uyqu, energiya, tartib)...'
        : language === 'en'
        ? 'General note for the next time you run this workout...'
        : 'Общий комментарий на следующую такую тренировку (самочувствие, порядок тренажеров, темп)...',
  };

  // Exercise IDs and names in active workout
  const exerciseIds = useMemo(() => {
    if (!workout) return [];
    return Array.from(new Set(workout.exercises.map((e) => e.exerciseId).filter(Boolean)));
  }, [workout]);

  const exerciseNames = useMemo(() => {
    if (!workout) return [];
    return Array.from(new Set(workout.exercises.map((e) => e.exerciseName?.trim()).filter(Boolean)));
  }, [workout]);

  // Fetch previous completed sets and notes directly from training service
  const { data: previousData } = useQuery<{
    items: Record<string, PreviousSetData[]>;
    notes?: Record<string, PreviousExerciseNote>;
  }>({
    queryKey: ['workouts', 'previous', exerciseIds.sort().join(','), exerciseNames.sort().join(',')],
    queryFn: () => {
      const params = new URLSearchParams();
      if (exerciseIds.length > 0) params.set('exercise_ids', exerciseIds.join(','));
      if (exerciseNames.length > 0) params.set('exercise_names', exerciseNames.join(','));
      return apiClient<{
        items: Record<string, PreviousSetData[]>;
        notes?: Record<string, PreviousExerciseNote>;
      }>(`/workouts/previous?${params.toString()}`);
    },
    enabled: (exerciseIds.length > 0 || exerciseNames.length > 0) && isOpen,
  });

  // Fetch full workouts history to extract set-level records and PRs for active exercises
  const { data: workoutsHistoryData } = useQuery<{ items: WorkoutHistoryItem[] }>({
    queryKey: ['workouts'],
    queryFn: async () => {
      try {
        const res = await apiClient<{ items: WorkoutHistoryItem[] }>('/workouts?limit=100');
        if (res && Array.isArray(res.items)) return res;
      } catch {
        // Fallback to local storage
      }
      return { items: workoutHistoryStorage.getAll() };
    },
    enabled: isOpen,
    staleTime: 60_000,
  });

  const allWorkoutsHistory = useMemo(() => {
    const local = workoutHistoryStorage.getAll();
    const server = Array.isArray(workoutsHistoryData?.items) ? workoutsHistoryData.items : [];
    const map = new Map<string, WorkoutHistoryItem>();
    for (const w of local) map.set(w.id, w);
    for (const w of server) map.set(w.id, w);
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
    );
  }, [workoutsHistoryData]);

  const [historyModalState, setHistoryModalState] = useState<{
    isOpen: boolean;
    exerciseName: string;
    exerciseId?: string;
    instanceId: string;
    setNumber?: number;
    activeSetId?: string;
    history: HistoricalSetRecord[];
  } | null>(null);

  const previousExerciseMap = useMemo(() => {
    const map = new Map<string, PreviousSetData[]>();

    // 1. First seed from allWorkoutsHistory (offline-first recent session sets)
    for (const w of allWorkoutsHistory) {
      if (!w.exercises || w.status === 'in_progress' || w.status === 'cancelled') continue;
      for (const ex of w.exercises) {
        const completedSets = (ex.sets || [])
          .filter((s) => s.completed !== false && (Number(s.weight_kg ?? 0) > 0 || Number(s.reps ?? 0) > 0))
          .sort((a, b) => (a.set_number || 1) - (b.set_number || 1))
          .map((s) => ({
            weightKg: Number(s.weight_kg ?? 0),
            weight_kg: Number(s.weight_kg ?? 0),
            reps: Number(s.reps ?? 0),
          }));

        if (completedSets.length === 0) continue;

        const candidateKeys = [
          ex.exercise_id?.toLowerCase().trim(),
          ex.exercise_name?.toLowerCase().trim(),
          ex.exercise_name ? normalizeExerciseName(ex.exercise_name) : null,
          ex.exercise_id ? ex.exercise_id.replace(/[^a-z0-9а-яё]/gi, '') : null,
          ex.exercise_name ? ex.exercise_name.replace(/[^a-z0-9а-яё]/gi, '').toLowerCase() : null,
        ].filter(Boolean) as string[];

        for (const k of candidateKeys) {
          if (!map.has(k)) {
            map.set(k, completedSets);
          }
        }
      }
    }

    // 2. Server previousData enriches or overrides if available
    if (previousData?.items) {
      for (const [key, sets] of Object.entries(previousData.items)) {
        if (!sets || sets.length === 0) continue;
        const lowerKey = key.toLowerCase().trim();
        map.set(lowerKey, sets);
        const cleanKey = lowerKey.replace(/[^a-z0-9а-яё]/gi, '');
        if (cleanKey) map.set(cleanKey, sets);
        const baseKey = lowerKey.replace(/\s*\([^)]*\)/g, '').replace(/[^a-z0-9а-яё]/gi, '').trim();
        if (baseKey) map.set(baseKey, sets);
      }
    }
    return map;
  }, [allWorkoutsHistory, previousData]);

  // Merge previous notes from backend + local storage cache
  const previousNotesMap = useMemo(() => {
    const map = new Map<string, PreviousExerciseNote>();

    // 1. Local saved notes first
    for (const [key, noteObj] of Object.entries(savedLocalNotes)) {
      if (!noteObj?.note?.trim()) continue;
      const lowerKey = key.toLowerCase().trim();
      map.set(lowerKey, noteObj);
    }

    // 2. Backend notes override or enrich
    if (previousData?.notes) {
      for (const [key, noteObj] of Object.entries(previousData.notes)) {
        if (!noteObj?.note?.trim()) continue;
        const lowerKey = key.toLowerCase().trim();
        map.set(lowerKey, noteObj);
        const cleanKey = lowerKey.replace(/[^a-z0-9а-яё]/gi, '');
        if (cleanKey && !map.has(cleanKey)) map.set(cleanKey, noteObj);
        const baseKey = lowerKey.replace(/\s*\([^)]*\)/g, '').replace(/[^a-z0-9а-яё]/gi, '').trim();
        if (baseKey && !map.has(baseKey)) map.set(baseKey, noteObj);
      }
    }
    return map;
  }, [previousData, savedLocalNotes]);

  const checkIsUnread = (keys: (string | null | undefined)[], noteText?: string): boolean => {
    const trimmed = noteText?.trim();
    if (!trimmed) return false;
    const validKeys = keys.filter((k): k is string => Boolean(k && k.trim()));
    if (validKeys.length === 0) return false;
    for (const k of validKeys) {
      const sig = `${k.toLowerCase().trim()}::${trimmed}`;
      if (readSignatures[sig]) {
        return false;
      }
    }
    return true;
  };

  // Workout-level previous note lookup
  const workoutNoteKeys = useMemo(() => {
    if (!workout) return [];
    const keys: string[] = [];
    if (workout.routineId) keys.push(`__routine__:${workout.routineId.toLowerCase().trim()}`);
    if (workout.name) keys.push(`__workout__:${workout.name.toLowerCase().trim()}`);
    return keys;
  }, [workout?.routineId, workout?.name]);

  const prevWorkoutNote = useMemo(() => {
    for (const k of workoutNoteKeys) {
      const found = previousNotesMap.get(k);
      if (found?.note?.trim()) return found;
    }
    return null;
  }, [workoutNoteKeys, previousNotesMap]);

  const isWorkoutNoteUnread = useMemo(
    () => checkIsUnread(workoutNoteKeys, prevWorkoutNote?.note),
    [workoutNoteKeys, prevWorkoutNote, readSignatures]
  );

  // Fetch all-time personal records from progress records
  const { data: recordsData } = useQuery<any[]>({
    queryKey: ['records'],
    queryFn: () => apiClient<any[]>('/progress/records'),
    enabled: isOpen,
  });

  const prMap = useMemo(() => {
    const map = new Map<string, { weightKg: number; reps: number }>();

    // 1. Scan allWorkoutsHistory for offline PRs
    for (const w of allWorkoutsHistory) {
      if (!w.exercises || w.status === 'in_progress' || w.status === 'cancelled') continue;
      for (const ex of w.exercises) {
        for (const s of ex.sets || []) {
          if (s.completed === false) continue;
          const wKg = Number(s.weight_kg ?? 0);
          const reps = Number(s.reps ?? 0);
          if (wKg <= 0 && reps <= 0) continue;
          const val = { weightKg: wKg, reps: reps };

          const keys = [
            ex.exercise_id ? String(ex.exercise_id).toLowerCase().trim() : null,
            ex.exercise_name ? String(ex.exercise_name).toLowerCase().trim() : null,
            ex.exercise_name ? normalizeExerciseName(ex.exercise_name) : null,
          ].filter(Boolean) as string[];

          for (const k of keys) {
            const existing = map.get(k);
            if (!existing || wKg > existing.weightKg || (wKg === existing.weightKg && reps > existing.reps)) {
              map.set(k, val);
            }
          }
        }
      }
    }

    // 2. Server recordsData enriches or overrides if available
    if (Array.isArray(recordsData)) {
      for (const rec of recordsData) {
        const w = Number(rec.best_weight_kg) || 0;
        const r = Number(rec.max_reps) || 0;
        if (w <= 0 && r <= 0) continue;

        const val = { weightKg: w, reps: r };
        const id = rec.exercise_id ? String(rec.exercise_id).toLowerCase() : null;
        if (id) {
          const existing = map.get(id);
          if (!existing || w > existing.weightKg || (w === existing.weightKg && r > existing.reps)) {
            map.set(id, val);
          }
        }

        const name = rec.exercise_name ? String(rec.exercise_name).toLowerCase().trim() : null;
        if (name) {
          const existing = map.get(name);
          if (!existing || w > existing.weightKg || (w === existing.weightKg && r > existing.reps)) {
            map.set(name, val);
          }

          const clean = name.replace(/[^a-z0-9]/g, '');
          if (clean) {
            const exClean = map.get(clean);
            if (!exClean || w > exClean.weightKg || (w === exClean.weightKg && r > exClean.reps)) {
              map.set(clean, val);
            }
          }

          const base = name.replace(/\s*\([^)]*\)/g, '').replace(/[^a-z0-9]/g, '').trim();
          if (base) {
            const exBase = map.get(base);
            if (!exBase || w > exBase.weightKg || (w === exBase.weightKg && r > exBase.reps)) {
              map.set(base, val);
            }
          }
        }
      }
    }
    return map;
  }, [allWorkoutsHistory, recordsData]);

  // Elapsed workout stopwatch
  useEffect(() => {
    if (!workout) {
      setElapsedSeconds(0);
      return;
    }

    const startTime = new Date(workout.startedAt).getTime();
    const updateElapsed = () => {
      const diff = Math.max(0, Math.floor((Date.now() - startTime) / 1000));
      setElapsedSeconds(diff);
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [workout?.startedAt]);

  // Rest timer tick
  useEffect(() => {
    if (!isRestTimerActive) {
      setRestRemaining(0);
      return;
    }

    const updateRest = () => {
      setRestRemaining(getRemainingSeconds());
    };

    updateRest();
    const interval = setInterval(updateRest, 500);
    return () => clearInterval(interval);
  }, [isRestTimerActive, getRemainingSeconds]);

  if (!workout && !summary) return null;

  const handleToggleWorkoutNote = () => {
    const nextOpen = !isWorkoutNoteOpen;
    setIsWorkoutNoteOpen(nextOpen);
    if (nextOpen && prevWorkoutNote?.note) {
      markNoteAsRead(workoutNoteKeys, prevWorkoutNote.note);
    }
  };

  const handleToggleExerciseNote = (
    instanceId: string,
    keys: (string | null | undefined)[],
    prevNoteText?: string
  ) => {
    const nextOpen = !expandedNoteIds[instanceId];
    setExpandedNoteIds((prev) => ({ ...prev, [instanceId]: nextOpen }));
    if (nextOpen && prevNoteText?.trim()) {
      const validKeys = keys.filter((k): k is string => Boolean(k && k.trim()));
      markNoteAsRead(validKeys, prevNoteText);
    }
  };

  const commitFinishWorkout = async () => {
    if (!workout) return;
    setIsUnfinishedModalOpen(false);

    const completedSets = workout.exercises.reduce(
      (sum, e) => sum + e.sets.filter((s) => s.completed).length,
      0
    );

    setIsSubmitting(true);
    try {
      // Save any newly written exercise or workout notes for the next workout (marked unread!)
      for (const ex of workout.exercises) {
        if (ex.notes && ex.notes.trim()) {
          const kId = ex.exerciseId?.toLowerCase().trim();
          const kName = ex.exerciseName?.toLowerCase().trim();
          const kClean = kName ? kName.replace(/[^a-z0-9а-яё]/gi, '') : '';
          const kBase = kName ? kName.replace(/\s*\([^)]*\)/g, '').replace(/[^a-z0-9а-яё]/gi, '').trim() : '';
          saveNoteForNextWorkout(
            [kId, kName, kClean, kBase].filter(Boolean) as string[],
            ex.notes.trim(),
            workout.id,
            workout.name,
            workout.startedAt
          );
        }
      }

      if (workout.workoutNotes && workout.workoutNotes.trim() && workoutNoteKeys.length > 0) {
        saveNoteForNextWorkout(
          workoutNoteKeys,
          workout.workoutNotes.trim(),
          workout.id,
          workout.name,
          workout.startedAt
        );
      }

      const payloadExercises = workout.exercises
        .map((ex) => ({
          exercise_id: ex.exerciseId,
          exercise_name: ex.exerciseName,
          measurement_type: ex.measurementType,
          notes: ex.notes?.trim() || undefined,
          sets: ex.sets
            .filter((s) => s.completed)
            .map((s) => ({
              id: s.id,
              set_number: s.setNumber,
              set_type: s.setType,
              weight_kg: Number(s.weightKg) || 0,
              reps: Number(s.reps) || 0,
              rpe: s.rpe ? Number(s.rpe) : undefined,
              duration_seconds: s.durationSeconds,
              completed: true,
            })),
        }))
        .filter((ex) => ex.sets.length > 0);

      // Save locally to workoutHistoryStorage immediately
      const finishedItem: WorkoutHistoryItem = {
        id: workout.id,
        user_id: userId,
        name: workout.name,
        started_at: new Date(Date.now() - elapsedSeconds * 1000).toISOString(),
        ended_at: new Date().toISOString(),
        status: 'completed',
        total_volume_kg: liveVolume,
        exercises: payloadExercises.map((e, idx) => ({
          exercise_id: e.exercise_id,
          exercise_name: e.exercise_name,
          order_index: idx,
          sets: e.sets.map((s) => ({
            set_number: s.set_number,
            set_type: s.set_type,
            weight_kg: s.weight_kg,
            reps: s.reps,
            completed: s.completed,
          })),
        })),
      };
      workoutHistoryStorage.addWorkout(finishedItem);

      // 1. Try syncing finished workout to training service
      try {
        await apiClient(`/workouts/${workout.id}/finish`, {
          method: 'POST',
          body: JSON.stringify({
            duration_seconds: elapsedSeconds,
            exercises: payloadExercises,
          }),
        });
      } catch (err: any) {
        console.warn('Backend finish sync warning (saved locally):', err);
      }

      setSummary({
        id: workout.id,
        name: workout.name,
        durationSeconds: elapsedSeconds,
        totalVolumeKg: liveVolume,
        completedSetsCount: completedSets,
        exerciseCount: payloadExercises.length,
        exercises: payloadExercises.map((e) => ({
          exerciseName: e.exercise_name,
          setsCount: e.sets.length,
          volumeKg: e.sets.reduce((acc, s) => acc + s.weight_kg * s.reps, 0),
        })),
      });

      stopRestTimer();
      finishWorkoutLocal();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['workouts'] }),
        queryClient.invalidateQueries({ queryKey: ['records'] }),
        queryClient.invalidateQueries({ queryKey: ['history'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      ]);
    } catch (err: any) {
      console.error('Finish workout error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinishWorkout = async () => {
    if (!workout) return;

    const totalSets = workout.exercises.reduce((sum, e) => sum + e.sets.length, 0);
    const completedSets = workout.exercises.reduce(
      (sum, e) => sum + e.sets.filter((s) => s.completed).length,
      0
    );

    if (completedSets === 0) {
      setIsEmptySetWarningOpen(true);
      return;
    }

    if (completedSets < totalSets) {
      setIsUnfinishedModalOpen(true);
      return;
    }

    await commitFinishWorkout();
  };

  const handleDiscard = async () => {
    if (!workout) return;
    try {
      await apiClient(`/workouts/${workout.id}/cancel`, { method: 'POST' });
    } catch {
      // Ignore
    }
    stopRestTimer();
    discardWorkout();
    setIsDiscardConfirmOpen(false);
  };

  const handleSelectExercise = (exercise: Exercise) => {
    const measType =
      typeof exercise.measurement_type === 'string'
        ? exercise.measurement_type
        : 'weight_reps';

    if (replacingInstanceId) {
      replaceExercise(replacingInstanceId, {
        id: exercise.id,
        name: exercise.name,
        measurementType: measType,
      });
      setReplacingInstanceId(null);
    } else {
      addExercise(exercise.id, exercise.name, measType);
      setShowAllExercises(true);
    }
  };

  const defaultRestSecs =
    typeof window !== 'undefined' ? Number(localStorage.getItem('np_default_rest_secs')) || 90 : 90;

  const restProgressValue =
    totalRestDuration > 0
      ? Math.max(0, Math.min(100, Math.round((restRemaining / totalRestDuration) * 100)))
      : 0;

  const visibleExercises = workout
    ? showAllExercises || workout.exercises.length <= 2
      ? workout.exercises
      : workout.exercises.slice(0, 2)
    : [];
  const hiddenExerciseCount = workout ? Math.max(0, workout.exercises.length - visibleExercises.length) : 0;

  return (
    <>
      {/* 1. Minimized Floating Draggable Pill Widget */}
      {workout && !isOpen && (
        <FloatingActiveWorkoutPill
          workout={workout}
          elapsedSeconds={elapsedSeconds}
          liveVolume={liveVolume}
          unitPref={unitPref}
          isRestTimerActive={isRestTimerActive}
          restRemaining={restRemaining}
          onOpen={openSheet}
          t={t}
        />
      )}

      {/* 2. Workspace Active Workout View (renders inline inside DashboardLayout) */}
      {workout && isOpen && (
        <div className="space-y-6 pb-8">
          {/* Page Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-[28px] sm:text-[30px] font-bold tracking-[-0.02em] text-[#fafafa] leading-tight">
                {t('activeWorkout.sessionHeading')}
              </h1>
              <p className="text-sm text-[#a3a3a3] mt-1 truncate">
                {workout.name}
              </p>
            </div>
            <Button
              variant="outline"
              size="md"
              onClick={closeSheet}
              className="shrink-0 flex items-center gap-1.5"
              title="Minimize workout"
            >
              <ChevronDown className="w-4 h-4" />
              <span className="hidden sm:inline">{t('activeWorkout.minimizeBtn')}</span>
            </Button>
          </div>

          {/* Session Telemetry & Actions Card */}
          <section className="bg-[#171717] border border-[#404040] rounded-[14px] p-5 space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[#a3a3a3]">
                  {t('activeWorkout.duration').toUpperCase()}
                </div>
                <div className="text-2xl font-bold tabular-nums text-[#fafafa] mt-1">
                  {formatDuration(elapsedSeconds)}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[#a3a3a3]">
                  {t('activeWorkout.volumeLabel')}
                </div>
                <div className="text-2xl font-bold tabular-nums text-[#fafafa] mt-1">
                  {formatWeight(liveVolume, unitPref)}
                </div>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[#a3a3a3]">
                  {t('activeWorkout.exercisesLabel')}
                </div>
                <div className="text-2xl font-bold tabular-nums text-[#fafafa] mt-1">
                  {workout.exercises.length}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <Button
                variant="primary"
                size="md"
                isLoading={isSubmitting}
                onClick={handleFinishWorkout}
              >
                {t('activeWorkout.finishBtn')}
              </Button>
              <Button
                variant="outline"
                size="md"
                onClick={() => setIsDiscardConfirmOpen(true)}
              >
                {t('common.discard')}
              </Button>
              <Button
                variant="outline"
                size="md"
                onClick={handleToggleWorkoutNote}
                className={
                  isWorkoutNoteUnread || isWorkoutNoteOpen
                    ? 'border-[#34d399] text-[#34d399]'
                    : undefined
                }
              >
                <span>{t('activeWorkout.sessionNoteBtn')}</span>
                {isWorkoutNoteUnread && (
                  <span className="ml-1.5 inline-flex items-center justify-center px-1.5 py-0.5 rounded bg-[#022c22] text-[#34d399] text-[10px] font-bold">
                    1
                  </span>
                )}
              </Button>
            </div>

            {isWorkoutNoteOpen && (
              <div className="p-4 rounded-[12px] bg-[#0a0a0a] border border-[#262626] space-y-3">
                {prevWorkoutNote?.note && (
                  <div className="p-3 rounded-[10px] bg-[#171717] border border-[#262626] space-y-1">
                    <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-[#34d399]">
                      <span>
                        {noteLabels.fromPrevWorkout}
                        {prevWorkoutNote.started_at ? ` · ${formatDate(prevWorkoutNote.started_at)}` : ''}
                      </span>
                      <span>{noteLabels.readBadge}</span>
                    </div>
                    <p className="text-xs text-[#fafafa] leading-relaxed whitespace-pre-wrap">
                      {prevWorkoutNote.note}
                    </p>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[#a3a3a3] block">
                    {noteLabels.leaveForNext}
                  </label>
                  <textarea
                    rows={2}
                    value={workout.workoutNotes || ''}
                    onChange={(e) => updateWorkoutNotes(e.target.value)}
                    placeholder={noteLabels.workoutNotePlaceholder}
                    className="w-full rounded-[10px] bg-[#171717] border border-[#404040] focus:border-[#34d399] focus:outline-none px-3 py-2.5 text-sm text-[#fafafa] placeholder:text-[#737373] resize-none"
                  />
                </div>
              </div>
            )}
          </section>

          {/* Active Rest Timer Card (Matches 15 · 01 / ОТДЫХ) */}
          {isRestTimerActive && (
            <section className="bg-[#171717] border border-[#404040] rounded-[14px] p-5 space-y-4">
              <div className="space-y-1">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[#34d399]">
                  {t('activeWorkout.restEyebrow')}
                </div>
                <h2 className="text-lg font-bold text-[#fafafa]">
                  {t('activeWorkout.restTitle')}
                </h2>
              </div>

              <div className="space-y-2">
                <div className="text-[36px] sm:text-[40px] font-bold leading-none tabular-nums text-[#fafafa]">
                  {formatDuration(restRemaining)}
                </div>
                <p className="text-xs text-[#a3a3a3]">
                  {t('activeWorkout.restRemainingSec', { sec: restRemaining })}
                </p>
                <ProgressBar value={restProgressValue} />
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <Button variant="outline" size="md" onClick={() => addRestSeconds(-15)}>
                  {t('activeWorkout.minus15s')}
                </Button>
                <Button variant="outline" size="md" onClick={() => addRestSeconds(30)}>
                  {t('activeWorkout.plus30s')}
                </Button>
                <Button variant="outline" size="md" onClick={stopRestTimer}>
                  {t('activeWorkout.skipRest')}
                </Button>
              </div>
            </section>
          )}

          {/* Exercise Grid (2-col on Desktop, 1-col on Mobile) */}
          {workout.exercises.length === 0 ? (
            <div className="bg-[#171717] border border-[#404040] rounded-[14px] p-8 text-center space-y-4">
              <div className="w-12 h-12 rounded-[12px] bg-[#0a0a0a] border border-[#262626] text-[#a3a3a3] flex items-center justify-center mx-auto">
                <Dumbbell className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-[#fafafa]">
                  {t('activeWorkout.emptyWorkoutWarning')}
                </h3>
              </div>
              <Button variant="primary" size="md" onClick={() => setIsPickerOpen(true)}>
                <Plus className="w-4 h-4 mr-1.5" />
                {t('activeWorkout.addExercise')}
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
              {visibleExercises.map((exercise, exIndex) => {
                const keyId = exercise.exerciseId?.toLowerCase().trim();
                const keyName = exercise.exerciseName?.toLowerCase().trim();
                const cleanKeyName = keyName ? keyName.replace(/[^a-z0-9а-яё]/gi, '') : null;
                const baseKeyName = keyName
                  ? keyName.replace(/\s*\([^)]*\)/g, '').replace(/[^a-z0-9а-яё]/gi, '').trim()
                  : null;

                const prevList =
                  (keyId && previousExerciseMap.get(keyId)) ||
                  (keyName && previousExerciseMap.get(keyName)) ||
                  (cleanKeyName && previousExerciseMap.get(cleanKeyName)) ||
                  (baseKeyName && previousExerciseMap.get(baseKeyName));

                const prRecord =
                  (keyId && prMap.get(keyId)) ||
                  (keyName && prMap.get(keyName)) ||
                  (cleanKeyName && prMap.get(cleanKeyName)) ||
                  (baseKeyName && prMap.get(baseKeyName));

                const prevNote =
                  (keyId && previousNotesMap.get(keyId)) ||
                  (keyName && previousNotesMap.get(keyName)) ||
                  (cleanKeyName && previousNotesMap.get(cleanKeyName)) ||
                  (baseKeyName && previousNotesMap.get(baseKeyName)) ||
                  null;

                const noteLookupKeys = [keyId, keyName, cleanKeyName, baseKeyName];
                const hasUnreadNote = checkIsUnread(noteLookupKeys, prevNote?.note);
                const isNoteExpanded = Boolean(expandedNoteIds[exercise.instanceId]);
                const noteTextareaId = `exercise-note-${exercise.instanceId}`;
                const showPlateMath = Boolean(plateMathInstances[exercise.instanceId]);

                const exerciseHistory = extractExerciseHistory(
                  allWorkoutsHistory,
                  exercise.exerciseId,
                  exercise.exerciseName
                );

                const activeSetId =
                  selectedSetByInstance[exercise.instanceId] &&
                  exercise.sets.some((s) => s.id === selectedSetByInstance[exercise.instanceId])
                    ? selectedSetByInstance[exercise.instanceId]
                    : exercise.sets[0]?.id;
                const activeSet = exercise.sets.find((s) => s.id === activeSetId) || exercise.sets[0];

                // Quick rep suggestions from recent history (or unique fallback from previous sets)
                const quickRepSet = new Set<number>();
                exerciseHistory.forEach((h) => {
                  if (h.reps > 0 && quickRepSet.size < 3) quickRepSet.add(h.reps);
                });
                if (Array.isArray(prevList)) {
                  prevList.forEach((p) => {
                    if (p.reps && p.reps > 0 && quickRepSet.size < 3) quickRepSet.add(p.reps);
                  });
                }
                const quickReps = Array.from(quickRepSet);

                const setTypeOptions: { id: SetType; label: string }[] = [
                  { id: 'normal', label: t('activeWorkout.typeNormal') },
                  { id: 'warmup', label: t('activeWorkout.typeWarmup') },
                  { id: 'drop', label: t('activeWorkout.typeDrop') },
                  { id: 'failure', label: t('activeWorkout.typeFailure') },
                ];

                const indexLabel = `${String(exIndex + 1).padStart(2, '0')} / ${String(workout.exercises.length).padStart(2, '0')}`;

                return (
                  <article
                    key={exercise.instanceId || exercise.exerciseId || exIndex}
                    className="bg-[#171717] border border-[#404040] rounded-[14px] p-5 space-y-4"
                  >
                    {/* Header: Index, Name, PR, Actions */}
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1 min-w-0">
                          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#a3a3a3]">
                            {indexLabel}
                          </div>
                          <h3
                            onClick={() => setInspectingExerciseName(exercise.exerciseName)}
                            className="text-xl font-bold text-[#fafafa] tracking-tight hover:text-[#34d399] cursor-pointer transition-colors leading-snug"
                          >
                            {exercise.exerciseName}
                          </h3>
                          {prRecord && (
                            <button
                              type="button"
                              onClick={() =>
                                setHistoryModalState({
                                  isOpen: true,
                                  exerciseName: exercise.exerciseName,
                                  exerciseId: exercise.exerciseId,
                                  instanceId: exercise.instanceId,
                                  setNumber: activeSet?.setNumber,
                                  activeSetId: activeSet?.id,
                                  history: exerciseHistory,
                                })
                              }
                              className="text-[13px] font-medium text-[#34d399] hover:underline cursor-pointer text-left block"
                            >
                              {t('activeWorkout.prPrefix', {
                                weight: formatWeight(prRecord.weightKg, unitPref),
                                reps: prRecord.reps,
                              })}
                            </button>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => setInspectingExerciseName(exercise.exerciseName)}
                          className="w-10 h-10 rounded-[10px] border border-[#262626] bg-[#0a0a0a] text-[#a3a3a3] hover:text-[#fafafa] flex items-center justify-center shrink-0 cursor-pointer transition-colors"
                          title={t('exercises.viewTechnique')}
                          aria-label={t('exercises.viewTechnique')}
                        >
                          <HelpCircle className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          variant="outline"
                          size="md"
                          onClick={() => {
                            setReplacingInstanceId(exercise.instanceId);
                            setIsPickerOpen(true);
                          }}
                        >
                          {t('activeWorkout.replaceShort')}
                        </Button>
                        <Button
                          variant="outline"
                          size="md"
                          onClick={() => removeExercise(exercise.instanceId)}
                        >
                          {t('activeWorkout.removeShort')}
                        </Button>
                      </div>
                    </div>

                    {/* Inline Unread Banner / Expandable Note Box */}
                    {(hasUnreadNote || isNoteExpanded) && (
                      <div className="p-3.5 rounded-[12px] bg-[#0a0a0a] border border-[#262626] space-y-3">
                        {hasUnreadNote && !isNoteExpanded && prevNote && (
                          <>
                            <div className="space-y-1">
                              <div className="text-[13px] font-semibold text-[#34d399]">
                                {t('activeWorkout.noteUnreadCount')}
                              </div>
                              <p className="text-xs text-[#fafafa] leading-relaxed whitespace-pre-wrap">
                                {prevNote.note}
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <Button
                                variant="outline"
                                size="md"
                                onClick={() =>
                                  handleToggleExerciseNote(exercise.instanceId, noteLookupKeys, prevNote.note)
                                }
                              >
                                {t('activeWorkout.collapseNote')}
                              </Button>
                              <Button
                                variant="outline"
                                size="md"
                                onClick={() => {
                                  handleToggleExerciseNote(exercise.instanceId, noteLookupKeys, prevNote.note);
                                  setTimeout(() => document.getElementById(noteTextareaId)?.focus(), 50);
                                }}
                              >
                                {t('activeWorkout.commentBtn')}
                              </Button>
                            </div>
                          </>
                        )}

                        {isNoteExpanded && (
                          <div className="space-y-2.5">
                            {prevNote?.note && (
                              <div className="space-y-1 pb-2.5 border-b border-[#262626]">
                                <div className="flex items-center justify-between gap-2 text-xs font-semibold text-[#34d399]">
                                  <span>{noteLabels.fromPrevWorkout}</span>
                                  <span className="text-[11px] font-normal text-[#a3a3a3]">
                                    {noteLabels.readBadge}
                                  </span>
                                </div>
                                <p className="text-xs text-[#fafafa] leading-relaxed whitespace-pre-wrap">
                                  {prevNote.note}
                                </p>
                              </div>
                            )}
                            <label className="text-xs font-medium text-[#a3a3a3] block">
                              {noteLabels.leaveForNext}
                            </label>
                            <textarea
                              id={noteTextareaId}
                              rows={2}
                              value={exercise.notes || ''}
                              onChange={(e) => updateExerciseNotes(exercise.instanceId, e.target.value)}
                              placeholder={noteLabels.placeholder}
                              className="w-full rounded-[10px] bg-[#171717] border border-[#404040] focus:border-[#34d399] focus:outline-none px-3 py-2 text-xs text-[#fafafa] placeholder:text-[#737373] resize-none"
                            />
                            <div className="flex justify-end">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  handleToggleExerciseNote(exercise.instanceId, noteLookupKeys, prevNote?.note)
                                }
                              >
                                {t('activeWorkout.collapseNote')}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Set Type Segmented Selector */}
                    {activeSet && (
                      <div className="space-y-2">
                        <div className="text-xs text-[#a3a3a3]">
                          {t('activeWorkout.setTypeOfSet', { number: activeSet.setNumber })}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {setTypeOptions.map((opt) => {
                            const isActive = activeSet.setType === opt.id;
                            return (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() =>
                                  updateSet(exercise.instanceId, activeSet.id, { setType: opt.id })
                                }
                                className={`h-9 px-3 rounded-[10px] text-xs font-semibold transition-colors cursor-pointer ${
                                  isActive
                                    ? 'bg-[#022c22] text-[#34d399] border border-[#064e3b]'
                                    : 'bg-transparent text-[#a3a3a3] hover:text-[#fafafa] border border-transparent'
                                }`}
                              >
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Set Table Header + Rows */}
                    <div>
                      <div className="grid grid-cols-[28px_1fr_1fr_44px] gap-2.5 text-[11px] font-medium text-[#a3a3a3] pb-2 border-b border-[#262626] items-center">
                        <span className="text-center">№</span>
                        <span>
                          {t('activeWorkout.weightKgCol', {
                            unit: unitPref === 'lb' ? 'lb' : 'кг',
                          })}
                        </span>
                        <span>
                          {exercise.measurementType === 'duration' ||
                          exercise.measurementType === 'distance_duration'
                            ? t('exercises.duration') || t('activeWorkout.repsCol')
                            : t('activeWorkout.repsCol')}
                        </span>
                        <span className="text-center">✓</span>
                      </div>

                      <div>
                        {(() => {
                          const exerciseHistory = extractExerciseHistory(
                            allWorkoutsHistory,
                            exercise.exerciseId,
                            exercise.exerciseName
                          );

                          return exercise.sets.map((set, sIdx) => {
                            const prevSet =
                              prevList && prevList[sIdx]
                                ? prevList[sIdx]
                                : prevList && prevList.length > 0
                                ? prevList[prevList.length - 1]
                                : null;

                          return (
                            <SetRow
                              key={set.id || sIdx}
                              set={set}
                              previousSet={prevSet}
                              measurementType={exercise.measurementType}
                              allExerciseHistory={exerciseHistory}
                              isSelected={activeSet?.id === set.id}
                              showPlateMath={showPlateMath}
                              onSelectSet={() =>
                                setSelectedSetByInstance((prev) => ({
                                  ...prev,
                                  [exercise.instanceId]: set.id,
                                }))
                              }
                              onOpenHistoryMenu={(setNum) => {
                                setHistoryModalState({
                                  isOpen: true,
                                  exerciseName: exercise.exerciseName,
                                  exerciseId: exercise.exerciseId,
                                  instanceId: exercise.instanceId,
                                  setNumber: setNum,
                                  activeSetId: set.id,
                                  history: exerciseHistory,
                                });
                              }}
                              onUpdate={(updates) => updateSet(exercise.instanceId, set.id, updates)}
                              onDelete={() => removeSet(exercise.instanceId, set.id)}
                              onCompleteToggle={() => {
                                const willBeCompleted = !set.completed;
                                updateSet(exercise.instanceId, set.id, { completed: willBeCompleted });
                                if (willBeCompleted) {
                                  playSetCompleteSound();
                                  startRestTimer(defaultRestSecs);
                                } else {
                                  playTaskUncheckSound();
                                  }
                                }}
                              />
                            );
                          });
                        })()}
                      </div>
                    </div>

                    {/* Quick Reps Presets */}
                    {quickReps.length > 0 && activeSet && (
                      <div className="space-y-1.5">
                        <div className="text-xs text-[#a3a3a3]">{t('activeWorkout.quickReps')}</div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {quickReps.map((qRep) => {
                            const isSelectedRep = activeSet.reps === qRep;
                            return (
                              <button
                                key={qRep}
                                type="button"
                                onClick={() =>
                                  updateSet(exercise.instanceId, activeSet.id, { reps: qRep })
                                }
                                className={`min-w-[36px] h-9 px-2.5 rounded-[8px] text-xs font-semibold tabular-nums transition-colors cursor-pointer ${
                                  isSelectedRep
                                    ? 'bg-[#022c22] text-[#34d399] border border-[#064e3b]'
                                    : 'bg-transparent text-[#a3a3a3] hover:text-[#fafafa] border border-[#262626]'
                                }`}
                              >
                                {qRep}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Card Footer Action Row 1 & Row 2 */}
                    <div className="space-y-2.5 pt-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          variant="outline"
                          size="md"
                          onClick={() => addSet(exercise.instanceId, 'normal')}
                        >
                          {t('activeWorkout.addNormalSet')}
                        </Button>
                        <Button
                          variant="outline"
                          size="md"
                          onClick={() => addSet(exercise.instanceId, 'warmup')}
                        >
                          {t('activeWorkout.addWarmupSet')}
                        </Button>
                        {exercise.measurementType === 'weight_reps' && (
                          <Button
                            variant="outline"
                            size="md"
                            onClick={() =>
                              setPlateMathInstances((prev) => ({
                                ...prev,
                                [exercise.instanceId]: !prev[exercise.instanceId],
                              }))
                            }
                            className={showPlateMath ? 'border-[#34d399] text-[#34d399]' : undefined}
                          >
                            {t('activeWorkout.platesBtn')}
                          </Button>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          variant="outline"
                          size="md"
                          onClick={() => startRestTimer(defaultRestSecs)}
                        >
                          {t('activeWorkout.restBtn', { time: formatDuration(defaultRestSecs) })}
                        </Button>
                        <Button
                          variant="outline"
                          size="md"
                          onClick={() =>
                            handleToggleExerciseNote(exercise.instanceId, noteLookupKeys, prevNote?.note)
                          }
                          className={isNoteExpanded || exercise.notes?.trim() ? 'border-[#34d399] text-[#34d399]' : undefined}
                        >
                          {t('activeWorkout.noteBtn')}
                        </Button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {/* Collapsed Remaining Exercises Banner Card (matches Figma 04 bottom block) */}
          {hiddenExerciseCount > 0 && (
            <div className="bg-[#171717] border border-[#404040] rounded-[14px] p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-[#fafafa]">
                  {t('activeWorkout.moreExercisesTitle', { count: hiddenExerciseCount })}
                </h3>
                <p className="text-xs text-[#a3a3a3] mt-1">
                  {t('activeWorkout.moreExercisesSubtitle')}
                </p>
              </div>
              <Button
                variant="outline"
                size="md"
                onClick={() => setShowAllExercises(true)}
                className="shrink-0"
              >
                {t('activeWorkout.showMoreCount', { count: hiddenExerciseCount })}
              </Button>
            </div>
          )}

          {/* Add Exercise & Collapse Controls */}
          {workout.exercises.length > 0 && (
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="outline"
                size="md"
                onClick={() => setIsPickerOpen(true)}
                className="flex items-center gap-2"
              >
                <Plus className="w-4 h-4 text-[#34d399]" />
                <span>{t('activeWorkout.addExercise')}</span>
              </Button>
              {showAllExercises && workout.exercises.length > 2 && (
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => setShowAllExercises(false)}
                  className="flex items-center gap-1.5"
                >
                  <ChevronUp className="w-4 h-4" />
                  <span>{t('activeWorkout.hideExtraCount')}</span>
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Unfinished Sets Confirmation Modal (Matches Figma 15 State 03) */}
      <Modal
        isOpen={isUnfinishedModalOpen}
        onClose={() => setIsUnfinishedModalOpen(false)}
        title={t('activeWorkout.unfinishedTitle')}
        size="sm"
        footer={
          <div className="flex flex-col sm:flex-row gap-2.5 w-full">
            <Button
              variant="primary"
              size="md"
              className="flex-1"
              onClick={() => setIsUnfinishedModalOpen(false)}
            >
              {t('activeWorkout.returnToWorkout')}
            </Button>
            <Button
              variant="outline"
              size="md"
              className="flex-1"
              isLoading={isSubmitting}
              onClick={commitFinishWorkout}
            >
              {t('activeWorkout.saveCompletedOnly')}
            </Button>
          </div>
        }
      >
        <div className="space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#a3a3a3]">
            {t('activeWorkout.unfinishedEyebrow')}
          </div>
          <p className="text-xs text-[#a3a3a3] leading-relaxed">
            {t('activeWorkout.unfinishedDesc')}
          </p>
        </div>
      </Modal>

      {/* No Completed Sets Alert Modal */}
      <Modal
        isOpen={isEmptySetWarningOpen}
        onClose={() => setIsEmptySetWarningOpen(false)}
        title={t('activeWorkout.emptyCheckTitle')}
        size="sm"
        footer={
          <Button variant="primary" size="md" onClick={() => setIsEmptySetWarningOpen(false)}>
            OK
          </Button>
        }
      >
        <div className="space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#a3a3a3]">
            {t('activeWorkout.emptyCheckEyebrow')}
          </div>
          <p className="text-xs text-[#a3a3a3] leading-relaxed">
            {t('activeWorkout.atLeastOneCompletedSet') || t('activeWorkout.emptyWorkoutWarning')}
          </p>
        </div>
      </Modal>

      {/* Discard Confirmation Modal (Matches Figma 15 State 04 with high-contrast white button) */}
      <Modal
        isOpen={isDiscardConfirmOpen}
        onClose={() => setIsDiscardConfirmOpen(false)}
        title={t('activeWorkout.resetTitle')}
        size="sm"
        footer={
          <>
            <Button
              variant="outline"
              size="md"
              onClick={() => setIsDiscardConfirmOpen(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="outline"
              size="md"
              className="!bg-[#fafafa] !text-[#0a0a0a] !border-[#fafafa] hover:!bg-[#e5e5e5]"
              onClick={handleDiscard}
            >
              {t('activeWorkout.resetConfirmBtn')}
            </Button>
          </>
        }
      >
        <div className="space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#a3a3a3]">
            {t('activeWorkout.resetEyebrow')}
          </div>
          <p className="text-xs text-[#a3a3a3] leading-relaxed">
            {t('activeWorkout.resetDesc')}
          </p>
        </div>
      </Modal>

      {/* Exercise Picker Modal */}
      <ExercisePickerModal
        isOpen={isPickerOpen}
        onClose={() => {
          setIsPickerOpen(false);
          setReplacingInstanceId(null);
        }}
        onSelectExercise={handleSelectExercise}
      />

      {/* Exercise Info Form Guide Modal */}
      {inspectingExerciseName && (
        <ExerciseInfoModal
          isOpen={true}
          onClose={() => setInspectingExerciseName(null)}
          exerciseName={inspectingExerciseName}
        />
      )}

      {/* Exercise Set History & Records Modal */}
      {historyModalState?.isOpen && (
        <ExerciseSetHistoryModal
          isOpen={true}
          onClose={() => setHistoryModalState(null)}
          exerciseName={historyModalState.exerciseName}
          initialSetNumber={historyModalState.setNumber}
          history={historyModalState.history}
          onApplyValues={(wKg, r) => {
            if (historyModalState.instanceId && historyModalState.activeSetId) {
              updateSet(historyModalState.instanceId, historyModalState.activeSetId, {
                weightKg: wKg,
                reps: r,
              });
            }
          }}
        />
      )}

      {/* Workout Summary Celebration Modal */}
      <WorkoutSummaryModal
        summary={summary}
        onClose={() => setSummary(null)}
        onViewHistory={() => {
          setSummary(null);
          navigate('/history');
        }}
      />
    </>
  );
};

