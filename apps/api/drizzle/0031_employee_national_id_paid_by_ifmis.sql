ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "national_id" varchar(50);
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "paid_by_ifmis" boolean DEFAULT true NOT NULL;
