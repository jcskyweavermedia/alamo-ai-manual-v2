import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface CrossNavButtonProps {
  label: string;
  targetPath: '/recipes' | '/dish-guide';
  targetSlug: string;
  className?: string;
}

export function CrossNavButton({ label, targetPath, targetSlug, className }: CrossNavButtonProps) {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => navigate(`${targetPath}?slug=${encodeURIComponent(targetSlug)}`)}
      className={cn(
        'inline-flex items-center gap-1.5',
        'rounded-full px-3 py-1.5',
        'text-xs font-semibold',
        'bg-blue-50 text-blue-700',
        'dark:bg-blue-900/30 dark:text-blue-300',
        'shadow-sm active:scale-[0.97]',
        'transition-all duration-150',
        className
      )}
    >
      {label}
      <ArrowRight className="h-3 w-3" />
    </button>
  );
}
