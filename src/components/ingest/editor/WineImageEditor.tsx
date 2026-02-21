import { useRef, useState, useCallback } from 'react';
import { Camera, ImagePlus, Sparkles, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIngestDraft } from '@/contexts/IngestDraftContext';
import { useDirectImageUpload } from '@/hooks/use-direct-image-upload';
import { useGenerateImage } from '@/hooks/use-generate-image';
import { useToast } from '@/hooks/use-toast';
import type { WineDraft } from '@/types/ingestion';

export function WineImageEditor() {
  const { state, dispatch } = useIngestDraft();
  const draft = state.draft as WineDraft;
  const { uploadToStorage, isUploading } = useDirectImageUpload();
  const { generateImage, isGenerating } = useGenerateImage();
  const { toast } = useToast();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  const handleImageLoaded = useCallback(() => setImageLoaded(true), []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const url = await uploadToStorage(file, state.sessionId || undefined);
    if (url) {
      setImageLoaded(false);
      dispatch({ type: 'SET_WINE_IMAGE', payload: url });
      toast({ title: 'Image added', description: file.name });
    }
  };

  const handleGenerate = async () => {
    if (!draft.name.trim()) {
      toast({ title: 'Name required', description: 'Add a wine name before generating an image' });
      return;
    }

    const result = await generateImage({
      productTable: 'wines',
      name: draft.name,
      prepType: draft.style,
      description: `${draft.varietal} wine from ${draft.region}, ${draft.country}`,
      sessionId: state.sessionId || undefined,
    });

    if (result) {
      setImageLoaded(false);
      dispatch({ type: 'SET_WINE_IMAGE', payload: result.imageUrl });
      toast({ title: 'AI image generated', description: 'Review the image before publishing' });
    }
  };

  const handleRemove = () => {
    dispatch({ type: 'SET_WINE_IMAGE', payload: null });
    setImageLoaded(false);
  };

  return (
    <div className="space-y-4 pt-2">
      {/* Current image preview */}
      {draft.image ? (
        <div className="relative group rounded-lg border border-border p-2">
          <div className="relative overflow-hidden rounded-md bg-muted">
            {!imageLoaded && (
              <div className="absolute inset-0 bg-muted animate-pulse rounded-md" />
            )}
            <img
              src={draft.image}
              alt={draft.name || 'Wine image'}
              loading="lazy"
              onLoad={handleImageLoaded}
              className={`w-full max-h-[300px] object-contain transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-3 right-3 h-7 w-7 text-destructive hover:text-destructive bg-background/80"
            onClick={handleRemove}
            title="Remove image"
            aria-label="Remove image"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground text-center py-2">
          No image yet. Upload a photo or generate one with AI.
        </p>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          {isUploading
            ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            : <ImagePlus className="h-4 w-4 mr-1.5" />}
          Upload Photo
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => cameraInputRef.current?.click()}
          disabled={isUploading}
        >
          <Camera className="h-4 w-4 mr-1.5" />
          Take Photo
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleGenerate}
          disabled={isGenerating || isUploading}
        >
          {isGenerating
            ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            : <Sparkles className="h-4 w-4 mr-1.5" />}
          {isGenerating ? 'Generating...' : 'Generate with AI'}
        </Button>
      </div>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        aria-label="Upload photo from device"
        onChange={handleFileSelect}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        aria-label="Take photo with camera"
        onChange={handleFileSelect}
      />
    </div>
  );
}
