-- CreateTable
CREATE TABLE "access_requests" (
    "id" UUID NOT NULL,
    "request_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "target_entitlement" TEXT NOT NULL,
    "justification" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "recommendation_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_at" TIMESTAMP(3),
    "decided_by_admin_id" TEXT,

    CONSTRAINT "access_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "access_requests_request_id_key" ON "access_requests"("request_id");

-- CreateIndex
CREATE INDEX "access_requests_status_idx" ON "access_requests"("status");
