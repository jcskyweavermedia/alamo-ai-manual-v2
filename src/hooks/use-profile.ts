/**
 * useProfile Hook
 * 
 * Provides profile data and mutation functions.
 * Syncs language preference with database.
 */

import { useState, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/hooks/use-language';
import { supabase } from '@/integrations/supabase/client';
import type { Profile } from '@/types/auth';

interface UseProfileReturn {
  profile: Profile | null;
  isLoading: boolean;
  error: Error | null;
  updateProfile: (updates: Partial<Pick<Profile, 'fullName' | 'avatarUrl'>>) => Promise<void>;
  updateLanguage: (language: 'en' | 'es') => Promise<void>;
}

export function useProfile(): UseProfileReturn {
  const { profile, user, refreshProfile, isLoading: authLoading } = useAuth();
  const { setLanguage } = useLanguage();
  const [error, setError] = useState<Error | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  /**
   * Update profile fields (full_name, avatar_url)
   */
  const updateProfile = useCallback(
    async (updates: Partial<Pick<Profile, 'fullName' | 'avatarUrl'>>) => {
      if (!user) {
        setError(new Error('Not authenticated'));
        return;
      }

      setIsUpdating(true);
      setError(null);

      try {
        const dbUpdates: Record<string, unknown> = {};
        if (updates.fullName !== undefined) {
          dbUpdates.full_name = updates.fullName;
        }
        if (updates.avatarUrl !== undefined) {
          dbUpdates.avatar_url = updates.avatarUrl;
        }

        const { error: updateError } = await supabase
          .from('profiles')
          .update(dbUpdates)
          .eq('id', user.id);

        if (updateError) {
          throw new Error(updateError.message);
        }

        // Refresh profile to get updated data
        await refreshProfile();
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to update profile');
        setError(error);
        throw error;
      } finally {
        setIsUpdating(false);
      }
    },
    [user, refreshProfile]
  );

  /**
   * Update language preference (syncs to DB and localStorage)
   */
  const updateLanguage = useCallback(
    async (language: 'en' | 'es') => {
      if (!user) {
        // Still update localStorage even if not authenticated
        setLanguage(language);
        return;
      }

      setIsUpdating(true);
      setError(null);

      try {
        // Update localStorage immediately for instant feedback
        setLanguage(language);

        // Sync to database
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ default_language: language })
          .eq('id', user.id);

        if (updateError) {
          throw new Error(updateError.message);
        }

        // Refresh profile to sync state
        await refreshProfile();
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to update language');
        setError(error);
        // Don't throw - language was already updated locally
        console.error('Failed to sync language to database:', error);
      } finally {
        setIsUpdating(false);
      }
    },
    [user, refreshProfile, setLanguage]
  );

  return {
    profile,
    isLoading: authLoading || isUpdating,
    error,
    updateProfile,
    updateLanguage,
  };
}
