ALTER TABLE "approval_requests"
  ALTER COLUMN "params_hash" TYPE CHAR(64),
  ALTER COLUMN "expires_at" SET NOT NULL;

ALTER TABLE "approval_requests"
  ADD CONSTRAINT "approval_requests_status_decided_at_check"
  CHECK (
    ("status" = 'pending' AND "decided_at" IS NULL)
    OR
    ("status" <> 'pending' AND "decided_at" IS NOT NULL)
  ),
  ADD CONSTRAINT "approval_requests_expires_at_after_created_at_check"
  CHECK ("expires_at" > "created_at");

CREATE INDEX "approval_requests_status_expires_at_idx"
  ON "approval_requests" ("status", "expires_at");

CREATE INDEX "approval_requests_resource_type_resource_id_created_at_idx"
  ON "approval_requests" ("resource_type", "resource_id", "created_at");

CREATE INDEX "approval_requests_created_at_idx"
  ON "approval_requests" ("created_at");

ALTER TABLE "approval_decisions"
  ALTER COLUMN "approver_id" SET NOT NULL,
  ALTER COLUMN "auth_method" SET NOT NULL;

ALTER TABLE "approval_decisions"
  ADD CONSTRAINT "approval_decisions_approval_request_id_key"
  UNIQUE ("approval_request_id");

CREATE INDEX "approval_decisions_approver_id_created_at_idx"
  ON "approval_decisions" ("approver_id", "created_at");

ALTER TABLE "capabilities"
  ALTER COLUMN "params_hash" TYPE CHAR(64),
  ALTER COLUMN "token_hash" TYPE CHAR(64);

ALTER TABLE "capabilities"
  ADD CONSTRAINT "capabilities_approval_request_id_key"
  UNIQUE ("approval_request_id"),
  ADD CONSTRAINT "capabilities_expires_at_after_issued_at_check"
  CHECK ("expires_at" > "issued_at");

CREATE INDEX "capabilities_expires_at_idx"
  ON "capabilities" ("expires_at");

CREATE INDEX "capabilities_resource_type_resource_id_idx"
  ON "capabilities" ("resource_type", "resource_id");

CREATE INDEX "audit_events_approval_request_id_created_at_idx"
  ON "audit_events" ("approval_request_id", "created_at");

CREATE INDEX "audit_events_event_type_created_at_idx"
  ON "audit_events" ("event_type", "created_at");

ALTER TABLE "immutable_events"
  ALTER COLUMN "payload_hash" TYPE CHAR(64);

CREATE INDEX "immutable_events_approval_request_id_created_at_idx"
  ON "immutable_events" ("approval_request_id", "created_at");

CREATE INDEX "immutable_events_event_type_created_at_idx"
  ON "immutable_events" ("event_type", "created_at");

ALTER TABLE "ledger_entries"
  ALTER COLUMN "previous_hash" TYPE CHAR(64),
  ALTER COLUMN "entry_hash" TYPE CHAR(64);

ALTER TABLE "ledger_entries"
  ADD CONSTRAINT "ledger_entries_entry_hash_key"
  UNIQUE ("entry_hash");

CREATE INDEX "ledger_entries_created_at_idx"
  ON "ledger_entries" ("created_at");

ALTER TABLE "webhook_deliveries"
  ADD CONSTRAINT "webhook_deliveries_approval_request_id_event_type_key"
  UNIQUE ("approval_request_id", "event_type"),
  ADD CONSTRAINT "webhook_deliveries_attempt_count_check"
  CHECK ("attempt_count" >= 0),
  ADD CONSTRAINT "webhook_deliveries_attempt_timestamps_check"
  CHECK (
    ("attempt_count" = 0 AND "last_attempt_at" IS NULL)
    OR
    ("attempt_count" > 0 AND "last_attempt_at" IS NOT NULL)
  );

CREATE INDEX "webhook_deliveries_status_created_at_idx"
  ON "webhook_deliveries" ("status", "created_at");

CREATE INDEX "webhook_deliveries_approval_request_id_created_at_idx"
  ON "webhook_deliveries" ("approval_request_id", "created_at");
