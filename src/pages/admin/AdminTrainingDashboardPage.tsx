// =============================================================================
// AdminTrainingDashboardPage — Top-level admin panel page
// Wraps AdminPanelShell (3-tab: Our Team | Courses | AI Hub) inside AppShell
// =============================================================================

import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';
import { AppShell } from '@/components/layout/AppShell';
import { AdminPanelShell } from '@/components/admin-panel/AdminPanelShell';

// =============================================================================
// STRINGS
// =============================================================================

const STRINGS = {
  en: { adminPanel: 'Admin Panel', alamoPrime: 'Alamo Prime', back: 'Back' },
  es: { adminPanel: 'Panel Admin', alamoPrime: 'Alamo Prime', back: 'Volver' },
};

// =============================================================================
// PAGE COMPONENT
// =============================================================================

export default function AdminTrainingDashboardPage() {
  const navigate = useNavigate();
  const { language, setLanguage } = useLanguage();
  const lang = (language === 'es' ? 'es' : 'en') as 'en' | 'es';
  const t = STRINGS[lang];

  // ---------------------------------------------------------------------------
  // AppShell header elements
  // ---------------------------------------------------------------------------

  const headerLeft = (
    <button
      onClick={() => navigate('/admin')}
      className="flex items-center justify-center shrink-0 h-9 w-9 rounded-lg
        bg-orange-500 text-white hover:bg-orange-600 active:scale-[0.96]
        shadow-sm transition-all duration-150"
      title={t.back}
    >
      <ArrowLeft className="h-4 w-4" />
    </button>
  );

  const headerToolbar = (
    <div className="flex items-center gap-2 min-w-0">
      <h1 className="text-sm font-semibold text-foreground truncate">{t.adminPanel}</h1>
      <span className="hidden sm:inline text-xs text-muted-foreground">{t.alamoPrime}</span>
    </div>
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <AppShell
      language={language}
      onLanguageChange={setLanguage}
      showSearch={false}
      headerLeft={headerLeft}
      headerToolbar={headerToolbar}
    >
      <AdminPanelShell language={lang} />
    </AppShell>
  );
}
