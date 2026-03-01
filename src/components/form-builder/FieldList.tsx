import { useBuilder } from '@/contexts/BuilderContext';

export function FieldList({ language }: { language: string }) {
  const { state, dispatch } = useBuilder();

  if (state.fields.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-sm">No fields yet. Add your first field to get started.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {state.fields.map(field => (
        <div
          key={field.key}
          onClick={() => dispatch({ type: 'SET_SELECTED_FIELD', payload: field.key })}
          className={`p-3 rounded-lg border cursor-pointer transition-colors ${
            state.selectedFieldKey === field.key
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{field.label}</span>
            <span className="text-xs text-muted-foreground">{field.type}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
