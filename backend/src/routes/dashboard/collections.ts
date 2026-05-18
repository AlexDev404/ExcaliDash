import express from "express";
import { DashboardRouteDeps } from "./types";
import { getUserTrashCollectionId, isTrashCollectionId } from "./trash";

const normalizeCollectionPermission = (input: unknown): "view" | "edit" | null => {
  if (input === "view" || input === "edit") return input;
  return null;
};

export const registerCollectionRoutes = (
  app: express.Express,
  deps: DashboardRouteDeps
) => {
  const {
    prisma,
    requireAuth,
    asyncHandler,
    collectionNameSchema,
    sanitizeText,
    ensureTrashCollection,
    invalidateDrawingsCache,
    config,
    logAuditEvent,
  } = deps;

  // GET /collections — owned + shared (with accessLevel field)
  app.get("/collections", requireAuth, asyncHandler(async (req, res) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const trashCollectionId = getUserTrashCollectionId(req.user.id);
    await ensureTrashCollection(prisma, req.user.id);

    const [rawCollections, sharedPerms] = await Promise.all([
      prisma.collection.findMany({
        where: { userId: req.user.id },
        orderBy: { createdAt: "desc" },
      }),
      prisma.collectionPermission.findMany({
        where: { granteeUserId: req.user.id },
        include: {
          collection: true,
        },
      }),
    ]);

    const hasInternalTrash = rawCollections.some((c) => c.id === trashCollectionId);
    const ownedCollections = rawCollections
      .filter((c) => !(hasInternalTrash && c.id === "trash"))
      .map((c) =>
        c.id === trashCollectionId
          ? { ...c, id: "trash", name: "Trash", accessLevel: "owner" as const }
          : { ...c, accessLevel: "owner" as const }
      );

    const sharedCollections = sharedPerms
      .filter((p) => p.collection.userId !== req.user!.id)
      .map((p) => ({
        ...p.collection,
        accessLevel: (normalizeCollectionPermission(p.permission) ?? "view") as "view" | "edit",
        sharedBy: p.collection.userId,
      }));

    return res.json([...ownedCollections, ...sharedCollections]);
  }));

  app.post("/collections", requireAuth, asyncHandler(async (req, res) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });

    const parsed = collectionNameSchema.safeParse(req.body.name);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Validation error",
        message: "Collection name must be between 1 and 100 characters",
      });
    }

    const sanitizedName = sanitizeText(parsed.data, 100);
    const newCollection = await prisma.collection.create({
      data: { name: sanitizedName, userId: req.user.id },
    });
    return res.json({ ...newCollection, accessLevel: "owner" });
  }));

  app.put("/collections/:id", requireAuth, asyncHandler(async (req, res) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });

    const { id } = req.params;
    if (isTrashCollectionId(id, req.user.id)) {
      return res.status(400).json({
        error: "Validation error",
        message: "Trash collection cannot be renamed",
      });
    }
    const existingCollection = await prisma.collection.findFirst({
      where: { id, userId: req.user.id },
    });
    if (!existingCollection) return res.status(404).json({ error: "Collection not found" });

    const parsed = collectionNameSchema.safeParse(req.body.name);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Validation error",
        message: "Collection name must be between 1 and 100 characters",
      });
    }

    const sanitizedName = sanitizeText(parsed.data, 100);
    const updateResult = await prisma.collection.updateMany({
      where: { id, userId: req.user.id },
      data: { name: sanitizedName },
    });
    if (updateResult.count === 0) {
      return res.status(404).json({ error: "Collection not found" });
    }
    const updatedCollection = await prisma.collection.findFirst({
      where: { id, userId: req.user.id },
    });
    if (!updatedCollection) {
      return res.status(404).json({ error: "Collection not found" });
    }
    return res.json(updatedCollection);
  }));

  app.delete("/collections/:id", requireAuth, asyncHandler(async (req, res) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });

    const { id } = req.params;
    if (isTrashCollectionId(id, req.user.id)) {
      return res.status(400).json({
        error: "Validation error",
        message: "Trash collection cannot be deleted",
      });
    }
    const collection = await prisma.collection.findFirst({
      where: { id, userId: req.user.id },
    });
    if (!collection) return res.status(404).json({ error: "Collection not found" });

    await prisma.$transaction([
      prisma.drawing.updateMany({
        where: { collectionId: id, userId: req.user.id },
        data: { collectionId: null },
      }),
      prisma.collection.deleteMany({ where: { id, userId: req.user.id } }),
    ]);
    invalidateDrawingsCache();

    if (config.enableAuditLogging) {
      await logAuditEvent({
        userId: req.user.id,
        action: "collection_deleted",
        resource: `collection:${id}`,
        ipAddress: req.ip || req.connection.remoteAddress || undefined,
        userAgent: req.headers["user-agent"] || undefined,
        details: { collectionId: id, collectionName: collection.name },
      });
    }

    return res.json({ success: true });
  }));

  // ── Collection sharing ──────────────────────────────────────────────────────

  // GET /collections/:id/sharing — list who has access (owner only)
  app.get("/collections/:id/sharing", requireAuth, asyncHandler(async (req, res) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const { id } = req.params;
    const collection = await prisma.collection.findFirst({
      where: { id, userId: req.user.id },
    });
    if (!collection) return res.status(404).json({ error: "Collection not found" });

    const permissions = await prisma.collectionPermission.findMany({
      where: { collectionId: id },
      include: {
        granteeUser: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    return res.json({ permissions });
  }));

  // GET /collections/:id/share-resolve — search users to add (owner only)
  app.get("/collections/:id/share-resolve", requireAuth, asyncHandler(async (req, res) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const { id } = req.params;
    const collection = await prisma.collection.findFirst({
      where: { id, userId: req.user.id },
    });
    if (!collection) return res.status(404).json({ error: "Collection not found" });

    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (q.length < 2) return res.json({ users: [] });

    const users = await prisma.user.findMany({
      where: {
        id: { not: req.user.id },
        isActive: true,
        OR: [
          { name: { contains: q } },
          { email: { contains: q } },
          { username: { contains: q } },
        ],
      },
      select: { id: true, name: true, email: true },
      take: 10,
    });

    return res.json({ users });
  }));

  // POST /collections/:id/permissions — grant or update access (owner only)
  app.post("/collections/:id/permissions", requireAuth, asyncHandler(async (req, res) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const { id } = req.params;
    const collection = await prisma.collection.findFirst({
      where: { id, userId: req.user.id },
    });
    if (!collection) return res.status(404).json({ error: "Collection not found" });

    const { granteeUserId, permission } = req.body;
    const normalizedPerm = normalizeCollectionPermission(permission);
    if (!normalizedPerm) {
      return res.status(400).json({ error: "Invalid permission value (use view or edit)" });
    }
    if (granteeUserId === req.user.id) {
      return res.status(400).json({ error: "Cannot share a collection with yourself" });
    }

    const grantee = await prisma.user.findUnique({
      where: { id: granteeUserId },
      select: { id: true, name: true, email: true },
    });
    if (!grantee) return res.status(404).json({ error: "User not found" });

    const perm = await prisma.collectionPermission.upsert({
      where: { collectionId_granteeUserId: { collectionId: id, granteeUserId } },
      update: { permission: normalizedPerm },
      create: {
        collectionId: id,
        granteeUserId,
        permission: normalizedPerm,
        createdByUserId: req.user.id,
      },
      include: { granteeUser: { select: { id: true, name: true, email: true } } },
    });

    return res.json({ permission: perm });
  }));

  // DELETE /collections/:id/permissions/:permId — revoke access (owner only)
  app.delete("/collections/:id/permissions/:permId", requireAuth, asyncHandler(async (req, res) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const { id, permId } = req.params;
    const collection = await prisma.collection.findFirst({
      where: { id, userId: req.user.id },
    });
    if (!collection) return res.status(404).json({ error: "Collection not found" });

    await prisma.collectionPermission.deleteMany({
      where: { id: permId, collectionId: id },
    });

    return res.json({ success: true });
  }));
};
