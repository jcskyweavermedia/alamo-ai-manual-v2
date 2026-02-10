import { useState, useEffect, useRef } from 'react';
import { Copy, Check, Loader2, AlertCircle } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAskProduct } from '@/hooks/use-ask-product';
import type { BeerLiquorItem } from '@/types/products';
import type { BeerLiquorAIAction } from '@/data/mock-beer-liquor';
import { BEER_LIQUOR_AI_ACTIONS } from '@/data/mock-beer-liquor';

interface BeerLiquorAISheetProps {
  item: BeerLiquorItem;
  action: BeerLiquorAIAction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BeerLiquorAISheet({ item, action, open, onOpenChange }: BeerLiquorAISheetProps) {
  const { askProduct, isLoading, result, error, clearResult, clearError } = useAskProduct();
  const [copied, setCopied] = useState(false);
  const [freeformQuestion, setFreeformQuestion] = useState('');
  const prevActionRef = useRef<string | null>(null);

  const actionLabel = BEER_LIQUOR_AI_ACTIONS.find(a => a.key === action)?.label ?? '';

  useEffect(() => {
    if (!action || !open) return;
    if (action === prevActionRef.current) return;
    prevActionRef.current = action;

    if (action === 'questions') return;

    clearResult();
    clearError();

    askProduct(actionLabel, {
      domain: 'beer_liquor',
      actionOptions: {
        action,
        itemContext: item as unknown as Record<string, unknown>,
      },
    });
  }, [action, open]);

  useEffect(() => {
    if (!open) {
      prevActionRef.current = null;
      clearResult();
      clearError();
      setFreeformQuestion('');
    }
  }, [open]);

  function handleAskQuestion() {
    if (!freeformQuestion.trim()) return;
    clearResult();
    askProduct(freeformQuestion.trim(), {
      domain: 'beer_liquor',
      actionOptions: {
        action: 'questions',
        itemContext: item as unknown as Record<string, unknown>,
      },
    });
  }

  const responseText = result?.answer ?? '';

  function handleCopy() {
    if (!responseText) return;
    navigator.clipboard.writeText(responseText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (!action) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[70vh] flex flex-col rounded-t-xl">
        <SheetHeader className="shrink-0">
          <SheetTitle>{actionLabel}</SheetTitle>
          <SheetDescription>{item.name}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-4">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Thinking...</span>
            </div>
          )}

          {error && !isLoading && (
            <div className="flex flex-col items-center gap-2 py-8">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {responseText && !isLoading && (
            <div className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
              {responseText}
            </div>
          )}

          {action === 'questions' && !isLoading && (
            <div className="flex gap-2 mt-4">
              <Input
                value={freeformQuestion}
                onChange={(e) => setFreeformQuestion(e.target.value)}
                placeholder="Ask anything about this beverage..."
                onKeyDown={(e) => e.key === 'Enter' && handleAskQuestion()}
              />
              <Button size="sm" onClick={handleAskQuestion} disabled={!freeformQuestion.trim()}>
                Ask
              </Button>
            </div>
          )}
        </div>

        <SheetFooter className="shrink-0 border-t pt-3">
          {result?.citations && result.citations.length > 0 && (
            <div className="flex-1 text-xs text-muted-foreground">
              Sources: {result.citations.map(c => c.name).join(', ')}
            </div>
          )}
          <Button variant="ghost" size="sm" onClick={handleCopy} disabled={!responseText} className="gap-2">
            {copied ? <><Check className="h-4 w-4" /> Copied</> : <><Copy className="h-4 w-4" /> Copy</>}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
