const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const users = await prisma.user.findMany();
    console.log('Total users:', users.length);
    console.log('Users:', JSON.stringify(users, null, 2));
  } catch (e) {
    console.error('Error fetching users:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
