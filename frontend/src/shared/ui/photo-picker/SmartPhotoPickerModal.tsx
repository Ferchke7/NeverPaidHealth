import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, Image as ImageIcon, RefreshCw, Check, AlertCircle, Sparkles } from 'lucide-react';
import { Button } from '../button.tsx';
import { Modal } from '../modal.tsx';
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

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const handleClose = useCallback(() => {
    stopStream();
    setMode('options');
    setCapturedPhoto(null);
    setCameraError(null);
    onClose();
  }, [stopStream, onClose]);

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
        t('photoPicker.cameraError')
      );
      setMode('options');
    }
  }, [stopStream]);

  const toggleFacingMode = () => {
    const nextFacing = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextFacing);
    void startCamera(nextFacing);
  };

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

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleConfirmPhoto = () => {
    if (capturedPhoto) {
      onPhotoSelected(capturedPhoto);
      handleClose();
    }
  };

  useEffect(() => {
    return () => {
      stopStream();
    };
  }, [stopStream]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      size="md"
      icon={
        <div className="w-8 h-8 rounded-xl bg-brand-500/20 text-brand-400 border border-brand-500/30 flex items-center justify-center shrink-0">
          <Camera className="w-4 h-4" />
        </div>
      }
      title={title || t('photoPicker.title')}
      subtitle={subtitle || t('photoPicker.subtitle')}
    >
      <div className="space-y-4">
        {cameraError && (
          <div className="p-3 bg-red-950/40 border border-red-800/50 rounded-xl text-xs text-red-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{cameraError}</span>
          </div>
        )}

        {/* 1. Mode: Options Selection */}
        {mode === 'options' && (
          <div className="space-y-3 py-2">
            <button
              type="button"
              onClick={() => void startCamera('environment')}
              className="w-full p-4 rounded-2xl bg-gradient-to-r from-brand-950/40 via-dark-800 to-dark-800 border border-brand-500/30 hover:border-brand-500/60 transition-all flex items-center gap-3.5 text-left group shadow-md cursor-pointer"
            >
              <div className="w-12 h-12 rounded-xl bg-brand-500/20 text-brand-400 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
                <Camera className="w-6 h-6" />
              </div>
              <div>
                <div className="text-sm font-bold text-zinc-100 group-hover:text-brand-400 transition-colors flex items-center gap-1.5">
                  {t('photoPicker.camera')}
                  <Sparkles className="w-3.5 h-3.5 text-brand-400" />
                </div>
                <div className="text-xs text-zinc-400 mt-0.5">
                  {t('photoPicker.cameraDesc')}
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full p-4 rounded-2xl bg-dark-800/80 hover:bg-dark-800 border border-dark-700 hover:border-dark-600 transition-all flex items-center gap-3.5 text-left group shadow-md cursor-pointer"
            >
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
                <ImageIcon className="w-6 h-6" />
              </div>
              <div>
                <div className="text-sm font-bold text-zinc-100 group-hover:text-emerald-400 transition-colors">
                  {t('photoPicker.gallery')}
                </div>
                <div className="text-xs text-zinc-400 mt-0.5">
                  {t('photoPicker.galleryDesc')}
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
          <div className="flex flex-col items-center">
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

              <button
                type="button"
                onClick={toggleFacingMode}
                className="absolute top-3 right-3 p-2.5 rounded-full bg-black/60 backdrop-blur-md text-white border border-white/20 hover:bg-black/80 transition-all active:scale-95 shadow-lg cursor-pointer"
                title={t('photoPicker.switchCamera')}
                aria-label={t('photoPicker.switchCamera')}
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-around w-full mt-4">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  stopStream();
                  setMode('options');
                }}
              >
                {t('common.cancel')}
              </Button>

              <button
                type="button"
                onClick={captureSnapshot}
                className="w-16 h-16 rounded-full bg-white p-1 shadow-lg shadow-brand-500/20 active:scale-90 transition-transform flex items-center justify-center cursor-pointer"
              >
                <div className="w-13 h-13 rounded-full border-4 border-dark-900 bg-brand-500 flex items-center justify-center">
                  <Camera className="w-6 h-6 text-dark-950" />
                </div>
              </button>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-brand-400 hover:text-brand-300 font-bold"
                onClick={() => {
                  stopStream();
                  fileInputRef.current?.click();
                }}
              >
                {t('photoPicker.galleryBtn')}
              </Button>
            </div>
          </div>
        )}

        {/* 3. Mode: Photo Preview & Confirm */}
        {mode === 'preview' && capturedPhoto && (
          <div className="flex flex-col items-center space-y-3">
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
                {t('photoPicker.retake')}
              </Button>

              <Button
                type="button"
                variant="primary"
                className="flex-1 text-xs font-bold shadow-md shadow-brand-500/30"
                onClick={handleConfirmPhoto}
              >
                <Check className="w-4 h-4 mr-1" />
                {t('photoPicker.usePhoto')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

