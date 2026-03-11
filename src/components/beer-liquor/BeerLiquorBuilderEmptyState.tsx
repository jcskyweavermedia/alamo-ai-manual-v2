import { Beer } from 'lucide-react';

export function BeerLiquorBuilderEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <div className="h-16 w-16 rounded-2xl bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center mb-5">
        <Beer className="h-8 w-8 text-orange-500" />
      </div>
      <h2 className="text-2xl font-bold text-foreground mb-2">
        Start Building Your List
      </h2>
      <p className="text-sm text-muted-foreground max-w-xs">
        Use the AI panel on the right to describe a beer or spirit and I'll add it to the list.
      </p>
    </div>
  );
}
