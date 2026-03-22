const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function main() {
  const m = await prisma.mahasiswa.findFirst({
    where: { pengajuanJudul: { some: { status: 'REJECTED' } } },
    include: { pengajuanJudul: { orderBy: { tanggal: 'desc' } } }
  });
  fs.writeFileSync('out.json', JSON.stringify(m, null, 2), 'utf8');
}

main().catch(console.error).finally(() => prisma.$disconnect());
