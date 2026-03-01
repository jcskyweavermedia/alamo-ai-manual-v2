import { cn } from '@/lib/utils';

interface TimePillOption {
  value: string;
  label: string;
  hiddenOnMobile?: boolean;
}

interface TimePillBarProps {
  options: TimePillOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  bgClassName?: string;
}

export function TimePillBar({
  options,
  value,
  onChange,
  className,
  bgClassName = 'bg-muted',
}: TimePillBarProps) {
  return (
    <div
      className={cn(
        'inline-flex rounded-full p-[3px] gap-0.5',
        bgClassName,
        className,
      )}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          aria-current={value === opt.value ? 'page' : undefined}
          className={cn(
            'px-3.5 py-1.5 rounded-full text-[13px] font-medium whitespace-nowrap transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#F97316] focus:ring-offset-1',
            opt.hiddenOnMobile && 'hidden sm:block',
            value === opt.value
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
