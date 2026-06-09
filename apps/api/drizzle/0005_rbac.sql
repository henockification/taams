CREATE TABLE IF NOT EXISTS "roles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "roles_name_unique" UNIQUE("name")
);

CREATE TABLE IF NOT EXISTS "permissions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "resource" text NOT NULL,
  "action" text NOT NULL,
  "description" text,
  "created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "permissions_name_unique" UNIQUE("name"),
  CONSTRAINT "permissions_resource_action_unique" UNIQUE("resource", "action")
);

CREATE TABLE IF NOT EXISTS "role_permissions" (
  "role_id" uuid NOT NULL,
  "permission_id" uuid NOT NULL,
  "created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "role_permissions_role_id_permission_id_pk" PRIMARY KEY("role_id", "permission_id")
);

CREATE TABLE IF NOT EXISTS "user_roles" (
  "user_id" text NOT NULL,
  "role_id" uuid NOT NULL,
  "created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "user_roles_user_id_role_id_pk" PRIMARY KEY("user_id", "role_id")
);

DO $$ BEGIN
 ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
