// =============================================================================
// AIBuilderPanel — Conversational AI form builder chat panel
// Modeled after ChatIngestionPanel: voice, attachments, auto-scroll, bilingual
// =============================================================================

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Paperclip, FileText, X, Loader2, Mic, Sparkles, Square } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useBuilder } from '@/contexts/BuilderContext';
import { useFormBuilderChat } from '@/hooks/useFormBuilderChat';
import { useVoiceRecording, formatRecordingTime, isRecordingSupported } from '@/hooks/use-voice-recording';
import type { BuilderChatMessage } from '@/types/form-builder';

// =============================================================================
// STRINGS
// =============================================================================

const STRINGS = {
  en: {
    placeholder: 'Describe what you need...',
    emptyTitle: 'AI Form Builder',
    emptyDesc: 'Describe the form you need, or ask me to make changes.',
    chipLabel1: 'Employee write-up',
    chipLabel2: 'Injury report',
    chipLabel3: 'Opening checklist',
    chipLabel4: 'Food safety log',
    chipPrompt1: 'Create an employee write-up form with sections for employee info, incident details, rule/policy violations, corrective actions, and signatures. The AI should reference company policies and the employee handbook from the operations manual when filling this form. You can also attach a photo of an existing paper form for reference.',
    chipPrompt2: 'Create a workplace injury report with sections for injured employee info, incident details (date, time, location, description), witness information, medical treatment given, and hospital/doctor contact lookup. Include fields for manager signature and follow-up actions. You can also attach a photo of an existing paper form for reference.',
    chipPrompt3: 'Create a daily opening checklist covering station setup, equipment checks, cleanliness standards, uniform/appearance verification, and steps-of-service readiness review. Use yes/no and checkbox fields for quick completion. You can also attach a photo of an existing paper form for reference.',
    chipPrompt4: 'Create a food safety temperature log for recording walk-in cooler, freezer, and hot-holding station temperatures. Include fields for time of check, specific product/item names, recorded temperatures, and corrective actions if out of range. You can also attach a photo of an existing paper form for reference.',
    chipLabel5: 'Cash handling',
    chipLabel6: 'Customer complaint',
    chipLabel7: 'Equipment log',
    chipLabel8: 'New hire checklist',
    chipPrompt5: 'Create a cash handling and register variance report with sections for shift info, expected vs. actual register totals, variance amount, employee responsible, and manager review. Use the manual tool to reference cash handling policies and standards. You can also attach a photo of an existing paper form for reference.',
    chipPrompt6: 'Create a customer incident and complaint report with sections for guest details, incident description, staff involved, resolution steps taken, and follow-up actions. Use the steps_of_service and standards tools to reference service recovery procedures. You can also attach a photo of an existing paper form for reference.',
    chipPrompt7: 'Create an equipment maintenance log with sections for equipment name and location, issue description, date reported, priority level, repair actions taken, and technician or vendor contact lookup. Use the manual tool to reference maintenance procedures and the contacts tool for vendor info. You can also attach a photo of an existing paper form for reference.',
    chipPrompt8: 'Create a new hire onboarding checklist covering paperwork completion, uniform issued, training schedule, system access setup, handbook acknowledgment, and mentor assignment. Use the manual tool to reference the employee handbook and training program requirements. You can also attach a photo of an existing paper form for reference.',
    sending: 'Thinking...',
    errorPrefix: 'Error: ',
    attachFile: 'Attach file',
    recordVoice: 'Record voice',
    stopRecording: 'Stop recording',
    transcribing: 'Transcribing...',
    sendMessage: 'Send message',
  },
  es: {
    placeholder: 'Describe lo que necesitas...',
    emptyTitle: 'Constructor de Formularios IA',
    emptyDesc: 'Describe el formulario que necesitas, o pideme que haga cambios.',
    chipLabel1: 'Amonestacion',
    chipLabel2: 'Reporte de lesion',
    chipLabel3: 'Lista de apertura',
    chipLabel4: 'Seguridad alimentaria',
    chipPrompt1: 'Crea un formulario de amonestacion con secciones para datos del empleado, detalles del incidente, violaciones de reglas/politicas, acciones correctivas y firmas. La IA debe consultar las politicas de la empresa y el manual del empleado al llenar este formulario. Tambien puedes adjuntar una foto de un formulario en papel existente como referencia.',
    chipPrompt2: 'Crea un reporte de lesion laboral con secciones para datos del empleado lesionado, detalles del incidente (fecha, hora, lugar, descripcion), informacion de testigos, tratamiento medico proporcionado y busqueda de contacto de hospitales/doctores. Incluye campos para firma del gerente y acciones de seguimiento. Tambien puedes adjuntar una foto de un formulario en papel existente como referencia.',
    chipPrompt3: 'Crea una lista de apertura diaria cubriendo preparacion de estaciones, revision de equipos, estandares de limpieza, verificacion de uniforme/apariencia y revision de preparacion de pasos de servicio. Usa campos si/no y casillas para completar rapidamente. Tambien puedes adjuntar una foto de un formulario en papel existente como referencia.',
    chipPrompt4: 'Crea un registro de temperaturas de seguridad alimentaria para registrar temperaturas de refrigeradores, congeladores y estaciones de mantenimiento caliente. Incluye campos para hora de revision, nombres de productos/articulos, temperaturas registradas y acciones correctivas si estan fuera de rango. Tambien puedes adjuntar una foto de un formulario en papel existente como referencia.',
    chipLabel5: 'Manejo de efectivo',
    chipLabel6: 'Queja de cliente',
    chipLabel7: 'Registro de equipos',
    chipLabel8: 'Lista de nuevo ingreso',
    chipPrompt5: 'Crea un reporte de manejo de efectivo y variacion de caja con secciones para informacion del turno, totales esperados vs. reales de la caja, monto de variacion, empleado responsable y revision del gerente. Usa la herramienta de manual para consultar politicas de manejo de efectivo y estandares. Tambien puedes adjuntar una foto de un formulario en papel existente como referencia.',
    chipPrompt6: 'Crea un reporte de incidente y queja de cliente con secciones para datos del comensal, descripcion del incidente, personal involucrado, pasos de resolucion tomados y acciones de seguimiento. Usa las herramientas de pasos_de_servicio y estandares para consultar procedimientos de recuperacion de servicio. Tambien puedes adjuntar una foto de un formulario en papel existente como referencia.',
    chipPrompt7: 'Crea un registro de mantenimiento de equipos con secciones para nombre y ubicacion del equipo, descripcion del problema, fecha reportada, nivel de prioridad, acciones de reparacion tomadas y busqueda de contacto de tecnicos o proveedores. Usa la herramienta de manual para consultar procedimientos de mantenimiento y la herramienta de contactos para informacion de proveedores. Tambien puedes adjuntar una foto de un formulario en papel existente como referencia.',
    chipPrompt8: 'Crea una lista de incorporacion de nuevo empleado cubriendo documentacion completada, uniforme entregado, horario de capacitacion, acceso a sistemas, reconocimiento del manual y asignacion de mentor. Usa la herramienta de manual para consultar el manual del empleado y los requisitos del programa de capacitacion. Tambien puedes adjuntar una foto de un formulario en papel existente como referencia.',
    sending: 'Pensando...',
    errorPrefix: 'Error: ',
    attachFile: 'Adjuntar archivo',
    recordVoice: 'Grabar voz',
    stopRecording: 'Detener grabacion',
    transcribing: 'Transcribiendo...',
    sendMessage: 'Enviar mensaje',
  },
};

