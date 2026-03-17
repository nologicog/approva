ALTER TABLE "organizations"
  ADD COLUMN "onboarding_completed_at" TIMESTAMP(3);

UPDATE "organizations"
SET "onboarding_completed_at" = NOW()
WHERE "onboarding_completed_at" IS NULL;

CREATE TABLE "organization_invitations" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "role" "OrganizationMemberRole" NOT NULL,
  "invited_by_user_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "accepted_at" TIMESTAMP(3),

  CONSTRAINT "organization_invitations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "organization_invitations_organization_id_email_key"
  ON "organization_invitations"("organization_id", "email");

CREATE INDEX "organization_invitations_email_accepted_expires_idx"
  ON "organization_invitations"("email", "accepted_at", "expires_at");

CREATE INDEX "organization_invitations_organization_id_created_at_idx"
  ON "organization_invitations"("organization_id", "created_at");

ALTER TABLE "organization_invitations"
  ADD CONSTRAINT "organization_invitations_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "organization_invitations"
  ADD CONSTRAINT "organization_invitations_invited_by_user_id_fkey"
  FOREIGN KEY ("invited_by_user_id") REFERENCES "dashboard_users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
