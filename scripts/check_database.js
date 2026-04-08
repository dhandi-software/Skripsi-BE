const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkData() {
  try {
    const users = await prisma.user.findMany({
      include: {
        dosen: true,
        mahasiswa: true
      }
    });
    console.log("Users:", JSON.stringify(users, null, 2));

    const pengajuan = await prisma.pengajuanJudul.findMany();
    console.log("Pengajuan Judul:", JSON.stringify(pengajuan, null, 2));

    const sidang = await prisma.sidang.findMany();
    console.log("Sidang:", JSON.stringify(sidang, null, 2));

    const bimbingan = await prisma.bimbingan.findMany();
    console.log("Bimbingan:", JSON.stringify(bimbingan, null, 2));

  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

checkData();
