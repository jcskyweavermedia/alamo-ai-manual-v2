// =============================================================================
// AdminCourseListPage — List all courses with "Create Course" button
// Uses AppShell for sidebar/header, matches Recipes page patterns
// =============================================================================

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Search,
  X,
  MoreVertical,
  Pencil,
  Archive,
  ArchiveRestore,
  Trash2,
  Globe,
  GlobeLock,
  ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
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
import { useGroupId } from '@/hooks/useGroupId';
import { useLanguage } from '@/hooks/use-language';
import { AppShell } from '@/components/layout/AppShell';
import { CourseWizardDialog } from '@/components/course-builder/wizard/CourseWizardDialog';
import { MenuRolloutWizard } from '@/components/course-builder/wizard/MenuRolloutWizard';
import type { CourseStatus, CourseType } from '@/types/course-builder';

// =============================================================================
// EMOJI MAP (matches training CourseCard)
// =============================================================================

const COURSE_EMOJI: Record<string, { emoji: string; bg: string; darkBg: string }> = {
  Landmark:        { emoji: '🏛️', bg: 'bg-slate-100',  darkBg: 'dark:bg-slate-800' },
  Beef:            { emoji: '🥩', bg: 'bg-red-100',    darkBg: 'dark:bg-red-900/30' },
  UtensilsCrossed: { emoji: '🍽️', bg: 'bg-amber-100',  darkBg: 'dark:bg-amber-900/30' },
  Wine:            { emoji: '🍷', bg: 'bg-rose-100',   darkBg: 'dark:bg-rose-900/30' },
  Martini:         { emoji: '🍸', bg: 'bg-sky-100',    darkBg: 'dark:bg-sky-900/30' },
  Beer:            { emoji: '🍺', bg: 'bg-amber-100',  darkBg: 'dark:bg-amber-900/30' },
  CakeSlice:       { emoji: '🍰', bg: 'bg-pink-100',   darkBg: 'dark:bg-pink-900/30' },
  GraduationCap:   { emoji: '🎓', bg: 'bg-blue-100',   darkBg: 'dark:bg-blue-900/30' },
  ChefHat:         { emoji: '👨‍🍳', bg: 'bg-orange-100', darkBg: 'dark:bg-orange-900/30' },
  Users:           { emoji: '👥', bg: 'bg-indigo-100',  darkBg: 'dark:bg-indigo-900/30' },
  BookOpen:        { emoji: '📖', bg: 'bg-cyan-100',   darkBg: 'dark:bg-cyan-900/30' },
  ClipboardList:   { emoji: '📋', bg: 'bg-green-100',  darkBg: 'dark:bg-green-900/30' },
  Utensils:        { emoji: '🍴', bg: 'bg-red-100',    darkBg: 'dark:bg-red-900/30' },
  Sparkles:        { emoji: '✨', bg: 'bg-amber-100',  darkBg: 'dark:bg-amber-900/30' },
  Star:            { emoji: '⭐', bg: 'bg-yellow-100', darkBg: 'dark:bg-yellow-900/30' },
  Shield:          { emoji: '🛡️', bg: 'bg-slate-100',  darkBg: 'dark:bg-slate-800' },
  Heart:           { emoji: '❤️', bg: 'bg-red-100',    darkBg: 'dark:bg-red-900/30' },
  Flame:           { emoji: '🔥', bg: 'bg-orange-100', darkBg: 'dark:bg-orange-900/30' },
  Award:           { emoji: '🏆', bg: 'bg-amber-100',  darkBg: 'dark:bg-amber-900/30' },
};
const defaultEmoji = { emoji: '📚', bg: 'bg-slate-100', darkBg: 'dark:bg-slate-800' };

// =============================================================================
// STRINGS
// =============================================================================