// =============================================================================
// LOCAL TYPES
// =============================================================================

interface QueuedAttachment {
  id: string;
  type: 'image' | 'file';
  name: string;
  preview?: string;      // Object URL for image thumbnails
  dataUrl?: string;       // Base64 data URL for images
  textContent?: string;   // Extracted text for .txt files
}

interface AIBuilderPanelProps {
  language: 'en' | 'es';
  groupId: string | null;
}

// =============================================================================
// BUILDER CHANGE CARD (inline under assistant messages)
// =============================================================================

function BuilderChangeCard({ changes }: { changes: string[] }) {
  if (!changes.length) return null;
  return (
    <div className="mt-2 rounded-lg border bg-muted/50 px-3 py-2 text-xs space-y-1">
      {changes.map((c, i) => (
        <div key={i} className="flex items-start gap-1.5">
          <span className="text-muted-foreground mt-0.5 shrink-0">&#8226;</span>
          <span>{c}</span>
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// THINKING INDICATOR (pulsing dots)
// =============================================================================

function ThinkingDots() {
  return (
    <div className="flex items-center gap-1 px-1 py-0.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-pulse"
          style={{ animationDelay: `${i * 200}ms` }}
        />
      ))}
    </div>
  );
}

// =============================================================================
// COMPONENT
// =============================================================================

export function AIBuilderPanel({ language, groupId }: AIBuilderPanelProps) {
  const t = STRINGS[language];
  const { state, dispatch } = useBuilder();
  const { sendMessage, isLoading: hookLoading, error: hookError } = useFormBuilderChat();

  // Local state
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<QueuedAttachment[]>([]);

  // Refs
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Voice recording (reuse existing hook)
  const {
    isRecording,
    isTranscribing,
    elapsedSeconds,
    isWarning,
    audioLevel,
    startRecording,
    stopRecording,
    cancelRecording,
  } = useVoiceRecording({
    language,
    silenceTimeoutMs: 4000,
    maxRecordingSeconds: 120,
    onTranscription: (text) => {
      setInput((prev) => (prev ? `${prev} ${text}` : text));
      inputRef.current?.focus();
    },
  });

  // Derived
  const messages = state.builderChatMessages ?? [];
  const isProcessing = state.builderChatLoading ?? false;
  const canSend = (input.trim() || attachments.length > 0) && !!groupId && !isProcessing;

  // --- Auto-grow textarea ---
  const MAX_TEXTAREA_HEIGHT = 120;
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const clamped = Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT);
    el.style.height = clamped + 'px';
    el.style.overflowY = el.scrollHeight > MAX_TEXTAREA_HEIGHT ? 'auto' : 'hidden';
  }, [input]);

  // --- Auto-scroll on new messages / processing ---
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages.length, isProcessing]);

  // --- Cleanup preview URLs on unmount (use ref to track current attachments) ---
  const attachmentsRef = useRef(attachments);
  useEffect(() => { attachmentsRef.current = attachments; }, [attachments]);
  useEffect(() => {
    return () => {
      attachmentsRef.current.forEach((a) => {
        if (a.preview) URL.revokeObjectURL(a.preview);
      });
    };
  }, []);

  // --- File handling ---
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    let hasImage = attachments.some((a) => a.type === 'image');
    Array.from(files).forEach((file) => {
      if (file.type.startsWith('image/')) {
        // Image: limit 1 per message — only first is sent to AI
        if (hasImage) return;
        hasImage = true;
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          setAttachments((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              type: 'image',
              name: file.name,
              preview: URL.createObjectURL(file),
              dataUrl,
            },
          ]);
        };
        reader.readAsDataURL(file);
      } else if (file.name.endsWith('.txt') || file.type === 'text/plain') {
        // Text file: read as text
        const reader = new FileReader();
        reader.onload = () => {
          setAttachments((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              type: 'file',
              name: file.name,
              textContent: (reader.result as string).slice(0, 50000),
            },
          ]);
        };
        reader.readAsText(file);
      } else {
        // PDF/DOCX: store name only (Phase 1 -- content extraction deferred)
        setAttachments((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            type: 'file',
            name: file.name,
          },
        ]);
      }
    });

    e.target.value = '';
  }, [attachments]);

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => {
      const removed = prev.find((a) => a.id === id);
      if (removed?.preview) URL.revokeObjectURL(removed.preview);
      return prev.filter((a) => a.id !== id);
    });
  }, []);

  // --- Clipboard paste (images — limit 1 per message) ---
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    if (attachments.some((a) => a.type === 'image')) return; // already has an image
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result as string;
            setAttachments((prev) => [
              ...prev,
              {
                id: crypto.randomUUID(),
                type: 'image',
                name: 'pasted-image.png',
                preview: URL.createObjectURL(file),
                dataUrl,
              },
            ]);
          };
          reader.readAsDataURL(file);
          return;
        }
      }
    }
  }, [attachments]);

  // --- Send message ---
  const handleSend = useCallback(async () => {
    if (!input.trim() && !attachments.length) return;
    if (!groupId || isProcessing) return;

    // Fix: default message when only attachments present (image-only)
    const messageText = input.trim() || (
      attachments.some((a) => a.type === 'image')
        ? 'Create a form based on this image.'
        : 'Create a form based on this file.'
    );

    const userMessage: BuilderChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: messageText,
      timestamp: new Date().toISOString(),
      // Fix: store dataUrl (base64) for images so thumbnails survive URL.revokeObjectURL
      attachments: attachments.map((a) => ({
        type: a.type,
        name: a.name,
        preview: a.type === 'image' ? a.dataUrl : undefined,
      })),
    };

    dispatch({ type: 'BUILDER_CHAT_ADD_MESSAGE', payload: userMessage });
    dispatch({ type: 'BUILDER_CHAT_SET_LOADING', payload: true });

    // Clear input + attachments
    const sentAttachments = [...attachments];
    setInput('');
    setAttachments([]);
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }

    // Build current form snapshot from state
    const currentForm = {
      titleEn: state.titleEn,
      titleEs: state.titleEs,
      descriptionEn: state.descriptionEn,
      descriptionEs: state.descriptionEs,
      icon: state.icon,
      iconColor: state.iconColor,
      fields: state.fields.map((f) => ({
        key: f.key,
        label: f.label,
        label_es: f.label_es || '',
        type: f.type,
        section: f.section || '',
        required: f.required ?? false,
        options: f.options,
        order: f.order,
      })),
      instructionsEn: state.instructionsEn,
      instructionsEs: state.instructionsEs,
      aiTools: state.aiTools,
    };

    // Get image/file from attachments (first of each type)
    const imageAttach = sentAttachments.find((a) => a.type === 'image');
    const fileAttach = sentAttachments.find((a) => a.type === 'file');

    const result = await sendMessage({
      message: messageText,
      currentForm,
      conversationHistory: messages,
      imageBase64: imageAttach?.dataUrl,
      fileContent: fileAttach?.textContent,
      fileName: fileAttach?.name,
      language,
      groupId,
    });

    if (result) {
      const assistantMessage: BuilderChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: result.message,
        timestamp: new Date().toISOString(),
        changeSummary: result.changeSummary,
        confidence: result.confidence,
      };
      dispatch({ type: 'BUILDER_CHAT_ADD_MESSAGE', payload: assistantMessage });

      // Apply form updates if any non-empty
      const hasUpdates =
        result.changeSummary.length > 0 ||
        Object.values(result.formUpdates).some(
          (v) => v != null && (!Array.isArray(v) || v.length > 0),
        );
      if (hasUpdates) {
        dispatch({ type: 'APPLY_CHAT_FORM_UPDATES', payload: result.formUpdates });
      }
    }

    dispatch({ type: 'BUILDER_CHAT_SET_LOADING', payload: false });

    // Clean up sent attachment URLs
    sentAttachments.forEach((a) => {
      if (a.preview) URL.revokeObjectURL(a.preview);
    });
  }, [input, attachments, groupId, isProcessing, state, dispatch, sendMessage, messages, language]);

  // --- Keyboard handling ---
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && isRecording) {
      e.preventDefault();
      cancelRecording();
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // --- Quick-start chip handler ---
  const handleChipClick = useCallback(
    (text: string) => {
      setInput(text);
      inputRef.current?.focus();
    },
    [],
  );

  // =========================================================================
  // RENDER
  // =========================================================================

  return (
    <div className="flex flex-col h-full" onPaste={handlePaste}>
      {/* ================ Messages area (scrollable) ================ */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto min-h-0 p-4 space-y-4"
      >
        {/* Empty state */}
        {messages.length === 0 && !isProcessing && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-base font-semibold text-foreground mb-1">
              {t.emptyTitle}
            </h3>
            <p className="text-xs text-muted-foreground mb-5 max-w-[280px]">
              {t.emptyDesc}
            </p>

            {/* Quick-start chips */}
            <div className="flex flex-wrap gap-2 justify-center max-w-[380px]">
              {([
                { label: t.chipLabel1, prompt: t.chipPrompt1 },
                { label: t.chipLabel2, prompt: t.chipPrompt2 },
                { label: t.chipLabel3, prompt: t.chipPrompt3 },
                { label: t.chipLabel4, prompt: t.chipPrompt4 },
                { label: t.chipLabel5, prompt: t.chipPrompt5 },
                { label: t.chipLabel6, prompt: t.chipPrompt6 },
                { label: t.chipLabel7, prompt: t.chipPrompt7 },
                { label: t.chipLabel8, prompt: t.chipPrompt8 },
              ]).map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => handleChipClick(chip.prompt)}
                  className={cn(
                    'px-3 py-1.5 text-xs rounded-full border',
                    'bg-card hover:bg-accent/50 transition-colors',
                    'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message list */}
        {messages.map((msg) => (
          <div key={msg.id} className="space-y-1">
            <div
              className={cn(
                'flex gap-2.5',
                msg.role === 'user' ? 'justify-end' : 'justify-start',
              )}
            >
              <div
                className={cn(
                  'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm',
                  msg.role === 'user'
                    ? 'bg-foreground/[0.06] text-foreground'
                    : 'bg-muted text-foreground',
                )}
              >
                {/* Message text */}
                {msg.role === 'assistant' ? (
                  <div className="text-sm leading-relaxed prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {msg.content}
                  </p>
                )}

                {/* User attachments (thumbnails) */}
                {msg.role === 'user' && msg.attachments && msg.attachments.length > 0 && (
                  <div className="flex gap-1.5 mt-2 flex-wrap">
                    {msg.attachments.map((att, i) =>
                      att.type === 'image' && att.preview ? (
                        <img
                          key={i}
                          src={att.preview}
                          alt={att.name}
                          className="h-12 w-12 rounded-md object-cover border border-border"
                        />
                      ) : (
                        <div
                          key={i}
                          className="h-12 px-2 rounded-md border border-border bg-muted/50 flex items-center gap-1.5"
                        >
                          <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="text-[10px] text-muted-foreground truncate max-w-[80px]">
                            {att.name}
                          </span>
                        </div>
                      ),
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Change card (under assistant messages) */}
            {msg.role === 'assistant' && msg.changeSummary && (
              <div className="max-w-[85%]">
                <BuilderChangeCard changes={msg.changeSummary} />
              </div>
            )}
          </div>
        ))}

        {/* Thinking indicator */}
        {isProcessing && (
          <div className="flex gap-2.5 justify-start">
            <div className="bg-muted rounded-2xl px-3.5 py-2.5">
              <ThinkingDots />
            </div>
          </div>
        )}

        {/* Error display */}
        {hookError && !isProcessing && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive">
            {t.errorPrefix}{hookError}
          </div>
        )}
      </div>

      {/* ================ Attachment preview strip ================ */}
      {attachments.length > 0 && (
        <div className="border-t border-border pt-2 pb-1 px-4">
          <div className="flex gap-2 overflow-x-auto">
            {attachments.map((att) => (
              <div key={att.id} className="relative shrink-0 group">
                {att.type === 'image' && att.preview ? (
                  <img
                    src={att.preview}
                    alt={att.name}
                    className="h-16 w-16 rounded-md object-cover border border-border"
                  />
                ) : (
                  <div className="h-16 w-16 rounded-md border border-border bg-muted flex flex-col items-center justify-center">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <span className="text-[9px] text-muted-foreground mt-0.5 truncate max-w-[56px] px-1">
                      {att.name.split('.').pop()?.toUpperCase()}
                    </span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => removeAttachment(att.id)}
                  className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================ Input bar (fixed at bottom) ================ */}
      <div className="shrink-0 border-t border-border p-3">
        <div className="flex gap-2 items-end">
          {/* Attachment button */}
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 h-9 w-9"
                  disabled={isProcessing}
                  onClick={() => fileInputRef.current?.click()}
                  aria-label={t.attachFile}
                >
                  <Paperclip className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t.attachFile}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Mic button with live audio ring */}
          <div className="relative shrink-0">
            {isRecording && (
              <span
                className="absolute inset-0 rounded-md bg-destructive/30 pointer-events-none"
                style={{
                  transform: `scale(${1 + audioLevel * 0.5})`,
                  opacity: 0.2 + audioLevel * 0.6,
                  transition: 'transform 100ms ease-out, opacity 100ms ease-out',
                }}
              />
            )}
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={isRecording ? 'destructive' : 'ghost'}
                    size="icon"
                    className="relative h-9 w-9"
                    disabled={!isRecordingSupported() || isProcessing || isTranscribing}
                    onClick={isRecording ? stopRecording : startRecording}
                    aria-label={isRecording ? t.stopRecording : t.recordVoice}
                  >
                    {isTranscribing ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Mic className="h-5 w-5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    {isTranscribing
                      ? t.transcribing
                      : isRecording
                        ? t.stopRecording
                        : t.recordVoice}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Recording timer */}
          {isRecording && (
            <span
              className={cn(
                'text-xs font-mono tabular-nums px-2 py-1 rounded-md shrink-0',
                isWarning
                  ? 'bg-warning/20 text-warning-foreground'
                  : 'bg-destructive/10 text-destructive',
              )}
            >
              {formatRecordingTime(elapsedSeconds)}
            </span>
          )}

          {/* Text input */}
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isTranscribing ? t.transcribing : t.placeholder
            }
            className={cn(
              'flex-1 resize-none min-h-[40px] max-h-[120px] text-sm py-2 px-3',
              'rounded-lg border border-input bg-background',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0',
              'overflow-y-hidden',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
            rows={1}
            disabled={isProcessing || isTranscribing}
          />

          {/* Send / Stop / Transcribing button */}
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                {isRecording ? (
                  <Button
                    size="icon"
                    variant="destructive"
                    className="shrink-0"
                    onClick={stopRecording}
                    aria-label={t.stopRecording}
                  >
                    <Square className="h-4 w-4" />
                  </Button>
                ) : isTranscribing ? (
                  <Button size="icon" className="shrink-0" disabled aria-label={t.transcribing}>
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </Button>
                ) : (
                  <Button
                    size="icon"
                    className="shrink-0"
                    onClick={handleSend}
                    disabled={!canSend}
                    aria-label={t.sendMessage}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                )}
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  {isRecording
                    ? t.stopRecording
                    : isTranscribing
                      ? t.transcribing
                      : t.sendMessage}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.txt,text/plain"
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />
    </div>
  );
}
