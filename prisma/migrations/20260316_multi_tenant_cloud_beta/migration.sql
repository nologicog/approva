-- Multi-tenant Approva Cloud Beta foundation.
-- Adds organizations and organization scoping while keeping self-host installs
-- compatible through a default organization backfill.

CREATE TYPE "OrganizationMemberRole" AS ENUM ('owner', 'admin', 'member', 'approver');

CREATE TABLE "organizations" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "owner_user_id" TEXT,
  CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");
CREATE INDEX "organizations_created_at_idx" ON "organizations"("created_at");
CREATE INDEX "organizations_owner_user_id_created_at_idx"
  ON "organizations"("owner_user_id", "created_at");

CREATE TABLE "organization_members" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "role" "OrganizationMemberRole" NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "organization_members_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "organization_members_organization_id_user_id_key"
  ON "organization_members"("organization_id", "user_id");
CREATE INDEX "organization_members_user_id_created_at_idx"
  ON "organization_members"("user_id", "created_at");
CREATE INDEX "organization_members_organization_id_role_created_at_idx"
  ON "organization_members"("organization_id", "role", "created_at");

ALTER TABLE "dashboard_users"
  ADD COLUMN "active_organization_id" TEXT;

INSERT INTO "organizations" ("id", "name", "slug")
VALUES ('org_default_self_host', 'Default Organization', 'default')
ON CONFLICT ("slug") DO NOTHING;

UPDATE "organizations"
SET "owner_user_id" = (
  SELECT "id"
  FROM "dashboard_users"
  ORDER BY "id" ASC
  LIMIT 1
)
WHERE "id" = 'org_default_self_host'
  AND "owner_user_id" IS NULL;

INSERT INTO "organization_members" ("id", "organization_id", "user_id", "role", "created_at")
SELECT
  'orgmem_' || md5("dashboard_users"."id" || '_default'),
  'org_default_self_host',
  "dashboard_users"."id",
  CAST(
    CASE
      WHEN "dashboard_users"."id" = (
        SELECT "id"
        FROM "dashboard_users"
        ORDER BY "id" ASC
        LIMIT 1
      ) THEN 'owner'
      ELSE 'admin'
    END AS "OrganizationMemberRole"
  ),
  CURRENT_TIMESTAMP
FROM "dashboard_users"
ON CONFLICT ("organization_id", "user_id") DO NOTHING;

UPDATE "dashboard_users"
SET "active_organization_id" = 'org_default_self_host'
WHERE "active_organization_id" IS NULL;

CREATE INDEX "dashboard_users_active_organization_id_idx"
  ON "dashboard_users"("active_organization_id");

ALTER TABLE "approval_requests"
  ADD COLUMN "organization_id" TEXT;
ALTER TABLE "approval_decisions"
  ADD COLUMN "organization_id" TEXT;
ALTER TABLE "capabilities"
  ADD COLUMN "organization_id" TEXT;
ALTER TABLE "audit_events"
  ADD COLUMN "organization_id" TEXT;
ALTER TABLE "immutable_events"
  ADD COLUMN "organization_id" TEXT;
ALTER TABLE "ledger_entries"
  ADD COLUMN "organization_id" TEXT;
ALTER TABLE "webhook_deliveries"
  ADD COLUMN "organization_id" TEXT;

UPDATE "approval_requests"
SET "organization_id" = 'org_default_self_host'
WHERE "organization_id" IS NULL;

UPDATE "approval_decisions"
SET "organization_id" = "approval_requests"."organization_id"
FROM "approval_requests"
WHERE "approval_decisions"."approval_request_id" = "approval_requests"."id"
  AND "approval_decisions"."organization_id" IS NULL;

UPDATE "capabilities"
SET "organization_id" = "approval_requests"."organization_id"
FROM "approval_requests"
WHERE "capabilities"."approval_request_id" = "approval_requests"."id"
  AND "capabilities"."organization_id" IS NULL;

