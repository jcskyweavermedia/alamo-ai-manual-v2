import { useState } from 'react';
import { Calendar as CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { DateRange } from 'react-day-picker';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';

interface DateRangeSelectorProps {
  isEs?: boolean;
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
}

export function DateRangeSelector({
  isEs = false,
  dateRange,
  onDateRangeChange,
}: DateRangeSelectorProps) {
  const [open, setOpen] = useState(false);
  const locale = isEs ? es : undefined;

  const formatDate = (date: Date | undefined) => {
    if (!date) return '';
    return format(date, 'MMM dd', { locale });
  };

  const label =
    dateRange.from && dateRange.to
      ? `${formatDate(dateRange.from)} - ${formatDate(dateRange.to)}`
      : isEs
        ? 'Seleccionar rango'
        : 'Select range';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="hidden md:flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border border-border text-foreground"
        >
          <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          {label}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <Calendar
          mode="range"
          selected={dateRange}
          onSelect={(range) => {
            if (range) onDateRangeChange(range);
          }}
          numberOfMonths={2}
          locale={locale}
        />
      </PopoverContent>
    </Popover>
  );
}
