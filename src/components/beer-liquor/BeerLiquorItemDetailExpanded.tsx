// =============================================================================
// BeerLiquorItemDetailExpanded — Inline detail panel shown below the table row
// Phase 1 UI Shell: read-only fields, photo upload stubs, delete confirmation
// =============================================================================

import { X, Camera, Sparkles, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import type { BeerLiquorItem } from '@/types/products';

// =============================================================================
// PROPS
// =============================================================================

interface BeerLiquorItemDetailExpandedProps {
  item: BeerLiquorItem;
  onClose: () => void;
  onDeleteItem: (id: string) => void;
}

// =============================================================================
// FIELD LABEL + VALUE
// =============================================================================

function FieldDisplay({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-0.5">
        {label}
      </p>
      <p className="text-sm text-foreground">{value}</p>
    </div>
  );
}

// =============================================================================
// COMPONENT
// =============================================================================

export function BeerLiquorItemDetailExpanded({
  item,
  onClose,
  onDeleteItem,
}: BeerLiquorItemDetailExpandedProps) {
  const { toast } = useToast();

  const handleComingSoon = () => {
    toast({
      title: 'Coming soon',
      description: 'This feature will be available in Phase 2.',
    });
  };

  const handleDeleteConfirm = () => {
    onDeleteItem(item.id);
    toast({
      title: 'Coming soon',
      description: 'Delete will be wired in Phase 2.',
    });
  };

  return (
    <div className="rounded-xl border bg-card shadow-sm mt-4 overflow-hidden">
      {/* ===================== Header ===================== */}
      <div className="flex items-start justify-between px-4 pt-4 pb-3 border-b">
        <div className="flex flex-wrap items-center gap-2 min-w-0 flex-1 pr-2">
          <span className="font-semibold text-sm text-foreground truncate">
            {item.name}
          </span>
          <Badge
            variant="outline"
            className={cn(
              'text-[11px] font-bold uppercase tracking-wide px-2 py-0',
              item.category === 'Beer'
                ? 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700'
                : 'bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-700',
            )}
          >
            {item.category}
          </Badge>
          {item.subcategory && (
            <Badge
              variant="outline"
              className="text-[11px] font-medium px-2 py-0 text-muted-foreground"
            >
              {item.subcategory}
            </Badge>
          )}
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
          onClick={onClose}
          aria-label="Close detail panel"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* ===================== Content — 4 columns ===================== */}
      <div className="px-4 py-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

          {/* Col 1 — Image + photo actions */}
          <div className="flex flex-col gap-3">
            {/* Image */}
            <div className="rounded-lg overflow-hidden border border-border bg-muted aspect-square flex items-center justify-center">
              {item.image ? (
                <img
                  src={item.image}
                  alt={item.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center gap-1.5 text-muted-foreground/50">
                  <Camera className="h-6 w-6" />
                  <span className="text-[11px]">No Image</span>
                </div>
              )}
            </div>
            {/* Photo actions */}
            <div className="flex gap-1.5">
              <Button variant="outline" size="sm" className="flex-1 gap-1 text-xs px-2" onClick={handleComingSoon}>
                <Camera className="h-3 w-3 shrink-0" />
                Upload
              </Button>
              <Button variant="outline" size="sm" className="flex-1 gap-1 text-xs px-2" onClick={handleComingSoon}>
                <Sparkles className="h-3 w-3 shrink-0" />
                AI
              </Button>
            </div>
            {/* Producer + Country */}
            <div className="space-y-2">
              <FieldDisplay label="Producer" value={item.producer} />
              <FieldDisplay label="Country" value={item.country} />
            </div>
          </div>

          {/* Col 2 — Style */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-1.5">
              Style
            </p>
            <div className="flex items-start gap-2">
              <span className={cn(
                'flex items-center justify-center shrink-0 mt-0.5',
                'w-7 h-7 rounded-full',
                'bg-amber-100 dark:bg-amber-900/30',
              )}>
                <span className="text-[14px] h-[14px] leading-[14px]">
                  {item.category === 'Beer' ? '🍺' : '🥃'}
                </span>
              </span>
              <p className="text-sm text-foreground leading-relaxed">{item.style}</p>
            </div>
          </div>

          {/* Col 3 — Description */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-1.5">
              Description
            </p>
            <p className="text-sm text-foreground leading-relaxed">
              {item.description}
            </p>
          </div>

          {/* Col 4 — Service Notes */}
          {item.notes && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-1.5">
                Service Notes
              </p>
              <p className="text-sm text-foreground leading-relaxed">
                {item.notes}
              </p>
            </div>
          )}
        </div>

        {/* ===================== Delete section ===================== */}
        <div className="border-t mt-4 pt-4">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" className="gap-1.5">
                <Trash2 className="h-3.5 w-3.5" />
                Delete Item
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {item.name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently remove this item from the list. This
                  action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={handleDeleteConfirm}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}