UPDATE "audit_events"
SET "organization_id" = COALESCE("approval_requests"."organization_id", 'org_default_self_host')
FROM "approval_requests"
WHERE "audit_events"."approval_request_id" = "approval_requests"."id"
  AND "audit_events"."organization_id" IS NULL;

UPDATE "audit_events"
SET "organization_id" = 'org_default_self_host'
WHERE "organization_id" IS NULL;

UPDATE "immutable_events"
SET "organization_id" = COALESCE("approval_requests"."organization_id", 'org_default_self_host')
FROM "approval_requests"
WHERE "immutable_events"."approval_request_id" = "approval_requests"."id"
  AND "immutable_events"."organization_id" IS NULL;

UPDATE "immutable_events"
SET "organization_id" = 'org_default_self_host'
WHERE "organization_id" IS NULL;

UPDATE "ledger_entries"
SET "organization_id" = "immutable_events"."organization_id"
FROM "immutable_events"
WHERE "ledger_entries"."immutable_event_id" = "immutable_events"."id"
  AND "ledger_entries"."organization_id" IS NULL;

UPDATE "ledger_entries"
SET "organization_id" = 'org_default_self_host'
WHERE "organization_id" IS NULL;

UPDATE "webhook_deliveries"
SET "organization_id" = "approval_requests"."organization_id"
FROM "approval_requests"
WHERE "webhook_deliveries"."approval_request_id" = "approval_requests"."id"
  AND "webhook_deliveries"."organization_id" IS NULL;

UPDATE "webhook_deliveries"
SET "organization_id" = 'org_default_self_host'
WHERE "organization_id" IS NULL;

ALTER TABLE "approval_requests"
  ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "approval_decisions"
  ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "capabilities"
  ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "audit_events"
  ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "immutable_events"
  ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "ledger_entries"
  ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "webhook_deliveries"
  ALTER COLUMN "organization_id" SET NOT NULL;

DROP INDEX IF EXISTS "approval_requests_status_expires_at_idx";
DROP INDEX IF EXISTS "approval_requests_resource_type_resource_id_created_at_idx";
DROP INDEX IF EXISTS "approval_requests_requested_by_system_created_at_idx";
DROP INDEX IF EXISTS "approval_requests_created_at_idx";
DROP INDEX IF EXISTS "approval_requests_requested_by_system_idempotency_key_key";
DROP INDEX IF EXISTS "approval_requests_requested_by_system_external_request_id_key";

CREATE INDEX "approval_requests_org_status_expires_idx"
  ON "approval_requests"("organization_id", "status", "expires_at");
CREATE INDEX "approval_requests_org_resource_created_idx"
  ON "approval_requests"("organization_id", "resource_type", "resource_id", "created_at");
CREATE INDEX "approval_requests_org_system_created_idx"
  ON "approval_requests"("organization_id", "requested_by_system", "created_at");
CREATE INDEX "approval_requests_org_created_idx"
  ON "approval_requests"("organization_id", "created_at");
CREATE UNIQUE INDEX "approval_requests_org_system_idemp_key"
  ON "approval_requests"("organization_id", "requested_by_system", "idempotency_key");
CREATE UNIQUE INDEX "approval_requests_org_system_external_key"
  ON "approval_requests"("organization_id", "requested_by_system", "external_request_id");

DROP INDEX IF EXISTS "approval_decisions_approver_id_created_at_idx";
CREATE INDEX "approval_decisions_organization_id_approver_id_created_at_idx"
  ON "approval_decisions"("organization_id", "approver_id", "created_at");

DROP INDEX IF EXISTS "capabilities_expires_at_idx";
DROP INDEX IF EXISTS "capabilities_revoked_at_idx";
DROP INDEX IF EXISTS "capabilities_resource_type_resource_id_idx";
CREATE INDEX "capabilities_organization_id_expires_at_idx"
  ON "capabilities"("organization_id", "expires_at");
CREATE INDEX "capabilities_organization_id_revoked_at_idx"
  ON "capabilities"("organization_id", "revoked_at");
