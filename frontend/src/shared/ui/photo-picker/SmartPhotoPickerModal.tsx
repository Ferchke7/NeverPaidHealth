import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, Image as ImageIcon, X, RefreshCw, Check, AlertCircle, Sparkles } from 'lucide-react';
import { Button } from '../button.tsx';
import { useTranslation } from '../../lib/i18n/i18n.ts';

export interface CompressedPhoto {
  dataUrl: string;
  base64: string;
  mimeType: string;
}

interface SmartPhotoPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPhotoSelected: (photo: CompressedPhoto) => void;
  title?: string;
  subtitle?: string;
}

export const SmartPhotoPickerModal: React.FC<SmartPhotoPickerModalProps> = ({
  isOpen,
  onClose,
  onPhotoSelected,
  title,
  subtitle,
}) => {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'options' | 'camera' | 'preview'>('options');
  const [capturedPhoto, setCapturedPhoto] = useState<CompressedPhoto | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Stop camera stream utility
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  // Close modal and cleanup
  const handleClose = useCallback(() => {
    stopStream();
    setMode('options');
    setCapturedPhoto(null);
    setCameraError(null);
    onClose();
  }, [stopStream, onClose]);

  // Start in-app live camera
  const startCamera = useCallback(async (facing: 'user' | 'environment') => {
    stopStream();
    setCameraError(null);
    setMode('camera');

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera not supported in this browser');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing,
          width: { ideal: 1280 },
          height: { ideal: 1280 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err: unknown) {
      console.warn('In-app camera stream failed:', err);
      setCameraError(
        'Не удалось получить доступ к камере. Выберите фото из галереи.'
      );
      setMode('options');
    }
  }, [stopStream]);

  // Toggle front/back camera
  const toggleFacingMode = () => {
    const nextFacing = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextFacing);
    startCamera(nextFacing);
  };

  // Capture snapshot from live video element (low memory)
  const captureSnapshot = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');

    const MAX_DIM = 1024;
    let w = video.videoWidth || 640;
    let h = video.videoHeight || 480;

    if (w > h && w > MAX_DIM) {
      h = Math.round((h * MAX_DIM) / w);
      w = MAX_DIM;
    } else if (h > MAX_DIM) {
      w = Math.round((w * MAX_DIM) / h);
      h = MAX_DIM;
    }

    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // If front camera, mirror image for natural selfie look
    if (facingMode === 'user') {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0, w, h);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
    const base64 = dataUrl.split(',')[1];

    stopStream();
    const photo: CompressedPhoto = {
      dataUrl,
      base64,
      mimeType: 'image/jpeg',
    };
    setCapturedPhoto(photo);
    setMode('preview');
  };

  // Process file selected from gallery (low memory safe compression)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_DIM = 1024;
        let w = img.width;
        let h = img.height;

        if (w > h && w > MAX_DIM) {
          h = Math.round((h * MAX_DIM) / w);
          w = MAX_DIM;
        } else if (h > MAX_DIM) {
          w = Math.round((w * MAX_DIM) / h);
          h = MAX_DIM;
        }

        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        const base64 = dataUrl.split(',')[1];

        const photo: CompressedPhoto = {
          dataUrl,
          base64,
          mimeType: 'image/jpeg',
        };
        setCapturedPhoto(photo);
        setMode('preview');
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Confirm photo selection
  const handleConfirmPhoto = () => {
    if (capturedPhoto) {
      onPhotoSelected(capturedPhoto);
      handleClose();
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopStream();
    };
  }, [stopStream]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-dark-900 border border-dark-750 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl relative flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-4 py-3 bg-dark-950/80 border-b border-dark-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-500/10 text-brand-400 flex items-center justify-center">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                {title || 'Сделать или выбрать фото'}
              </h3>
              <p className="text-[10px] text-zinc-400">
                {subtitle || 'Быстрое сжатие без перезагрузки браузера'}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-dark-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 flex-1 overflow-y-auto flex flex-col">
          {cameraError && (
            <div className="mb-3 p-3 bg-red-950/40 border border-red-800/50 rounded-xl text-xs text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{cameraError}</span>
            </div>
          )}

          {/* 1. Mode: Options Selection */}
          {mode === 'options' && (
            <div className="space-y-3 my-auto py-2">
              <button
                type="button"
                onClick={() => startCamera('environment')}
                className="w-full p-4 rounded-xl bg-gradient-to-r from-brand-950/40 via-dark-800 to-dark-800 border border-brand-500/30 hover:border-brand-500/60 transition-all flex items-center gap-3.5 text-left group shadow-md"
              >
                <div className="w-12 h-12 rounded-xl bg-brand-500/20 text-brand-400 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
                  <Camera className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-sm font-bold text-zinc-100 group-hover:text-brand-400 transition-colors flex items-center gap-1.5">
                    Встроенная камера (без вылетов)
                    <Sparkles className="w-3.5 h-3.5 text-brand-400" />
                  </div>
                  <div className="text-xs text-zinc-400 mt-0.5">
                    Прямой снимок в приложении с малым расходом памяти
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full p-4 rounded-xl bg-dark-800/80 hover:bg-dark-800 border border-dark-700 hover:border-dark-600 transition-all flex items-center gap-3.5 text-left group shadow-md"
              >
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
                  <ImageIcon className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-sm font-bold text-zinc-100 group-hover:text-emerald-400 transition-colors">
                    Выбрать из галереи
                  </div>
                  <div className="text-xs text-zinc-400 mt-0.5">
                    Загрузить готовое фото, селфи или скриншот
                  </div>
                </div>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          )}

          {/* 2. Mode: Live In-App Camera Viewfinder */}
          {mode === 'camera' && (
            <div className="flex flex-col items-center flex-1">
              <div className="relative w-full aspect-square sm:aspect-[4/3] bg-black rounded-2xl overflow-hidden border border-dark-750 shadow-inner flex items-center justify-center">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${
                    facingMode === 'user' ? '-scale-x-100' : ''
                  }`}
                />

                {/* Switch Camera Button */}
                <button
                  type="button"
                  onClick={toggleFacingMode}
                  className="absolute top-3 right-3 p-2.5 rounded-full bg-black/60 backdrop-blur-md text-white border border-white/20 hover:bg-black/80 transition-all active:scale-95 shadow-lg"
                  title="Переключить камеру"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>

              {/* Camera Actions */}
              <div className="flex items-center justify-around w-full mt-4">
                <button
                  type="button"
                  onClick={() => {
                    stopStream();
                    setMode('options');
                  }}
                  className="px-3.5 py-2 text-xs font-semibold text-zinc-400 hover:text-white rounded-xl"
                >
                  {t('common.cancel')}
                </button>

                {/* Shutter Button */}
                <button
                  type="button"
                  onClick={captureSnapshot}
                  className="w-16 h-16 rounded-full bg-white p-1 shadow-lg shadow-brand-500/20 active:scale-90 transition-transform flex items-center justify-center"
                >
                  <div className="w-13 h-13 rounded-full border-4 border-dark-900 bg-brand-500 flex items-center justify-center">
                    <Camera className="w-6 h-6 text-dark-950" />
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    stopStream();
                    fileInputRef.current?.click();
                  }}
                  className="px-3.5 py-2 text-xs font-semibold text-brand-400 hover:text-brand-300 rounded-xl"
                >
                  Галерея
                </button>
              </div>
            </div>
          )}

          {/* 3. Mode: Photo Preview & Confirm */}
          {mode === 'preview' && capturedPhoto && (
            <div className="flex flex-col items-center flex-1 space-y-3">
              <div className="w-full aspect-square sm:aspect-[4/3] bg-black rounded-2xl overflow-hidden border border-brand-500/40 shadow-xl relative">
                <img
                  src={capturedPhoto.dataUrl}
                  alt="Captured Preview"
                  className="w-full h-full object-contain"
                />
              </div>

              <div className="flex items-center gap-2.5 w-full pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="flex-1 text-xs"
                  onClick={() => setMode('options')}
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1" />
                  Переснять
                </Button>

                <Button
                  type="button"
                  variant="primary"
                  className="flex-1 text-xs font-bold shadow-md shadow-brand-500/30"
                  onClick={handleConfirmPhoto}
                >
                  <Check className="w-4 h-4 mr-1" />
                  Использовать фото
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
