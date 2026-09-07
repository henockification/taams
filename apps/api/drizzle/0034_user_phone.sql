ALTER TABLE "user" ALTER COLUMN "email" DROP NOT NULL;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "phone" varchar(30);
CREATE UNIQUE INDEX IF NOT EXISTS "user_phone_unique" ON "user" ("phone");
