CREATE TABLE "dashboard_users" (
  "id" TEXT NOT NULL,
  "name" TEXT,
  "email" TEXT,
  "email_verified" TIMESTAMP(3),
  "image" TEXT,
  CONSTRAINT "dashboard_users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "dashboard_accounts" (
  "user_id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "provider_account_id" TEXT NOT NULL,
  "refresh_token" TEXT,
  "access_token" TEXT,
  "expires_at" INTEGER,
  "token_type" TEXT,
  "scope" TEXT,
  "id_token" TEXT,
  "session_state" TEXT
);

CREATE TABLE "dashboard_sessions" (
  "session_token" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "expires" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "dashboard_verification_tokens" (
  "identifier" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "expires" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "dashboard_authenticators" (
  "credential_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "provider_account_id" TEXT NOT NULL,
  "credential_public_key" TEXT NOT NULL,
  "counter" INTEGER NOT NULL,
  "credential_device_type" TEXT NOT NULL,
  "credential_backed_up" BOOLEAN NOT NULL,
  "transports" TEXT
);

ALTER TABLE "dashboard_users"
  ADD CONSTRAINT "dashboard_users_email_key"
  UNIQUE ("email");

ALTER TABLE "dashboard_accounts"
  ADD CONSTRAINT "dashboard_accounts_provider_provider_account_id_key"
  UNIQUE ("provider", "provider_account_id");

ALTER TABLE "dashboard_sessions"
  ADD CONSTRAINT "dashboard_sessions_session_token_key"
  UNIQUE ("session_token");

ALTER TABLE "dashboard_verification_tokens"
  ADD CONSTRAINT "dashboard_verification_tokens_identifier_token_key"
  UNIQUE ("identifier", "token");

ALTER TABLE "dashboard_verification_tokens"
  ADD CONSTRAINT "dashboard_verification_tokens_token_key"
  UNIQUE ("token");

ALTER TABLE "dashboard_authenticators"
  ADD CONSTRAINT "dashboard_authenticators_user_id_credential_id_key"
  UNIQUE ("user_id", "credential_id");

ALTER TABLE "dashboard_authenticators"
  ADD CONSTRAINT "dashboard_authenticators_credential_id_key"
  UNIQUE ("credential_id");

CREATE INDEX "dashboard_accounts_user_id_idx"
  ON "dashboard_accounts" ("user_id");

CREATE INDEX "dashboard_sessions_user_id_idx"
  ON "dashboard_sessions" ("user_id");

CREATE INDEX "dashboard_authenticators_user_id_idx"
  ON "dashboard_authenticators" ("user_id");

ALTER TABLE "dashboard_accounts"
  ADD CONSTRAINT "dashboard_accounts_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "dashboard_users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "dashboard_sessions"
  ADD CONSTRAINT "dashboard_sessions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "dashboard_users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "dashboard_authenticators"
  ADD CONSTRAINT "dashboard_authenticators_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "dashboard_users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
