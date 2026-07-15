const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const list = await prisma.sanksiAdministrasi.findMany();
    console.log('All Sanksi:', list);
}

main().catch(console.error).finally(() => prisma.$disconnect());
