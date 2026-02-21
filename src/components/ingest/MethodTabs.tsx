import { MessageSquare, Upload, Camera } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { FileUploadZone } from '@/components/ingest/FileUploadZone';
import { ImageUploadZone } from '@/components/ingest/ImageUploadZone';
import type { IngestionMethod } from '@/types/ingestion';
import type { FileUploadResult } from '@/hooks/use-file-upload';
import type { ImageUploadResult } from '@/hooks/use-image-upload';

interface MethodTabsProps {
  activeMethod: IngestionMethod;
  onMethodChange: (method: IngestionMethod) => void;
  chatContent: React.ReactNode;
  onFileProcessed?: (result: FileUploadResult) => void;
  onImageProcessed?: (result: ImageUploadResult) => void;
  sessionId?: string;
}

export function MethodTabs({
  activeMethod,
  onMethodChange,
  chatContent,
  onFileProcessed,
  onImageProcessed,
  sessionId,
}: MethodTabsProps) {
  return (
    <Tabs
      value={activeMethod}
      onValueChange={(v) => onMethodChange(v as IngestionMethod)}
      className="w-full"
    >
      <TabsList className="w-full">
        <TabsTrigger value="chat" className="flex-1 gap-1.5">
          <MessageSquare className="h-3.5 w-3.5" />
          Chat with AI
        </TabsTrigger>
        <TabsTrigger value="file_upload" className="flex-1 gap-1.5">
          <Upload className="h-3.5 w-3.5" />
          Upload File
        </TabsTrigger>
        <TabsTrigger value="image_upload" className="flex-1 gap-1.5">
          <Camera className="h-3.5 w-3.5" />
          Take Photo
        </TabsTrigger>
      </TabsList>

      <TabsContent value="chat" className="mt-3">
        {chatContent}
      </TabsContent>

      <TabsContent value="file_upload" className="mt-3">
        {onFileProcessed ? (
          <FileUploadZone
            onFileProcessed={onFileProcessed}
            sessionId={sessionId}
          />
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
            <Upload className="h-8 w-8 mb-3 opacity-50" />
            <p className="text-sm font-medium">File upload not available</p>
          </div>
        )}
      </TabsContent>

      <TabsContent value="image_upload" className="mt-3">
        {onImageProcessed ? (
          <ImageUploadZone
            onImageProcessed={onImageProcessed}
            sessionId={sessionId}
          />
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
            <Camera className="h-8 w-8 mb-3 opacity-50" />
            <p className="text-sm font-medium">Image upload not available</p>
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
