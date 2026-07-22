const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    const p = await prisma.pengajuanJudul.findMany({ include: { dosen: true } });
    console.log(p.slice(0,2).map(x => ({nim: x.mahasiswaNim, dosenNidn: x.dosenNidn, dosenNama: x.dosen?.nama, status: x.status})));
}
main().finally(() => prisma.$disconnect());
