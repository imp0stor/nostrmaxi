-- CreateTable
CREATE TABLE "Book" (
    "id" TEXT NOT NULL,
    "authorPubkey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "coverUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "publishedAt" TIMESTAMP(3),
    "nostrEventId" TEXT,
    "totalZaps" BIGINT NOT NULL DEFAULT 0,
    "buyerCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Book_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chapter" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Chapter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Book_authorPubkey_createdAt_idx" ON "Book"("authorPubkey", "createdAt");
CREATE INDEX "Book_status_idx" ON "Book"("status");
CREATE UNIQUE INDEX "Chapter_bookId_orderIndex_key" ON "Chapter"("bookId", "orderIndex");
CREATE INDEX "Chapter_bookId_updatedAt_idx" ON "Chapter"("bookId", "updatedAt");

-- AddForeignKey
ALTER TABLE "Chapter" ADD CONSTRAINT "Chapter_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;
