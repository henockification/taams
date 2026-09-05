"use client";

import { useCallback, useEffect, useState } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3012";

type AuthError = {
  message: string;
  code?: string;
  status?: number;
};

async function authFetch(path: string, init?: RequestInit) {
  const response = await fetch(`${API_BASE_URL}/api/auth${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    return {
      data: null,
      error: {
        message: data?.message || data?.error || "Request failed",
        code: data?.code,
        status: response.status,
      } as AuthError,
    };
  }

  return { data, error: null };
}

export const authClient = {
  signIn: {
    email: async ({ email, password, otp, fetchOptions, callbackURL }: any) => {
      return authFetch("/sign-in/email", {
        method: "POST",
        headers: fetchOptions?.headers,
        body: JSON.stringify({ email, password, otp, callbackURL }),
      });
    },
    social: async (_input?: any) => ({
      data: null,
      error: { message: "Social sign-in is not enabled", status: 400 } as AuthError,
    }),
  },
  signUp: {
    email: async (_input?: any) => ({
      data: null,
      error: { message: "Public signup is disabled", status: 404 } as AuthError,
    }),
  },
  signOut: async () => authFetch("/sign-out", { method: "POST" }),
  getSession: async () => authFetch("/get-session", { method: "GET" }),
  requestPasswordReset: async ({ email, fetchOptions }: any) => {
    return authFetch("/request-password-reset", {
      method: "POST",
      headers: fetchOptions?.headers,
      body: JSON.stringify({ email }),
    });
  },
  resetPassword: async ({ email, otp, token, newPassword }: any) => {
    return authFetch("/reset-password", {
      method: "POST",
      body: JSON.stringify({ email, otp: otp ?? token, newPassword }),
    });
  },
  emailOtp: {
    verifyEmail: async ({ email, otp }: any) => {
      return authFetch("/email-otp/verify-email", {
        method: "POST",
        body: JSON.stringify({ email, otp }),
      });
    },
    sendVerificationOtp: async ({ email }: any) => {
      return authFetch("/email-otp/send-verification-otp", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
    },
  },
};

export const signIn = authClient.signIn;
export const signOut = authClient.signOut;
export const signUp = authClient.signUp;
export const getSession = authClient.getSession;

export function useSession() {
  const [data, setData] = useState<any>(null);
  const [isPending, setIsPending] = useState(true);

  const loadSession = useCallback(async () => {
    setIsPending(true);
    const result = await authClient.getSession();
    setData(result.data);
    setIsPending(false);
    return result;
  }, []);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  return {
    data,
    isPending,
    refetch: loadSession,
  };
}
