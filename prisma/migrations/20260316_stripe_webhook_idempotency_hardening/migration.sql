ALTER TABLE "organization_subscriptions"
  ADD COLUMN "provider_last_event_id" TEXT,
  ADD COLUMN "provider_last_event_created_at" TIMESTAMP(3);

CREATE INDEX "organization_subscriptions_provider_last_event_created_idx"
  ON "organization_subscriptions"("provider", "provider_last_event_created_at");

CREATE TABLE "stripe_webhook_event_receipts" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT,
  "provider_event_id" TEXT NOT NULL,
  "event_type" TEXT NOT NULL,
  "provider_customer_id" TEXT,
  "provider_subscription_id" TEXT,
  "status" TEXT NOT NULL,
  "outcome_reason" TEXT,
  "event_created_at" TIMESTAMP(3) NOT NULL,
  "processed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "stripe_webhook_event_receipts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "stripe_webhook_event_receipts_provider_event_id_key"
  ON "stripe_webhook_event_receipts"("provider_event_id");

CREATE INDEX "stripe_webhook_event_receipts_org_created_idx"
  ON "stripe_webhook_event_receipts"("organization_id", "created_at");

CREATE INDEX "stripe_webhook_event_receipts_sub_event_created_idx"
  ON "stripe_webhook_event_receipts"("provider_subscription_id", "event_created_at");

CREATE INDEX "stripe_webhook_event_receipts_status_created_idx"
  ON "stripe_webhook_event_receipts"("status", "created_at");

ALTER TABLE "stripe_webhook_event_receipts"
  ADD CONSTRAINT "stripe_webhook_event_receipts_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
