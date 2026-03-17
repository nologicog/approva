CREATE TYPE "ApiKeyScope" AS ENUM (
  'approval_requests_create',
  'approval_requests_read',
  'capabilities_verify',
  'capabilities_use',
  'webhooks_manage'
);

CREATE TABLE "service_accounts" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "created_by_user_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revoked_at" TIMESTAMP(3),

  CONSTRAINT "service_accounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "organization_api_keys" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "service_account_id" TEXT,
  "name" TEXT NOT NULL,
  "key_prefix" TEXT NOT NULL,
  "key_hash" CHAR(64) NOT NULL,
  "scopes" "ApiKeyScope"[] NOT NULL,
  "created_by_user_id" TEXT,
  "last_used_at" TIMESTAMP(3),
  "revoked_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "organization_api_keys_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "service_accounts_org_created_idx"
  ON "service_accounts"("organization_id", "created_at");

CREATE INDEX "service_accounts_org_revoked_created_idx"
  ON "service_accounts"("organization_id", "revoked_at", "created_at");

CREATE INDEX "service_accounts_created_by_user_created_idx"
  ON "service_accounts"("created_by_user_id", "created_at");

CREATE UNIQUE INDEX "organization_api_keys_key_prefix_key"
  ON "organization_api_keys"("key_prefix");

CREATE UNIQUE INDEX "organization_api_keys_key_hash_key"
  ON "organization_api_keys"("key_hash");

CREATE INDEX "organization_api_keys_org_created_idx"
  ON "organization_api_keys"("organization_id", "created_at");

CREATE INDEX "organization_api_keys_org_revoked_created_idx"
  ON "organization_api_keys"("organization_id", "revoked_at", "created_at");

CREATE INDEX "organization_api_keys_org_last_used_idx"
  ON "organization_api_keys"("organization_id", "last_used_at");

CREATE INDEX "organization_api_keys_service_account_created_idx"
  ON "organization_api_keys"("service_account_id", "created_at");

CREATE INDEX "organization_api_keys_created_by_user_created_idx"
  ON "organization_api_keys"("created_by_user_id", "created_at");

ALTER TABLE "service_accounts"
  ADD CONSTRAINT "service_accounts_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "service_accounts"
  ADD CONSTRAINT "service_accounts_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "dashboard_users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "organization_api_keys"
  ADD CONSTRAINT "organization_api_keys_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "organization_api_keys"
  ADD CONSTRAINT "organization_api_keys_service_account_id_fkey"
  FOREIGN KEY ("service_account_id") REFERENCES "service_accounts"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "organization_api_keys"
  ADD CONSTRAINT "organization_api_keys_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "dashboard_users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
