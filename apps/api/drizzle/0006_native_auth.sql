CREATE TABLE IF NOT EXISTS "auth_credentials" (
  "user_id" text PRIMARY KEY NOT NULL,
  "password_hash" text NOT NULL,
  "created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp(6) with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "auth_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "token" text NOT NULL,
  "user_id" text NOT NULL,
  "expires_at" timestamp(6) with time zone NOT NULL,
  "ip_address" text,
  "user_agent" text,
  "created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "auth_sessions_token_unique" UNIQUE("token")
);

CREATE TABLE IF NOT EXISTS "auth_verification_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "purpose" text NOT NULL,
  "identifier" text NOT NULL,
  "token_hash" text NOT NULL,
  "expires_at" timestamp(6) with time zone NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "consumed_at" timestamp(6) with time zone,
  "created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp(6) with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "auth_verification_tokens_identifier_purpose_idx"
  ON "auth_verification_tokens" ("identifier", "purpose");

DO $$ BEGIN
 ALTER TABLE "auth_credentials" ADD CONSTRAINT "auth_credentials_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DROP TABLE IF EXISTS "account" CASCADE;
DROP TABLE IF EXISTS "session" CASCADE;
DROP TABLE IF EXISTS "verification" CASCADE;
