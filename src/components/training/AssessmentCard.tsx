import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { LucideIcon } from 'lucide-react';

interface AssessmentCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  statusLabel: string;
  statusVariant: 'default' | 'success' | 'warning' | 'info';
  onClick: () => void;
  disabled?: boolean;
}

const VARIANT_CLASSES: Record<string, string> = {
  default: 'bg-muted text-muted-foreground',
  success: 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
  info: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400',
};

export function AssessmentCard({
  icon: Icon,
  title,
  description,
  statusLabel,
  statusVariant,
  onClick,
  disabled = false,
}: AssessmentCardProps) {
  return (
    <Card
      className={cn(
        'cursor-pointer hover:shadow-elevated transition-shadow duration-200',
        disabled && 'opacity-50 pointer-events-none'
      )}
      onClick={disabled ? undefined : onClick}
    >
      <CardContent className="flex items-start gap-3 p-4">
        <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10 shrink-0">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-sm font-semibold text-foreground">{title}</h4>
            <Badge
              variant="secondary"
              className={cn('text-[10px] px-1.5 py-0 border-0', VARIANT_CLASSES[statusVariant])}
            >
              {statusLabel}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
}
