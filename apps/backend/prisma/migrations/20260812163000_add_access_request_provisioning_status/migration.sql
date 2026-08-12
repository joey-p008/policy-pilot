-- AlterTable
ALTER TABLE "access_requests" ADD COLUMN "provisioning_status" TEXT NOT NULL DEFAULT 'NOT_APPLICABLE';

-- Existing approved rows were granted synchronously before the grant queue
-- existed, so their downstream call has already succeeded.
UPDATE "access_requests" SET "provisioning_status" = 'PROVISIONED' WHERE "status" = 'APPROVED';

-- CreateIndex
CREATE INDEX "access_requests_provisioning_status_idx" ON "access_requests"("provisioning_status");
