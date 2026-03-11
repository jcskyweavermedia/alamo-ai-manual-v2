/**
 * SignInForm
 *
 * Email + password sign-in form for returning users.
 * Per docs/plans/step-3-authentication-roles.md Phase 3.
 */

import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Mail, Lock } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage, type Language } from '@/hooks/use-language';

// =============================================================================
// STRINGS
// =============================================================================

const STRINGS = {
  en: {
    email: 'Email',
    password: 'Password',
    signIn: 'Sign In',
    signingIn: 'Signing in...',
    invalidCredentials: 'Invalid email or password. Please try again.',
    emailNotConfirmed: 'Please verify your email address before signing in.',
    unexpectedError: 'An unexpected error occurred. Please try again.',
    // Zod messages
    emailRequired: 'Email is required',
    emailInvalid: 'Please enter a valid email',
    emailMax: 'Email must be less than 255 characters',
    passwordRequired: 'Password is required',
    passwordMax: 'Password must be less than 128 characters',
  },
  es: {
    email: 'Correo electr\u00f3nico',
    password: 'Contrase\u00f1a',
    signIn: 'Iniciar Sesi\u00f3n',
    signingIn: 'Iniciando sesi\u00f3n...',
    invalidCredentials: 'Correo o contrase\u00f1a incorrectos. Int\u00e9ntalo de nuevo.',
    emailNotConfirmed: 'Verifica tu correo electr\u00f3nico antes de iniciar sesi\u00f3n.',
    unexpectedError: 'Ocurri\u00f3 un error inesperado. Int\u00e9ntalo de nuevo.',
    // Zod messages
    emailRequired: 'El correo es obligatorio',
    emailInvalid: 'Ingresa un correo v\u00e1lido',
    emailMax: 'El correo debe tener menos de 255 caracteres',
    passwordRequired: 'La contrase\u00f1a es obligatoria',
    passwordMax: 'La contrase\u00f1a debe tener menos de 128 caracteres',
  },
} as const;

// =============================================================================
// VALIDATION SCHEMA (static for type inference)
// =============================================================================

const signInSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Email is required')
    .email('Please enter a valid email')
    .max(255, 'Email must be less than 255 characters'),
  password: z
    .string()
    .min(1, 'Password is required')
    .max(128, 'Password must be less than 128 characters'),
});

type SignInValues = z.infer<typeof signInSchema>;

// =============================================================================
// COMPONENT
// =============================================================================

interface SignInFormProps {
  /** Called on successful sign-in */
  onSuccess?: () => void;
  /** Link to sign-up page (optional) */
  signUpLink?: React.ReactNode;
  /** Language override (if parent already has it) */
  language?: Language;
}

export function SignInForm({ onSuccess, signUpLink, language: languageProp }: SignInFormProps) {
  const { language: hookLanguage } = useLanguage();
  const language = languageProp ?? hookLanguage;
  const t = STRINGS[language];

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Rebuild schema when language changes so validation messages match
  const localizedSchema = useMemo(() => z.object({
    email: z
      .string()
      .trim()
      .min(1, t.emailRequired)
      .email(t.emailInvalid)
      .max(255, t.emailMax),
    password: z
      .string()
      .min(1, t.passwordRequired)
      .max(128, t.passwordMax),
  }), [t]);

  const form = useForm<SignInValues>({
    resolver: zodResolver(localizedSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (values: SignInValues) => {
    setIsLoading(true);
    setError(null);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });

      if (signInError) {
        // Handle common error cases with friendly messages
        if (signInError.message.includes('Invalid login credentials')) {
          setError(t.invalidCredentials);
        } else if (signInError.message.includes('Email not confirmed')) {
          setError(t.emailNotConfirmed);
        } else {
          setError(signInError.message);
        }
        return;
      }

      onSuccess?.();
    } catch (err) {
      setError(t.unexpectedError);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm mx-auto">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-lg">
          {/* Email Field */}
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t.email}</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="email"
                      placeholder="you@example.com"
                      autoComplete="email"
                      className="pl-10"
                      disabled={isLoading}
                      {...field}
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Password Field */}
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t.password}</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="password"
                      placeholder="••••••••"
                      autoComplete="current-password"
                      className="pl-10"
                      disabled={isLoading}
                      {...field}
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Error Message */}
          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="animate-spin" />
                {t.signingIn}
              </>
            ) : (
              t.signIn
            )}
          </Button>

          {/* Sign Up Link */}
          {signUpLink && (
            <div className="text-center text-sm text-muted-foreground">
              {signUpLink}
            </div>
          )}
        </form>
      </Form>
    </div>
  );
}
