import { useBuilder } from '@/contexts/BuilderContext';

export function AIToolsPicker({ language }: { language: string }) {
  const { state } = useBuilder();

  return (
    <div className="text-center py-12 text-muted-foreground">
      <p className="text-sm">AI Tools configuration — coming soon.</p>
      <p className="text-xs mt-1">{state.aiTools.length} tools configured</p>
    </div>
  );
}
