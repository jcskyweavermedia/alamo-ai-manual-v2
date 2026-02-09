/**
 * SignOutButton
 * 
 * Sign out button with loading state.
 * Calls signOut from useAuth and handles redirect.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';

interface SignOutButtonProps {
  className?: string;
  /** Redirect path after sign out (default: /sign-in) */
  redirectTo?: string;
}

export function SignOutButton({ 
  className, 
  redirectTo = '/sign-in' 
}: SignOutButtonProps) {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
      navigate(redirectTo, { replace: true });
    } catch (error) {
      console.error('Sign out error:', error);
      setIsSigningOut(false);
    }
  };

  return (
    <Button
      variant="destructive"
      className={cn('w-full', className)}
      onClick={handleSignOut}
      disabled={isSigningOut}
    >
      {isSigningOut ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <LogOut className="h-4 w-4 mr-2" />
      )}
      {isSigningOut ? 'Signing Out...' : 'Sign Out'}
    </Button>
  );
}