CREATE INDEX "capabilities_organization_id_resource_type_resource_id_idx"
  ON "capabilities"("organization_id", "resource_type", "resource_id");

DROP INDEX IF EXISTS "audit_events_approval_request_id_created_at_idx";
DROP INDEX IF EXISTS "audit_events_event_type_created_at_idx";
CREATE INDEX "audit_events_organization_id_approval_request_id_created_at_idx"
  ON "audit_events"("organization_id", "approval_request_id", "created_at");
CREATE INDEX "audit_events_organization_id_event_type_created_at_idx"
  ON "audit_events"("organization_id", "event_type", "created_at");

DROP INDEX IF EXISTS "immutable_events_approval_request_id_created_at_idx";
DROP INDEX IF EXISTS "immutable_events_event_type_created_at_idx";
CREATE INDEX "immutable_events_org_request_created_idx"
  ON "immutable_events"("organization_id", "approval_request_id", "created_at");
CREATE INDEX "immutable_events_organization_id_event_type_created_at_idx"
  ON "immutable_events"("organization_id", "event_type", "created_at");

DROP INDEX IF EXISTS "ledger_entries_sequence_key";
DROP INDEX IF EXISTS "ledger_entries_created_at_idx";
CREATE UNIQUE INDEX "ledger_entries_organization_id_sequence_key"
  ON "ledger_entries"("organization_id", "sequence");
CREATE INDEX "ledger_entries_organization_id_created_at_idx"
  ON "ledger_entries"("organization_id", "created_at");

DROP INDEX IF EXISTS "webhook_deliveries_status_created_at_idx";
DROP INDEX IF EXISTS "webhook_deliveries_approval_request_id_created_at_idx";
CREATE INDEX "webhook_deliveries_organization_id_status_created_at_idx"
  ON "webhook_deliveries"("organization_id", "status", "created_at");
CREATE INDEX "webhook_deliveries_org_request_created_idx"
  ON "webhook_deliveries"("organization_id", "approval_request_id", "created_at");

CREATE TABLE "policies" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "config" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "policies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "policies_organization_id_slug_key"
  ON "policies"("organization_id", "slug");
CREATE INDEX "policies_organization_id_created_at_idx"
  ON "policies"("organization_id", "created_at");

CREATE TABLE "webhooks" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "callback_url" TEXT NOT NULL,
  "signing_secret_hash" CHAR(64),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "webhooks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "webhooks_organization_id_callback_url_key"
  ON "webhooks"("organization_id", "callback_url");
CREATE INDEX "webhooks_organization_id_created_at_idx"
  ON "webhooks"("organization_id", "created_at");

CREATE TABLE "integrations" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "external_account_id" TEXT,
  "config" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "integrations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "integrations_organization_id_provider_idx"
  ON "integrations"("organization_id", "provider");

ALTER TABLE "organizations"
  ADD CONSTRAINT "organizations_owner_user_id_fkey"
  FOREIGN KEY ("owner_user_id") REFERENCES "dashboard_users"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

ALTER TABLE "organization_members"
  ADD CONSTRAINT "organization_members_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "organization_members"
  ADD CONSTRAINT "organization_members_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "dashboard_users"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "dashboard_users"
  ADD CONSTRAINT "dashboard_users_active_organization_id_fkey"
  FOREIGN KEY ("active_organization_id") REFERENCES "organizations"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

ALTER TABLE "approval_requests"
  ADD CONSTRAINT "approval_requests_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "approval_decisions"
  ADD CONSTRAINT "approval_decisions_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "capabilities"
  ADD CONSTRAINT "capabilities_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "audit_events"
  ADD CONSTRAINT "audit_events_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "immutable_events"
  ADD CONSTRAINT "immutable_events_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "ledger_entries"
  ADD CONSTRAINT "ledger_entries_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "webhook_deliveries"
  ADD CONSTRAINT "webhook_deliveries_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "policies"
  ADD CONSTRAINT "policies_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "webhooks"
  ADD CONSTRAINT "webhooks_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "integrations"
  ADD CONSTRAINT "integrations_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;
