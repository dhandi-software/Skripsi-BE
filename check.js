const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const records = await prisma.sidang.findMany({ orderBy: { id: 'desc' }, take: 2 });
    console.log(JSON.stringify(records, null, 2));
}

main().finally(() => prisma.$disconnect());
