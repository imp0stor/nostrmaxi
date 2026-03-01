-- CreateTable
CREATE TABLE "Feed" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "filterConfig" JSONB NOT NULL,
  "isPublic" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Feed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedSubscription" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "feedId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FeedSubscription_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "Feed_userId_createdAt_idx" ON "Feed"("userId", "createdAt");
CREATE UNIQUE INDEX "FeedSubscription_userId_feedId_key" ON "FeedSubscription"("userId", "feedId");
CREATE INDEX "FeedSubscription_feedId_idx" ON "FeedSubscription"("feedId");

-- Foreign Keys
ALTER TABLE "Feed" ADD CONSTRAINT "Feed_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FeedSubscription" ADD CONSTRAINT "FeedSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FeedSubscription" ADD CONSTRAINT "FeedSubscription_feedId_fkey" FOREIGN KEY ("feedId") REFERENCES "Feed"("id") ON DELETE CASCADE ON UPDATE CASCADE;
