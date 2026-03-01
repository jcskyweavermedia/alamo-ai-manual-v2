import { Sparkles } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

interface AIChatButtonProps {
  isEs?: boolean;
  onClick?: () => void;
}

export function AIChatButton({ isEs = false, onClick }: AIChatButtonProps) {
  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      alert(isEs ? 'Próximamente' : 'Coming Soon');
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={handleClick}
          className="fixed bottom-[calc(72px+1.5rem)] sm:bottom-6 right-6 z-[100] w-14 h-14 rounded-full bg-[#F97316] shadow-floating flex items-center justify-center hover:scale-[1.08] active:scale-95 transition-transform duration-150"
          aria-label={isEs ? 'Preguntar sobre reseñas' : 'Ask about reviews'}
        >
          <Sparkles className="h-6 w-6 text-white" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="left">
        {isEs ? 'Preguntar sobre reseñas' : 'Ask about reviews'}
      </TooltipContent>
    </Tooltip>
  );
}
