-- CreateExtension
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateTable
CREATE TABLE "policy_chunks" (
    "id" UUID NOT NULL,
    "document_id" TEXT NOT NULL,
    "page_number" INTEGER NOT NULL,
    "section_title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(1536) NOT NULL,

    CONSTRAINT "policy_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "policy_chunks_document_id_idx" ON "policy_chunks"("document_id");
