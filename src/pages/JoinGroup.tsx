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
import { SignUpForm, AuthLoadingScreen } from '@/components/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

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
        setError('Invalid join link');
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
          setError('This join link is invalid or has expired');
          setIsValidating(false);
          return;
        }

        if (!data.is_active) {
          setError('This group is no longer active');
          setIsValidating(false);
          return;
        }

        setGroupName(data.name);
        setIsValidating(false);
      } catch (err) {
        setError('Unable to validate join link');
        setIsValidating(false);
      }
    }

    validateGroup();
  }, [slug]);

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
        setJoinError('Failed to join group. Please try again.');
        setIsJoining(false);
        return;
      }

      const result = data as unknown as JoinGroupResult;

      if (!result.success) {
        setJoinError(result.error || 'Failed to join group');
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
      setJoinError('An unexpected error occurred');
      setIsJoining(false);
    }
  };

  if (authLoading || isValidating) {
    return <AuthLoadingScreen message="Validating join link..." />;
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
            <CardTitle className="text-section">Invalid Link</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link 
                to="/sign-in" 
                className="text-primary hover:text-primary-hover underline underline-offset-4"
              >
                Sign in here
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
                <CardTitle className="text-section">Welcome!</CardTitle>
                <CardDescription>
                  You've successfully joined {groupName}. Redirecting...
                </CardDescription>
              </>
            ) : (
              <>
                <CardTitle className="text-section">Join {groupName}</CardTitle>
                <CardDescription>
                  You're about to join this group as a staff member
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
                    Joining...
                  </>
                ) : (
                  'Join Group'
                )}
              </Button>
              <p className="text-sm text-muted-foreground text-center">
                <Link 
                  to="/manual" 
                  className="text-primary hover:text-primary-hover underline underline-offset-4"
                >
                  Cancel and go back
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
          <CardTitle className="text-section">Join {groupName}</CardTitle>
          <CardDescription>
            Create your account to access the operations manual
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SignUpForm
            groupSlug={slug}
            onSuccess={() => navigate('/manual', { replace: true })}
            signInLink={
              <>
                Already have an account?{' '}
                <Link 
                  to="/sign-in" 
                  className="text-primary hover:text-primary-hover underline underline-offset-4"
                >
                  Sign in
                </Link>
              </>
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
