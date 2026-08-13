ALTER TABLE "leave_types" ADD COLUMN "allowed_days" numeric(8, 2);

INSERT INTO "leave_types" (
  "code",
  "name_en",
  "name_am",
  "description",
  "deducts_annual_balance",
  "requires_balance",
  "allowed_days",
  "is_active"
) VALUES
  ('ANNUAL', 'Annual Leave', 'ዓመታዊ ፈቃድ', 'Annual leave deducted from employee fiscal-year balance.', true, true, NULL, true),
  ('SICK', 'Sick Leave', 'የሕመም ፈቃድ', 'Sick leave capped by policy.', false, false, '240.00', true),
  ('MATERNITY', 'Maternity Leave', 'የወሊድ ፈቃድ', 'Maternity leave with pay.', false, false, '120.00', true),
  ('PATERNITY', 'Paternity Leave', 'የአባትነት ፈቃድ', 'Paternity leave with pay.', false, false, '10.00', true),
  ('SPECIAL_FULL_PAY', 'Special Leave with Full Pay', 'ልዩ ፈቃድ ከሙሉ ክፍያ ጋር', 'Special leave with full pay capped by policy.', false, false, '7.00', true),
  ('UNPAID', 'Unpaid Leave', 'ያለ ክፍያ ፈቃድ', 'Special leave without pay capped by policy.', false, false, '365.00', true)
ON CONFLICT ("code") DO UPDATE SET
  "name_en" = EXCLUDED."name_en",
  "name_am" = EXCLUDED."name_am",
  "description" = COALESCE("leave_types"."description", EXCLUDED."description"),
  "deducts_annual_balance" = EXCLUDED."deducts_annual_balance",
  "requires_balance" = EXCLUDED."requires_balance",
  "allowed_days" = EXCLUDED."allowed_days",
  "is_active" = true,
  "updated_at" = now();
