import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

const PHASE_THRESHOLD_MS = 50_000;
const CYCLE_INTERVAL_MS = 8_000;

const BUILDING_MESSAGES = [
  '📖 Reading your details...',
  '🥬 Identifying ingredients and quantities...',
  '📋 Mapping out procedure steps...',
  '⚠️ Detecting allergens and tags...',
  '📦 Organizing ingredient groups...',
  '🔧 Structuring the full draft...',
];

const REVIEWING_MESSAGES = [
  '✅ Running quality checks...',
  '📏 Verifying measurements and units...',
  '🔍 Checking for missing fields...',
  '✨ Finalizing your draft...',
  '🏁 Almost there...',
];

export function ThinkingIndicator() {
  const [phase, setPhase] = useState<'building' | 'reviewing'>('building');
  const [messageIndex, setMessageIndex] = useState(0);

  // Phase transition: switch to "reviewing" after threshold
  useEffect(() => {
    const timer = setTimeout(() => {
      setPhase('reviewing');
      setMessageIndex(0);
    }, PHASE_THRESHOLD_MS);
    return () => clearTimeout(timer);
  }, []);

  // Cycle messages within current phase
  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => {
        const messages = phase === 'building' ? BUILDING_MESSAGES : REVIEWING_MESSAGES;
        return (prev + 1) % messages.length;
      });
    }, CYCLE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [phase]);

  const messages = phase === 'building' ? BUILDING_MESSAGES : REVIEWING_MESSAGES;
  const label = phase === 'building' ? 'Building' : 'Reviewing';

  return (
    <div className="space-y-1 py-0.5">
      <p className="text-[11px] text-muted-foreground">
        🧑‍🍳 Working on it — this may take a minute
      </p>
      <p
        key={`${phase}-${messageIndex}`}
        className="flex items-center gap-1.5 text-xs font-medium animate-fade-in"
      >
        <Loader2 className="h-3 w-3 animate-spin shrink-0" />
        <span>{messages[messageIndex]}</span>
      </p>
    </div>
  );
}
