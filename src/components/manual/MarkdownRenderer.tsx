/**
 * MarkdownRenderer
 * 
 * Transforms Markdown content into styled React components
 * using the design system typography and UI components.
 * 
 * Features:
 * - Custom headings (PageTitle, SectionTitle, Subsection)
 * - Styled lists, tables, and code blocks
 * - Callout detection from blockquotes (Critical/Tip/Note)
 * - Horizontal scroll for tables on mobile
 * - Memoized for performance
 */

import { memo } from 'react';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
import { PageTitle, SectionTitle, Subsection, BodyText } from '@/components/ui/typography';
import { Callout } from '@/components/ui/callout';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import type { Components } from 'react-markdown';
import type { ReactNode } from 'react';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

/**
 * Parse blockquote content to detect callout type
 * Looks for patterns like:
 * - **⚠️ Critical**: ...
 * - **💡 Tip**: ...
 * - **ℹ️ Note**: ...
 */
function parseCalloutType(children: ReactNode): {
  variant: 'critical' | 'warning' | 'tip' | 'info';
  title: string;
  content: ReactNode;
} | null {
  // Convert children to string to check for callout patterns
  const childArray = Array.isArray(children) ? children : [children];
  
  // Find the first paragraph element
  const firstChild = childArray[0];
  if (!firstChild || typeof firstChild !== 'object') return null;
  
  // Get text content from the paragraph
  const props = (firstChild as React.ReactElement).props;
  if (!props?.children) return null;
  
  const textContent = extractTextContent(props.children);
  
  // Check for callout patterns
  const patterns: Array<{
    regex: RegExp;
    variant: 'critical' | 'warning' | 'tip' | 'info';
    title: string;
  }> = [
    { regex: /^\*\*⚠️\s*Cr[ií]tic[oa]?\*\*:?\s*/i, variant: 'critical', title: 'Critical' },
    { regex: /^\*\*⚠️\s*Warning\*\*:?\s*/i, variant: 'warning', title: 'Warning' },
    { regex: /^\*\*💡\s*(Tip|Consejo)\*\*:?\s*/i, variant: 'tip', title: 'Tip' },
    { regex: /^\*\*ℹ️\s*(Note|Nota)\*\*:?\s*/i, variant: 'info', title: 'Note' },
  ];

  for (const pattern of patterns) {
    if (pattern.regex.test(textContent)) {
      // Remove the pattern from content
      const cleanContent = textContent.replace(pattern.regex, '');
      return {
        variant: pattern.variant,
        title: pattern.title,
        content: cleanContent,
      };
    }
  }

  return null;
}

/**
 * Recursively extract text content from React children
 */
function extractTextContent(children: ReactNode): string {
  if (typeof children === 'string') return children;
  if (typeof children === 'number') return String(children);
  if (!children) return '';
  
  if (Array.isArray(children)) {
    return children.map(extractTextContent).join('');
  }
  
  if (typeof children === 'object' && 'props' in children) {
    return extractTextContent((children as React.ReactElement).props?.children);
  }
  
  return '';
}

/**
 * Generate slug ID from text
 */
function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

/**
 * Custom components for react-markdown
 */
