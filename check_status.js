const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    const p = await prisma.pengajuanJudul.findMany();
    console.log("PengajuanJudul status:");
    console.log(p.map(x => ({nim: x.mahasiswaNim, status: x.status})));
}
main().finally(() => prisma.$disconnect());
