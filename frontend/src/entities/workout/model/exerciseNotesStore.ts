import { create } from 'zustand';
import { PreviousExerciseNote } from './types.ts';

const NOTES_STORAGE_KEY = 'np_exercise_notes_v1';

interface PersistedNotesData {
  savedNotes: Record<string, PreviousExerciseNote>;
  readSignatures: Record<string, boolean>;
}

interface ExerciseNotesState extends PersistedNotesData {
  saveNoteForNextWorkout: (
    keys: string[],
    note: string,
    workoutId: string,
    workoutName: string,
    startedAt?: string
  ) => void;
  markNoteAsRead: (keys: string[], noteText: string) => void;
  isNoteUnread: (keys: string[], noteText: string) => boolean;
}

function normalizeNoteKey(raw: string): string {
  return raw.toLowerCase().trim();
}

function buildSignature(key: string, noteText: string): string {
  return `${normalizeNoteKey(key)}::${noteText.trim()}`;
}

function loadFromStorage(): PersistedNotesData {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { savedNotes: {}, readSignatures: {} };
  }
  try {
    const raw = localStorage.getItem(NOTES_STORAGE_KEY);
    if (!raw) return { savedNotes: {}, readSignatures: {} };
    const parsed = JSON.parse(raw);
    return {
      savedNotes: parsed?.savedNotes && typeof parsed.savedNotes === 'object' ? parsed.savedNotes : {},
      readSignatures:
        parsed?.readSignatures && typeof parsed.readSignatures === 'object' ? parsed.readSignatures : {},
    };
  } catch {
    return { savedNotes: {}, readSignatures: {} };
  }
}

function saveToStorage(data: PersistedNotesData) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage quota errors
  }
}

export const useExerciseNotesStore = create<ExerciseNotesState>((set, get) => ({
  ...loadFromStorage(),

  saveNoteForNextWorkout: (keys, note, workoutId, workoutName, startedAt) => {
    const trimmed = note.trim();
    if (!trimmed) return;

    set((state) => {
      const nextSaved = { ...state.savedNotes };
      const nextRead = { ...state.readSignatures };
      const entry: PreviousExerciseNote = {
        note: trimmed,
        workout_id: workoutId,
        workout_name: workoutName,
        started_at: startedAt || new Date().toISOString(),
      };

      for (const rawKey of keys) {
        if (!rawKey) continue;
        const k = normalizeNoteKey(rawKey);
        if (!k) continue;
        nextSaved[k] = entry;
        // Clear read status for this new note signature so it glows on the next workout!
        delete nextRead[buildSignature(k, trimmed)];
      }

      const updated = { savedNotes: nextSaved, readSignatures: nextRead };
      saveToStorage(updated);
      return updated;
    });
  },

  markNoteAsRead: (keys, noteText) => {
    const trimmed = noteText.trim();
    if (!trimmed) return;

    set((state) => {
      const nextRead = { ...state.readSignatures };
      for (const rawKey of keys) {
        if (!rawKey) continue;
        const k = normalizeNoteKey(rawKey);
        if (!k) continue;
        nextRead[buildSignature(k, trimmed)] = true;
      }
      const updated = { savedNotes: state.savedNotes, readSignatures: nextRead };
      saveToStorage(updated);
      return { readSignatures: nextRead };
    });
  },

  isNoteUnread: (keys, noteText) => {
    const trimmed = noteText.trim();
    if (!trimmed) return false;
    const { readSignatures } = get();
    for (const rawKey of keys) {
      if (!rawKey) continue;
      const k = normalizeNoteKey(rawKey);
      if (!k) continue;
      if (readSignatures[buildSignature(k, trimmed)]) {
        return false;
      }
    }
    return true;
  },
}));
