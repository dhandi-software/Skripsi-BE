const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const dosen = await prisma.dosen.findMany({ select: { jabatan: true }, distinct: ['jabatan'] });
    console.log(dosen);
}

main().catch(console.error).finally(() => prisma.$disconnect());
