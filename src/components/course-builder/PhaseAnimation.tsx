// =============================================================================
// PhaseAnimation — Animated visual per active build phase
// Phase "content": typewriter effect. Phase "assembly": progress bar.
// Falls back to static for prefers-reduced-motion.
// =============================================================================

import { useState, useEffect, useRef } from 'react';
import { Progress } from '@/components/ui/progress';
import type { BuildPhase } from '@/types/course-builder';

const WRITER_LINES = [
  'Crafting your training content...',
  'Writing course material...',
  'Building cohesive lesson flow...',
  'Generating expert-level content...',
];

interface PhaseAnimationProps {
  currentPhase: BuildPhase | null;
}

export function PhaseAnimation({ currentPhase }: PhaseAnimationProps) {
  if (!currentPhase || currentPhase.status !== 'active') return null;

  if (currentPhase.id === 'structure' || currentPhase.id === 'content') {
    return <TypewriterAnimation />;
  }

  // Progress bar phases: assembly, layout
  if (currentPhase.progress) {
    const pct = Math.round((currentPhase.progress.completed / currentPhase.progress.total) * 100);
    const labels: Record<string, string> = {
      assembly: 'Assembling elements',
      layout: 'Building layout',
    };
    const label = labels[currentPhase.id] || currentPhase.label;
    return (
      <div className="ai-phase-animation space-y-2 rounded-lg border bg-muted/50 px-4 py-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{label}</span>
          <span className="tabular-nums">Section {currentPhase.progress.completed} of {currentPhase.progress.total}</span>
        </div>
        <Progress value={pct} className="h-1.5" />
      </div>
    );
  }

  return null;
}

function TypewriterAnimation() {
  const [text, setText] = useState('');
  const [lineIdx, setLineIdx] = useState(0);
  const charIdx = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const line = WRITER_LINES[lineIdx % WRITER_LINES.length];

    function tick() {
      if (charIdx.current <= line.length) {
        setText(line.slice(0, charIdx.current));
        charIdx.current++;
        timerRef.current = setTimeout(tick, 35);
      } else {
        // Pause, then move to next line
        timerRef.current = setTimeout(() => {
          charIdx.current = 0;
          setText('');
          setLineIdx(prev => prev + 1);
        }, 2000);
      }
    }

    tick();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [lineIdx]);

  return (
    <div className="ai-phase-animation rounded-lg border bg-muted/50 px-4 py-3 min-h-[44px] flex items-center">
      <p className="text-sm text-muted-foreground">
        {text}
        <span className="inline-block w-[2px] h-4 bg-primary ml-0.5 align-middle animate-blink" />
      </p>
    </div>
  );
}
