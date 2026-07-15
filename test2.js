const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    const p = await prisma.pengajuanJudul.findMany();
    console.log('Total Pengajuan:', p.length);
    if(p.length > 0) {
        console.log('Sample:', p[0]);
    }
}

run().catch(console.error).finally(() => prisma.$disconnect());
