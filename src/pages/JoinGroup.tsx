/**
 * JoinGroup Page
 *
 * Sign-up page accessed via shared group link.
 * Route: /join/:slug
 *
 * New users sign up here and are auto-assigned to the group.
 * Authenticated users can also join via this link.
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/hooks/use-language';
import { SignUpForm, AuthLoadingScreen } from '@/components/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

const STRINGS = {
  en: {
    validating: 'Validating join link...',
    invalidLink: 'Invalid Link',
    invalidJoinLink: 'Invalid join link',
    linkExpired: 'This join link is invalid or has expired',
    groupInactive: 'This group is no longer active',
    unableToValidate: 'Unable to validate join link',
    alreadyHaveAccount: 'Already have an account?',
    signInHere: 'Sign in here',
    signIn: 'Sign in',
    welcome: 'Welcome!',
    joinedSuccess: (name: string) => `You've successfully joined ${name}. Redirecting...`,
    joinGroup: (name: string) => `Join ${name}`,
    aboutToJoin: "You're about to join this group as a staff member",
    failedToJoin: 'Failed to join group. Please try again.',
    failedToJoinGeneric: 'Failed to join group',
    unexpectedError: 'An unexpected error occurred',
    joining: 'Joining...',
    joinGroupBtn: 'Join Group',
    cancelGoBack: 'Cancel and go back',
    createAccount: 'Create your account to access the operations manual',
  },
  es: {
    validating: 'Validando enlace...',
    invalidLink: 'Enlace Inv\u00e1lido',
    invalidJoinLink: 'Enlace de invitaci\u00f3n inv\u00e1lido',
    linkExpired: 'Este enlace de invitaci\u00f3n es inv\u00e1lido o ha expirado',
    groupInactive: 'Este grupo ya no est\u00e1 activo',
    unableToValidate: 'No se pudo validar el enlace',
    alreadyHaveAccount: '\u00bfYa tienes cuenta?',
    signInHere: 'Inicia sesi\u00f3n aqu\u00ed',
    signIn: 'Iniciar sesi\u00f3n',
    welcome: '\u00a1Bienvenido!',
    joinedSuccess: (name: string) => `Te has unido a ${name} exitosamente. Redirigiendo...`,
    joinGroup: (name: string) => `Unirse a ${name}`,
    aboutToJoin: 'Est\u00e1s a punto de unirte a este grupo como miembro del equipo',
    failedToJoin: 'Error al unirse al grupo. Int\u00e9ntalo de nuevo.',
    failedToJoinGeneric: 'Error al unirse al grupo',
    unexpectedError: 'Ocurri\u00f3 un error inesperado',
    joining: 'Uni\u00e9ndose...',
    joinGroupBtn: 'Unirse al Grupo',
    cancelGoBack: 'Cancelar y volver',
    createAccount: 'Crea tu cuenta para acceder al manual de operaciones',
  },
} as const;

interface JoinGroupResult {
  success: boolean;
  error?: string;
  already_member?: boolean;
  group_id?: string;
  group_name?: string;
  role?: string;
}

export default function JoinGroup() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading, refreshProfile } = useAuth();
  const { language } = useLanguage();
  const t = STRINGS[language];

  const [groupName, setGroupName] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // For authenticated user join flow
  const [isJoining, setIsJoining] = useState(false);
  const [joinSuccess, setJoinSuccess] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  // Validate the group slug exists and is accepting signups
  useEffect(() => {
    async function validateGroup() {
      if (!slug) {
        setError(t.invalidJoinLink);
        setIsValidating(false);
        return;
      }

      try {
        const { data, error: fetchError } = await supabase
          .from('groups')
          .select('name, is_active')
          .eq('slug', slug)
          .single();

        if (fetchError || !data) {
          setError(t.linkExpired);
          setIsValidating(false);
          return;
        }

        if (!data.is_active) {
          setError(t.groupInactive);
          setIsValidating(false);
          return;
        }

        setGroupName(data.name);
        setIsValidating(false);
      } catch (err) {
        setError(t.unableToValidate);
        setIsValidating(false);
      }
    }

    validateGroup();
  }, [slug, t]);

  // Handle authenticated user joining the group
  const handleJoinGroup = async () => {
    if (!slug) return;

    setIsJoining(true);
    setJoinError(null);

    try {
      const { data, error: rpcError } = await supabase.rpc('join_group_by_slug', {
        group_slug: slug,
      });

      if (rpcError) {
        setJoinError(t.failedToJoin);
        setIsJoining(false);
        return;
      }

      const result = data as unknown as JoinGroupResult;

      if (!result.success) {
        setJoinError(result.error || t.failedToJoinGeneric);
        setIsJoining(false);
        return;
      }

      // Refresh permissions to include new group
      await refreshProfile();

      setJoinSuccess(true);
      setIsJoining(false);

      // Redirect after brief success message
      setTimeout(() => {
        navigate('/manual', { replace: true });
      }, 1500);
    } catch (err) {
      setJoinError(t.unexpectedError);
      setIsJoining(false);
    }
  };

  if (authLoading || isValidating) {
    return <AuthLoadingScreen message={t.validating} />;
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-md">
        <Card className="w-full max-w-md" elevation="elevated">
          <CardHeader className="text-center">
            <div className="mx-auto mb-md w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle className="text-section">{t.invalidLink}</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground">
              {t.alreadyHaveAccount}{' '}
              <Link
                to="/sign-in"
                className="text-primary hover:text-primary-hover underline underline-offset-4"
              >
                {t.signInHere}
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Authenticated user - show join confirmation
  if (isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-md">
        <Card className="w-full max-w-md" elevation="elevated">
          <CardHeader className="text-center">
            {joinSuccess ? (
              <>
                <div className="mx-auto mb-md w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center">
                  <CheckCircle2 className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-section">{t.welcome}</CardTitle>
                <CardDescription>
                  {t.joinedSuccess(groupName ?? '')}
                </CardDescription>
              </>
            ) : (
              <>
                <CardTitle className="text-section">{t.joinGroup(groupName ?? '')}</CardTitle>
                <CardDescription>
                  {t.aboutToJoin}
                </CardDescription>
              </>
            )}
          </CardHeader>
          {!joinSuccess && (
            <CardContent className="space-y-lg">
              {joinError && (
                <p className="text-sm text-destructive text-center">{joinError}</p>
              )}
              <Button
                onClick={handleJoinGroup}
                className="w-full"
                disabled={isJoining}
              >
                {isJoining ? (
                  <>
                    <Loader2 className="animate-spin" />
                    {t.joining}
                  </>
                ) : (
                  t.joinGroupBtn
                )}
              </Button>
              <p className="text-sm text-muted-foreground text-center">
                <Link
                  to="/manual"
                  className="text-primary hover:text-primary-hover underline underline-offset-4"
                >
                  {t.cancelGoBack}
                </Link>
              </p>
            </CardContent>
          )}
        </Card>
      </div>
    );
  }

  // Unauthenticated user - show signup form
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-md">
      <Card className="w-full max-w-md" elevation="elevated">
        <CardHeader className="text-center">
          <CardTitle className="text-section">{t.joinGroup(groupName ?? '')}</CardTitle>
          <CardDescription>
            {t.createAccount}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SignUpForm
            language={language}
            groupSlug={slug}
            onSuccess={() => navigate('/manual', { replace: true })}
            signInLink={
              <>
                {t.alreadyHaveAccount}{' '}
                <Link
                  to="/sign-in"
                  className="text-primary hover:text-primary-hover underline underline-offset-4"
                >
                  {t.signIn}
                </Link>
              </>
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
