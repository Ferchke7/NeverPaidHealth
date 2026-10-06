import React, { useState } from 'react';
import { Dumbbell } from 'lucide-react';
import { getExerciseVisual } from '../../../shared/lib/exerciseImages.ts';

interface ExerciseThumbnailProps {
  exerciseName: string;
  fallbackMuscle?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  onClick?: () => void;
}

const SIZE_CLASSES = {
  xs: 'w-7 h-7 rounded-lg text-[10px]',
  sm: 'w-10 h-10 rounded-xl text-xs',
  md: 'w-12 h-12 rounded-xl text-sm',
  lg: 'w-16 h-16 rounded-2xl text-base',
  xl: 'w-20 h-20 rounded-2xl text-lg',
};

const ICON_SIZES = {
  xs: 'w-3.5 h-3.5',
  sm: 'w-5 h-5',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
  xl: 'w-10 h-10',
};

export const ExerciseThumbnail: React.FC<ExerciseThumbnailProps> = ({
  exerciseName,
  fallbackMuscle,
  size = 'md',
  className = '',
  onClick,
}) => {
  const [hasError, setHasError] = useState(false);
  const visual = getExerciseVisual(exerciseName, fallbackMuscle);
  const imageSrc = visual.images && visual.images.length > 0 ? visual.images[0] : null;

  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;
  const iconClass = ICON_SIZES[size] || ICON_SIZES.md;

  const primaryMuscle = visual.primaryMuscles[0] || fallbackMuscle || 'muscle';

  // Dynamic gradient based on muscle group for visual variety in fallbacks
  const getFallbackGradient = (m: string) => {
    const l = m.toLowerCase();
    if (l.includes('chest')) return 'from-blue-600/30 to-indigo-900/40 text-blue-400 border-blue-500/30';
    if (l.includes('back') || l.includes('lat')) return 'from-emerald-600/30 to-teal-900/40 text-emerald-400 border-emerald-500/30';
    if (l.includes('quad') || l.includes('leg') || l.includes('hamstring')) return 'from-amber-600/30 to-orange-900/40 text-amber-400 border-amber-500/30';
    if (l.includes('shoulder')) return 'from-purple-600/30 to-violet-900/40 text-purple-400 border-purple-500/30';
    if (l.includes('bicep') || l.includes('tricep') || l.includes('arm')) return 'from-rose-600/30 to-pink-900/40 text-rose-400 border-rose-500/30';
    return 'from-brand-500/20 to-dark-800 text-brand-400 border-dark-700';
  };

  return (
    <div
      onClick={onClick}
      className={`relative shrink-0 overflow-hidden bg-dark-900 border border-dark-700/80 flex items-center justify-center select-none shadow-sm ${sizeClass} ${className} ${
        onClick ? 'cursor-pointer hover:border-brand-500/50 hover:opacity-95 transition-all' : ''
      }`}
    >
      {imageSrc && !hasError ? (
        <img
          src={imageSrc}
          alt={exerciseName}
          loading="lazy"
          crossOrigin="anonymous"
          onError={() => setHasError(true)}
          className="w-full h-full object-cover object-center bg-white/5 transition-transform duration-300 group-hover:scale-105"
        />
      ) : (
        <div
          className={`w-full h-full bg-gradient-to-br flex items-center justify-center ${getFallbackGradient(
            primaryMuscle
          )}`}
        >
          <Dumbbell className={iconClass} />
        </div>
      )}
    </div>
  );
};
