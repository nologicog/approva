CREATE TYPE "IntegrationType" AS ENUM ('slack', 'webhook', 'email');

ALTER TABLE "integrations"
  ADD COLUMN "type" "IntegrationType",
  ADD COLUMN "config_json" JSONB;

UPDATE "integrations"
SET
  "type" = CASE
    WHEN "provider" = 'slack' THEN 'slack'::"IntegrationType"
    WHEN "provider" = 'email' THEN 'email'::"IntegrationType"
    ELSE 'webhook'::"IntegrationType"
  END,
  "config_json" = COALESCE("config", '{}'::jsonb)
WHERE "type" IS NULL;

ALTER TABLE "integrations"
  ALTER COLUMN "type" SET NOT NULL,
  ALTER COLUMN "config_json" SET NOT NULL;

ALTER TABLE "integrations"
  DROP COLUMN IF EXISTS "provider",
  DROP COLUMN IF EXISTS "external_account_id",
  DROP COLUMN IF EXISTS "config",
  DROP COLUMN IF EXISTS "updated_at";

DROP INDEX IF EXISTS "integrations_organization_id_provider_idx";

CREATE UNIQUE INDEX "integrations_org_type_key"
  ON "integrations"("organization_id", "type");

CREATE INDEX "integrations_org_created_idx"
  ON "integrations"("organization_id", "created_at");
