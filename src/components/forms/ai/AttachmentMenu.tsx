/**
 * AttachmentMenu
 *
 * Popover with "Take photo" + "Upload file" options.
 * Uses Paperclip icon trigger. File input refs for camera and file.
 */

import { useRef } from 'react';
import { Paperclip, Camera, FileUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface AttachmentMenuProps {
  language: 'en' | 'es';
  disabled?: boolean;
  onFileSelect: (files: FileList) => void;
}

export function AttachmentMenu({ language, disabled, onFileSelect }: AttachmentMenuProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCameraClick = () => {
    cameraInputRef.current?.click();
  };

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelect(e.target.files);
      // Reset input so the same file can be selected again
      e.target.value = '';
    }
  };

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled}
            className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
            aria-label={language === 'es' ? 'Adjuntar archivo' : 'Attach file'}
          >
            <Paperclip className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          side="top"
          align="start"
          className={cn(
            'w-48 p-1.5',
            'bg-popover border border-border rounded-xl shadow-elevated',
          )}
        >
          <button
            type="button"
            onClick={handleCameraClick}
            className={cn(
              'flex items-center gap-2.5 w-full',
              'px-3 py-2.5 rounded-lg',
              'text-sm text-foreground',
              'hover:bg-muted/60 active:bg-muted',
              'transition-colors duration-100',
            )}
          >
            <Camera className="h-4 w-4 text-muted-foreground" />
            {language === 'es' ? 'Tomar foto' : 'Take photo'}
          </button>
          <button
            type="button"
            onClick={handleFileClick}
            className={cn(
              'flex items-center gap-2.5 w-full',
              'px-3 py-2.5 rounded-lg',
              'text-sm text-foreground',
              'hover:bg-muted/60 active:bg-muted',
              'transition-colors duration-100',
            )}
          >
            <FileUp className="h-4 w-4 text-muted-foreground" />
            {language === 'es' ? 'Subir archivo' : 'Upload file'}
          </button>
        </PopoverContent>
      </Popover>

      {/* Hidden file inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleInputChange}
        className="hidden"
        aria-hidden="true"
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,.txt,.pdf"
        onChange={handleInputChange}
        className="hidden"
        aria-hidden="true"
      />
    </>
  );
}
