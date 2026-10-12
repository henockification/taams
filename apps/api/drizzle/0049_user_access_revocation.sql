-- Administrators can revoke a user's access: revoked users cannot sign in and lose
-- their active sessions until access is restored.
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "access_revoked_at" timestamp (6) with time zone;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "access_revoked_by" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "access_revoked_reason" text;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "user" ADD CONSTRAINT "user_access_revoked_by_user_id_fk" FOREIGN KEY ("access_revoked_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
