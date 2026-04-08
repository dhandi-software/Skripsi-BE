const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const allAcara = await prisma.acara.findMany({
        select: { id: true, title: true }
    });
    console.log('All Acara:', JSON.stringify(allAcara, null, 2));

    const readStatuses = await prisma.acaraReadStatus.findMany({
        where: { mahasiswaId: 7 },
        select: { acaraId: true }
    });
    console.log('Read Acara IDs for Mahasiswa 7:', readStatuses.map(r => r.acaraId));
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
