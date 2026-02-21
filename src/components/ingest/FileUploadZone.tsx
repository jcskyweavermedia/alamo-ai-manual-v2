import { useState, useRef } from 'react';
import { Upload, FileText, AlertCircle, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useFileUpload } from '@/hooks/use-file-upload';
import type { FileUploadResult } from '@/hooks/use-file-upload';

// =============================================================================
// TYPES
// =============================================================================

interface FileUploadZoneProps {
  onFileProcessed: (result: FileUploadResult) => void;
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

/** Accepted MIME types mapped to extensions */
const ACCEPTED_EXTENSIONS = '.pdf,.docx,.txt';

/** Type badges to display in the drop zone */
const TYPE_BADGES = ['PDF', 'DOCX', 'TXT'] as const;

// =============================================================================
// COMPONENT
// =============================================================================

export function FileUploadZone({
  onFileProcessed,
  sessionId,
  className,
}: FileUploadZoneProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadFile, isUploading, error } = useFileUpload();

  // ---------------------------------------------------------------------------
  // Drag-and-drop handlers
  // ---------------------------------------------------------------------------

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) setSelectedFile(file);
  };

  // ---------------------------------------------------------------------------
  // File selection
  // ---------------------------------------------------------------------------

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setSelectedFile(file);
    // Reset so same file can be re-selected after removal
    e.target.value = '';
  };

  const handleRemove = () => {
    setSelectedFile(null);
  };

  // ---------------------------------------------------------------------------
  // Process with AI
  // ---------------------------------------------------------------------------

  const handleProcess = async () => {
    if (!selectedFile) return;
    const result = await uploadFile(selectedFile, sessionId);
    if (result) {
      onFileProcessed(result);
      setSelectedFile(null);
    }
  };

  // ---------------------------------------------------------------------------
  // Retry after error
  // ---------------------------------------------------------------------------

  const handleRetry = () => {
    // Clear the selected file so the user can start fresh
    setSelectedFile(null);
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

  // --- Uploading state ---
  if (isUploading) {
    return (
      <div className={cn('flex flex-col items-center gap-3 p-6', className)}>
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">
          Processing {selectedFile?.name ?? 'file'}...
        </p>
      </div>
    );
  }

  // --- File selected state ---
  if (selectedFile) {
    return (
      <div className={cn('flex flex-col items-center gap-3 p-6', className)}>
        <div className="flex items-center gap-2 text-sm">
          <FileText className="h-5 w-5 text-primary shrink-0" />
          <span className="font-medium truncate max-w-[200px]">
            {selectedFile.name}
          </span>
          <span className="text-muted-foreground">
            ({formatFileSize(selectedFile.size)})
          </span>
        </div>

        <div className="flex gap-2">
          <Button size="sm" onClick={handleProcess}>
            Process with AI
          </Button>
          <Button variant="ghost" size="sm" onClick={handleRemove}>
            <X className="h-4 w-4 mr-1" />
            Remove
          </Button>
        </div>
      </div>
    );
  }

  // --- Default empty state (drop zone) ---
  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        'flex flex-col items-center gap-3 p-6 cursor-pointer',
        'border-2 border-dashed rounded-lg transition-colors',
        isDragOver
          ? 'border-primary bg-primary/5'
          : 'border-muted-foreground/25 hover:border-muted-foreground/40',
        className,
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          fileInputRef.current?.click();
        }
      }}
    >
      <Upload className="h-8 w-8 text-muted-foreground/60" />

      <p className="text-sm text-muted-foreground text-center">
        Drop a file here or click to browse
      </p>

      {/* Type badges */}
      <div className="flex gap-1.5">
        {TYPE_BADGES.map((badge) => (
          <span
            key={badge}
            className="bg-muted text-muted-foreground text-xs px-2 py-0.5 rounded-full"
          >
            {badge}
          </span>
        ))}
      </div>

      <p className="text-xs text-muted-foreground/60">Max 10MB</p>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS}
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
