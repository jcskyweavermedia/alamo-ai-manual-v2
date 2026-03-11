/**
 * SignIn Page
 *
 * Email + password sign-in for returning users.
 * Route: /sign-in
 */

import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/hooks/use-language';
import { SignInForm, AuthLoadingScreen } from '@/components/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const STRINGS = {
  en: {
    checkingSession: 'Checking session...',
    redirecting: 'Redirecting...',
    welcomeBack: 'Welcome Back',
    signInDescription: 'Sign in to access the operations manual',
    noAccount: "Don't have an account?",
    contactManager: 'Contact your manager',
  },
  es: {
    checkingSession: 'Verificando sesi\u00f3n...',
    redirecting: 'Redirigiendo...',
    welcomeBack: 'Bienvenido de Nuevo',
    signInDescription: 'Inicia sesi\u00f3n para acceder al manual de operaciones',
    noAccount: '\u00bfNo tienes cuenta?',
    contactManager: 'Contacta a tu gerente',
  },
} as const;

export default function SignIn() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuth();
  const { language } = useLanguage();
  const t = STRINGS[language];

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/manual', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  if (isLoading) {
    return <AuthLoadingScreen message={t.checkingSession} />;
  }

  if (isAuthenticated) {
    return <AuthLoadingScreen message={t.redirecting} />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-md">
      <Card className="w-full max-w-md" elevation="elevated">
        <CardHeader className="text-center">
          <CardTitle className="text-section">{t.welcomeBack}</CardTitle>
          <CardDescription>
            {t.signInDescription}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SignInForm
            language={language}
            onSuccess={() => navigate('/manual', { replace: true })}
            signUpLink={
              <>
                {t.noAccount}{' '}
                <Link
                  to="/"
                  className="text-primary hover:text-primary-hover underline underline-offset-4"
                >
                  {t.contactManager}
                </Link>
              </>
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
