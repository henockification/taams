CREATE TABLE IF NOT EXISTS "hr_units" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name_en" varchar(150) NOT NULL,
  "name_am" varchar(150),
  "code" varchar(50),
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "hr_units_name_en_unique" UNIQUE("name_en"),
  CONSTRAINT "hr_units_code_unique" UNIQUE("code")
);

CREATE TABLE IF NOT EXISTS "user_hr_units" (
  "user_id" text NOT NULL,
  "hr_unit_id" uuid NOT NULL,
  "created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "user_hr_units_user_id_hr_unit_id_pk" PRIMARY KEY("user_id","hr_unit_id")
);

ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "hr_unit_id" uuid;

DO $$ BEGIN
 ALTER TABLE "employees" ADD CONSTRAINT "employees_hr_unit_id_hr_units_id_fk" FOREIGN KEY ("hr_unit_id") REFERENCES "hr_units"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "user_hr_units" ADD CONSTRAINT "user_hr_units_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "user_hr_units" ADD CONSTRAINT "user_hr_units_hr_unit_id_hr_units_id_fk" FOREIGN KEY ("hr_unit_id") REFERENCES "hr_units"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "employees_hr_unit_id_idx" ON "employees" ("hr_unit_id");
CREATE INDEX IF NOT EXISTS "user_hr_units_user_id_idx" ON "user_hr_units" ("user_id");
CREATE INDEX IF NOT EXISTS "user_hr_units_hr_unit_id_idx" ON "user_hr_units" ("hr_unit_id");

INSERT INTO "permissions" ("name", "resource", "action", "description")
VALUES
  ('hr-units:read', 'hr-units', 'read', 'View HR units'),
  ('hr-units:add', 'hr-units', 'add', 'Create HR units'),
  ('hr-units:edit', 'hr-units', 'edit', 'Update HR units'),
  ('user-hr-units:edit', 'user-hr-units', 'edit', 'Assign HR units to users')
ON CONFLICT ("resource", "action") DO NOTHING;
