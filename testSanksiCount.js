const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const sanksi = await prisma.sanksiAdministrasi.findMany();
  console.log("SanksiAdministrasi:", sanksi.length);
  
  const sidang = await prisma.sidang.findMany();
  console.log("Sidang:", sidang.length);
}

main().catch(console.error).finally(() => prisma.$disconnect());
