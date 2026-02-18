import { useState } from 'react';
import { Mic, Loader2, Check, X, Send, RotateCcw, Type } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useVoiceRecording, formatRecordingTime, isRecordingSupported } from '@/hooks/use-voice-recording';
import { VoiceConsentDialog } from '@/components/training/VoiceConsentDialog';
import type { QuizQuestionClient, VoiceAnswerResult } from '@/types/training';

interface QuizVoiceQuestionProps {
  question: QuizQuestionClient;
  onSubmit: (transcription: string) => Promise<void>;
  result?: VoiceAnswerResult;
  isGrading: boolean;
  language: 'en' | 'es';
}

export function QuizVoiceQuestion({
  question,
  onSubmit,
  result,
  isGrading,
  language,
}: QuizVoiceQuestionProps) {
  const [showConsent, setShowConsent] = useState(false);
  const [hasConsented, setHasConsented] = useState(false);
  const [useTextMode, setUseTextMode] = useState(!isRecordingSupported());
  const [textAnswer, setTextAnswer] = useState('');
  const [transcription, setTranscription] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isAnswered = !!result;

  const voice = useVoiceRecording({
    language,
    onTranscription: (text) => {
      setTranscription(text);
    },
    onError: (err) => {
      console.error('Voice recording error:', err);
      setUseTextMode(true);
    },
  });

  const handleStartRecording = () => {
    if (!hasConsented) {
      setShowConsent(true);
      return;
    }
    voice.startRecording();
  };

  const handleConsent = () => {
    setHasConsented(true);
    setShowConsent(false);
    voice.startRecording();
  };

  const handleDecline = () => {
    setShowConsent(false);
    setUseTextMode(true);
  };

  const handleSubmit = async () => {
    const answer = useTextMode ? textAnswer.trim() : transcription;
    if (!answer) return;

    setIsSubmitting(true);
    try {
      await onSubmit(answer);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReRecord = () => {
    setTranscription(null);
  };

  const isEs = language === 'es';

  return (
    <div className="space-y-4">
      <VoiceConsentDialog
        open={showConsent}
        onConsent={handleConsent}
        onDecline={handleDecline}
        language={language}
      />

      <p className="text-base font-medium text-foreground leading-relaxed">
        {question.question}
      </p>

      {question.rubric_summary && (
        <p className="text-xs text-muted-foreground">
          {isEs ? 'Se evaluara: ' : 'You will be evaluated on: '}
          {question.rubric_summary}
        </p>
      )}

      {/* Grading overlay */}
      {isGrading && (
        <div className="flex flex-col items-center justify-center py-8 gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            {isEs ? 'Evaluando tu respuesta...' : 'Evaluating your answer...'}
          </p>
        </div>
      )}

      {/* Answered — show result */}
      {isAnswered && !isGrading && (
        <div className="space-y-3 animate-in fade-in duration-300">
          {/* Score */}
          <div className={cn(
            'flex items-center gap-2 rounded-lg px-4 py-3',
            result.passed
              ? 'bg-green-50 dark:bg-green-950/30'
              : 'bg-amber-50 dark:bg-amber-950/30'
          )}>
            <span className="text-2xl font-bold tabular-nums">
              {result.voiceScore}
            </span>
            <span className="text-sm text-muted-foreground">/100</span>
          </div>

          {/* Rubric breakdown */}
          <div className="space-y-1.5">
            {result.criteriaScores.map((c, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                {c.met ? (
                  <Check className="h-3.5 w-3.5 text-green-500 shrink-0" />
                ) : (
                  <X className="h-3.5 w-3.5 text-red-400 shrink-0" />
                )}
                <span className="flex-1 text-muted-foreground">{c.criterion}</span>
                <span className="text-xs tabular-nums font-medium">
                  {c.pointsEarned}/{c.pointsPossible}
                </span>
              </div>
            ))}
          </div>

          {/* Feedback */}
          {result.feedback && (
            <p className="text-sm text-foreground bg-muted rounded-lg px-4 py-3">
              {result.feedback}
            </p>
          )}
        </div>
      )}

      {/* Not yet answered */}
      {!isAnswered && !isGrading && (
        <>
          {/* Text mode toggle */}
          {!useTextMode && isRecordingSupported() && (
            <button
              type="button"
              onClick={() => setUseTextMode(true)}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <Type className="h-3 w-3" />
              {isEs ? 'Escribir en su lugar' : 'Type instead'}
            </button>
          )}

          {useTextMode ? (
            /* Text input mode */
            <div className="space-y-3">
              <textarea
                value={textAnswer}
                onChange={(e) => setTextAnswer(e.target.value)}
                placeholder={isEs ? 'Escribe tu respuesta aqui...' : 'Type your answer here...'}
                rows={4}
                className={cn(
                  'w-full rounded-lg border border-border bg-background px-4 py-3 text-sm',
                  'placeholder:text-muted-foreground/50 resize-none',
                  'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary'
                )}
              />
              <Button
                onClick={handleSubmit}
                disabled={!textAnswer.trim() || isSubmitting}
                className="w-full"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                {isEs ? 'Enviar respuesta' : 'Submit answer'}
              </Button>
              {isRecordingSupported() && (
                <button
                  type="button"
                  onClick={() => setUseTextMode(false)}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mx-auto"
                >
                  <Mic className="h-3 w-3" />
                  {isEs ? 'Usar voz en su lugar' : 'Use voice instead'}
                </button>
              )}
            </div>
          ) : transcription ? (
            /* Review transcription */
            <div className="space-y-3">
              <div className="rounded-lg bg-muted px-4 py-3">
                <p className="text-xs text-muted-foreground mb-1">
                  {isEs ? 'Tu respuesta:' : 'Your answer:'}
                </p>
                <p className="text-sm text-foreground">"{transcription}"</p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleReRecord}
                  className="flex-1"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  {isEs ? 'Grabar de nuevo' : 'Re-record'}
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="flex-1"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  {isEs ? 'Enviar' : 'Submit'}
                </Button>
              </div>
            </div>
          ) : (
            /* Recording controls */
            <div className="flex flex-col items-center gap-4 py-4">
              {voice.isRecording ? (
                <>
                  <div className="relative">
                    <div className="h-20 w-20 rounded-full bg-red-500/10 flex items-center justify-center animate-pulse">
                      <Mic className="h-8 w-8 text-red-500" />
                    </div>
                  </div>
                  <p className={cn(
                    'text-lg font-mono tabular-nums',
                    voice.isWarning ? 'text-red-500' : 'text-foreground'
                  )}>
                    {formatRecordingTime(voice.elapsedSeconds)}
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={voice.cancelRecording}>
                      {isEs ? 'Cancelar' : 'Cancel'}
                    </Button>
                    <Button onClick={voice.stopRecording}>
                      {isEs ? 'Detener y enviar' : 'Stop & submit'}
                    </Button>
                  </div>
                </>
              ) : voice.isTranscribing ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">
                    {isEs ? 'Transcribiendo...' : 'Transcribing...'}
                  </p>
                </div>
              ) : (
                <Button
                  size="lg"
                  onClick={handleStartRecording}
                  className="h-14 px-8 rounded-full"
                >
                  <Mic className="h-5 w-5 mr-2" />
                  {isEs ? 'Grabar respuesta' : 'Record answer'}
                </Button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
