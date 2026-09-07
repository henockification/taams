ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "failed_login_count" integer NOT NULL DEFAULT 0;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "locked_until" timestamp with time zone;
ALTER TABLE "auth_sessions" ADD COLUMN IF NOT EXISTS "last_seen_at" timestamp with time zone NOT NULL DEFAULT now();
