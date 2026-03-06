import type { Components } from 'react-markdown';

// =============================================================================
// COURSE CONTENT — Article-quality markdown for course builder canvas & learner
// Designed for readability: clear heading hierarchy, generous spacing, polished lists
// =============================================================================

export const courseMdComponents: Components = {
  h1: ({ children, ...props }) => (
    <h1 className="text-lg font-bold text-foreground mt-7 first:mt-0 mb-3" {...props}>
      {children}
    </h1>
  ),
  h2: ({ children, ...props }) => (
    <h2 className="text-[1.0625rem] font-bold text-foreground mt-7 first:mt-0 mb-3" {...props}>
      {children}
    </h2>
  ),
  h3: ({ children, ...props }) => (
    <h3 className="text-base font-bold text-foreground mt-6 first:mt-0 mb-2" {...props}>
      {children}
    </h3>
  ),
  h4: ({ children, ...props }) => (
    <h4 className="text-[0.9375rem] font-bold text-foreground mt-5 first:mt-0 mb-1.5" {...props}>
      {children}
    </h4>
  ),
  p: ({ children, ...props }) => (
    <p className="text-[0.9375rem] leading-[1.75] text-foreground/90 mb-4 last:mb-0" {...props}>
      {children}
    </p>
  ),
  ul: ({ children, ...props }) => (
    <ul className="my-3 ml-1.5 space-y-2.5 list-none" {...props}>
      {children}
    </ul>
  ),
  ol: ({ children, ...props }) => (
    <ol className="my-3 ml-1.5 space-y-2.5 list-none" style={{ counterReset: 'list-counter' }} {...props}>
      {children}
    </ol>
  ),
  li: ({ children, ordered, ...props }) => (
    <li
      className="relative pl-5 text-[0.9375rem] leading-[1.75] text-foreground/90"
      style={ordered ? { counterIncrement: 'list-counter' } : undefined}
      {...props}
    >
      {!ordered && (
        <span className="absolute left-1 top-[0.6em] w-[5px] h-[5px] rounded-full bg-foreground/50" aria-hidden />
      )}
      {children}
    </li>
  ),
  strong: ({ children, ...props }) => (
    <strong className="font-bold text-foreground" {...props}>{children}</strong>
  ),
  em: ({ children, ...props }) => (
    <em className="italic" {...props}>{children}</em>
  ),
  blockquote: ({ children, ...props }) => (
    <blockquote className="border-l-[3px] border-border/60 pl-4 pr-3 py-1 my-4 text-[0.9375rem] text-foreground/75 italic [&>p]:mb-2 [&>p:last-child]:mb-0" {...props}>
      {children}
    </blockquote>
  ),
  a: ({ children, href, ...props }) => (
    <a className="text-primary font-medium underline underline-offset-2 decoration-primary/40 hover:decoration-primary/80 transition-colors" href={href} target="_blank" rel="noopener noreferrer" {...props}>
      {children}
    </a>
  ),
  hr: ({ ...props }) => (
    <hr className="my-6 border-t border-border/50" {...props} />
  ),
  table: ({ children, ...props }) => (
    <div className="my-4 overflow-x-auto rounded-lg border border-border/60">
      <table className="w-full text-[0.9375rem]" {...props}>{children}</table>
    </div>
  ),
  thead: ({ children, ...props }) => (
    <thead className="bg-muted/50 border-b border-border/60" {...props}>{children}</thead>
  ),
  th: ({ children, ...props }) => (
    <th className="px-3 py-2.5 text-left text-xs font-semibold text-foreground/70 uppercase tracking-wider" {...props}>{children}</th>
  ),
  td: ({ children, ...props }) => (
    <td className="px-3 py-2.5 text-[0.9375rem] text-foreground/85 border-t border-border/30" {...props}>{children}</td>
  ),
  tr: ({ children, ...props }) => (
    <tr className="even:bg-muted/25" {...props}>{children}</tr>
  ),
  pre: ({ children, ...props }) => (
    <pre className="bg-muted/60 rounded-lg p-4 my-4 overflow-x-auto text-sm leading-relaxed border border-border/40" {...props}>{children}</pre>
  ),
  code: ({ children, className, ...props }) => {
    const isBlock = typeof className === 'string' && className.startsWith('language-');
    if (isBlock) {
      return <code className="font-mono text-sm" {...props}>{children}</code>;
    }
    return (
      <code className="bg-muted/70 text-foreground/90 rounded px-1.5 py-0.5 text-sm font-mono border border-border/30" {...props}>
        {children}
      </code>
    );
  },
};

// =============================================================================
// CHAT BUBBLES — Compact markdown for AI chat panels (text-sm, tight spacing)
// =============================================================================

/** Compact markdown component overrides for chat bubbles (text-sm sized). */
export const chatMdComponents: Components = {
  h1: ({ children, ...props }) => (
    <h1 className="text-sm font-bold mt-2 mb-1" {...props}>{children}</h1>
  ),
  h2: ({ children, ...props }) => (
    <h2 className="text-sm font-bold mt-2 mb-1" {...props}>{children}</h2>
  ),
  h3: ({ children, ...props }) => (
    <h3 className="text-sm font-semibold mt-1.5 mb-0.5" {...props}>{children}</h3>
  ),
  p: ({ children, ...props }) => (
    <p className="text-sm leading-relaxed mb-1.5 last:mb-0" {...props}>{children}</p>
  ),
  ul: ({ children, ...props }) => (
    <ul className="list-disc pl-4 mb-1.5 space-y-0.5 text-sm" {...props}>{children}</ul>
  ),
  ol: ({ children, ...props }) => (
    <ol className="list-decimal pl-4 mb-1.5 space-y-0.5 text-sm" {...props}>{children}</ol>
  ),
  li: ({ children, ...props }) => (
    <li className="text-sm leading-relaxed" {...props}>{children}</li>
  ),
  strong: ({ children, ...props }) => (
    <strong className="font-bold" {...props}>{children}</strong>
  ),
  em: ({ children, ...props }) => (
    <em className="italic" {...props}>{children}</em>
  ),
  blockquote: ({ children, ...props }) => (
    <blockquote className="border-l-2 border-primary/30 pl-2 my-1 text-muted-foreground italic text-sm" {...props}>{children}</blockquote>
  ),
  a: ({ children, href, ...props }) => (
    <a className="text-primary underline underline-offset-2" href={href} target="_blank" rel="noopener noreferrer" {...props}>{children}</a>
  ),
  pre: ({ children, ...props }) => (
    <pre className="bg-background/50 rounded-md p-2 my-1.5 overflow-x-auto text-xs" {...props}>{children}</pre>
  ),
  code: ({ children, className, ...props }) => {
    // Fenced code blocks get wrapped in <pre> by react-markdown, so className contains "language-*"
    const isBlock = typeof className === 'string' && className.startsWith('language-');
    if (isBlock) {
      return <code className="font-mono text-xs" {...props}>{children}</code>;
    }
    return <code className="bg-background/50 rounded px-1 py-0.5 text-xs font-mono" {...props}>{children}</code>;
  },
};
