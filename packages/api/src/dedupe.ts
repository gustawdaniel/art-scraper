import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('⚡ Starting database deduplication...');
  
  const beforeCount = await prisma.artwork.count();
  console.log(`📊 Current record count: ${beforeCount}`);

  console.log('🧹 Executing deduplication SQL query...');
  const deletedCount = await prisma.$executeRawUnsafe(`
    DELETE FROM "Artwork"
    WHERE id NOT IN (
      SELECT MIN(id)
      FROM "Artwork"
      GROUP BY "imageLink"
    );
  `);
  
  const afterCount = await prisma.artwork.count();
  console.log(`✅ Deduplication complete.`);
  console.log(`🗑️ Deleted duplicates: ${deletedCount} rows.`);
  console.log(`📊 New record count: ${afterCount}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
