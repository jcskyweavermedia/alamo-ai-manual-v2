import { useState, useEffect } from 'react';
import { Link2, Unlink, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover';
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';
import { useSearchPrepRecipes } from '@/hooks/use-search-prep-recipes';
import { checkCircularRef } from '@/hooks/use-check-circular-ref';

interface SubRecipeLinkerProps {
  currentRef?: string;
  currentRefName?: string;
  excludeSlug?: string;
  /** Array of slugs to exclude from results (used by cocktail linked recipes) */
  excludeSlugs?: string[];
  /** Filter results by department */
  department?: 'kitchen' | 'bar';
  onLink: (slug: string, name: string) => void;
  onUnlink?: () => void;
}

export function SubRecipeLinker({ currentRef, currentRefName, excludeSlug, excludeSlugs, department, onLink, onUnlink }: SubRecipeLinkerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [checking, setChecking] = useState(false);

  const { results: rawResults, loading, error, reset } = useSearchPrepRecipes({
    query,
    enabled: open && !currentRef,
    excludeSlug,
    department,
  });

  // Filter out already-linked slugs (used by cocktail editor's multi-link pattern)
  const results = excludeSlugs?.length
    ? rawResults.filter((r) => !excludeSlugs.includes(r.slug))
    : rawResults;

  // Reset on close
  useEffect(() => {
    if (!open) {
      setQuery('');
      reset();
    }
  }, [open]);

  const isLinked = !!currentRef;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={isLinked ? `Linked to ${currentRefName || currentRef}. Open to unlink.` : 'Link to sub-recipe'}
          className={`h-7 w-7 shrink-0 ${
            isLinked
              ? 'text-emerald-600 hover:text-emerald-700'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Link2 className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-64 p-0" align="end" collisionPadding={8}>
        {isLinked ? (
          <div className="p-3 space-y-2">
            <p className="text-xs text-muted-foreground">Linked to sub-recipe:</p>
            <p className="text-sm font-medium line-clamp-2">{currentRefName || currentRef}</p>
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs"
              onClick={() => {
                onUnlink?.();
                setOpen(false);
              }}
            >
              <Unlink className="h-3 w-3 mr-1.5" />
              Unlink
            </Button>
          </div>
        ) : (
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search prep recipes..."
              value={query}
              onValueChange={setQuery}
            />
            <CommandList>
              {(loading || checking) && (
                <div className="flex items-center justify-center gap-2 py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  {checking && <span className="text-xs text-muted-foreground">Checking references...</span>}
                </div>
              )}
              {error && (
                <div className="flex items-center gap-2 px-3 py-4 text-xs text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
              {!loading && !error && query.trim().length >= 2 && results.length === 0 && (
                <CommandEmpty>No recipes found.</CommandEmpty>
              )}
              {!loading && !error && results.length > 0 && (
                <CommandGroup>
                  {results.map((r) => (
                    <CommandItem
                      key={r.id}
                      value={r.slug}
                      disabled={checking}
                      onSelect={async () => {
                        if (excludeSlug) {
                          setChecking(true);
                          const isCircular = await checkCircularRef(r.slug, excludeSlug);
                          setChecking(false);

                          if (isCircular) {
                            const confirmed = window.confirm(
                              `Warning: This creates a circular reference ("${r.name}" already references this recipe). Continue anyway?`
                            );
                            if (!confirmed) return;
                          }
                        }

                        onLink(r.slug, r.name);
                        setOpen(false);
                      }}
                    >
                      <div className="flex flex-col">
                        <span className="text-sm">{r.name}</span>
                        <span className="text-[10px] text-muted-foreground">{r.slug}</span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        )}
      </PopoverContent>
    </Popover>
  );
}
