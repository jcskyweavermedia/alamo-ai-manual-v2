/**
 * SignIn Page
 * 
 * Email + password sign-in for returning users.
 * Route: /sign-in
 */

import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { SignInForm, AuthLoadingScreen } from '@/components/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function SignIn() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuth();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/manual', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  if (isLoading) {
    return <AuthLoadingScreen message="Checking session..." />;
  }

  if (isAuthenticated) {
    return <AuthLoadingScreen message="Redirecting..." />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-md">
      <Card className="w-full max-w-md" elevation="elevated">
        <CardHeader className="text-center">
          <CardTitle className="text-section">Welcome Back</CardTitle>
          <CardDescription>
            Sign in to access the operations manual
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SignInForm
            onSuccess={() => navigate('/manual', { replace: true })}
            signUpLink={
              <>
                Don't have an account?{' '}
                <Link 
                  to="/" 
                  className="text-primary hover:text-primary-hover underline underline-offset-4"
                >
                  Contact your manager
                </Link>
              </>
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
