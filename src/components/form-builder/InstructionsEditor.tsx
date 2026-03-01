import { useBuilder } from '@/contexts/BuilderContext';

export function InstructionsEditor({ language }: { language: string }) {
  const { state, dispatch } = useBuilder();
  const isEn = state.instructionLanguage === 'en';

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          onClick={() => dispatch({ type: 'SET_INSTRUCTION_LANGUAGE', payload: 'en' })}
          className={`text-sm px-3 py-1 rounded ${isEn ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
        >
          English
        </button>
        <button
          onClick={() => dispatch({ type: 'SET_INSTRUCTION_LANGUAGE', payload: 'es' })}
          className={`text-sm px-3 py-1 rounded ${!isEn ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
        >
          Spanish
        </button>
      </div>
      <textarea
        value={isEn ? state.instructionsEn : state.instructionsEs}
        onChange={e =>
          dispatch({
            type: isEn ? 'SET_INSTRUCTIONS_EN' : 'SET_INSTRUCTIONS_ES',
            payload: e.target.value,
          })
        }
        placeholder={isEn ? 'Enter AI instructions...' : 'Ingrese instrucciones de IA...'}
        className="w-full min-h-[200px] p-3 text-sm rounded-lg border bg-background resize-y"
      />
    </div>
  );
}
