-- Refine the client-configured schedules in place. This migration never
-- changes employee_work_schedules assignments.

UPDATE "shifts"
SET "grace_period_minutes" = 30,
    "late_after_minutes" = 0,
    "early_out_before_minutes" = 15,
    "updated_at" = CURRENT_TIMESTAMP
WHERE "name_en" IN ('Standard Mon-Thu (08:30-17:30)', 'Standard Friday (08:30-17:30)');

UPDATE "shifts"
SET "grace_period_minutes" = 30,
    "late_after_minutes" = 0,
    "early_out_before_minutes" = 30,
    "updated_at" = CURRENT_TIMESTAMP
WHERE "name_en" = 'Cleaner (06:30-10:00)';

UPDATE "shift_segments" s
SET "name_en" = CASE WHEN s."sort_order" = 1 THEN 'Morning Session' ELSE 'Afternoon Session' END,
    "start_time" = CASE WHEN s."sort_order" = 1 THEN '08:30:00'::time ELSE '13:30:00'::time END,
    "end_time" = CASE WHEN s."sort_order" = 1 THEN '12:30:00'::time ELSE '17:30:00'::time END,
    "updated_at" = CURRENT_TIMESTAMP
FROM "shifts" sh
WHERE s."shift_id" = sh."id"
  AND sh."name_en" = 'Standard Mon-Thu (08:30-17:30)'
  AND s."sort_order" IN (1, 2);

INSERT INTO "shift_segments" ("shift_id", "name_en", "start_time", "end_time", "sort_order")
SELECT sh."id", 'Morning Session', '08:30:00'::time, '12:30:00'::time, 1
FROM "shifts" sh
WHERE sh."name_en" = 'Standard Mon-Thu (08:30-17:30)'
  AND NOT EXISTS (SELECT 1 FROM "shift_segments" s WHERE s."shift_id" = sh."id" AND s."sort_order" = 1);

INSERT INTO "shift_segments" ("shift_id", "name_en", "start_time", "end_time", "sort_order")
SELECT sh."id", 'Afternoon Session', '13:30:00'::time, '17:30:00'::time, 2
FROM "shifts" sh
WHERE sh."name_en" = 'Standard Mon-Thu (08:30-17:30)'
  AND NOT EXISTS (SELECT 1 FROM "shift_segments" s WHERE s."shift_id" = sh."id" AND s."sort_order" = 2);

INSERT INTO "shift_segments" ("shift_id", "name_en", "start_time", "end_time", "sort_order")
SELECT sh."id", 'Morning Session', '08:30:00'::time, '11:30:00'::time, 1
FROM "shifts" sh
WHERE sh."name_en" = 'Standard Friday (08:30-17:30)'
  AND NOT EXISTS (SELECT 1 FROM "shift_segments" s WHERE s."shift_id" = sh."id" AND s."sort_order" = 1);

INSERT INTO "shift_segments" ("shift_id", "name_en", "start_time", "end_time", "sort_order")
SELECT sh."id", 'Afternoon Session', '13:30:00'::time, '17:30:00'::time, 2
FROM "shifts" sh
WHERE sh."name_en" = 'Standard Friday (08:30-17:30)'
  AND NOT EXISTS (SELECT 1 FROM "shift_segments" s WHERE s."shift_id" = sh."id" AND s."sort_order" = 2);

UPDATE "shift_segments" s
SET "name_en" = CASE WHEN s."sort_order" = 1 THEN 'Morning Session' ELSE 'Afternoon Session' END,
    "start_time" = CASE WHEN s."sort_order" = 1 THEN '08:30:00'::time ELSE '13:30:00'::time END,
    "end_time" = CASE WHEN s."sort_order" = 1 THEN '11:30:00'::time ELSE '17:30:00'::time END,
    "updated_at" = CURRENT_TIMESTAMP
FROM "shifts" sh
WHERE s."shift_id" = sh."id"
  AND sh."name_en" = 'Standard Friday (08:30-17:30)'
  AND s."sort_order" IN (1, 2);

INSERT INTO "shift_breaks" ("shift_id", "name_en", "start_time", "end_time", "is_paid")
SELECT sh."id", 'Lunch', '12:30:00'::time, '13:30:00'::time, false
FROM "shifts" sh
WHERE sh."name_en" = 'Standard Mon-Thu (08:30-17:30)'
  AND NOT EXISTS (
    SELECT 1 FROM "shift_breaks" b WHERE b."shift_id" = sh."id" AND b."name_en" = 'Lunch'
  );

INSERT INTO "shift_breaks" ("shift_id", "name_en", "start_time", "end_time", "is_paid")
SELECT sh."id", 'Friday Lunch', '11:30:00'::time, '13:30:00'::time, false
FROM "shifts" sh
WHERE sh."name_en" = 'Standard Friday (08:30-17:30)'
  AND NOT EXISTS (
    SELECT 1 FROM "shift_breaks" b WHERE b."shift_id" = sh."id" AND b."name_en" = 'Friday Lunch'
  );

-- Create the two special-purpose shifts only when the client has not created
-- them yet; existing records with these names are reused unchanged.
INSERT INTO "shifts" ("name_en", "grace_period_minutes", "late_after_minutes", "early_out_before_minutes", "is_overnight")
SELECT 'Cafeteria (06:30-16:30)', 30, 0, 15, false
WHERE NOT EXISTS (SELECT 1 FROM "shifts" WHERE "name_en" = 'Cafeteria (06:30-16:30)');

