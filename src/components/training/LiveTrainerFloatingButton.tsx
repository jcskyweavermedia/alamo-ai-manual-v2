import { useEffect, useState } from 'react';
import { AudioWaveform, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WebRTCVoiceState } from '@/hooks/use-realtime-webrtc';

interface LiveTrainerFloatingButtonProps {
  state: WebRTCVoiceState;
  language: 'en' | 'es';
  visible: boolean;
  onInterrupt: () => void;
  onEndSession: () => void;
}

const STRINGS = {
  en: {
    interrupt: '✋ Interrupt & Ask',
    listening: 'Listening...',
    processing: 'Thinking...',
    speaking: 'Trainer is speaking — tap to interrupt',
    connecting: 'Connecting to Live Trainer...',
    connected: 'Live session ready',
    endSession: 'End Session',
  },
  es: {
    interrupt: '✋ Interrumpir',
    listening: 'Escuchando...',
    processing: 'Pensando...',
    speaking: 'El entrenador habla — toca para interrumpir',
    connecting: 'Conectando...',
    connected: 'Sesión lista',
    endSession: 'Finalizar',
  },
} as const;

export function LiveTrainerFloatingButton({
  state,
  language,
  visible,
  onInterrupt,
  onEndSession,
}: LiveTrainerFloatingButtonProps) {
  const [animClass, setAnimClass] = useState('translate-y-full opacity-0');

  useEffect(() => {
    requestAnimationFrame(() => {
      setAnimClass(visible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0');
    });
  }, [visible]);

  const s = STRINGS[language];
  const isTappable = state === 'speaking';

  const label =
    state === 'connecting' ? s.connecting
    : state === 'connected' ? s.connected
    : state === 'listening' ? s.listening
    : state === 'processing' ? s.processing
    : state === 'speaking' ? s.speaking
    : s.connected;

  const icon =
    state === 'connecting' ? (
      <Loader2 className="h-5 w-5 animate-spin text-white shrink-0" />
    ) : state === 'listening' ? (
      <span className="relative flex h-3 w-3 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
        <span className="relative inline-flex rounded-full h-3 w-3 bg-white" />
      </span>
    ) : (
      <AudioWaveform
        className={cn(
          'h-5 w-5 text-white shrink-0',
          state === 'speaking' && 'animate-pulse',
          state === 'processing' && 'animate-pulse-subtle',
        )}
      />
    );

  return (
    <div className="absolute bottom-0 left-0 right-0 z-20 px-4 pb-4 pointer-events-none">
      <div
        className={cn(
          'transition-all duration-[280ms] ease-out',
          animClass,
        )}
      >
        <div
          className={cn(
            'h-14 rounded-full bg-orange-500 shadow-lg flex items-center pointer-events-auto',
            isTappable && 'cursor-pointer active:bg-orange-600/80',
            !isTappable && 'cursor-default',
          )}
          onClick={isTappable ? onInterrupt : undefined}
        >
          {/* Main area — icon + label */}
          <div className="flex-1 flex items-center gap-3 px-5 min-w-0">
            {icon}
            <span className="text-sm font-medium text-white truncate">
              {label}
            </span>
          </div>

          {/* Divider */}
          <div className="w-px h-8 bg-white/30 shrink-0" />

          {/* End Session button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEndSession();
            }}
            className="px-4 shrink-0 flex items-center gap-1.5 text-white/80 hover:text-white text-xs font-medium h-full"
          >
            <X className="h-3.5 w-3.5" />
            {s.endSession}
          </button>
        </div>
      </div>
    </div>
  );
}
