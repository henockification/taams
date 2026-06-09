import { betterAuth } from "better-auth";
import { captcha, customSession, emailOTP, openAPI } from "better-auth/plugins";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../db/db";
import { emailService } from "./email";

export const auth: any = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  user: {
    additionalFields: {
      tenantId: { type: "string", required: false, input: false },
      role: { type: "string[]", required: false, input: false }
    }
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true, // Disable this since emailOTP handles verification
    sendResetPassword: async({ user, url, token}, request) => {
      try {
        await emailService.sendResetPasswordEmail(user.name, user.email, url);
      } catch (error) {
        throw error;
      }
    }
  },
  plugins: [
    ...(process.env.TURNSTILE_SECRET_KEY
      ? [
          captcha({
            provider: "cloudflare-turnstile",
            secretKey: process.env.TURNSTILE_SECRET_KEY,
          }),
        ]
      : []),
    openAPI(),
    emailOTP({
      overrideDefaultEmailVerification: true,
      sendVerificationOTP: async (data: any, request: any) => {
        try {
          await emailService.sendVerifyEmail(data.email, data.otp);
        } catch (error) {
          throw error;
        }
      },
      otpLength: 6,
      expiresIn: 600,
      allowedAttempts: 3,
      sendVerificationOnSignUp: true
    }),
    customSession(async ({ user, session }) => {
      return { user, session }; // ensures extra fields are present in getSession & sign-in responses
    }),
  ],
//   socialProviders: {
//     google: {
//       clientId: process.env.GOOGLE_CLIENT_ID || "",
//       clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
//       enabled: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
//     },
//   },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
    freshAge: 60 * 5, // Session is considered fresh if created within the last 5 minutes
  },
  advanced: {
    cookies: {
      session_token: {
        name: "taams_session", // Custom session name
        attributes: {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production", // Secure in production
          sameSite: "lax",
          path: "/",
          domain: process.env.NODE_ENV === "production" ? ".taams.com" : undefined, // Allow subdomain sharing
        },
      },
    },
  },
  trustedOrigins: [
    "http://localhost:3008", // Local development frontend
    "https://www.taams.com" // Custom domain frontend
  ],
  secret: process.env.BETTER_AUTH_SECRET || "fallback-secret-key-for-development-only",
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3009"
});
