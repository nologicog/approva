CREATE TYPE "ApproverUserStatus" AS ENUM ('active', 'disabled');

CREATE TABLE "approver_users" (
  "id" UUID NOT NULL,
  "email" TEXT NOT NULL,
  "display_name" TEXT NOT NULL,
  "status" "ApproverUserStatus" NOT NULL DEFAULT 'active',
  "registration_challenge" TEXT,
  "registration_challenge_expires_at" TIMESTAMP(3),
  "authentication_challenge" TEXT,
  "authentication_challenge_expires_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "approver_users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "webauthn_credentials" (
  "id" UUID NOT NULL,
  "approver_user_id" UUID NOT NULL,
  "credential_id" TEXT NOT NULL,
  "public_key" BYTEA NOT NULL,
  "counter" INTEGER NOT NULL,
  "transports_json" JSONB,
  "device_type" TEXT,
  "backed_up" BOOLEAN,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_used_at" TIMESTAMP(3),
  CONSTRAINT "webauthn_credentials_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "approver_sessions" (
  "id" UUID NOT NULL,
  "approver_user_id" UUID NOT NULL,
  "webauthn_credential_id" UUID,
  "session_token_hash" CHAR(64) NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "approver_sessions_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "approver_users"
  ADD CONSTRAINT "approver_users_email_key"
  UNIQUE ("email");

ALTER TABLE "webauthn_credentials"
  ADD CONSTRAINT "webauthn_credentials_credential_id_key"
  UNIQUE ("credential_id");

ALTER TABLE "approver_sessions"
  ADD CONSTRAINT "approver_sessions_session_token_hash_key"
  UNIQUE ("session_token_hash");

CREATE INDEX "approver_users_status_created_at_idx"
  ON "approver_users" ("status", "created_at");

CREATE INDEX "webauthn_credentials_approver_user_id_created_at_idx"
  ON "webauthn_credentials" ("approver_user_id", "created_at");

CREATE INDEX "webauthn_credentials_last_used_at_idx"
  ON "webauthn_credentials" ("last_used_at");

CREATE INDEX "approver_sessions_approver_user_id_created_at_idx"
  ON "approver_sessions" ("approver_user_id", "created_at");

CREATE INDEX "approver_sessions_expires_at_idx"
  ON "approver_sessions" ("expires_at");

CREATE INDEX "approver_sessions_webauthn_credential_id_created_at_idx"
  ON "approver_sessions" ("webauthn_credential_id", "created_at");

ALTER TABLE "webauthn_credentials"
  ADD CONSTRAINT "webauthn_credentials_approver_user_id_fkey"
  FOREIGN KEY ("approver_user_id") REFERENCES "approver_users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "approver_sessions"
  ADD CONSTRAINT "approver_sessions_approver_user_id_fkey"
  FOREIGN KEY ("approver_user_id") REFERENCES "approver_users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "approver_sessions"
  ADD CONSTRAINT "approver_sessions_webauthn_credential_id_fkey"
  FOREIGN KEY ("webauthn_credential_id") REFERENCES "webauthn_credentials"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
