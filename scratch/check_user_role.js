const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUser() {
  try {
    const user = await prisma.$queryRaw`
      SELECT u.id, u.role, d.id as "dosenId", d.nama 
      FROM "User" u 
      JOIN "Dosen" d ON u.id = d."userId" 
      WHERE d.id = 2
    `;
    console.log("USER FOR DOSEN 2:", JSON.stringify(user, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

checkUser();
