-- CreateTable
CREATE TABLE "NetworkAnalytics" (
    "id" TEXT NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalEvents" INTEGER NOT NULL,
    "eventsByKind" JSONB NOT NULL,
    "hourlyEvents" JSONB NOT NULL,
    "dailyEvents" JSONB NOT NULL,
    "activeUsersHour" INTEGER NOT NULL,
    "activeUsersDay" INTEGER NOT NULL,
    "activeUsersWeek" INTEGER NOT NULL,
    "totalZapSats" BIGINT NOT NULL,
    "zapCount" INTEGER NOT NULL,
    "avgZapSats" INTEGER NOT NULL,
    "topZappedPosts" JSONB NOT NULL,
    "topHashtags" JSONB NOT NULL,
    "mediaPostCount" INTEGER NOT NULL,
    "relayLatencyMs" INTEGER NOT NULL,
    "eventsPerMinute" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "NetworkAnalytics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NetworkAnalytics_computedAt_idx" ON "NetworkAnalytics"("computedAt");
