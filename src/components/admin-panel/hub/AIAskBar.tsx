// =============================================================================
// AIAskBar -- Bottom AI chat input bar with form submission
// =============================================================================

import { useState, type FormEvent } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { ADMIN_STRINGS } from '../strings';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AIAskBarProps {
  language: 'en' | 'es';
  onSubmit?: (question: string) => void;
  isLoading?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AIAskBar({ language, onSubmit, isLoading = false }: AIAskBarProps) {
  const t = ADMIN_STRINGS[language];
  const [value, setValue] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || isLoading) return;
    onSubmit?.(trimmed);
    setValue('');
  };

  return (
    <div className="bg-card rounded-2xl border border-black/[0.04] dark:border-white/[0.06] p-4">
      <form onSubmit={handleSubmit} className="flex items-center gap-3">
        {/* Sparkles icon */}
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-orange-500">
          <Sparkles
            className="h-4 w-4 text-white"
            style={{ filter: 'drop-shadow(0 0 4px rgba(249,115,22,0.5))' }}
          />
        </div>

        {/* Input */}
        <input
          type="text"
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder={t.askAiPlaceholder}
          className="flex-1 text-sm bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
          disabled={isLoading}
        />

        {/* Ask AI button */}
        <button
          type="submit"
          disabled={isLoading || !value.trim()}
          className="px-4 py-2 text-sm font-semibold rounded-xl text-white bg-orange-500 hover:bg-orange-600 transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            t.askAi
          )}
        </button>
      </form>
    </div>
  );
}
