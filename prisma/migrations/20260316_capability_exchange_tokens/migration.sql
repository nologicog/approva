CREATE TYPE "CapabilityDeliveryMode" AS ENUM (
  'none',
  'exchange_token'
);

CREATE TYPE "MachinePrincipalType" AS ENUM (
  'api_key',
  'service_account'
);

ALTER TABLE "approval_requests"
  ADD COLUMN "deliver_capability_mode" "CapabilityDeliveryMode" NOT NULL DEFAULT 'none',
  ADD COLUMN "machine_principal_type" "MachinePrincipalType",
  ADD COLUMN "machine_principal_id" TEXT;

CREATE TABLE "capability_exchange_tokens" (
  "organization_id" TEXT NOT NULL,
  "id" TEXT NOT NULL,
  "approval_request_id" UUID NOT NULL,
  "capability_id" UUID NOT NULL,
  "exchange_token_hash" CHAR(64) NOT NULL,
  "encrypted_capability_token" TEXT,
  "callback_url" TEXT,
  "machine_principal_type" "MachinePrincipalType",
  "machine_principal_id" TEXT,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "used_at" TIMESTAMP(3),
  "revoked_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "capability_exchange_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "capability_exchange_tokens_approval_request_id_key"
  ON "capability_exchange_tokens"("approval_request_id");

CREATE UNIQUE INDEX "capability_exchange_tokens_capability_id_key"
  ON "capability_exchange_tokens"("capability_id");

CREATE UNIQUE INDEX "capability_exchange_tokens_exchange_token_hash_key"
  ON "capability_exchange_tokens"("exchange_token_hash");

CREATE INDEX "capability_exchange_tokens_org_expires_idx"
  ON "capability_exchange_tokens"("organization_id", "expires_at");

CREATE INDEX "capability_exchange_tokens_org_used_expires_idx"
  ON "capability_exchange_tokens"("organization_id", "used_at", "expires_at");

ALTER TABLE "capability_exchange_tokens"
  ADD CONSTRAINT "capability_exchange_tokens_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "capability_exchange_tokens"
  ADD CONSTRAINT "capability_exchange_tokens_approval_request_id_fkey"
  FOREIGN KEY ("approval_request_id") REFERENCES "approval_requests"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "capability_exchange_tokens"
  ADD CONSTRAINT "capability_exchange_tokens_capability_id_fkey"
  FOREIGN KEY ("capability_id") REFERENCES "capabilities"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
