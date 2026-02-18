import { cn } from '@/lib/utils';

interface ChatBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
  className?: string;
}

export function ChatBubble({ role, content, timestamp, className }: ChatBubbleProps) {
  const isUser = role === 'user';

  return (
    <div className={cn('flex w-full', isUser ? 'justify-end' : 'justify-start', className)}>
      <div className={cn(
        'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
        isUser
          ? 'bg-primary text-primary-foreground rounded-br-md'
          : 'bg-muted text-foreground rounded-bl-md'
      )}>
        <p className="whitespace-pre-wrap break-words">{content}</p>
        {timestamp && (
          <span className={cn(
            'block mt-1 text-[10px]',
            isUser ? 'text-primary-foreground/60' : 'text-muted-foreground/60'
          )}>
            {timestamp}
          </span>
        )}
      </div>
    </div>
  );
}
