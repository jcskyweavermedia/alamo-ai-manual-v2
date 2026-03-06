// =============================================================================
// AdminCourseListPage — List all courses with "Create Course" button
// Follows the pattern of AdminFormsListPage
// =============================================================================

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Search,
  MoreVertical,
  Pencil,
  Archive,
  ArchiveRestore,
  Trash2,
  GraduationCap,
  Globe,
  GlobeLock,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
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
import { useAuth } from '@/components/auth';
import { useGroupId } from '@/hooks/useGroupId';
import { CourseWizardDialog } from '@/components/course-builder/wizard/CourseWizardDialog';
import { MenuRolloutWizard } from '@/components/course-builder/wizard/MenuRolloutWizard';
import type { CourseStatus, CourseType } from '@/types/course-builder';

// =============================================================================
// STRINGS
// =============================================================================

const STRINGS = {
  en: {
    title: 'Course Builder',
    back: 'Admin',
    createNew: 'New Course',
    search: 'Search courses...',
    all: 'All',
    draft: 'Draft',
    published: 'Published',
    archived: 'Archived',
    sections: 'sections',
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
    title: 'Constructor de Cursos',
    back: 'Admin',
    createNew: 'Nuevo Curso',
    search: 'Buscar cursos...',
    all: 'Todos',
    draft: 'Borrador',
    published: 'Publicado',
    archived: 'Archivado',
    sections: 'secciones',
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
  icon: string | null;
  status: CourseStatus;
  course_type: string;
  version: number;
  updated_at: string;
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
// PAGE COMPONENT
// =============================================================================

export default function AdminCourseListPage() {
  const navigate = useNavigate();
  const { language = 'en' } = useAuth();
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
        .select('id, slug, title_en, title_es, description_en, icon, status, course_type, version, updated_at')
        .eq('group_id', groupId)
        .order('updated_at', { ascending: false });

      if (queryError) throw queryError;
      setCourses((data as CourseRow[]) || []);
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
          <Button size="sm" onClick={() => setWizardOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            {t.createNew}
          </Button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-5 space-y-5">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.search}
            className="pl-9 rounded-xl"
          />
        </div>

        {/* Status filter tabs */}
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
        ) : !hasCourses ? (
          <div className="text-center py-16 space-y-3">
            <div className="mx-auto h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              <GraduationCap className="h-7 w-7 text-primary" />
            </div>
            <p className="text-base font-medium text-muted-foreground">{t.noCourses}</p>
            <p className="text-sm text-muted-foreground">{t.noCoursesDesc}</p>
            <Button className="mt-4" onClick={() => setWizardOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              {t.createNew}
            </Button>
          </div>
        ) : !hasResults ? (
          <div className="text-center py-12 space-y-2">
            <p className="text-base font-medium text-muted-foreground">{t.noResults}</p>
            <p className="text-sm text-muted-foreground">{t.noResultsDesc}</p>
          </div>
        ) : (
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((course) => (
              <div
                key={course.id}
                onClick={() => navigate(`/admin/courses/${course.id}/edit`)}
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
                    <div className="flex items-center justify-center shrink-0 h-10 w-10 rounded-[12px] bg-primary/10">
                      <GraduationCap className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate text-foreground">
                        {lang === 'es' && course.title_es ? course.title_es : course.title_en}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <Badge
                          variant="secondary"
                          className={cn(
                            'text-[10px] font-semibold px-1.5 py-0 h-[18px] border-0',
                            statusBadgeStyles[course.status],
                          )}
                        >
                          {t[course.status] || course.status}
                        </Badge>
                        {course.version > 1 && (
                          <span className="text-[10px] font-medium text-muted-foreground tabular-nums">
                            v{course.version}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1.5">
                        {t.lastUpdated} {formatRelativeTime(course.updated_at, lang)}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/admin/courses/${course.id}/edit`); }}>
                        <Pencil className="h-4 w-4 mr-2" />{t.edit}
                      </DropdownMenuItem>
                      {course.status !== 'archived' && (
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          handleStatusChange(course, course.status === 'published' ? 'draft' : 'published');
                        }}>
                          {course.status === 'published' ? <GlobeLock className="h-4 w-4 mr-2" /> : <Globe className="h-4 w-4 mr-2" />}
                          {course.status === 'published' ? t.unpublish : t.publish}
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={(e) => {
                        e.stopPropagation();
                        handleStatusChange(course, course.status === 'archived' ? 'draft' : 'archived');
                      }}>
                        {course.status === 'archived' ? <ArchiveRestore className="h-4 w-4 mr-2" /> : <Archive className="h-4 w-4 mr-2" />}
                        {course.status === 'archived' ? t.unarchive : t.archive}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget(course); }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />{t.delete}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Course Wizard Dialog */}
      <CourseWizardDialog
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onSelectType={(type: CourseType) => {
          setWizardOpen(false);
          if (type === 'menu_rollout') {
            setMenuRolloutOpen(true);
          } else {
            // For now, only menu_rollout is supported
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
    </div>
  );
}
