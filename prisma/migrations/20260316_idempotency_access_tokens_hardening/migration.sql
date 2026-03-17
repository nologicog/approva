ALTER TABLE "approval_requests"
  ADD COLUMN "external_request_id" TEXT,
  ADD COLUMN "requested_by_system" TEXT,
  ADD COLUMN "requested_by_actor_id" TEXT,
  ADD COLUMN "idempotency_key" TEXT,
  ADD COLUMN "request_fingerprint_hash" CHAR(64),
  ADD COLUMN "approval_access_token_hash" CHAR(64);

UPDATE "approval_requests"
SET
  "requested_by_system" = COALESCE("requested_by_system", 'legacy-system'),
  "request_fingerprint_hash" = COALESCE(
    "request_fingerprint_hash",
    LPAD(MD5("id"::text || ':request_fingerprint'), 64, '0')
  ),
  "approval_access_token_hash" = COALESCE(
    "approval_access_token_hash",
    LPAD(MD5("id"::text || ':approval_access'), 64, '0')
  );

ALTER TABLE "approval_requests"
  ALTER COLUMN "requested_by_system" SET NOT NULL,
  ALTER COLUMN "request_fingerprint_hash" SET NOT NULL,
  ALTER COLUMN "approval_access_token_hash" SET NOT NULL;

ALTER TABLE "approval_requests"
  ADD CONSTRAINT "approval_requests_approval_access_token_hash_key"
  UNIQUE ("approval_access_token_hash"),
  ADD CONSTRAINT "approval_requests_requested_by_system_idempotency_key_key"
  UNIQUE ("requested_by_system", "idempotency_key"),
  ADD CONSTRAINT "approval_requests_requested_by_system_external_request_id_key"
  UNIQUE ("requested_by_system", "external_request_id");

CREATE INDEX "approval_requests_requested_by_system_created_at_idx"
  ON "approval_requests" ("requested_by_system", "created_at");

ALTER TABLE "capabilities"
  ADD COLUMN "revoked_at" TIMESTAMP(3);

CREATE INDEX "capabilities_revoked_at_idx"
  ON "capabilities" ("revoked_at");
