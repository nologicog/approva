DROP INDEX IF EXISTS "policies_organization_id_slug_key";
DROP INDEX IF EXISTS "policies_organization_id_created_at_idx";

ALTER TABLE "policies"
  ADD COLUMN "action" TEXT NOT NULL DEFAULT '*',
  ADD COLUMN "resource_type" TEXT NOT NULL DEFAULT '*',
  ADD COLUMN "risk_level" "RiskLevel" NOT NULL DEFAULT 'high',
  ADD COLUMN "approval_required" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "approver_roles" "OrganizationMemberRole"[] NOT NULL DEFAULT ARRAY['owner', 'admin', 'approver']::"OrganizationMemberRole"[];

ALTER TABLE "policies"
  DROP COLUMN IF EXISTS "name",
  DROP COLUMN IF EXISTS "slug",
  DROP COLUMN IF EXISTS "config",
  DROP COLUMN IF EXISTS "updated_at";

CREATE INDEX "policies_org_created_idx"
  ON "policies"("organization_id", "created_at");

CREATE UNIQUE INDEX "policies_org_action_resource_risk_key"
  ON "policies"("organization_id", "action", "resource_type", "risk_level");

CREATE INDEX "policies_org_match_idx"
  ON "policies"("organization_id", "action", "resource_type", "risk_level");
