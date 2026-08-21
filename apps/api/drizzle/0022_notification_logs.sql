CREATE TABLE IF NOT EXISTS "notification_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "event_type" varchar(80) NOT NULL,
  "channel" varchar(20) NOT NULL,
  "status" varchar(20) DEFAULT 'PENDING' NOT NULL,
  "recipient_user_id" text,
  "recipient_employee_id" uuid,
  "recipient_name" text,
  "destination" text,
  "subject" text,
  "message" text NOT NULL,
  "locale" varchar(10) DEFAULT 'en' NOT NULL,
  "related_entity_type" varchar(80),
  "related_entity_id" uuid,
  "metadata" jsonb,
  "attempts" integer DEFAULT 0 NOT NULL,
  "last_attempt_at" timestamp,
  "next_attempt_at" timestamp,
  "provider_message_id" text,
  "provider_response" jsonb,
  "error_message" text,
  "sent_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "chk_notification_logs_channel" CHECK ("notification_logs"."channel" IN ('EMAIL', 'SMS')),
  CONSTRAINT "chk_notification_logs_status" CHECK ("notification_logs"."status" IN ('PENDING', 'SENT', 'FAILED', 'SKIPPED'))
);

DO $$ BEGIN
 ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_recipient_user_id_user_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_recipient_employee_id_employees_id_fk" FOREIGN KEY ("recipient_employee_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "idx_notification_logs_event_type" ON "notification_logs" USING btree ("event_type");
CREATE INDEX IF NOT EXISTS "idx_notification_logs_channel_status" ON "notification_logs" USING btree ("channel", "status");
CREATE INDEX IF NOT EXISTS "idx_notification_logs_created_at" ON "notification_logs" USING btree ("created_at");
CREATE INDEX IF NOT EXISTS "idx_notification_logs_recipient_user_id" ON "notification_logs" USING btree ("recipient_user_id");
CREATE INDEX IF NOT EXISTS "idx_notification_logs_recipient_employee_id" ON "notification_logs" USING btree ("recipient_employee_id");
CREATE INDEX IF NOT EXISTS "idx_notification_logs_related_entity" ON "notification_logs" USING btree ("related_entity_type", "related_entity_id");
