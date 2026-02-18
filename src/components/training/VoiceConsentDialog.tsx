import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';

interface VoiceConsentDialogProps {
  open: boolean;
  onConsent: () => void;
  onDecline: () => void;
  language: 'en' | 'es';
}

const TEXT = {
  en: {
    title: 'Voice Mode',
    description:
      'Voice transcriptions are stored for up to 90 days to improve your learning experience. ' +
      'Your recordings are only accessible to you and your assigned manager.',
    consent: 'I Consent',
    decline: 'Use Text Only',
  },
  es: {
    title: 'Modo de Voz',
    description:
      'Las transcripciones de voz se almacenan hasta 90 dias para mejorar tu experiencia de aprendizaje. ' +
      'Tus grabaciones solo son accesibles para ti y tu gerente asignado.',
    consent: 'Acepto',
    decline: 'Solo Texto',
  },
} as const;

export function VoiceConsentDialog({
  open,
  onConsent,
  onDecline,
  language,
}: VoiceConsentDialogProps) {
  const t = TEXT[language];

  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t.title}</AlertDialogTitle>
          <AlertDialogDescription>{t.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onDecline}>
            {t.decline}
          </AlertDialogCancel>
          <AlertDialogAction onClick={onConsent}>
            {t.consent}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
