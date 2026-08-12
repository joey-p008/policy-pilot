-- CreateIndex
CREATE UNIQUE INDEX "entitlements_user_resource_permission_key" ON "entitlements"("user_id", "resource_name", "permission_level");
