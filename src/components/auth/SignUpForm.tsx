/**
 * SignUpForm
 *
 * Email + password + name sign-up form for new users.
 * Per docs/plans/step-3-authentication-roles.md Phase 3.
 */

import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Mail, Lock, User } from 'lucide-react';

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
    fullName: 'Full Name',
    optional: '(optional)',
    email: 'Email',
    password: 'Password',
    confirmPassword: 'Confirm Password',
    createAccount: 'Create Account',
    createAccountJoin: 'Create Account & Join',
    creatingAccount: 'Creating account...',
    alreadyExists: 'An account with this email already exists. Please sign in instead.',
    rateLimit: 'Too many attempts. Please wait a moment and try again.',
    unexpectedError: 'An unexpected error occurred. Please try again.',
    // Zod messages
    nameMax: 'Name must be less than 100 characters',
    emailRequired: 'Email is required',
    emailInvalid: 'Please enter a valid email',
    emailMax: 'Email must be less than 255 characters',
    passwordMin: 'Password must be at least 8 characters',
    passwordMax: 'Password must be less than 128 characters',
    passwordComplexity: 'Password must include uppercase, lowercase, and a number',
    confirmRequired: 'Please confirm your password',
    passwordsMismatch: 'Passwords do not match',
  },
  es: {
    fullName: 'Nombre Completo',
    optional: '(opcional)',
    email: 'Correo electr\u00f3nico',
    password: 'Contrase\u00f1a',
    confirmPassword: 'Confirmar Contrase\u00f1a',
    createAccount: 'Crear Cuenta',
    createAccountJoin: 'Crear Cuenta y Unirse',
    creatingAccount: 'Creando cuenta...',
    alreadyExists: 'Ya existe una cuenta con este correo. Inicia sesi\u00f3n en su lugar.',
    rateLimit: 'Demasiados intentos. Espera un momento e int\u00e9ntalo de nuevo.',
    unexpectedError: 'Ocurri\u00f3 un error inesperado. Int\u00e9ntalo de nuevo.',
    // Zod messages
    nameMax: 'El nombre debe tener menos de 100 caracteres',
    emailRequired: 'El correo es obligatorio',
    emailInvalid: 'Ingresa un correo v\u00e1lido',
    emailMax: 'El correo debe tener menos de 255 caracteres',
    passwordMin: 'La contrase\u00f1a debe tener al menos 8 caracteres',
    passwordMax: 'La contrase\u00f1a debe tener menos de 128 caracteres',
    passwordComplexity: 'La contrase\u00f1a debe incluir may\u00fasculas, min\u00fasculas y un n\u00famero',
    confirmRequired: 'Confirma tu contrase\u00f1a',
    passwordsMismatch: 'Las contrase\u00f1as no coinciden',
  },
} as const;

// =============================================================================
// VALIDATION SCHEMA (static for type inference)
// =============================================================================

const signUpSchema = z.object({
  fullName: z
    .string()
    .trim()
    .max(100, 'Name must be less than 100 characters')
    .optional(),
  email: z
    .string()
    .trim()
    .min(1, 'Email is required')
    .email('Please enter a valid email')
    .max(255, 'Email must be less than 255 characters'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be less than 128 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must include uppercase, lowercase, and a number'
    ),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

type SignUpValues = z.infer<typeof signUpSchema>;

// =============================================================================
// COMPONENT
// =============================================================================

interface SignUpFormProps {
  /** Called on successful sign-up */
  onSuccess?: () => void;
  /** Link to sign-in page (optional) */
  signInLink?: React.ReactNode;
  /** Group slug for auto-join (from /join/:slug route) */
  groupSlug?: string;
  /** Language override (if parent already has it) */
  language?: Language;
}

export function SignUpForm({ onSuccess, signInLink, groupSlug, language: languageProp }: SignUpFormProps) {
  const { language: hookLanguage } = useLanguage();
  const language = languageProp ?? hookLanguage;
  const t = STRINGS[language];

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Rebuild schema when language changes so validation messages match
  const localizedSchema = useMemo(() => z.object({
    fullName: z
      .string()
      .trim()
      .max(100, t.nameMax)
      .optional(),
    email: z
      .string()
      .trim()
      .min(1, t.emailRequired)
      .email(t.emailInvalid)
      .max(255, t.emailMax),
    password: z
      .string()
      .min(8, t.passwordMin)
      .max(128, t.passwordMax)
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        t.passwordComplexity
      ),
    confirmPassword: z.string().min(1, t.confirmRequired),
  }).refine((data) => data.password === data.confirmPassword, {
    message: t.passwordsMismatch,
    path: ['confirmPassword'],
  }), [t]);

  const form = useForm<SignUpValues>({
    resolver: zodResolver(localizedSchema),
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (values: SignUpValues) => {
    setIsLoading(true);
    setError(null);

    try {
      // Sign up with user metadata
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          data: {
            full_name: values.fullName || undefined,
          },
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (signUpError) {
        // Handle common error cases with friendly messages
        if (signUpError.message.includes('already registered')) {
          setError(t.alreadyExists);
        } else if (signUpError.message.includes('rate limit')) {
          setError(t.rateLimit);
        } else {
          setError(signUpError.message);
        }
        return;
      }

      // If we have a group slug and a session was created (auto-confirm enabled),
      // join the group immediately
      if (groupSlug && data.session) {
        const { data: joinResult, error: joinError } = await supabase.rpc(
          'join_group_by_slug',
          { group_slug: groupSlug }
        );

        if (joinError) {
          console.error('Error joining group:', joinError);
          // Don't block signup success, just log the error
        } else if (joinResult) {
          const result = joinResult as unknown as { success: boolean; error?: string };
          if (!result.success) {
            console.warn('Failed to join group:', result.error);
          }
        }
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
          {/* Full Name Field (Optional) */}
          <FormField
            control={form.control}
            name="fullName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {t.fullName} <span className="text-muted-foreground">{t.optional}</span>
                </FormLabel>
                <FormControl>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="John Doe"
                      autoComplete="name"
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
                      autoComplete="new-password"
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

          {/* Confirm Password Field */}
          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t.confirmPassword}</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="password"
                      placeholder="••••••••"
                      autoComplete="new-password"
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
                {t.creatingAccount}
              </>
            ) : groupSlug ? (
              t.createAccountJoin
            ) : (
              t.createAccount
            )}
          </Button>

          {/* Sign In Link */}
          {signInLink && (
            <div className="text-center text-sm text-muted-foreground">
              {signInLink}
            </div>
          )}
        </form>
      </Form>
    </div>
  );
}
