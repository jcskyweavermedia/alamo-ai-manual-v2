import { useRef, useState, useCallback } from 'react';
import { Camera, ImagePlus, Sparkles, Star, ArrowUp, ArrowDown, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useIngestDraft } from '@/contexts/IngestDraftContext';
import { useDirectImageUpload } from '@/hooks/use-direct-image-upload';
import { useGenerateImage } from '@/hooks/use-generate-image';
import { useToast } from '@/hooks/use-toast';

interface ImagesEditorProps {
  productTable?: string;
}

export function ImagesEditor({ productTable = 'prep_recipes' }: ImagesEditorProps) {
  const { state, dispatch } = useIngestDraft();
  const { draft } = state;
  const { uploadToStorage, isUploading } = useDirectImageUpload();
  const { generateImage, isGenerating } = useGenerateImage();
  const { toast } = useToast();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [loadedUrls, setLoadedUrls] = useState<Set<string>>(new Set());

  const markLoaded = useCallback((url: string) => {
    setLoadedUrls((prev) => new Set(prev).add(url));
  }, []);

  // Handle file selection (upload or camera)
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const url = await uploadToStorage(file, state.sessionId || undefined);
    if (url) {
      dispatch({ type: 'ADD_IMAGE', payload: { url, alt: file.name } });
      toast({ title: 'Image added', description: file.name });
    }
  };

  // Handle AI image generation
  const handleGenerate = async () => {
    if (!draft.name.trim()) {
      toast({ title: 'Name required', description: 'Add a name before generating an image' });
      return;
    }

    // Build description based on product type
    const isPlateSpec = productTable === 'plate_specs';
    const description = isPlateSpec
      ? [
          ('plateType' in draft ? (draft as { plateType: string }).plateType : ''),
          ('menuCategory' in draft ? (draft as { menuCategory: string }).menuCategory : ''),
          ...('tags' in draft && Array.isArray(draft.tags) ? draft.tags : []),
        ].filter(Boolean).join(', ')
      : draft.tags.join(', ');

    const result = await generateImage({
      productTable,
      name: draft.name,
      prepType: isPlateSpec ? ('plateType' in draft ? (draft as { plateType: string }).plateType : '') : draft.prepType,
      description,
      sessionId: state.sessionId || undefined,
    });

    if (result) {
      dispatch({
        type: 'ADD_IMAGE',
        payload: { url: result.imageUrl, alt: `AI-generated: ${draft.name}`, caption: 'AI-generated placeholder' },
      });
      toast({ title: 'AI image generated', description: 'Review and set as thumbnail if needed' });
    }
  };

  // Handle inline alt text editing
  const handleAltChange = (index: number, alt: string) => {
    const updated = [...draft.images];
    updated[index] = { ...updated[index], alt };
    dispatch({ type: 'REORDER_IMAGES', payload: updated });
  };

  return (
    <div className="space-y-4 pt-2">
      {/* Image grid */}
      {draft.images.length > 0 ? (
        <div className="space-y-3">
          {draft.images.map((img, i) => (
            <div
              key={`${img.url}-${i}`}
              className="flex items-start gap-3 rounded-lg border border-border p-2"
            >
              {/* Thumbnail */}
              <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-md">
                {!loadedUrls.has(img.url) && (
                  <div className="absolute inset-0 bg-muted animate-pulse rounded-md" />
                )}
                <img
                  src={img.url}
                  alt={img.alt || 'Recipe image'}
                  loading="lazy"
                  onLoad={() => markLoaded(img.url)}
                  className={`h-full w-full object-cover transition-opacity duration-300 ${loadedUrls.has(img.url) ? 'opacity-100' : 'opacity-0'}`}
                />
                {i === 0 && (
                  <span className="absolute top-1 left-1 flex items-center gap-0.5 rounded bg-primary/90 px-1 py-0.5 text-[11px] font-bold text-primary-foreground">
                    <Star className="h-2.5 w-2.5 fill-current" />
                    Thumbnail
                  </span>
                )}
              </div>

              {/* Info + controls */}
              <div className="flex-1 min-w-0 space-y-1.5">
                <Label className="sr-only" htmlFor={`img-alt-${i}`}>
                  Alt text for image {i + 1}
                </Label>
                <Input
                  id={`img-alt-${i}`}
                  value={img.alt || ''}
                  onChange={(e) => handleAltChange(i, e.target.value)}
                  placeholder="Alt text / caption"
                  className="h-7 text-xs"
                />
                <div className="flex items-center gap-1">
                  {i !== 0 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Set as thumbnail"
                      aria-label="Set as thumbnail"
                      onClick={() => dispatch({ type: 'SET_THUMBNAIL', payload: i })}
                    >
                      <Star className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={i === 0}
                    onClick={() => {
                      const imgs = [...draft.images];
                      [imgs[i - 1], imgs[i]] = [imgs[i], imgs[i - 1]];
                      dispatch({ type: 'REORDER_IMAGES', payload: imgs });
                    }}
                    title="Move up"
                    aria-label="Move up"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={i === draft.images.length - 1}
                    onClick={() => {
                      const imgs = [...draft.images];
                      [imgs[i], imgs[i + 1]] = [imgs[i + 1], imgs[i]];
                      dispatch({ type: 'REORDER_IMAGES', payload: imgs });
                    }}
                    title="Move down"
                    aria-label="Move down"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                  <div className="flex-1" />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => dispatch({ type: 'REMOVE_IMAGE', payload: i })}
                    title="Remove image"
                    aria-label="Remove image"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground text-center py-2">
          No images yet. Upload a photo or generate one with AI.
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
