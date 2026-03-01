// =============================================================================
// AIToolsSelector — Checkbox list for form AI tools
// Used inside FormInstructionsPanel (desktop right column)
// =============================================================================

import { cn } from '@/lib/utils';
import { useBuilder } from '@/contexts/BuilderContext';
import { useFormAITools } from '@/hooks/useFormAITools';

const STRINGS = {
  en: {
    helper: 'What the AI can search when filling this form',
    loading: 'Loading tools...',
  },
  es: {
    helper: 'Lo que la IA puede buscar al llenar este formulario',
    loading: 'Cargando herramientas...',
  },
} as const;

interface AIToolsSelectorProps {
  language: 'en' | 'es';
}

export function AIToolsSelector({ language }: AIToolsSelectorProps) {
  const { state, toggleTool } = useBuilder();
  const { tools, loading } = useFormAITools();
  const t = STRINGS[language];

  if (loading) {
    return <p className="text-xs text-muted-foreground">{t.loading}</p>;
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">{t.helper}</p>
      <div className="space-y-1.5">
        {tools.map((tool) => {
          const isActive = state.aiTools.includes(tool.id);
          const label = language === 'es' ? tool.labelEs : tool.labelEn;
          const description = language === 'es' ? tool.descriptionEs : tool.descriptionEn;

          return (
            <label
              key={tool.id}
              className={cn(
                'flex items-start gap-2.5 p-2 rounded-lg cursor-pointer transition-colors',
                isActive
                  ? 'bg-primary/5'
                  : 'hover:bg-muted/50',
              )}
            >
              <input
                type="checkbox"
                checked={isActive}
                onChange={() => toggleTool(tool.id)}
                className="mt-0.5 h-4 w-4 rounded border-muted-foreground/40 text-primary focus:ring-primary/30 cursor-pointer"
              />
              <div className="flex-1 min-w-0">
                <span className={cn(
                  'text-sm font-medium',
                  isActive ? 'text-primary' : 'text-foreground',
                )}>
                  {label}
                </span>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                  {description}
                </p>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}
