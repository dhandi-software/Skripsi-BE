const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkMapping() {
  try {
    const dosesUsers = await prisma.user.findMany({
      where: { role: 'DOSEN' },
      include: { dosen: true }
    });
    console.log("Dosen Users Mapping:", JSON.stringify(dosesUsers, null, 2));

    const allDosen = await prisma.dosen.findMany();
    console.log("All Dosen Records:", JSON.stringify(allDosen, null, 2));

  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

checkMapping();