const STRINGS = {
  en: {
    heroLine1: 'Build with',
    heroLine2: 'Purpose',
    subtitle: 'Create and manage your training courses.',
    back: 'Back',
    createNew: 'New',
    search: 'Search courses...',
    all: 'All',
    draft: 'Draft',
    published: 'Published',
    archived: 'Archived',
    sections: 'sections',
    section: 'section',
    rollout: 'Rollout',
    more: 'more',
    less: 'less',
    edit: 'Edit',
    publish: 'Publish',
    unpublish: 'Unpublish',
    archive: 'Archive',
    unarchive: 'Unarchive',
    delete: 'Delete',
    noCourses: 'No courses yet',
    noCoursesDesc: 'Create your first course to get started.',
    noResults: 'No matching courses',
    noResultsDesc: 'Try adjusting your search or filter.',
    loading: 'Loading courses...',
    error: 'Failed to load courses',
    deleteTitle: 'Delete Course',
    deleteDesc: 'Are you sure you want to delete this course? This action cannot be undone.',
    cancel: 'Cancel',
    confirm: 'Delete',
    deleteSuccess: 'Course deleted',
    lastUpdated: 'Updated',
  },
  es: {
    heroLine1: 'Construye con',
    heroLine2: 'Propósito',
    subtitle: 'Crea y administra tus cursos de capacitación.',
    back: 'Volver',
    createNew: 'Nuevo',
    search: 'Buscar cursos...',
    all: 'Todos',
    draft: 'Borrador',
    published: 'Publicado',
    archived: 'Archivado',
    sections: 'secciones',
    section: 'sección',
    rollout: 'Rollout',
    more: 'más',
    less: 'menos',
    edit: 'Editar',
    publish: 'Publicar',
    unpublish: 'Despublicar',
    archive: 'Archivar',
    unarchive: 'Desarchivar',
    delete: 'Eliminar',
    noCourses: 'No hay cursos',
    noCoursesDesc: 'Crea tu primer curso para comenzar.',
    noResults: 'Sin resultados',
    noResultsDesc: 'Intenta ajustar tu busqueda o filtro.',
    loading: 'Cargando cursos...',
    error: 'Error al cargar cursos',
    deleteTitle: 'Eliminar Curso',
    deleteDesc: 'Estas seguro de que deseas eliminar este curso? Esta accion no se puede deshacer.',
    cancel: 'Cancelar',
    confirm: 'Eliminar',
    deleteSuccess: 'Curso eliminado',
    lastUpdated: 'Actualizado',
  },
};

// =============================================================================
// TYPES
// =============================================================================

interface CourseRow {
  id: string;
  slug: string;
  title_en: string;
  title_es: string | null;
  description_en: string | null;
  description_es: string | null;
  icon: string | null;
  status: CourseStatus;
  course_type: string;
  version: number;
  updated_at: string;
  sectionCount: number;
}

type StatusFilter = 'all' | CourseStatus;

const statusBadgeStyles: Record<CourseStatus, string> = {
  draft: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  outline: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300',
  generating: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300',
  review: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  published: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  archived: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400',
};

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
  return `${months}mo`;
}

// =============================================================================
// COURSE CARD (matches ProgramCard layout)
// =============================================================================

