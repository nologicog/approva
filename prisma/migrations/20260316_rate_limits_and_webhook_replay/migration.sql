CREATE TABLE "rate_limit_windows" (
  "id" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "bucket" TEXT NOT NULL,
  "window_start" TIMESTAMP(3) NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 1,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "rate_limit_windows_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "rate_limit_windows_scope_bucket_window_start_key"
  ON "rate_limit_windows"("scope", "bucket", "window_start");

CREATE INDEX "rate_limit_windows_expires_at_idx"
  ON "rate_limit_windows"("expires_at");

CREATE TABLE "webhook_replay_windows" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "target" TEXT NOT NULL,
  "replay_key" CHAR(64) NOT NULL,
  "event_type" TEXT NOT NULL,
  "approval_request_id" UUID,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "webhook_replay_windows_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "webhook_replay_windows_org_target_replay_key_key"
  ON "webhook_replay_windows"("organization_id", "target", "replay_key");

CREATE INDEX "webhook_replay_windows_expires_at_idx"
  ON "webhook_replay_windows"("expires_at");

CREATE INDEX "webhook_replay_windows_org_created_idx"
  ON "webhook_replay_windows"("organization_id", "created_at");

ALTER TABLE "webhook_replay_windows"
  ADD CONSTRAINT "webhook_replay_windows_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