const components: Components = {
  // Headings
  h1: ({ children, ...props }) => (
    <h1 className="text-[1.75rem] font-bold leading-[1.2] tracking-tight mb-lg text-foreground" {...props}>
      {children}
    </h1>
  ),
  
  h2: ({ children, ...props }) => {
    const text = extractTextContent(children);
    const id = slugify(text);
    return (
      <h2 id={id} className="text-[1.5rem] font-bold leading-[1.25] tracking-tight mt-12 mb-md pb-sm border-b border-border scroll-mt-20 text-foreground" {...props}>
        {children}
      </h2>
    );
  },
  
  h3: ({ children, ...props }) => {
    const text = extractTextContent(children);
    const id = slugify(text);
    return (
      <h3 id={id} className="text-[1.25rem] font-semibold leading-[1.3] mt-8 mb-sm scroll-mt-20 text-foreground" {...props}>
        {children}
      </h3>
    );
  },
  
  h4: ({ children, ...props }) => (
    <h4 className="text-base font-semibold mt-lg mb-sm text-muted-foreground" {...props}>
      {children}
    </h4>
  ),
  
  // Paragraphs
  p: ({ children, ...props }) => (
    <BodyText className="mb-md leading-relaxed" {...props}>
      {children}
    </BodyText>
  ),
  
  // Blockquotes → Callouts
  blockquote: ({ children }) => {
    const calloutInfo = parseCalloutType(children);
    
    if (calloutInfo) {
      return (
        <Callout variant={calloutInfo.variant} title={calloutInfo.title} className="my-lg">
          {calloutInfo.content}
        </Callout>
      );
    }
    
    // Default blockquote styling
    return (
      <Callout variant="info" className="my-lg">
        {children}
      </Callout>
    );
  },
  
  // Lists
  ul: ({ children, ...props }) => (
    <ul className="list-disc pl-6 mb-md space-y-sm text-body text-foreground marker:text-primary/40" {...props}>
      {children}
    </ul>
  ),
  
  ol: ({ children, ...props }) => (
    <ol className="list-decimal pl-6 mb-md space-y-sm text-body text-foreground marker:text-primary/40" {...props}>
      {children}
    </ol>
  ),
  
  li: ({ children, ...props }) => (
    <li className="text-body leading-relaxed" {...props}>
      {children}
    </li>
  ),
  
  // Tables
  table: ({ children, ...props }) => (
    <div className="overflow-x-auto my-lg -mx-4 px-4 md:mx-0 md:px-0">
      <Table className="min-w-full" {...props}>
        {children}
      </Table>
    </div>
  ),
  
  thead: ({ children, ...props }) => (
    <TableHeader {...props}>{children}</TableHeader>
  ),
  
  tbody: ({ children, ...props }) => (
    <TableBody {...props}>{children}</TableBody>
  ),
  
  tr: ({ children, ...props }) => (
    <TableRow {...props}>{children}</TableRow>
  ),
  
  th: ({ children, ...props }) => (
    <TableHead className="text-left font-semibold" {...props}>
      {children}
    </TableHead>
  ),
  
  td: ({ children, ...props }) => (
    <TableCell {...props}>{children}</TableCell>
  ),
  
  // Code
  code: ({ children, className, ...props }) => {
    const isBlock = className?.includes('language-');
    
    if (isBlock) {
      return (
        <pre className="bg-muted rounded-card p-md overflow-x-auto my-lg">
          <code className={cn("text-small font-mono text-foreground", className)} {...props}>
            {children}
          </code>
        </pre>
      );
    }
    
    return (
      <code 
        className="bg-muted px-1.5 py-0.5 rounded text-small font-mono text-foreground" 
        {...props}
      >
        {children}
      </code>
    );
  },
  
  pre: ({ children }) => <>{children}</>,
  
  // Horizontal rule
  hr: () => <Separator className="my-xl" />,
  
  // Links
  a: ({ children, href, ...props }) => (
    <a
      href={href}
      className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
      target={href?.startsWith('http') ? '_blank' : undefined}
      rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
      {...props}
    >
      {children}
    </a>
  ),
  
  // Strong/emphasis
  strong: ({ children, ...props }) => (
    <strong className="font-bold text-foreground" {...props}>
      {children}
    </strong>
  ),
  
  em: ({ children, ...props }) => (
    <em className="italic" {...props}>
      {children}
    </em>
  ),
  
  // Images
  img: ({ src, alt, ...props }) => (
    <img
      src={src}
      alt={alt || ''}
      className="max-w-full h-auto rounded-card my-lg"
      loading="lazy"
      {...props}
    />
  ),
};

export const MarkdownRenderer = memo(function MarkdownRenderer({ 
  content, 
  className 
}: MarkdownRendererProps) {
  return (
    <div className={cn("prose-manual", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
});
