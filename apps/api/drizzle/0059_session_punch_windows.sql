-- Punch windows per session, so HR can change them on the Shifts page without a deployment.
-- NULL keeps the shift-level defaults (grace / late after / early-out), so existing shifts behave as before.
ALTER TABLE "shift_segments" ADD COLUMN IF NOT EXISTS "check_in_opens_before_minutes" integer;--> statement-breakpoint
ALTER TABLE "shift_segments" ADD COLUMN IF NOT EXISTS "late_after_minutes" integer;--> statement-breakpoint
ALTER TABLE "shift_segments" ADD COLUMN IF NOT EXISTS "check_out_closes_after_minutes" integer;--> statement-breakpoint
ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "duplicate_punch_window_minutes" integer NOT NULL DEFAULT 2;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "shift_segments" ADD CONSTRAINT "chk_shift_segment_punch_windows" CHECK (
    ("check_in_opens_before_minutes" IS NULL OR "check_in_opens_before_minutes" >= 0)
    AND ("late_after_minutes" IS NULL OR "late_after_minutes" >= 0)
    AND ("check_out_closes_after_minutes" IS NULL OR "check_out_closes_after_minutes" >= 0)
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "shifts" ADD CONSTRAINT "chk_shift_duplicate_punch_window" CHECK ("duplicate_punch_window_minutes" >= 2);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
