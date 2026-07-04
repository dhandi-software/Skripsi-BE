require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const mahasiswas = await prisma.mahasiswa.findMany();
    console.log("Total Mahasiswa:", mahasiswas.length);
    console.log(mahasiswas);
}

main().catch(console.error).finally(() => prisma.$disconnect());
