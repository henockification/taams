import { useMutation, useQueryClient } from '@tanstack/react-query';
import { authClient } from '@/lib/auth-client';
import { coreQueryKeys } from './core.hooks';

export type EmailSignInInput = {
  email: string;
  password: string;
  otp?: string;
  callbackURL?: string;
};

export const authQueryKeys = {
  session: ['auth', 'session'] as const,
};

export function useEmailSignIn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: EmailSignInInput) => {
      const result = await authClient.signIn.email(input);

      if (result.error) {
        throw result.error;
      }

      return result.data;
    },
    onSuccess: (data) => {
      if (data?.otpRequired) return;
      queryClient.removeQueries({ queryKey: coreQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: authQueryKeys.session });
    },
  });
}
