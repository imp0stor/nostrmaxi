-- Epic 4: Domain + Site management
ALTER TABLE "Domain"
  ADD COLUMN IF NOT EXISTS "userId" TEXT,
  ADD COLUMN IF NOT EXISTS "lightningName" TEXT;

-- optional unique token for DNS verification
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Domain_verifyToken_key'
  ) THEN
    ALTER TABLE "Domain" ADD CONSTRAINT "Domain_verifyToken_key" UNIQUE ("verifyToken");
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Domain_userId_idx" ON "Domain"("userId");

ALTER TABLE "Domain"
  ADD CONSTRAINT "Domain_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "Site" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "domainId" TEXT NOT NULL,
  "template" TEXT NOT NULL DEFAULT 'personal',
  "config" JSONB NOT NULL DEFAULT '{}',
  "views" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Site_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Site_domainId_key" ON "Site"("domainId");
CREATE INDEX IF NOT EXISTS "Site_userId_idx" ON "Site"("userId");

ALTER TABLE "Site"
  ADD CONSTRAINT "Site_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Site"
  ADD CONSTRAINT "Site_domainId_fkey"
  FOREIGN KEY ("domainId") REFERENCES "Domain"("id") ON DELETE CASCADE ON UPDATE CASCADE;
