-- CreateTable
CREATE TABLE "RelaySyncState" (
    "id" TEXT NOT NULL,
    "pubkey" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "lastActive" TIMESTAMP(3),
    "followerCount" INTEGER NOT NULL DEFAULT 0,
    "lastSyncedAt" TIMESTAMP(3),
    "syncStatus" TEXT NOT NULL DEFAULT 'pending',
    "eventsImported" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RelaySyncState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RelaySyncStats" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "profilesSynced" INTEGER NOT NULL,
    "notesSynced" INTEGER NOT NULL,
    "reactionsSynced" INTEGER NOT NULL,
    "zapsSynced" INTEGER NOT NULL,
    "totalEvents" INTEGER NOT NULL,
    "errors" INTEGER NOT NULL,

    CONSTRAINT "RelaySyncStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscoveredRelay" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastQueryAt" TIMESTAMP(3),
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "avgLatencyMs" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "DiscoveredRelay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RelaySyncState_pubkey_key" ON "RelaySyncState"("pubkey");

-- CreateIndex
CREATE INDEX "RelaySyncState_priority_idx" ON "RelaySyncState"("priority" DESC);

-- CreateIndex
CREATE INDEX "RelaySyncState_syncStatus_idx" ON "RelaySyncState"("syncStatus");

-- CreateIndex
CREATE INDEX "RelaySyncStats_createdAt_idx" ON "RelaySyncStats"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DiscoveredRelay_url_key" ON "DiscoveredRelay"("url");

-- CreateIndex
CREATE INDEX "DiscoveredRelay_isActive_idx" ON "DiscoveredRelay"("isActive");

-- CreateIndex
CREATE INDEX "DiscoveredRelay_successCount_avgLatencyMs_idx" ON "DiscoveredRelay"("successCount", "avgLatencyMs");
