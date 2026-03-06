// =============================================================================
// CourseComingSoonPage — Stub page while Course Builder is being built
// Replaces old training routes during Phase 2 teardown
// =============================================================================

import { ArrowLeft, GraduationCap, Wrench } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/components/auth';

const STRINGS = {
  en: {
    back: 'Back',
    title: 'Course Builder Coming Soon',
    subtitle: 'The training section is being rebuilt with a new AI-powered Course Builder.',
    description:
      'We are building an entirely new course creation and learning experience. ' +
      'The new system will feature AI-generated content, interactive quizzes, ' +
      'and a visual course editor for managers.',
    stayTuned: 'Stay tuned for updates.',
  },
  es: {
    back: 'Volver',
    title: 'Constructor de Cursos Proximamente',
    subtitle: 'La seccion de entrenamiento se esta reconstruyendo con un nuevo Constructor de Cursos con IA.',
    description:
      'Estamos construyendo una experiencia completamente nueva de creacion y aprendizaje de cursos. ' +
      'El nuevo sistema contara con contenido generado por IA, cuestionarios interactivos, ' +
      'y un editor visual de cursos para gerentes.',
    stayTuned: 'Mantente atento a las actualizaciones.',
  },
};

export default function CourseComingSoonPage() {
  const navigate = useNavigate();
  const { language = 'en' } = useAuth();
  const lang = (language === 'es' ? 'es' : 'en') as 'en' | 'es';
  const t = STRINGS[lang];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-md border-b">
        <div className="flex items-center gap-2 max-w-2xl mx-auto px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">{t.title}</h1>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-12">
        <Card className="rounded-2xl border-dashed">
          <CardContent className="flex flex-col items-center text-center py-16 px-6 gap-6">
            <div className="flex items-center gap-3">
              <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                <GraduationCap className="h-7 w-7 text-primary" />
              </div>
              <div className="h-14 w-14 rounded-2xl bg-amber-500/10 flex items-center justify-center">
                <Wrench className="h-7 w-7 text-amber-600" />
              </div>
            </div>

            <div className="space-y-3 max-w-md">
              <h2 className="text-xl font-semibold text-foreground">{t.title}</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">{t.subtitle}</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{t.description}</p>
              <p className="text-sm font-medium text-primary">{t.stayTuned}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
