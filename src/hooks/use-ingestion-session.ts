/**
 * useIngestionSession Hook
 *
 * Manages session persistence with Supabase for the data ingestion flow.
 * Handles creating, loading, saving, and listing ingestion sessions.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';
import type { PrepRecipeDraft, WineDraft, CocktailDraft, ChatMessage } from '@/types/ingestion';

// =============================================================================
// TYPES
// =============================================================================

export interface IngestionSession {
  id: string;
  productTable: string;
  ingestionMethod: string;
  status: string;
  draftData: PrepRecipeDraft | WineDraft | CocktailDraft;
  draftVersion: number;
  productId: string | null;
  editingProductId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UseIngestionSessionReturn {
  session: IngestionSession | null;
  isLoading: boolean;
  error: string | null;
  createSession: (productTable: string, method?: string) => Promise<string | null>;
  loadSession: (sessionId: string) => Promise<{
    session: IngestionSession;
    messages: ChatMessage[];
  } | null>;
  saveDraft: (draft: PrepRecipeDraft | WineDraft | CocktailDraft, version: number) => Promise<boolean>;
  listSessions: (status?: string) => Promise<IngestionSession[]>;
}

// =============================================================================
// HELPERS
// =============================================================================

/** Map a raw DB row (snake_case) to the camelCase IngestionSession interface */
function mapRow(row: Record<string, unknown>): IngestionSession {
  return {
    id: row.id as string,
    productTable: row.product_table as string,
    ingestionMethod: row.ingestion_method as string,
    status: row.status as string,
    draftData: row.draft_data as PrepRecipeDraft | WineDraft | CocktailDraft,
    draftVersion: row.draft_version as number,
    productId: (row.product_id as string) ?? null,
    editingProductId: (row.editing_product_id as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// =============================================================================
// HOOK
// =============================================================================

export function useIngestionSession(): UseIngestionSessionReturn {
  const [session, setSession] = useState<IngestionSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { user } = useAuth();

  // Auto-save debounce timer
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  // ---------------------------------------------------------------------------
  // createSession
  // ---------------------------------------------------------------------------
  const createSession = useCallback(
    async (productTable: string, method: string = 'chat'): Promise<string | null> => {
      if (!user) {
        toast.error('Please sign in to create an ingestion session');
        return null;
      }

      setIsLoading(true);
      setError(null);

      try {
        const { data, error: dbError } = await supabase
          .from('ingestion_sessions')
          .insert({
            created_by: user.id,
            product_table: productTable,
            ingestion_method: method,
            status: 'drafting',
            draft_data: {} as unknown,
            draft_version: 1,
          })
          .select()
          .single();

        if (dbError) {
          throw new Error(dbError.message);
        }

        const mapped = mapRow(data as Record<string, unknown>);
        setSession(mapped);
        return mapped.id;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to create session';
        setError(message);
        toast.error(message);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [user],
  );

  // ---------------------------------------------------------------------------
  // loadSession
  // ---------------------------------------------------------------------------
  const loadSession = useCallback(
    async (sessionId: string): Promise<{ session: IngestionSession; messages: ChatMessage[] } | null> => {
      setIsLoading(true);
      setError(null);

      try {
        // Fetch session
        const { data: sessionData, error: sessionError } = await supabase
          .from('ingestion_sessions')
          .select('*')
          .eq('id', sessionId)
          .single();

        if (sessionError) {
          throw new Error(sessionError.message);
        }

        const mapped = mapRow(sessionData as Record<string, unknown>);
        setSession(mapped);

        // Fetch messages
        const { data: messagesData, error: messagesError } = await supabase
          .from('ingestion_messages')
          .select('id, role, content, draft_updates, created_at')
          .eq('session_id', sessionId)
          .order('created_at', { ascending: true });

        if (messagesError) {
          console.error('Failed to load messages:', messagesError.message);
        }

        // Map DB rows to ChatMessage format (filter to user/assistant only)
        const messages: ChatMessage[] = (messagesData || [])
          .filter((m: any) => m.role === 'user' || m.role === 'assistant')
          .map((m: any) => ({
            id: m.id as string,
            role: m.role as 'user' | 'assistant',
            content: m.content as string,
            draftPreview: m.draft_updates || undefined,
            createdAt: m.created_at as string,
          }));

        return { session: mapped, messages };
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to load session';
        setError(message);
        toast.error(message);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  // ---------------------------------------------------------------------------
  // saveDraft (optimistic concurrency via draft_version)
  // ---------------------------------------------------------------------------
  const saveDraft = useCallback(
    async (draft: PrepRecipeDraft | WineDraft | CocktailDraft, version: number): Promise<boolean> => {
      if (!session) {
        setError('No active session');
        return false;
      }

      setIsLoading(true);
      setError(null);

      try {
        const { data, error: dbError } = await supabase
          .from('ingestion_sessions')
          .update({
            draft_data: draft as unknown,
            draft_version: version + 1,
            updated_at: new Date().toISOString(),
          })
          .eq('id', session.id)
          .eq('draft_version', version) // optimistic concurrency check
          .select()
          .single();

        if (dbError) {
          // If no rows matched, another save beat us -- reload
          if (dbError.code === 'PGRST116') {
            toast.error(
              'Draft was modified elsewhere. Reloading latest version.',
            );
            await loadSession(session.id);
            return false;
          }
          throw new Error(dbError.message);
        }

        setSession(mapRow(data as Record<string, unknown>));
        return true;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to save draft';
        setError(message);
        toast.error(message);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [session, loadSession],
  );

  // ---------------------------------------------------------------------------
  // listSessions
  // ---------------------------------------------------------------------------
  const listSessions = useCallback(
    async (status?: string): Promise<IngestionSession[]> => {
      if (!user) return [];

      setIsLoading(true);
      setError(null);

      try {
        let query = supabase
          .from('ingestion_sessions')
          .select('*')
          .eq('created_by', user.id)
          .order('updated_at', { ascending: false });

        if (status) {
          query = query.eq('status', status);
        }

        const { data, error: dbError } = await query;

        if (dbError) {
          throw new Error(dbError.message);
        }

        return (data as Record<string, unknown>[]).map(mapRow);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to list sessions';
        setError(message);
        toast.error(message);
        return [];
      } finally {
        setIsLoading(false);
      }
    },
    [user],
  );

  return {
    session,
    isLoading,
    error,
    createSession,
    loadSession,
    saveDraft,
    listSessions,
  };
}
