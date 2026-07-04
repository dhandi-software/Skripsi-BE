const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "JadwalKp" RENAME COLUMN "tanggalMulai" TO "tanggal"`);
    console.log('Renamed column successfully');
  } catch (e) {
    console.error('Error renaming column:', e);
  } finally {
    await prisma.$disconnect();
  }
}
main();
