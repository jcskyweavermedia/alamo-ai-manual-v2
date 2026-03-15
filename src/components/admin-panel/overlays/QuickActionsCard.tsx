// =============================================================================
// QuickActionsCard -- 2x2 grid of action buttons (no-op)
// =============================================================================

import { Calendar, Send, Bell, MessageSquare } from 'lucide-react';
import { RoleGate } from '@/components/auth/RoleGate';
import { ADMIN_STRINGS } from '../strings';

interface QuickActionsCardProps {
  language: 'en' | 'es';
}

const ACTIONS = (t: (typeof ADMIN_STRINGS)['en']) =>
  [
    { icon: Calendar, label: t.schedule1on1 },
    { icon: Send, label: t.sendResource },
    { icon: Bell, label: t.nudge },
    { icon: MessageSquare, label: t.addNote },
  ] as const;

export function QuickActionsCard({ language }: QuickActionsCardProps) {
  const t = ADMIN_STRINGS[language];
  const actions = ACTIONS(t);

  return (
    <RoleGate allowedRoles={['manager', 'admin']}>
      <div className="rounded-2xl border bg-card p-4">
        <div className="text-xs font-semibold uppercase tracking-wider mb-3 text-muted-foreground">
          {t.quickActions}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {actions.map(({ icon: Icon, label }) => (
            <button
              key={label}
              type="button"
              onClick={() => {}}
              className="flex items-center gap-2 p-3 rounded-xl text-sm font-medium border border-border text-muted-foreground transition-colors hover:bg-muted/50"
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </div>
    </RoleGate>
  );
}
