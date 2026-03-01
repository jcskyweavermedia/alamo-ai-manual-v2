// =============================================================================
// AdminFormsListPage — Full admin forms management page
// Card grid with status filters, search, action menus, and bilingual support
// =============================================================================

import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Search,
  MoreVertical,
  Pencil,
  Copy,
  Archive,
  ArchiveRestore,
  Trash2,
  FileText,
  Globe,
  GlobeLock,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { resolveIcon } from '@/lib/form-builder/icon-utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAdminFormTemplates } from '@/hooks/useAdminFormTemplates';
import { useAuth } from '@/components/auth';
import { useGroupId } from '@/hooks/useGroupId';
import { generateSlug } from '@/lib/form-builder/builder-utils';
import { FormCreationDialog } from '@/components/form-builder/FormCreationDialog';
import type { FormTemplate, FormTemplateStatus } from '@/types/forms';

// =============================================================================
// STRINGS
// =============================================================================

const STRINGS = {
  en: {
    title: 'Form Templates',
    back: 'Admin',
    createNew: 'New Form',
    search: 'Search forms...',
    all: 'All',
    draft: 'Draft',
    published: 'Published',
    archived: 'Archived',
    fields: 'fields',
    version: 'v',
    edit: 'Edit',
    duplicate: 'Duplicate',
    publish: 'Publish',
    unpublish: 'Unpublish',
    archive: 'Archive',
    unarchive: 'Unarchive',
    delete: 'Delete',
    deleteBlocked: 'Cannot delete: has submissions',
    noForms: 'No form templates yet',
    noFormsDesc: 'Create your first form template to get started.',
    noResults: 'No matching templates',
    noResultsDesc: 'Try adjusting your search or filter.',
    loading: 'Loading templates...',
    error: 'Failed to load templates',
    deleteTitle: 'Delete Template',
    deleteDesc: 'Are you sure you want to delete this template? This action cannot be undone.',
    cancel: 'Cancel',
    confirm: 'Delete',
    duplicateSuccess: 'Template duplicated',
    archiveSuccess: 'Template archived',
    unarchiveSuccess: 'Template unarchived',
    deleteSuccess: 'Template deleted',
    lastUpdated: 'Updated',
  },
  es: {
    title: 'Plantillas de Formularios',
    back: 'Admin',
    createNew: 'Nuevo Formulario',
    search: 'Buscar formularios...',
    all: 'Todos',
    draft: 'Borrador',
    published: 'Publicado',
    archived: 'Archivado',
    fields: 'campos',
    version: 'v',
    edit: 'Editar',
    duplicate: 'Duplicar',
    publish: 'Publicar',
    unpublish: 'Despublicar',
    archive: 'Archivar',
    unarchive: 'Desarchivar',
    delete: 'Eliminar',
    deleteBlocked: 'No se puede eliminar: tiene envios',
    noForms: 'No hay plantillas de formularios',
    noFormsDesc: 'Crea tu primera plantilla para comenzar.',
    noResults: 'Sin resultados',
    noResultsDesc: 'Intenta ajustar tu busqueda o filtro.',
    loading: 'Cargando plantillas...',
    error: 'Error al cargar plantillas',
    deleteTitle: 'Eliminar Plantilla',
    deleteDesc: 'Estas seguro de que deseas eliminar esta plantilla? Esta accion no se puede deshacer.',
    cancel: 'Cancelar',
    confirm: 'Eliminar',
    duplicateSuccess: 'Plantilla duplicada',
    archiveSuccess: 'Plantilla archivada',
    unarchiveSuccess: 'Plantilla desarchivada',
    deleteSuccess: 'Plantilla eliminada',
    lastUpdated: 'Actualizado',
  },
};

// =============================================================================
// HELPERS
// =============================================================================

type StatusFilter = 'all' | FormTemplateStatus;

const statusBadgeStyles: Record<FormTemplateStatus, string> = {
  draft: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  published: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  archived: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400',
};

/** Format a date string as a simple relative time */
function formatRelativeTime(dateString: string, language: 'en' | 'es'): string {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const diffMs = now - then;

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return language === 'es' ? 'Ahora' : 'Just now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo`;

  const years = Math.floor(months / 12);
  return `${years}y`;
}

// =============================================================================
// PAGE COMPONENT
// =============================================================================

