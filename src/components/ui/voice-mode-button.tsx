/**
 * VoiceModeButton
 * 
 * Voice mode toggle button with visual state feedback.
 * Shows connection status and animated indicators for listening/speaking states.
 * 
 * Part of Step 11: Integrated Voice Chat Mode
 */

import * as React from 'react';
import { Mic, X, Square, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { WebRTCVoiceState } from '@/hooks/use-realtime-webrtc';

// =============================================================================
// TYPES
// =============================================================================

interface VoiceModeButtonProps {
  /** Current voice connection state */
  state: WebRTCVoiceState;
  /** Called when user wants to connect */
  onConnect: () => void;
  /** Called when user wants to disconnect */
  onDisconnect: () => void;
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Current language */
  language: 'en' | 'es';
  /** Optional className */
  className?: string;
}

// =============================================================================
// LOCALIZED STRINGS
// =============================================================================

const strings = {
  en: {
    startVoice: 'Voice mode',
    cancel: 'Cancel',
    end: 'End',
    connecting: 'Connecting...',
  },
  es: {
    startVoice: 'Modo voz',
    cancel: 'Cancelar',
    end: 'Terminar',
    connecting: 'Conectando...',
  },
};

// =============================================================================
// INTERIOR ANIMATION COMPONENTS
// =============================================================================

/** Animated bars for listening state */
function ListeningBars() {
  return (
    <div className="flex items-center justify-center gap-0.5 h-4">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="w-0.5 bg-current rounded-full animate-pulse"
          style={{
            height: `${8 + Math.sin(i * 1.5) * 4}px`,
            animationDelay: `${i * 100}ms`,
            animationDuration: '600ms',
          }}
        />
      ))}
    </div>
  );
}

/** Pulsing dot for processing state */
function ProcessingDot() {
  return (
    <div className="flex items-center justify-center">
      <div className="w-2 h-2 bg-current rounded-full animate-pulse" />
    </div>
  );
}

/** Bouncing bars for speaking state */
function SpeakingBars() {
  return (
    <div className="flex items-center justify-center gap-0.5 h-4">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="w-1 bg-current rounded-full"
          style={{
            animation: 'bounce 0.6s ease-in-out infinite',
            animationDelay: `${i * 100}ms`,
            height: '12px',
          }}
        />
      ))}
    </div>
  );
}

/** Small idle dot for connected state */
function IdleDot() {
  return (
    <div className="flex items-center justify-center">
      <div className="w-1.5 h-1.5 bg-current rounded-full opacity-60" />
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function VoiceModeButton({
  state,
  onConnect,
  onDisconnect,
  disabled = false,
  language,
  className,
}: VoiceModeButtonProps) {
  const t = strings[language];

  const isDisconnected = state === 'disconnected';
  const isConnecting = state === 'connecting';
  const isActive = !isDisconnected && !isConnecting;

  const handleClick = () => {
    if (isDisconnected) {
      onConnect();
    } else {
      onDisconnect();
    }
  };

  // Determine button content based on state
  const renderContent = () => {
    if (isDisconnected) {
      return (
        <>
          <Mic className="h-4 w-4" />
          <span className="sr-only">{t.startVoice}</span>
        </>
      );
    }

    if (isConnecting) {
      return (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-xs">{t.cancel}</span>
        </>
      );
    }

    // Active states (connected, listening, processing, speaking)
    // Show animation instead of Square icon for better clarity
    return (
      <>
        <div className="flex items-center justify-center w-5 h-5">
          {state === 'listening' && <ListeningBars />}
          {state === 'processing' && <ProcessingDot />}
          {state === 'speaking' && <SpeakingBars />}
          {state === 'connected' && <Square className="h-3.5 w-3.5 fill-current" />}
        </div>
        <span className="text-xs">{t.end}</span>
      </>
    );
  };

  // Determine button variant and styling
  const getButtonStyles = () => {
    if (isDisconnected) {
      return 'bg-orange-500 text-white hover:bg-orange-600';
    }
    if (isConnecting) {
      return 'bg-muted hover:bg-destructive/90 text-muted-foreground hover:text-destructive-foreground';
    }
    // Active - show as destructive (red) for "End"
    return 'bg-destructive hover:bg-destructive/90 text-destructive-foreground';
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleClick}
      disabled={disabled}
      className={cn(
        'gap-1.5 px-3 h-9 rounded-full transition-all duration-200',
        getButtonStyles(),
        className
      )}
      aria-label={isDisconnected ? t.startVoice : isConnecting ? t.cancel : t.end}
    >
      {renderContent()}
    </Button>
  );
}
