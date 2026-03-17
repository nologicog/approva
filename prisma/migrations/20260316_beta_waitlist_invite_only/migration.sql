CREATE TABLE "beta_waitlist" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "company" TEXT NOT NULL,
  "use_case" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "beta_waitlist_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "beta_waitlist_email_key" ON "beta_waitlist"("email");
CREATE INDEX "beta_waitlist_created_at_idx" ON "beta_waitlist"("created_at");
