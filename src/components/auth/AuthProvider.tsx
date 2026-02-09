/**
 * AuthProvider
 * 
 * Manages authentication state and provides context to the app.
 * Uses Supabase magic link authentication.
 */

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import {
  type AuthContextValue,
  type Profile,
  type UserPermissions,
  type UserPermissionsRaw,
  type UserRole,
  transformPermissions,
  getHighestRole,
} from '@/types/auth';

// =============================================================================
// CONTEXT
// =============================================================================

export const AuthContext = createContext<AuthContextValue | null>(null);

// =============================================================================
// PROVIDER
// =============================================================================

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  // Session state
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Profile & permissions
  const [profile, setProfile] = useState<Profile | null>(null);
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);

  // ---------------------------------------------------------------------------
  // FETCH PERMISSIONS
  // ---------------------------------------------------------------------------
  
  const fetchPermissions = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase.rpc('get_user_permissions');
      
      if (error) {
        console.error('Error fetching permissions:', error);
        return null;
      }
      
      if (!data) {
        console.warn('No permissions data returned for user:', userId);
        return null;
      }
      
      // Cast through unknown for proper type conversion
      const transformed = transformPermissions(data as unknown as UserPermissionsRaw);
      return transformed;
    } catch (err) {
      console.error('Exception fetching permissions:', err);
      return null;
    }
  }, []);

  // ---------------------------------------------------------------------------
  // REFRESH PROFILE
  // ---------------------------------------------------------------------------
  
  const refreshProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setPermissions(null);
      return;
    }
    
    const perms = await fetchPermissions(user.id);
    
    if (perms) {
      setPermissions(perms);
      setProfile({
        id: perms.userId,
        email: perms.email,
        fullName: perms.fullName,
        avatarUrl: null, // Not returned by get_user_permissions
        defaultLanguage: perms.defaultLanguage,
        isActive: perms.isActive,
        createdAt: '', // Not returned
        updatedAt: '', // Not returned
      });
    }
  }, [user, fetchPermissions]);

  // ---------------------------------------------------------------------------
  // AUTH STATE LISTENER
  // ---------------------------------------------------------------------------
  
  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        // Synchronous state updates only
        setSession(newSession);
        setUser(newSession?.user ?? null);
        
        // Clear permissions on sign out
        if (event === 'SIGNED_OUT') {
          setProfile(null);
          setPermissions(null);
        }
        
        // Defer Supabase calls with setTimeout to prevent deadlock
        if (newSession?.user && event === 'SIGNED_IN') {
          setTimeout(() => {
            fetchPermissions(newSession.user.id).then((perms) => {
              if (perms) {
                setPermissions(perms);
                setProfile({
                  id: perms.userId,
                  email: perms.email,
                  fullName: perms.fullName,
                  avatarUrl: null,
                  defaultLanguage: perms.defaultLanguage,
                  isActive: perms.isActive,
                  createdAt: '',
                  updatedAt: '',
                });
              }
            });
          }, 0);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      setSession(existingSession);
      setUser(existingSession?.user ?? null);
      
      if (existingSession?.user) {
        fetchPermissions(existingSession.user.id).then((perms) => {
          if (perms) {
            setPermissions(perms);
            setProfile({
              id: perms.userId,
              email: perms.email,
              fullName: perms.fullName,
              avatarUrl: null,
              defaultLanguage: perms.defaultLanguage,
              isActive: perms.isActive,
              createdAt: '',
              updatedAt: '',
            });
          }
          setIsLoading(false);
        });
      } else {
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchPermissions]);

  // ---------------------------------------------------------------------------
  // SIGN IN WITH MAGIC LINK
  // ---------------------------------------------------------------------------
  
  const signInWithMagicLink = useCallback(async (email: string): Promise<{ error?: Error }> => {
    const redirectUrl = `${window.location.origin}/auth/callback`;
    
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectUrl,
      },
    });
    
    if (error) {
      return { error: new Error(error.message) };
    }
    
    return {};
  }, []);

  // ---------------------------------------------------------------------------
  // SIGN OUT
  // ---------------------------------------------------------------------------
  
  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
    setPermissions(null);
  }, []);

  // ---------------------------------------------------------------------------
  // ROLE CHECKS
  // ---------------------------------------------------------------------------
  
  const memberships = permissions?.memberships ?? [];
  const highestRole = getHighestRole(memberships);
  
  const hasRole = useCallback(
    (role: UserRole): boolean => {
      return memberships.some((m) => m.role === role);
    },
    [memberships]
  );
  
  const hasAnyRole = useCallback(
    (roles: UserRole[]): boolean => {
      return memberships.some((m) => roles.includes(m.role));
    },
    [memberships]
  );
  
  const isAdmin = useMemo(() => hasRole('admin'), [hasRole]);
  const isManager = useMemo(() => hasAnyRole(['manager', 'admin']), [hasAnyRole]);
  const isStaff = useMemo(() => memberships.length > 0, [memberships]);

  // ---------------------------------------------------------------------------
  // CONTEXT VALUE
  // ---------------------------------------------------------------------------
  
  const value = useMemo<AuthContextValue>(
    () => ({
      // Session
      session,
      user,
      isLoading,
      isAuthenticated: !!session && !!user,
      
      // Profile & permissions
      profile,
      permissions,
      
      // Actions
      signInWithMagicLink,
      signOut,
      refreshProfile,
      
      // Role checks
      hasRole,
      hasAnyRole,
      isAdmin,
      isManager,
      isStaff,
      highestRole,
    }),
    [
      session,
      user,
      isLoading,
      profile,
      permissions,
      signInWithMagicLink,
      signOut,
      refreshProfile,
      hasRole,
      hasAnyRole,
      isAdmin,
      isManager,
      isStaff,
      highestRole,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
