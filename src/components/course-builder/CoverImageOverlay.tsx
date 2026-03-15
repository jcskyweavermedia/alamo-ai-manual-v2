import { Upload, Sparkles, ImagePlus, Trash2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const STRINGS = {
  en: {
    generating: 'Generating cover...',
    uploading: 'Uploading...',
    change: 'Change',
    regenerate: 'Regenerate',
    removeCover: 'Remove cover image',
    uploadImage: 'Upload Image',
    generateAI: 'Generate with AI',
  },
  es: {
    generating: 'Generando portada...',
    uploading: 'Subiendo...',
    change: 'Cambiar',
    regenerate: 'Regenerar',
    removeCover: 'Eliminar imagen de portada',
    uploadImage: 'Subir Imagen',
    generateAI: 'Generar con IA',
  },
};

interface CoverImageOverlayProps {
  hasImage: boolean;
  isUploading: boolean;
  isGenerating: boolean;
  onUploadClick: () => void;
  onGenerateClick: () => void;
  onRemoveClick: () => void;
  language: 'en' | 'es';
  /** When true, force the overlay visible (touch-tap-to-reveal) */
  isVisible?: boolean;
}

export function CoverImageOverlay({
  hasImage,
  isUploading,
  isGenerating,
  onUploadClick,
  onGenerateClick,
  onRemoveClick,
  language,
  isVisible = false,
}: CoverImageOverlayProps) {
  const isLoading = isUploading || isGenerating;
  const t = STRINGS[language];

  if (isLoading) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[2px] rounded-[14px]">
        <Loader2 className="h-8 w-8 animate-spin text-white mb-2" />
        <p className="text-xs font-medium text-white/90">
          {isGenerating ? t.generating : t.uploading}
        </p>
      </div>
    );
  }

  if (hasImage) {
    return (
      <div className={cn(
        'absolute inset-0 rounded-[14px]',
        'bg-black/30 backdrop-blur-[1px]',
        'flex items-center justify-center gap-2',
        'transition-opacity duration-200',
        isVisible ? 'opacity-100' : 'opacity-0 group-hover/hero:opacity-100',
      )}>
        {/* H-5: aria-label on upload button */}
        <button
          onClick={(e) => { e.stopPropagation(); onUploadClick(); }}
          aria-label={t.change}
          className="flex items-center gap-1.5 h-8 px-3 rounded-xl text-[12px] font-medium bg-white/90 dark:bg-gray-800/90 text-gray-900 dark:text-gray-100 shadow-md hover:bg-white dark:hover:bg-gray-700 transition-colors"
        >
          <ImagePlus className="h-3.5 w-3.5" />
          {t.change}
        </button>
        {/* H-5: aria-label on generate button */}
        <button
          onClick={(e) => { e.stopPropagation(); onGenerateClick(); }}
          aria-label={t.regenerate}
          className="flex items-center gap-1.5 h-8 px-3 rounded-xl text-[12px] font-medium bg-white/90 dark:bg-gray-800/90 text-gray-900 dark:text-gray-100 shadow-md hover:bg-white dark:hover:bg-gray-700 transition-colors"
        >
          <Sparkles className="h-3.5 w-3.5" />
          {t.regenerate}
        </button>
        {/* H-5: aria-label on remove button */}
        <button
          onClick={(e) => { e.stopPropagation(); onRemoveClick(); }}
          aria-label={t.removeCover}
          className="flex items-center justify-center h-8 w-8 rounded-full bg-white/90 dark:bg-gray-800/90 text-gray-600 dark:text-gray-300 shadow-md hover:bg-white dark:hover:bg-gray-700 hover:text-destructive transition-colors"
          title={t.removeCover}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className={cn(
      'absolute inset-0 rounded-[14px]',
      'bg-black/40 backdrop-blur-[2px]',
      'flex flex-col items-center justify-center gap-2',
      'transition-opacity duration-200',
      isVisible ? 'opacity-100' : 'opacity-0 group-hover/hero:opacity-100',
    )}>
      {/* H-5: aria-label on upload button */}
      <button
        onClick={(e) => { e.stopPropagation(); onUploadClick(); }}
        aria-label={t.uploadImage}
        className="flex items-center gap-1.5 h-8 px-3 rounded-xl text-[12px] font-medium bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <Upload className="h-3.5 w-3.5" />
        {t.uploadImage}
      </button>
      {/* H-5: aria-label on generate button */}
      <button
        onClick={(e) => { e.stopPropagation(); onGenerateClick(); }}
        aria-label={t.generateAI}
        className="flex items-center gap-1.5 h-8 px-3 rounded-xl text-[12px] font-medium bg-orange-500 text-white shadow-md hover:bg-orange-600 transition-colors"
      >
        <Sparkles className="h-3.5 w-3.5" />
        {t.generateAI}
      </button>
    </div>
  );
}