function CourseCard({
  course,
  lang,
  t,
  onEdit,
  onStatusChange,
  onDelete,
}: {
  course: CourseRow;
  lang: 'en' | 'es';
  t: typeof STRINGS['en'];
  onEdit: () => void;
  onStatusChange: (course: CourseRow, status: CourseStatus) => void;
  onDelete: (course: CourseRow) => void;
}) {
  const emojiConfig = COURSE_EMOJI[course.icon ?? ''] ?? defaultEmoji;
  const title = lang === 'es' && course.title_es ? course.title_es : course.title_en;
  const description = lang === 'es' && course.description_es ? course.description_es : course.description_en;
  const sectionLabel = course.sectionCount === 1
    ? `1 ${t.section}`
    : `${course.sectionCount} ${t.sections}`;

  const [expanded, setExpanded] = useState(false);
  const descRef = useRef<HTMLParagraphElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    const el = descRef.current;
    if (el) setIsOverflowing(el.scrollHeight > el.clientHeight + 1);
  }, [description]);

  return (
    <div
      onClick={onEdit}
      className={cn(
        'group relative flex flex-col',
        'p-5',
        'bg-card rounded-[20px]',
        'border border-black/[0.04] dark:border-white/[0.06]',
        'shadow-card',
        'transition-all duration-150',
        'cursor-pointer hover:bg-muted/20 dark:hover:bg-muted/10 active:scale-[0.99]',
      )}
    >
      {/* Emoji hero tile */}
      <div className={cn(
        'relative w-full aspect-[16/9] rounded-[14px] overflow-hidden mb-3',
        'flex items-center justify-center',
        'shadow-[3px_8px_12px_-3px_rgba(0,0,0,0.08),2px_4px_8px_-2px_rgba(0,0,0,0.05)]',
        'dark:shadow-[3px_8px_12px_-3px_rgba(0,0,0,0.3),2px_4px_8px_-2px_rgba(0,0,0,0.2)]',
        emojiConfig.bg, emojiConfig.darkBg,
      )}>
        <span className="text-[48px] h-[48px] leading-[48px] group-hover:scale-110 transition-transform duration-300">
          {emojiConfig.emoji}
        </span>
      </div>

      {/* Status badge + actions row */}
      <div className="flex items-start gap-2 w-full">
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge
              variant="secondary"
              className={cn(
                'text-[10px] font-bold px-2 py-0 border-0',
                statusBadgeStyles[course.status],
              )}
            >
              {(t[course.status] || course.status).toUpperCase()}
            </Badge>
            {course.course_type === 'menu_rollout' && (
              <Badge
                variant="secondary"
                className="text-[10px] font-bold px-2 py-0 border-0 bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400"
              >
                🍽️ {t.rollout.toUpperCase()}
              </Badge>
            )}
          </div>

          {/* Title */}
          <h3 className="text-base font-semibold text-foreground leading-tight line-clamp-1">
            {title}
          </h3>
        </div>

        {/* Dropdown trigger */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <button className={cn(
              'flex items-center justify-center shrink-0',
              'h-8 w-8 rounded-full',
              'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300',
              'transition-all duration-150',
            )}>
              <MoreVertical className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(); }}>
              <Pencil className="h-4 w-4 mr-2" />{t.edit}
            </DropdownMenuItem>
            {course.status !== 'archived' && (
              <DropdownMenuItem onClick={(e) => {
                e.stopPropagation();
                onStatusChange(course, course.status === 'published' ? 'draft' : 'published');
              }}>
                {course.status === 'published' ? <GlobeLock className="h-4 w-4 mr-2" /> : <Globe className="h-4 w-4 mr-2" />}
                {course.status === 'published' ? t.unpublish : t.publish}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={(e) => {
              e.stopPropagation();
              onStatusChange(course, course.status === 'archived' ? 'draft' : 'archived');
            }}>
              {course.status === 'archived' ? <ArchiveRestore className="h-4 w-4 mr-2" /> : <Archive className="h-4 w-4 mr-2" />}
              {course.status === 'archived' ? t.unarchive : t.archive}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={(e) => { e.stopPropagation(); onDelete(course); }}
            >
              <Trash2 className="h-4 w-4 mr-2" />{t.delete}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Description with expand/collapse */}
      {description && (
        <div className="mt-1.5">
          <p
            ref={descRef}
            className={cn(
              'text-xs text-muted-foreground leading-relaxed',
              !expanded && 'line-clamp-3',
            )}
          >
            {description}
          </p>
          {isOverflowing && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded((prev) => !prev);
              }}
              className="flex items-center gap-0.5 mt-1 text-[11px] text-primary hover:text-primary/80 transition-colors"
            >
              <ChevronDown className={cn(
                'h-3 w-3 transition-transform duration-200',
                expanded && 'rotate-180',
              )} />
              {expanded ? t.less : t.more}
            </button>
          )}
        </div>
      )}

      {/* Meta row — anchored to bottom */}
      <div className="flex items-center gap-3 mt-auto pt-3 text-[13px] leading-none text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="text-[14px] h-[14px] leading-[14px] shrink-0">📖</span>
          <span>{sectionLabel}</span>
        </span>
        <span className="text-black/10 dark:text-white/10">·</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="text-[14px] h-[14px] leading-[14px] shrink-0">🕐</span>
          <span>{t.lastUpdated} {formatRelativeTime(course.updated_at, lang)}</span>
        </span>
        {course.version > 1 && (
          <>
            <span className="text-black/10 dark:text-white/10">·</span>
            <span className="tabular-nums">v{course.version}</span>
          </>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// PAGE COMPONENT
// =============================================================================

export default function AdminCourseListPage() {
  const navigate = useNavigate();
  const { language, setLanguage } = useLanguage();
  const lang = (language === 'es' ? 'es' : 'en') as 'en' | 'es';
  const t = STRINGS[lang];
  const groupId = useGroupId();
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [deleteTarget, setDeleteTarget] = useState<CourseRow | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [menuRolloutOpen, setMenuRolloutOpen] = useState(false);

  // Load courses on mount
  const loadCourses = useCallback(async () => {
    if (!groupId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: queryError } = await supabase
        .from('courses')
        .select('id, slug, title_en, title_es, description_en, description_es, icon, status, course_type, version, updated_at, course_sections(count)')
        .eq('group_id', groupId)
        .order('updated_at', { ascending: false });

      if (queryError) throw queryError;
      const rows: CourseRow[] = (data || []).map((row: any) => ({
        ...row,
        sectionCount: row.course_sections?.[0]?.count ?? 0,
      }));
      setCourses(rows);
    } catch (err) {
      console.error('[AdminCourseList] Load error:', err);
      setError(err instanceof Error ? err.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  // Load on mount and when groupId changes
  useEffect(() => { void loadCourses(); }, [loadCourses]);

  // Filter
  const filtered = useMemo(() => {
    let list = courses;
    if (statusFilter !== 'all') {
      list = list.filter(c => c.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        c => c.title_en.toLowerCase().includes(q) || c.title_es?.toLowerCase().includes(q),
      );
    }
    return list;
  }, [courses, statusFilter, search]);

  // Counts
  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = { all: courses.length, draft: 0, published: 0, archived: 0 };
    for (const course of courses) {
      if (course.status in c) c[course.status as CourseStatus]++;
    }
    return c;
  }, [courses]);

  const tabs: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: t.all },
    { key: 'draft', label: t.draft },
    { key: 'published', label: t.published },
    { key: 'archived', label: t.archived },
  ];

  // Handlers
  const handleDelete = useCallback(async (course: CourseRow) => {
    try {
      // Delete sections first
      await supabase.from('course_sections').delete().eq('course_id', course.id);
      // Delete course
      const { error: deleteError } = await supabase.from('courses').delete().eq('id', course.id);
      if (deleteError) throw deleteError;
      toast.success(t.deleteSuccess);
      setDeleteTarget(null);
      void loadCourses();
    } catch (err) {
      console.error('[AdminCourseList] Delete error:', err);
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    }
  }, [loadCourses, t.deleteSuccess]);

  const handleStatusChange = useCallback(async (course: CourseRow, newStatus: CourseStatus) => {
    try {
      const { error: updateError } = await supabase
        .from('courses')
        .update({ status: newStatus })
        .eq('id', course.id);
      if (updateError) throw updateError;
      void loadCourses();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
    }
  }, [loadCourses]);

  const hasCourses = courses.length > 0;
  const hasResults = filtered.length > 0;

  // ---------------------------------------------------------------------------
  // AppShell header elements (matches Recipes pattern)
  // ---------------------------------------------------------------------------

  // Back button for header left slot
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

  // Header toolbar: search + filter pills (lg+) + new button — single line
  const headerToolbar = (
    <div className="flex items-center gap-2 min-w-0">
      {/* Search */}
      <div className="relative flex-1 max-w-[200px] min-w-[120px]">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t.search}
          className={cn(
            'h-9 w-full rounded-lg border border-input bg-background',
            'pl-8 pr-8 text-sm',
            'ring-offset-background transition-colors duration-150',
            'placeholder:text-muted-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            '[&::-webkit-search-cancel-button]:hidden',
          )}
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
            aria-label="Clear search"
          >
            <X className="h-3 w-3 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Filter pills — segmented control, lg+ only */}
      <div className="hidden lg:flex gap-0.5 rounded-lg bg-muted p-0.5">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setStatusFilter(tab.key)}
            className={cn(
              'min-h-[28px] px-2.5 rounded-md text-[11px] font-semibold',
              'transition-colors duration-150',
              statusFilter === tab.key
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label} {counts[tab.key]}
          </button>
        ))}
      </div>

      {/* New course button */}
      <button
        onClick={() => setWizardOpen(true)}
        className="flex items-center gap-1 shrink-0 h-9 px-3 rounded-lg text-xs font-medium
          bg-orange-500 text-white hover:bg-orange-600 active:scale-[0.96]
          shadow-sm transition-all duration-150"
      >
        <Plus className="h-3.5 w-3.5" />
        {t.createNew}
      </button>
    </div>
  );

  return (
    <AppShell
      language={language}
      onLanguageChange={setLanguage}
      showSearch={false}
      headerLeft={headerLeft}
      headerToolbar={headerToolbar}
    >
      {/* Hero intro */}
      <div className="py-6 flex items-start justify-between">
        <div>
          <p className="text-2xl sm:text-3xl text-foreground leading-tight font-extralight">
            {t.heroLine1}
            <br />
            <span className="font-bold">{t.heroLine2}</span> 🎓
          </p>
          <p className="text-sm text-muted-foreground mt-2">{t.subtitle}</p>
        </div>
      </div>

      {/* Mobile filter chips — scrollable, lg:hidden */}
      <div className="lg:hidden -mx-4 px-4 mb-4">
        <div
          className="flex gap-1.5 overflow-x-auto"
          style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
        >
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setStatusFilter(tab.key)}
              className={cn(
                'flex-none h-8 px-4 rounded-full text-[12px] font-semibold whitespace-nowrap',
                'transition-all duration-150 active:scale-[0.96]',
                statusFilter === tab.key
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'bg-muted text-muted-foreground',
              )}
            >
              {tab.label} {counts[tab.key]}
            </button>
          ))}
        </div>
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
      ) : !hasCourses ? (
        <div className="text-center py-16 space-y-3">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <span className="text-[30px] h-[30px] leading-[30px]">🎓</span>
          </div>
          <p className="text-base font-medium text-muted-foreground">{t.noCourses}</p>
          <p className="text-sm text-muted-foreground">{t.noCoursesDesc}</p>
          <button
            onClick={() => setWizardOpen(true)}
            className="mt-4 inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-sm font-medium
              bg-orange-500 text-white hover:bg-orange-600 active:scale-[0.96]
              shadow-sm transition-all duration-150"
          >
            <Plus className="h-4 w-4" />
            {t.createNew}
          </button>
        </div>
      ) : !hasResults ? (
        <div className="text-center py-12 space-y-2">
          <p className="text-base font-medium text-muted-foreground">{t.noResults}</p>
          <p className="text-sm text-muted-foreground">{t.noResultsDesc}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pb-6">
          {filtered.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              lang={lang}
              t={t}
              onEdit={() => navigate(`/admin/courses/${course.id}/edit`)}
              onStatusChange={handleStatusChange}
              onDelete={setDeleteTarget}
            />
          ))}
        </div>
      )}

      {/* Course Wizard Dialog */}
      <CourseWizardDialog
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onSelectType={(type: CourseType) => {
          setWizardOpen(false);
          if (type === 'menu_rollout') {
            setMenuRolloutOpen(true);
          } else {
            navigate('/admin/courses/new');
          }
        }}
        language={lang}
      />

      {/* Menu Rollout Wizard */}
      <MenuRolloutWizard
        open={menuRolloutOpen}
        onClose={() => setMenuRolloutOpen(false)}
        language={lang}
      />

      {/* Delete confirmation */}
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
    </AppShell>
  );
}
