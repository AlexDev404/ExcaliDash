import { prisma } from "../db/prisma";
import { config } from "../config";
import { S3ImageStore } from "../storage/s3ImageStore";

const parseJsonField = <T>(rawValue: string | null | undefined, fallback: T): T => {
  if (!rawValue) return fallback;
  try {
    return JSON.parse(rawValue) as T;
  } catch {
    return fallback;
  }
};

const run = async () => {
  if (!config.s3ImageStorage.enabled) {
    throw new Error("ENABLE_S3_IMAGE_STORAGE must be true to run migration");
  }

  const store = new S3ImageStore(config.s3ImageStorage);
  if (!store.isEnabled()) {
    throw new Error("S3 image store is not enabled");
  }

  const pageSize = 100;
  let cursorId: string | null = null;
  let scanned = 0;
  let updatedDrawings = 0;
  let externalizedFiles = 0;

  while (true) {
    const batch = await prisma.drawing.findMany({
      take: pageSize,
      ...(cursorId ? { skip: 1, cursor: { id: cursorId } } : {}),
      orderBy: { id: "asc" },
      select: {
        id: true,
        files: true,
      },
    });
    if (batch.length === 0) break;

    for (const drawing of batch) {
      scanned += 1;
      const files = parseJsonField<Record<string, any>>(drawing.files, {});
      const externalized = await store.externalizeFiles(files);
      if (!externalized.changed) continue;

      await prisma.drawing.update({
        where: { id: drawing.id },
        data: {
          files: JSON.stringify(externalized.files),
        },
      });
      updatedDrawings += 1;
      externalizedFiles += externalized.changedCount;
    }

    cursorId = batch[batch.length - 1]?.id || null;
  }

  console.log(
    JSON.stringify(
      {
        success: true,
        scanned,
        updatedDrawings,
        externalizedFiles,
      },
      null,
      2
    )
  );
};

run()
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
