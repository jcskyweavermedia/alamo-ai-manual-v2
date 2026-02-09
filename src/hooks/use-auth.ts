/**
 * useAuth Hook
 * 
 * Consumes the AuthContext to access authentication state and actions.
 */

import { useContext } from 'react';
import { AuthContext } from '@/components/auth/AuthProvider';
import type { AuthContextValue } from '@/types/auth';

/**
 * Access authentication state and actions
 * 
 * @throws Error if used outside of AuthProvider
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
}
