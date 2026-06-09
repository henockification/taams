import { createAuthClient } from "better-auth/react";
import { emailOTPClient, inferAdditionalFields } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3009",
  plugins: [
    inferAdditionalFields({
      user: {
        tenantId: { type: "string", input: false },
        role: { type: "string[]", input: false }
      }
    }), 
    emailOTPClient()
  ],
  fetchOptions: {
    credentials: 'include', // Important for cookies
  },
});

export const {
  signIn,
  signOut,
  signUp,
  useSession,
  getSession,
} = authClient;
