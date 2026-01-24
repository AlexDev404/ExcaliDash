/**
 * Data migration script for existing drawings and collections
 * This script assigns existing data to a default user
 * Run this if you have existing data before the auth migration
 */
import { PrismaClient } from '../generated/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function migrateExistingData() {
  try {
    console.log('Starting data migration...');

    // Check if there are any drawings or collections without userId
    // Note: After migration, userId is required, so this query is for pre-migration data
    // We use a raw query or check for missing userId field
    const allDrawings = await prisma.drawing.findMany({
      select: { id: true, userId: true },
    });
    const drawingsWithoutUser = allDrawings.filter((d) => !d.userId);

    const allCollections = await prisma.collection.findMany({
      select: { id: true, userId: true },
    });
    const collectionsWithoutUser = allCollections.filter((c) => !c.userId);

    if (drawingsWithoutUser.length === 0 && collectionsWithoutUser.length === 0) {
      console.log('No data to migrate. All records already have userId.');
      return;
    }

    console.log(`Found ${drawingsWithoutUser.length} drawings and ${collectionsWithoutUser.length} collections without userId`);

    // Create a default migration user
    const defaultEmail = 'migration@excalidash.local';
    const defaultPassword = await bcrypt.hash('migration-temp-password-change-me', 10);

    let migrationUser = await prisma.user.findUnique({
      where: { email: defaultEmail },
    });

    if (!migrationUser) {
      migrationUser = await prisma.user.create({
        data: {
          email: defaultEmail,
          passwordHash: defaultPassword,
          name: 'Migration User',
        },
      });
      console.log('Created migration user:', migrationUser.id);
    }

    // Update collections
    if (collectionsWithoutUser.length > 0) {
      const collectionIds = collectionsWithoutUser.map((c) => c.id);
      await prisma.collection.updateMany({
        where: {
          id: { in: collectionIds },
        },
        data: {
          userId: migrationUser.id,
        },
      });
      console.log(`Assigned ${collectionsWithoutUser.length} collections to migration user`);
    }

    // Update drawings
    if (drawingsWithoutUser.length > 0) {
      const drawingIds = drawingsWithoutUser.map((d) => d.id);
      await prisma.drawing.updateMany({
        where: {
          id: { in: drawingIds },
        },
        data: {
          userId: migrationUser.id,
        },
      });
      console.log(`Assigned ${drawingsWithoutUser.length} drawings to migration user`);
    }

    console.log('Migration completed successfully!');
    console.log(`⚠️  IMPORTANT: Change the password for user ${defaultEmail} or delete this user after assigning data to real users.`);
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

migrateExistingData();