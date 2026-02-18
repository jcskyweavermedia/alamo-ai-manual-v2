import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/hooks/use-language';
import { useRollouts } from '@/hooks/use-rollouts';
import { useCourses } from '@/hooks/use-courses';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface RolloutWizardProps {
  open: boolean;
  onClose: () => void;
}

const STEPS = ['Basics', 'Courses', 'Deadline', 'Assign', 'Review'] as const;

export function RolloutWizard({ open, onClose }: RolloutWizardProps) {
  const { language } = useLanguage();
  const { permissions } = useAuth();
  const { createRollout } = useRollouts();
  const { courses } = useCourses();
  const { toast } = useToast();
  const isEs = language === 'es';
  const groupId = permissions?.memberships?.[0]?.groupId ?? null;

  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);
  const [deadline, setDeadline] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);

  // Fetch group members
  const { data: groupMembers = [] } = useQuery({
    queryKey: ['group-members', groupId],
    queryFn: async () => {
      if (!groupId) return [];
      const { data } = await supabase
        .from('group_memberships')
        .select('user_id, role, profiles(full_name, email)')
        .eq('group_id', groupId);
      return (data ?? []).map((m: Record<string, unknown>) => {
        const profile = m.profiles as Record<string, unknown> | null;
        return {
          userId: m.user_id as string,
          role: m.role as string,
          fullName: profile?.full_name as string | null,
          email: profile?.email as string,
        };
      });
    },
    enabled: !!groupId && open,
  });

  const staffMembers = groupMembers.filter((m) => m.role === 'staff');

  const reset = () => {
    setStep(0);
    setName('');
    setDescription('');
    setSelectedCourseIds([]);
    setDeadline('');
    setExpiresAt('');
    setSelectedUserIds([]);
    setSelectAll(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const toggleCourse = (id: string) => {
    setSelectedCourseIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleUser = (id: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    setSelectedUserIds(checked ? staffMembers.map((m) => m.userId) : []);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await createRollout({
        name,
        description: description || undefined,
        courseIds: selectedCourseIds,
        deadline: deadline || undefined,
        expiresAt: expiresAt || undefined,
        assigneeIds: selectedUserIds,
      });
      toast({
        title: isEs ? 'Rollout creado' : 'Rollout created',
        description: isEs
          ? `${selectedUserIds.length} asignados`
          : `${selectedUserIds.length} assigned`,
      });
      handleClose();
    } catch (err) {
      toast({
        title: isEs ? 'Error' : 'Error',
        description:
          err instanceof Error ? err.message : 'Failed to create rollout',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 0:
        return name.trim().length > 0;
      case 1:
        return selectedCourseIds.length > 0;
      case 2:
        return true; // Deadline is optional
      case 3:
        return selectedUserIds.length > 0;
      default:
        return true;
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEs ? 'Nuevo Rollout' : 'New Rollout'}
          </DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-1.5 mb-4">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={cn(
                'h-1.5 flex-1 rounded-full transition-colors',
                i <= step ? 'bg-primary' : 'bg-muted'
              )}
            />
          ))}
        </div>

        {/* Step Content */}
        <div className="min-h-[200px]">
          {/* Step 0: Basics */}
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">
                  {isEs ? 'Nombre' : 'Name'}
                </label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={
                    isEs ? 'ej. Entrenamiento Server 101' : 'e.g. Server 101 Training'
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">
                  {isEs ? 'Descripcion (opcional)' : 'Description (optional)'}
                </label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder={
                    isEs ? 'Detalles del rollout...' : 'Rollout details...'
                  }
                />
              </div>
            </div>
          )}

          {/* Step 1: Courses */}
          {step === 1 && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground mb-3">
                {isEs
                  ? 'Selecciona los cursos a incluir'
                  : 'Select courses to include'}
              </p>
              {courses.map((c) => (
                <label
                  key={c.id}
                  className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-muted cursor-pointer"
                >
                  <Checkbox
                    checked={selectedCourseIds.includes(c.id)}
                    onCheckedChange={() => toggleCourse(c.id)}
                  />
                  <span className="text-sm">
                    {isEs && c.titleEs ? c.titleEs : c.titleEn}
                  </span>
                </label>
              ))}
              {courses.length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  {isEs ? 'No hay cursos publicados' : 'No published courses'}
                </p>
              )}
            </div>
          )}

          {/* Step 2: Deadline */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">
                  {isEs ? 'Fecha limite (opcional)' : 'Deadline (optional)'}
                </label>
                <Input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {isEs
                    ? 'Asignaciones se marcan como atrasadas despues de esta fecha'
                    : 'Assignments are marked overdue after this date'}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">
                  {isEs ? 'Expira (opcional)' : 'Expires (optional)'}
                </label>
                <Input
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {isEs
                    ? 'El rollout se archiva automaticamente despues de esta fecha'
                    : 'Rollout auto-expires after this date'}
                </p>
              </div>
            </div>
          )}

          {/* Step 3: Assign */}
          {step === 3 && (
            <div className="space-y-2">
              <label className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-muted cursor-pointer border-b mb-2">
                <Checkbox
                  checked={selectAll}
                  onCheckedChange={(c) => handleSelectAll(!!c)}
                />
                <span className="text-sm font-medium">
                  {isEs ? 'Todo el Staff' : 'All Staff'} ({staffMembers.length})
                </span>
              </label>
              {staffMembers.map((m) => (
                <label
                  key={m.userId}
                  className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-muted cursor-pointer"
                >
                  <Checkbox
                    checked={selectedUserIds.includes(m.userId)}
                    onCheckedChange={() => toggleUser(m.userId)}
                  />
                  <span className="text-sm">
                    {m.fullName || m.email}
                  </span>
                </label>
              ))}
              {staffMembers.length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  {isEs
                    ? 'No hay miembros staff en el grupo'
                    : 'No staff members in this group'}
                </p>
              )}
            </div>
          )}

          {/* Step 4: Review */}
          {step === 4 && (
            <div className="space-y-3 text-sm">
              <div>
                <span className="font-medium">
                  {isEs ? 'Nombre' : 'Name'}:
                </span>{' '}
                {name}
              </div>
              {description && (
                <div>
                  <span className="font-medium">
                    {isEs ? 'Descripcion' : 'Description'}:
                  </span>{' '}
                  {description}
                </div>
              )}
              <div>
                <span className="font-medium">
                  {isEs ? 'Cursos' : 'Courses'}:
                </span>{' '}
                {selectedCourseIds.length}
              </div>
              {deadline && (
                <div>
                  <span className="font-medium">
                    {isEs ? 'Fecha limite' : 'Deadline'}:
                  </span>{' '}
                  {new Date(deadline).toLocaleDateString()}
                </div>
              )}
              <div>
                <span className="font-medium">
                  {isEs ? 'Asignados' : 'Assignees'}:
                </span>{' '}
                {selectedUserIds.length} {isEs ? 'personas' : 'people'}
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between mt-4">
          <Button
            variant="outline"
            onClick={() => (step === 0 ? handleClose() : setStep(step - 1))}
            disabled={isSubmitting}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            {step === 0
              ? isEs
                ? 'Cancelar'
                : 'Cancel'
              : isEs
                ? 'Atras'
                : 'Back'}
          </Button>

          {step < STEPS.length - 1 ? (
            <Button
              onClick={() => setStep(step + 1)}
              disabled={!canProceed()}
            >
              {isEs ? 'Siguiente' : 'Next'}
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              {isEs ? 'Crear Rollout' : 'Create Rollout'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
