const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkPengajuan() {
  try {
    const pengajuan = await prisma.$queryRaw`SELECT * FROM "PengajuanJudul" WHERE "mahasiswaId" = 310`;
    console.log("PENGAJUAN FOR 310:", JSON.stringify(pengajuan, null, 2));
    
    const bimbingan = await prisma.$queryRaw`SELECT * FROM "Bimbingan" WHERE "mahasiswaId" = 310`;
    console.log("BIMBINGAN FOR 310:", JSON.stringify(bimbingan, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

checkPengajuan();
