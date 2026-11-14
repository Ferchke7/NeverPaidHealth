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

  const getFallbackStyle = (m: string) => {
    const l = m.toLowerCase();
    if (l.includes('chest')) return 'bg-[#0a0a0a] text-[#34d399]';
    if (l.includes('back') || l.includes('lat')) return 'bg-[#022c22] text-[#34d399]';
    if (l.includes('quad') || l.includes('leg') || l.includes('hamstring')) return 'bg-[#0a0a0a] text-amber-400';
    if (l.includes('shoulder')) return 'bg-[#0a0a0a] text-[#fafafa]';
    if (l.includes('bicep') || l.includes('tricep') || l.includes('arm')) return 'bg-[#0a0a0a] text-[#a3a3a3]';
    return 'bg-[#0a0a0a] text-[#34d399]';
  };

  return (
    <div
      onClick={onClick}
      className={`relative shrink-0 overflow-hidden bg-[#0a0a0a] border border-[#262626] flex items-center justify-center select-none ${sizeClass} ${className} ${
        onClick ? 'cursor-pointer hover:border-[#34d399]/60 transition-colors' : ''
      }`}
    >
      {imageSrc && !hasError ? (
        <img
          src={imageSrc}
          alt={exerciseName}
          loading="lazy"
          crossOrigin="anonymous"
          onError={() => setHasError(true)}
          className="w-full h-full object-cover object-center bg-[#171717]"
        />
      ) : (
        <div
          className={`w-full h-full flex items-center justify-center ${getFallbackStyle(
            primaryMuscle
          )}`}
        >
          <Dumbbell className={iconClass} />
        </div>
      )}
    </div>
  );
};
