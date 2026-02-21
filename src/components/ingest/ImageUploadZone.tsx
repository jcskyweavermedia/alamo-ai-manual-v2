import { useState, useRef, useEffect } from 'react';
import { Camera, ImagePlus, AlertCircle, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useImageUpload } from '@/hooks/use-image-upload';
import type { ImageUploadResult } from '@/hooks/use-image-upload';

// =============================================================================
// TYPES
// =============================================================================

interface ImageUploadZoneProps {
  onImageProcessed: (result: ImageUploadResult) => void;
  sessionId?: string;
  className?: string;
}

// =============================================================================
// HELPERS
// =============================================================================

/** Format bytes to a human-readable string (e.g. "1.2 MB") */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function ImageUploadZone({
  onImageProcessed,
  sessionId,
  className,
}: ImageUploadZoneProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { uploadImage, isUploading, error } = useImageUpload();

  // ---------------------------------------------------------------------------
  // Clean up object URL on unmount or when preview changes
  // ---------------------------------------------------------------------------

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  // ---------------------------------------------------------------------------
  // File selection (shared between camera and file inputs)
  // ---------------------------------------------------------------------------

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Revoke previous preview URL if it exists
      if (preview) URL.revokeObjectURL(preview);
      setSelectedFile(file);
      setPreview(URL.createObjectURL(file));
    }
    // Reset so the same file can be re-selected
    e.target.value = '';
  };

  // ---------------------------------------------------------------------------
  // Remove selected image
  // ---------------------------------------------------------------------------

  const handleRemove = () => {
    if (preview) URL.revokeObjectURL(preview);
    setSelectedFile(null);
    setPreview(null);
  };

  // ---------------------------------------------------------------------------
  // Analyze with AI
  // ---------------------------------------------------------------------------

  const handleAnalyze = async () => {
    if (!selectedFile) return;
    const result = await uploadImage(selectedFile, sessionId);
    if (result) {
      onImageProcessed(result);
      handleRemove();
    }
  };

  // ---------------------------------------------------------------------------
  // Retry after error
  // ---------------------------------------------------------------------------

  const handleRetry = () => {
    handleRemove();
  };

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------

  // --- Error state ---
  if (error && !isUploading) {
    return (
      <div className={cn('flex flex-col items-center gap-3 p-6', className)}>
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-sm text-destructive text-center">{error}</p>
        <Button variant="outline" size="sm" onClick={handleRetry}>
          Try Again
        </Button>
      </div>
    );
  }

  // --- Uploading state (dimmed preview with spinner) ---
  if (isUploading) {
    return (
      <div className={cn('flex flex-col items-center gap-3 p-6', className)}>
        <div className="relative">
          {preview && (
            <img
              src={preview}
              alt="Uploading preview"
              className="rounded-lg object-cover max-h-[200px] mx-auto opacity-40"
            />
          )}
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </div>
        <p className="text-sm text-muted-foreground">Analyzing image...</p>
      </div>
    );
  }

  // --- Preview state (image selected) ---
  if (selectedFile && preview) {
    return (
      <div className={cn('flex flex-col items-center gap-3 p-6', className)}>
        <img
          src={preview}
          alt={selectedFile.name}
          className="rounded-lg object-cover max-h-[200px] mx-auto"
        />

        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium truncate max-w-[200px]">
            {selectedFile.name}
          </span>
          <span className="text-muted-foreground">
            ({formatFileSize(selectedFile.size)})
          </span>
        </div>

        <div className="flex gap-2">
          <Button size="sm" onClick={handleAnalyze}>
            Analyze with AI
          </Button>
          <Button variant="ghost" size="sm" onClick={handleRemove}>
            <X className="h-4 w-4 mr-1" />
            Remove
          </Button>
        </div>
      </div>
    );
  }

  // --- Default empty state ---
  return (
    <div className={cn('flex flex-col items-center gap-4 p-6', className)}>
      {/* Two buttons side by side */}
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => cameraInputRef.current?.click()}
        >
          <Camera className="h-4 w-4 mr-1.5" />
          Take Photo
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
        >
          <ImagePlus className="h-4 w-4 mr-1.5" />
          Upload Image
        </Button>
      </div>

      <p className="text-sm text-muted-foreground text-center">
        Snap a recipe card, menu, or label
      </p>

      <p className="text-xs text-muted-foreground/60">Max 10MB</p>

      {/* Hidden camera input (mobile) */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Hidden file browser input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileSelect}
      />
    </div>
  );
}
