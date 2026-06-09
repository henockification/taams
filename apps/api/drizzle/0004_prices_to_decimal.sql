-- Convert price columns from integer (cents) to numeric (dollars)
-- packages.price_cents -> price
ALTER TABLE "packages" ADD COLUMN IF NOT EXISTS "price" numeric(12, 2);--> statement-breakpoint
UPDATE "packages" SET "price" = "price_cents"::numeric / 100 WHERE "price_cents" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "packages" ALTER COLUMN "price" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "packages" DROP COLUMN IF EXISTS "price_cents";--> statement-breakpoint

-- orders: subtotal_cents, discount_cents, shipping_cents, tax_cents, total_cents -> subtotal, discount, shipping, tax, total
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "subtotal" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "discount" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "shipping" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "tax" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "total" numeric(12, 2);--> statement-breakpoint
UPDATE "orders" SET "subtotal" = "subtotal_cents"::numeric / 100, "discount" = "discount_cents"::numeric / 100, "shipping" = "shipping_cents"::numeric / 100, "tax" = "tax_cents"::numeric / 100, "total" = "total_cents"::numeric / 100;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "subtotal" SET NOT NULL, ALTER COLUMN "discount" SET NOT NULL, ALTER COLUMN "shipping" SET NOT NULL, ALTER COLUMN "tax" SET NOT NULL, ALTER COLUMN "total" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" DROP COLUMN IF EXISTS "subtotal_cents", DROP COLUMN IF EXISTS "discount_cents", DROP COLUMN IF EXISTS "shipping_cents", DROP COLUMN IF EXISTS "tax_cents", DROP COLUMN IF EXISTS "total_cents";--> statement-breakpoint

-- order_items: unit_price_cents_snapshot -> unit_price_snapshot
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "unit_price_snapshot" numeric(12, 2);--> statement-breakpoint
UPDATE "order_items" SET "unit_price_snapshot" = "unit_price_cents_snapshot"::numeric / 100 WHERE "unit_price_cents_snapshot" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "unit_price_snapshot" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" DROP COLUMN IF EXISTS "unit_price_cents_snapshot";--> statement-breakpoint

-- payments.amount (integer cents) -> numeric dollars
ALTER TABLE "payments" ALTER COLUMN "amount" TYPE numeric(12, 2) USING ("amount"::numeric / 100);--> statement-breakpoint
