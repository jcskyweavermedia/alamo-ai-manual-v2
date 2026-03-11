/**
 * WizardRichInput
 *
 * Reusable rich input for wizard flows — combines Textarea with voice
 * transcription, file upload, and camera capture capabilities.
 *
 * Feature toggles: enableVoice, enableAttachments, enableCamera.
 */

import { useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { WizardInputToolbar } from './wizard-input-toolbar';
import { WizardAttachmentList } from './wizard-attachment-list';
import { useVoiceRecording } from '@/hooks/use-voice-recording';
import { useWizardAttachments, validateAttachmentFile, MAX_ATTACHMENTS } from '@/hooks/use-wizard-attachments';
import type { AttachmentData } from '@/components/forms/ai/AttachmentChip';

interface WizardRichInputProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  textareaClassName?: string;
  enableVoice?: boolean;
  enableAttachments?: boolean;
  enableCamera?: boolean;
  language?: 'en' | 'es';
  autoFocus?: boolean;
  /** External attachments state (if provided, internal state is not used) */
  attachments?: AttachmentData[];
  onAttachmentsChange?: (attachments: AttachmentData[]) => void;
}

export function WizardRichInput({
  label,
  value,
  onChange,
  placeholder,
  className,
  textareaClassName,
  enableVoice = true,
  enableAttachments = true,
  enableCamera = true,
  language = 'en',
  autoFocus,
  attachments: externalAttachments,
  onAttachmentsChange,
}: WizardRichInputProps) {
  const useExternal = !!(externalAttachments && onAttachmentsChange);

  // Internal attachment state (only used when no external state provided)
  const internal = useWizardAttachments();

  const attachments = useExternal ? externalAttachments : internal.attachments;

  const addFiles = useCallback(
    (files: FileList) => {
      if (useExternal) {
        // External mode — validate + build AttachmentData and dispatch to parent
        const newAtts: AttachmentData[] = [];
        let currentCount = externalAttachments.length;
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          if (!validateAttachmentFile(file, currentCount)) {
            if (currentCount >= MAX_ATTACHMENTS) break;
            continue;
          }
          const isImage = file.type.startsWith('image/');
          newAtts.push({
            id: `wz-${Date.now()}-${i}`,
            name: file.name,
            type: file.type,
            previewUrl: isImage ? URL.createObjectURL(file) : undefined,
            file,
          });
          currentCount++;
        }
        if (newAtts.length > 0) {
          onAttachmentsChange!([...externalAttachments, ...newAtts]);
        }
      } else {
        // Internal mode — delegate to hook
        internal.addFiles(files);
      }
    },
    [useExternal, internal, onAttachmentsChange, externalAttachments],
  );

  const removeAttachment = useCallback(
    (id: string) => {
      if (useExternal) {
        const item = externalAttachments.find((a) => a.id === id);
        if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
        onAttachmentsChange!(externalAttachments.filter((a) => a.id !== id));
      } else {
        internal.removeAttachment(id);
      }
    },
    [useExternal, internal, onAttachmentsChange, externalAttachments],
  );

  // Ref to latest value — avoids stale closure in transcription callback
  const valueRef = useRef(value);
  valueRef.current = value;

  // Voice recording — append transcribed text to textarea value
  const handleTranscription = useCallback(
    (text: string) => {
      const current = valueRef.current;
      onChange(current ? `${current}\n${text}` : text);
    },
    [onChange],
  );

  const {
    isRecording,
    isTranscribing,
    isWarning,
    elapsedSeconds,
    startRecording,
    stopRecording,
  } = useVoiceRecording({
    language,
    onTranscription: handleTranscription,
  });

  const handleMicClick = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  const showToolbar = enableVoice || enableAttachments || enableCamera;
  const showAttachments = (enableAttachments || enableCamera) && attachments.length > 0;

  return (
    <div className={cn('space-y-0', className)}>
      {label && <Label className="text-sm font-medium">{label}</Label>}
      <div
        className={cn(
          'rounded-lg border border-input bg-background',
          'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1',
          label && 'mt-1',
        )}
      >
        {/* Borderless textarea inside wrapper */}
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className={cn(
            'border-0 focus-visible:ring-0 focus-visible:ring-offset-0',
            'min-h-[120px] max-h-[300px] overflow-y-auto resize-y',
            'rounded-b-none',
            textareaClassName,
          )}
        />

        {/* Toolbar */}
        {showToolbar && (
          <WizardInputToolbar
            enableVoice={enableVoice}
            enableAttachments={enableAttachments}
            enableCamera={enableCamera}
            isRecording={isRecording}
            isTranscribing={isTranscribing}
            isWarning={isWarning}
            elapsedSeconds={elapsedSeconds}
            onMicClick={handleMicClick}
            onFileSelect={addFiles}
            language={language}
          />
        )}

        {/* Attachment list */}
        {showAttachments && (
          <WizardAttachmentList
            attachments={attachments}
            onRemove={removeAttachment}
          />
        )}
      </div>
    </div>
  );
}
