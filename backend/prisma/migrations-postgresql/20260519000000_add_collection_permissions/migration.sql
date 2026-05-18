-- CreateTable
CREATE TABLE "CollectionPermission" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "granteeUserId" TEXT NOT NULL,
    "permission" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollectionPermission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CollectionPermission_collectionId_granteeUserId_key" ON "CollectionPermission"("collectionId", "granteeUserId");

-- CreateIndex
CREATE INDEX "CollectionPermission_granteeUserId_idx" ON "CollectionPermission"("granteeUserId");

-- CreateIndex
CREATE INDEX "CollectionPermission_collectionId_idx" ON "CollectionPermission"("collectionId");

-- AddForeignKey
ALTER TABLE "CollectionPermission" ADD CONSTRAINT "CollectionPermission_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionPermission" ADD CONSTRAINT "CollectionPermission_granteeUserId_fkey" FOREIGN KEY ("granteeUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
