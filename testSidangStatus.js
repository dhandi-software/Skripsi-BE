const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const sidang = await prisma.sidang.groupBy({
    by: ['status'],
    _count: {
      status: true
    }
  });
  console.log("Sidang Statuses:");
  console.dir(sidang);
}

main().catch(console.error).finally(() => prisma.$disconnect());
