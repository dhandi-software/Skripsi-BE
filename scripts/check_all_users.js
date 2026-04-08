const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAllUsers() {
  try {
    const users = await prisma.user.findMany();
    console.log("All Users:", JSON.stringify(users, null, 2));

  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

checkAllUsers();
