-- Data repair: re-applies authorized leave to attendance daily records.
-- 1. Records generated or supervisor-approved before the leave was authorized kept 0 leave days,
--    so those days counted as absent.
-- 2. Non-annual leave was credited as working days / calendar days (e.g. 10 working days over 12
--    calendar days = 0.83 per day), leaving part of every leave day as uncovered absence.
-- Leave value per day now matches the attendance generator (lib/attendance/leave-days.ts):
--   annual leave: its approved date value (1.00 or 0.50); confirmed ISMIS day: 1.00;
--   other leave: 1.00 on a working day, 0.50 on a half-day holiday, 0 on a rest day / full holiday.
-- Only leave days, payable days, absence days and the payroll note are recalculated, from figures
-- already on the record (punch attendance, holiday, off day). Status, approvals and punches are kept.
-- Never touched: HR-approved (payroll-ready) records and records with a manual payroll adjustment.
-- Idempotent: a second run changes nothing. Safe to run by hand as well.
WITH scope AS (
  SELECT DISTINCT a.id
  FROM "attendance_daily_records" a
  JOIN "leave_requests" r
    ON r."employee_id" = a."employee_id"
   AND r."status" = 'AUTHORIZED'
   AND a."attendance_date" BETWEEN r."start_date" AND r."end_date"
  WHERE a."status" <> 'HR_APPROVED'
    AND NOT EXISTS (SELECT 1 FROM "attendance_daily_record_adjustments" adj WHERE adj."attendance_daily_record_id" = a.id)
),
leave_parts AS (
  SELECT
    a.id,
    -- Confirmed ISMIS leave day.
    CASE WHEN EXISTS (
      SELECT 1 FROM "ismis_leave_days" d
      JOIN "ismis_leave_import_batches" b ON b."id" = d."batch_id" AND b."status" = 'COMPLETED'
      WHERE d."employee_id" = a."employee_id" AND d."attendance_date" = a."attendance_date"
    ) THEN 1 ELSE 0 END::numeric AS ismis_days,
    -- Annual leave: approved value of this date (legacy requests without dates: requested / calendar days).
    COALESCE((
      SELECT SUM(CASE
        WHEN EXISTS (SELECT 1 FROM "annual_leave_request_dates" x WHERE x."leave_request_id" = r."id")
          THEN LEAST(1, COALESCE((
            SELECT SUM(x."approved_day_value") FROM "annual_leave_request_dates" x
            WHERE x."leave_request_id" = r."id"
              AND x."leave_date" = a."attendance_date"
              AND x."status" = 'APPROVED'
              AND COALESCE(x."utilization_status", 'SCHEDULED') IN ('SCHEDULED', 'CONSUMED')
          ), 0))
        ELSE LEAST(1, round(r."requested_days" / GREATEST(1, r."end_date" - r."start_date" + 1), 2))
      END)
      FROM "leave_requests" r
      JOIN "leave_types" t ON t."id" = r."leave_type_id"
      WHERE r."employee_id" = a."employee_id" AND r."status" = 'AUTHORIZED'
        AND a."attendance_date" BETWEEN r."start_date" AND r."end_date"
        AND upper(trim(t."code")) = 'ANNUAL'
    ), 0) AS annual_days,
    EXISTS (
      SELECT 1 FROM "leave_requests" r JOIN "leave_types" t ON t."id" = r."leave_type_id"
      WHERE r."employee_id" = a."employee_id" AND r."status" = 'AUTHORIZED'
        AND a."attendance_date" BETWEEN r."start_date" AND r."end_date"
        AND upper(trim(t."code")) NOT IN ('ANNUAL', 'UNPAID')
    ) AS whole_day_leave,
    EXISTS (
      SELECT 1 FROM "leave_requests" r JOIN "leave_types" t ON t."id" = r."leave_type_id"
      WHERE r."employee_id" = a."employee_id" AND r."status" = 'AUTHORIZED'
        AND a."attendance_date" BETWEEN r."start_date" AND r."end_date"
        AND upper(trim(t."code")) = 'UNPAID'
    ) AS whole_day_unpaid,
    -- Duty part of the day: holiday_days is 1.00 on rest days and full holidays, 0.50 on half-day holidays.
    GREATEST(0, 1 - a."holiday_days") AS duty_days
  FROM "attendance_daily_records" a
  JOIN scope s ON s.id = a.id
),
values_cte AS (
  SELECT
    p.id,
    LEAST(1, LEAST(1, p.ismis_days + p.annual_days) + CASE WHEN p.whole_day_leave THEN p.duty_days ELSE 0 END) AS leave_days,
    CASE WHEN p.whole_day_unpaid THEN p.duty_days ELSE 0 END AS unpaid_days
  FROM leave_parts p
),
payroll AS (
  SELECT
    a.id,
    a."attendance_days" AS attendance_days,
    v.leave_days,
    v.unpaid_days,
    a."holiday_days" AS holiday_days,
    COALESCE(h."name_en", CASE WHEN a."is_off_day" THEN 'Scheduled off day' END, 'Institution off day') AS holiday_name,
    -- Approved overtime adds its own segment to the note (syncApprovedOvertimeToDailyRecord); keep it.
    substring(a."payroll_note" FROM 'Approved overtime [^;]+') AS overtime_note,
    LEAST(1, LEAST(1, a."attendance_days" + v.leave_days) + a."holiday_days") AS payable_days
  FROM "attendance_daily_records" a
  JOIN values_cte v ON v.id = a.id
  LEFT JOIN "holidays" h ON h."id" = a."holiday_id"
),
computed AS (
  SELECT
    p.*,
    GREATEST(0, 1 - p.payable_days) AS absence_days,
    LEAST(GREATEST(0, 1 - p.payable_days), p.unpaid_days) AS unpaid_payroll_days
  FROM payroll p
),
final AS (
  SELECT
    c.id,
    round(c.leave_days, 2)::numeric(4, 2) AS leave_days,
    round(c.payable_days, 2)::numeric(4, 2) AS payable_days,
    round(c.absence_days, 2)::numeric(4, 2) AS absence_days,
    -- Same note text as the attendance generator (resolvePayrollDays), then the overtime segment.
    NULLIF(concat_ws('; ',
      CASE WHEN c.attendance_days = 0.5 THEN 'Half-day attendance from one completed schedule session' END,
      CASE WHEN c.leave_days > 0 THEN 'Approved leave ' || round(c.leave_days, 2)::numeric(4, 2)::text || ' day(s)' END,
      CASE WHEN c.holiday_days > 0 THEN 'Holiday/off day ' || round(c.holiday_days, 2)::numeric(4, 2)::text || ' day(s): ' || c.holiday_name END,
      CASE WHEN c.unpaid_payroll_days > 0 THEN 'Approved unpaid leave ' || round(c.unpaid_payroll_days, 2)::numeric(4, 2)::text || ' day(s) for payroll' END,
      CASE WHEN c.absence_days - c.unpaid_payroll_days > 0 THEN 'Uncovered absence ' || round(c.absence_days - c.unpaid_payroll_days, 2)::numeric(4, 2)::text || ' day(s)' END,
      c.overtime_note
    ), '') AS payroll_note
  FROM computed c
)
UPDATE "attendance_daily_records" a
SET
  "leave_days" = f.leave_days,
  "payable_days" = f.payable_days,
  "absence_days" = f.absence_days,
  "payroll_note" = f.payroll_note,
  "updated_at" = CURRENT_TIMESTAMP
FROM final f
WHERE a.id = f.id
  AND (
    a."leave_days" IS DISTINCT FROM f.leave_days
    OR a."payable_days" IS DISTINCT FROM f.payable_days
    OR a."absence_days" IS DISTINCT FROM f.absence_days
    OR a."payroll_note" IS DISTINCT FROM f.payroll_note
  );
