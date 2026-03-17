CREATE TABLE "organization_subscriptions" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "provider_customer_id" TEXT,
  "provider_subscription_id" TEXT,
  "plan_code" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "current_period_end" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "organization_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "organization_subscriptions_organization_id_key"
  ON "organization_subscriptions"("organization_id");

CREATE INDEX "organization_subscriptions_provider_customer_idx"
  ON "organization_subscriptions"("provider", "provider_customer_id");

CREATE INDEX "organization_subscriptions_provider_subscription_idx"
  ON "organization_subscriptions"("provider", "provider_subscription_id");

CREATE INDEX "organization_subscriptions_plan_status_idx"
  ON "organization_subscriptions"("plan_code", "status");

ALTER TABLE "organization_subscriptions"
  ADD CONSTRAINT "organization_subscriptions_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "organization_subscriptions" (
  "id",
  "organization_id",
  "provider",
  "plan_code",
  "status",
  "created_at",
  "updated_at"
)
SELECT
  'sub_' || substr(md5(id || '_free_beta'), 1, 24),
  id,
  'internal',
  'free_beta',
  'active',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "organizations"
ON CONFLICT ("organization_id") DO NOTHING;
