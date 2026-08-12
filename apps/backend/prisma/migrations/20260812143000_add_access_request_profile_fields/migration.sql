-- AlterTable
ALTER TABLE "access_requests" ADD COLUMN "title" TEXT NOT NULL DEFAULT '';
ALTER TABLE "access_requests" ADD COLUMN "department" TEXT NOT NULL DEFAULT '';
ALTER TABLE "access_requests" ADD COLUMN "cost_center" TEXT NOT NULL DEFAULT '';
ALTER TABLE "access_requests" ADD COLUMN "system_name" TEXT NOT NULL DEFAULT '';

ALTER TABLE "access_requests" ALTER COLUMN "title" DROP DEFAULT;
ALTER TABLE "access_requests" ALTER COLUMN "department" DROP DEFAULT;
ALTER TABLE "access_requests" ALTER COLUMN "cost_center" DROP DEFAULT;
ALTER TABLE "access_requests" ALTER COLUMN "system_name" DROP DEFAULT;