export default function AdminFormsListPage() {
  const navigate = useNavigate();
  const { language = 'en', user } = useAuth();
  const lang = (language === 'es' ? 'es' : 'en') as 'en' | 'es';
  const t = STRINGS[lang];
  const { templates, loading, error, refetch } = useAdminFormTemplates();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [deleteTarget, setDeleteTarget] = useState<FormTemplate | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const groupId = useGroupId();

  // Filter templates
  const filtered = useMemo(() => {
    let list = templates;
    if (statusFilter !== 'all') {
      list = list.filter((tmpl) => tmpl.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (tmpl) =>
          tmpl.titleEn.toLowerCase().includes(q) ||
          (tmpl.titleEs?.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [templates, statusFilter, search]);

  // Count per status
  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = { all: templates.length, draft: 0, published: 0, archived: 0 };
    for (const tmpl of templates) {
      if (tmpl.status in c) c[tmpl.status]++;
    }
    return c;
  }, [templates]);

  // Tabs
  const tabs: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: t.all },
    { key: 'draft', label: t.draft },
    { key: 'published', label: t.published },
    { key: 'archived', label: t.archived },
  ];

  // Action handlers
  const handleDuplicate = useCallback(
    async (template: FormTemplate) => {
      try {
        if (!groupId) return;

        const newSlug = generateSlug(`${template.titleEn} copy`);
        const { error: insertError } = await supabase.from('form_templates').insert({
          group_id: groupId,
          slug: newSlug,
          title_en: `${template.titleEn} (Copy)`,
          title_es: template.titleEs ? `${template.titleEs} (Copia)` : null,
          description_en: template.descriptionEn,
          description_es: template.descriptionEs,
          icon: template.icon,
          icon_color: template.iconColor ?? 'blue',
          fields: template.fields as unknown as Record<string, unknown>[],
          instructions_en: template.instructionsEn,
          instructions_es: template.instructionsEs,
          ai_tools: template.aiTools,
          status: 'draft',
          template_version: 1,
          created_by: user?.id,
        });

        if (insertError) throw insertError;

        toast.success(t.duplicateSuccess);
        refetch();
      } catch (err) {
        console.error('[AdminFormsList] Duplicate error:', err);
        toast.error(err instanceof Error ? err.message : 'Duplicate failed');
      }
    },
    [user?.id, groupId, refetch, t.duplicateSuccess],
  );

  const handlePublishToggle = useCallback(
    async (template: FormTemplate) => {
      const newStatus: FormTemplateStatus = template.status === 'published' ? 'draft' : 'published';
      try {
        const { error: updateError } = await supabase
          .from('form_templates')
          .update({ status: newStatus })
          .eq('id', template.id);

        if (updateError) throw updateError;

        toast.success(
          newStatus === 'published'
            ? (lang === 'es' ? 'Plantilla publicada' : 'Template published')
            : (lang === 'es' ? 'Plantilla despublicada' : 'Template unpublished'),
        );
        refetch();
      } catch (err) {
        console.error('[AdminFormsList] Publish toggle error:', err);
        toast.error(err instanceof Error ? err.message : 'Update failed');
      }
    },
    [refetch, lang],
  );

  const handleArchiveToggle = useCallback(
    async (template: FormTemplate) => {
      const newStatus: FormTemplateStatus = template.status === 'archived' ? 'draft' : 'archived';
      try {
        const { error: updateError } = await supabase
          .from('form_templates')
          .update({ status: newStatus })
          .eq('id', template.id);

        if (updateError) throw updateError;

        toast.success(newStatus === 'archived' ? t.archiveSuccess : t.unarchiveSuccess);
        refetch();
      } catch (err) {
        console.error('[AdminFormsList] Archive toggle error:', err);
        toast.error(err instanceof Error ? err.message : 'Update failed');
      }
    },
    [refetch, t.archiveSuccess, t.unarchiveSuccess],
  );

  const handleDelete = useCallback(
    async (template: FormTemplate) => {
      try {
        // Check for existing submissions before deleting (M6)
        const { count, error: countError } = await supabase
          .from('form_submissions')
          .select('id', { count: 'exact', head: true })
          .eq('template_id', template.id);

        if (countError) throw countError;

        if (count && count > 0) {
          toast.error(t.deleteBlocked);
          setDeleteTarget(null);
          return;
        }

        const { error: deleteError } = await supabase
          .from('form_templates')
          .delete()
          .eq('id', template.id);

        if (deleteError) throw deleteError;

        toast.success(t.deleteSuccess);
        setDeleteTarget(null);
        refetch();
      } catch (err) {
        console.error('[AdminFormsList] Delete error:', err);
        toast.error(err instanceof Error ? err.message : 'Delete failed');
      }
    },
    [refetch, t.deleteSuccess, t.deleteBlocked],
  );

  // Determine empty state type
  const hasTemplates = templates.length > 0;
  const hasResults = filtered.length > 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-md border-b">
        <div className="flex items-center justify-between max-w-5xl mx-auto px-4 py-3">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-semibold">{t.title}</h1>
          </div>
          <Button size="sm" onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            {t.createNew}
          </Button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-5 space-y-5">
        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.search}
            className="pl-9 rounded-xl"
          />
        </div>

        {/* Status filter tabs with counts */}
        <div className="flex gap-1 border-b">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors',
                statusFilter === tab.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.label}
              <span
                className={cn(
                  'text-[10px] font-semibold tabular-nums min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1',
                  statusFilter === tab.key
                    ? 'bg-primary/10 text-primary'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                {counts[tab.key]}
              </span>
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-flex items-center gap-2 text-muted-foreground">
              <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">{t.loading}</span>
            </div>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-sm text-destructive">{t.error}</p>
          </div>
        ) : !hasTemplates ? (
          /* Empty state -- no templates at all */
          <div className="text-center py-16 space-y-3">
            <div className="mx-auto h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              <FileText className="h-7 w-7 text-primary" />
            </div>
            <p className="text-base font-medium text-muted-foreground">{t.noForms}</p>
            <p className="text-sm text-muted-foreground">{t.noFormsDesc}</p>
            <Button className="mt-4" onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              {t.createNew}
            </Button>
          </div>
        ) : !hasResults ? (
          /* Empty state -- filter/search returned nothing */
          <div className="text-center py-12 space-y-2">
            <p className="text-base font-medium text-muted-foreground">{t.noResults}</p>
            <p className="text-sm text-muted-foreground">{t.noResultsDesc}</p>
          </div>
        ) : (
          /* Template card grid */
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                language={lang}
                t={t}
                onEdit={() => navigate(`/admin/forms/${template.id}/edit`)}
                onDuplicate={() => handleDuplicate(template)}
                onPublishToggle={() => handlePublishToggle(template)}
                onArchiveToggle={() => handleArchiveToggle(template)}
                onDelete={() => setDeleteTarget(template)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create form dialog */}
      <FormCreationDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        language={lang}
        onBlank={() => {
          setShowCreateDialog(false);
          navigate('/admin/forms/new');
        }}
        onAIBuilder={() => {
          setShowCreateDialog(false);
          navigate('/admin/forms/new', { state: { openAIBuilder: true } });
        }}
      />

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.deleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>{t.deleteDesc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
            >
              {t.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// =============================================================================
// TEMPLATE CARD
// =============================================================================

interface TemplateCardProps {
  template: FormTemplate;
  language: 'en' | 'es';
  t: (typeof STRINGS)['en'];
  onEdit: () => void;
  onDuplicate: () => void;
  onPublishToggle: () => void;
  onArchiveToggle: () => void;
  onDelete: () => void;
}

function TemplateCard({
  template,
  language,
  t,
  onEdit,
  onDuplicate,
  onPublishToggle,
  onArchiveToggle,
  onDelete,
}: TemplateCardProps) {
  const iconConfig = resolveIcon(template.icon, template.iconColor);
  const title = language === 'es' && template.titleEs ? template.titleEs : template.titleEn;
  const fieldCount = template.fields.length;
  const isArchived = template.status === 'archived';

  return (
    <div
      onClick={onEdit}
      className={cn(
        'group relative cursor-pointer',
        'rounded-[20px]',
        'border border-black/[0.04] dark:border-white/[0.06]',
        'shadow-card hover:shadow-md',
        'bg-card',
        'transition-shadow duration-200',
        'p-4',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {/* Icon tile */}
          <div
            className={cn(
              'flex items-center justify-center shrink-0',
              'h-10 w-10 rounded-[12px]',
              iconConfig.bg,
              iconConfig.darkBg,
            )}
          >
            <span className="text-[20px] leading-none">{iconConfig.emoji}</span>
          </div>

          {/* Text content */}
          <div className="min-w-0 flex-1">
            <p className="font-medium text-sm truncate text-foreground">{title}</p>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <Badge
                variant="secondary"
                className={cn(
                  'text-[10px] font-semibold px-1.5 py-0 h-[18px] border-0',
                  statusBadgeStyles[template.status],
                )}
              >
                {t[template.status] || template.status}
              </Badge>
              {template.templateVersion > 1 && (
                <span className="text-[10px] font-medium text-muted-foreground tabular-nums">
                  {t.version}{template.templateVersion}
                </span>
              )}
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {fieldCount} {t.fields}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1.5">
              {t.lastUpdated} {formatRelativeTime(template.updatedAt, language)}
            </p>
          </div>
        </div>

        {/* Actions dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
            >
              <Pencil className="h-4 w-4 mr-2" />
              {t.edit}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onDuplicate();
              }}
            >
              <Copy className="h-4 w-4 mr-2" />
              {t.duplicate}
            </DropdownMenuItem>
            {/* Publish/Unpublish (only for non-archived) */}
            {template.status !== 'archived' && (
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onPublishToggle();
                }}
              >
                {template.status === 'published' ? (
                  <GlobeLock className="h-4 w-4 mr-2" />
                ) : (
                  <Globe className="h-4 w-4 mr-2" />
                )}
                {template.status === 'published' ? t.unpublish : t.publish}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onArchiveToggle();
              }}
            >
              {isArchived ? (
                <ArchiveRestore className="h-4 w-4 mr-2" />
              ) : (
                <Archive className="h-4 w-4 mr-2" />
              )}
              {isArchived ? t.unarchive : t.archive}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {t.delete}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
