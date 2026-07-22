const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const sidangs = await prisma.sidang.findMany({
    where: {
      status: 'TERJADWAL'
    },
    select: {
      mahasiswaNim: true,
      tanggalSidang: true
    }
  });
  console.log("Sidang TERJADWAL list:", sidangs);
}

main().catch(console.error).finally(() => prisma.$disconnect());