INSERT INTO "shift_segments" ("shift_id", "name_en", "start_time", "end_time", "sort_order")
SELECT sh."id", 'Cafeteria Duty', '06:30:00'::time, '16:30:00'::time, 1
FROM "shifts" sh
WHERE sh."name_en" = 'Cafeteria (06:30-16:30)'
  AND NOT EXISTS (SELECT 1 FROM "shift_segments" s WHERE s."shift_id" = sh."id" AND s."sort_order" = 1);

UPDATE "shifts"
SET "grace_period_minutes" = 30, "late_after_minutes" = 0, "early_out_before_minutes" = 15,
    "is_overnight" = false, "updated_at" = CURRENT_TIMESTAMP
WHERE "name_en" = 'Cafeteria (06:30-16:30)';

UPDATE "shift_segments" s
SET "name_en" = 'Cafeteria Duty', "start_time" = '06:30:00'::time, "end_time" = '16:30:00'::time,
    "is_active" = true, "updated_at" = CURRENT_TIMESTAMP
FROM "shifts" sh
WHERE s."shift_id" = sh."id" AND sh."name_en" = 'Cafeteria (06:30-16:30)' AND s."sort_order" = 1;

INSERT INTO "shifts" ("name_en", "grace_period_minutes", "late_after_minutes", "early_out_before_minutes", "is_overnight")
SELECT 'Security 24h Duty (06:30-06:30)', 30, 0, 15, true
WHERE NOT EXISTS (SELECT 1 FROM "shifts" WHERE "name_en" = 'Security 24h Duty (06:30-06:30)');

INSERT INTO "shift_segments" ("shift_id", "name_en", "start_time", "end_time", "sort_order")
SELECT sh."id", 'Security 24-hour Duty', '06:30:00'::time, '06:30:00'::time, 1
FROM "shifts" sh
WHERE sh."name_en" = 'Security 24h Duty (06:30-06:30)'
  AND NOT EXISTS (SELECT 1 FROM "shift_segments" s WHERE s."shift_id" = sh."id" AND s."sort_order" = 1);

UPDATE "shifts"
SET "grace_period_minutes" = 30, "late_after_minutes" = 0, "early_out_before_minutes" = 15,
    "is_overnight" = true, "updated_at" = CURRENT_TIMESTAMP
WHERE "name_en" = 'Security 24h Duty (06:30-06:30)';

UPDATE "shift_segments" s
SET "name_en" = 'Security 24-hour Duty', "start_time" = '06:30:00'::time, "end_time" = '06:30:00'::time,
    "is_active" = true, "updated_at" = CURRENT_TIMESTAMP
FROM "shifts" sh
WHERE s."shift_id" = sh."id" AND sh."name_en" = 'Security 24h Duty (06:30-06:30)' AND s."sort_order" = 1;

INSERT INTO "shift_segments" ("shift_id", "name_en", "start_time", "end_time", "sort_order")
SELECT sh."id", 'Cleaner Duty', '06:30:00'::time, '10:00:00'::time, 1
FROM "shifts" sh
WHERE sh."name_en" = 'Cleaner (06:30-10:00)'
  AND NOT EXISTS (SELECT 1 FROM "shift_segments" s WHERE s."shift_id" = sh."id" AND s."sort_order" = 1);

UPDATE "shift_segments" s
SET "name_en" = 'Cleaner Duty', "start_time" = '06:30:00'::time, "end_time" = '10:00:00'::time,
    "is_active" = true, "updated_at" = CURRENT_TIMESTAMP
FROM "shifts" sh
WHERE s."shift_id" = sh."id" AND sh."name_en" = 'Cleaner (06:30-10:00)' AND s."sort_order" = 1;

UPDATE "work_schedules"
SET "schedule_type" = 'ROSTER', "roster_on_days" = 1, "roster_off_days" = 2, "updated_at" = CURRENT_TIMESTAMP
WHERE "name_en" = 'Security Roster';

UPDATE "work_schedules"
SET "schedule_type" = 'WEEKLY', "roster_on_days" = 1, "roster_off_days" = 0, "updated_at" = CURRENT_TIMESTAMP
WHERE "name_en" IN ('Standard Week', 'Cleaner', 'Cafeteria');

UPDATE "work_schedule_days" d
SET "shift_id" = sh."id", "updated_at" = CURRENT_TIMESTAMP
FROM "work_schedules" ws, "shifts" sh
WHERE d."work_schedule_id" = ws."id"
  AND ws."name_en" = 'Cleaner'
  AND sh."name_en" = 'Cleaner (06:30-10:00)'
  AND d."is_off_day" = false;

UPDATE "work_schedule_days" d
SET "shift_id" = sh."id", "updated_at" = CURRENT_TIMESTAMP
FROM "work_schedules" ws, "shifts" sh
WHERE d."work_schedule_id" = ws."id"
  AND ws."name_en" = 'Cafeteria'
  AND sh."name_en" = 'Cafeteria (06:30-16:30)'
  AND d."is_off_day" = false;

UPDATE "work_schedule_days" d
SET "shift_id" = sh."id", "updated_at" = CURRENT_TIMESTAMP
FROM "work_schedules" ws, "shifts" sh
WHERE d."work_schedule_id" = ws."id"
  AND ws."name_en" = 'Security Roster'
  AND sh."name_en" = 'Security 24h Duty (06:30-06:30)'
  AND d."is_off_day" = false;
