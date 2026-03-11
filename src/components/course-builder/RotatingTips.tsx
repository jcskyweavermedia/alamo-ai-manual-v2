// =============================================================================
// RotatingTips — Cycling bilingual tip messages during build
// =============================================================================

import { useState, useEffect } from 'react';
import { Lightbulb } from 'lucide-react';

const TIPS: Array<{ en: string; es: string }> = [
  { en: 'You can edit any content after the build completes.', es: 'Puedes editar cualquier contenido al finalizar.' },
  { en: 'Each element can be individually regenerated later.', es: 'Cada elemento se puede regenerar individualmente.' },
  { en: 'The AI uses your source material to stay accurate.', es: 'La IA usa tu material fuente para mayor precisión.' },
  { en: 'Courses support both English and Spanish content.', es: 'Los cursos soportan contenido en inglés y español.' },
  { en: 'Use the AI chat panel to make targeted edits.', es: 'Usa el panel de chat IA para ediciones específicas.' },
  { en: 'Preview mode lets you see exactly what staff will see.', es: 'La vista previa muestra exactamente lo que verá el staff.' },
];

interface RotatingTipsProps {
  language?: 'en' | 'es';
  intervalMs?: number;
}

export function RotatingTips({ language = 'en', intervalMs = 6000 }: RotatingTipsProps) {
  const [idx, setIdx] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setIdx(prev => (prev + 1) % TIPS.length);
        setFading(false);
      }, 200);
    }, intervalMs);

    return () => clearInterval(timer);
  }, [intervalMs]);

  const tip = TIPS[idx];

  return (
    <div className="flex items-start gap-2 text-xs text-muted-foreground">
      <Lightbulb className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-500" />
      <p
        className="transition-opacity duration-200"
        style={{ opacity: fading ? 0 : 1 }}
      >
        {language === 'es' ? tip.es : tip.en}
      </p>
    </div>
  );
}
