-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "employee_id_hash" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "cost_center_hash" TEXT NOT NULL,
    "role" TEXT NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entitlements" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "resource_name" TEXT NOT NULL,
    "permission_level" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3),

    CONSTRAINT "entitlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "request_id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "response_payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("request_id")
);

-- CreateTable
CREATE TABLE "access_audit_logs" (
    "id" UUID NOT NULL,
    "request_id" TEXT NOT NULL,
    "actor_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "previous_state" JSONB NOT NULL,
    "new_state" JSONB NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "access_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_employee_id_hash_key" ON "users"("employee_id_hash");

-- CreateIndex
CREATE INDEX "entitlements_user_id_idx" ON "entitlements"("user_id");

-- CreateIndex
CREATE INDEX "access_audit_logs_request_id_idx" ON "access_audit_logs"("request_id");

-- AddForeignKey
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_audit_logs" ADD CONSTRAINT "access_audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

